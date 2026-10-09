import { cleanPhone, initializeSessionState, updateSessionConfig, getSessionConfig } from "../core/sessionManager.js";

// ==========================================
// 1. CONFIGURATION & MASTER ACCESS
// ==========================================
const DEV_NUMBERS = new Set(["94719845166", "15947733680169"]);
global.settingsHookedSockets = global.settingsHookedSockets || new WeakSet();

// Developer / Owner Verification Check
function checkAuthorization(sock, msg, from, botPhone) {
  if (msg.key.fromMe) return true;
  const senderJid = msg.key.participant || msg.participant || from || "";
  const cleanSender = cleanPhone(senderJid);
  return cleanSender === botPhone || DEV_NUMBERS.has(cleanSender);
}

// ==========================================
// 2. BACKGROUND REAL-TIME ENGINE (LISTENERS)
// ==========================================
export function attachSettingsEngine(sock) {
  // Prevent duplicate hooks on reconnection (Memory Leak Shield)
  if (!sock || global.settingsHookedSockets.has(sock)) return;
  global.settingsHookedSockets.add(sock);

  const botPhone = cleanPhone(sock.user?.id || "");
  if (botPhone) initializeSessionState(botPhone);

  // Unified Single Message Upsert Handler (Fast & Clean)
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
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

    // [A] Mode Barrier (Public, Private, Group, Inbox)
    if (!isOwner) {
      if (cfg.mode === "private") return;
      if (cfg.mode === "group" && !isGroup) return;
      if (cfg.mode === "inbox" && isGroup) return;
    }

    // [B] Anti-Send Engine (Automatic Message Deletion)
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

  // [C] Anti-Call Rejection Barrier
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
// 3. MAIN COMMAND HANDLER & TOGGLES
// ==========================================
export default {
  name: "setting",
  aliases: ["settings", "mode", "botmode", "antisend", "config"],
  category: "owner",
  description: "Session-locked isolated bot settings panel",

  async execute({ sock, msg, from, args, body, prefix, config: botConfig }) {
    attachSettingsEngine(sock);

    const pref = prefix || botConfig?.PREFIX || ".";
    const botPhone = cleanPhone(sock.user?.id || "");
    const settings = getSessionConfig(botPhone);

    // Permission Verification
    if (!checkAuthorization(sock, msg, from, botPhone)) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔒 *මෙම Bot Session එකේ සැකසුම් වෙනස් කළ හැක්කේ Developer හෝ Owner ට පමණි!*" },
        { quoted: msg }
      );
    }

    const fullBody = (body || "").trim().slice(pref.length).trim();
    const cmd = fullBody.split(/\s+/)[0].toLowerCase();
    const opt = args[0]?.toLowerCase()?.trim();
    const val = args[1]?.toLowerCase()?.trim();

    // --- Action A: Bot Mode Management (.mode public|private|group|inbox) ---
    if (cmd === "mode" || (cmd === "setting" && opt === "mode")) {
      const modeArg = cmd === "mode" ? opt : val;
      const validModes = ["public", "private", "group", "inbox"];

      if (validModes.includes(modeArg)) {
        await updateSessionConfig(botPhone, "mode", modeArg);
        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🎯 *Bot Mode යාවත්කාලීන විය:* \`${modeArg.toUpperCase()}\` Mode එකට මාරු කරන ලදී.` },
          { quoted: msg }
        );
      }
    }

    // --- Action B: Anti-Send Management (.antisend me|from|all|off) ---
    if (cmd === "antisend" || (cmd === "setting" && opt === "antisend")) {
      const antiSendArg = cmd === "antisend" ? opt : val;
      const validAntiSend = ["me", "from", "all", "off"];

      if (validAntiSend.includes(antiSendArg)) {
        await updateSessionConfig(botPhone, "antiSend", antiSendArg);
        sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🛡️ *Anti-Send යාවත්කාලීන විය:* \`${antiSendArg.toUpperCase()}\`` },
          { quoted: msg }
        );
      }
    }

    // --- Action C: Feature Toggles (ON / OFF) ---
    const toggleFeatures = {
      antidel: "antiDelete",
      stseen: "statusSeen",
      stract: "statusReact",
      autoreply: "autoReply",
      welcome: "welcomeCard",
      anticall: "antiCall"
    };

    if (opt && toggleFeatures[opt]) {
      const targetConfigKey = toggleFeatures[opt];
      let newState = !settings[targetConfigKey];

      if (val === "on") newState = true;
      if (val === "off") newState = false;

      await updateSessionConfig(botPhone, targetConfigKey, newState);
      sock.sendMessage(from, { react: { text: newState ? "🟢" : "🔴", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `⚙️ *${opt.toUpperCase()}:* ${newState ? "ක්‍රියාත්මකයි (ON) 🟢" : "අක්‍රියයි (OFF) 🔴"}` },
        { quoted: msg }
      );
    }

    // --- Action D: Custom Status Emoji Update ---
    if (opt === "emoji" && args[1]) {
      const selectedEmoji = args[1].trim();
      await updateSessionConfig(botPhone, "statusEmoji", selectedEmoji);
      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `💖 *Status React Emoji එක:* ${selectedEmoji} ලෙස සකසන ලදී.` },
        { quoted: msg }
      );
    }

    // ==========================================
    // 4. MASTER CONTROL DASHBOARD UI
    // ==========================================
    sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});

    const dashboardCard = 
`🎛️ ｡ﾟ•┈୨ *DARK-DINU MD ENGINE SETTINGS* ୧┈•ﾟ｡ ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━

📱 *Session ID:* \`+${botPhone}\`
🔒 *Isolation:* \`MongoDB Session-Locked\`

┌─〔 ⚙️ *වත්මන් සැකසුම් (STATUS)* 〕
├─▸ 🎯 *Mode*         : \`${settings.mode ? settings.mode.toUpperCase() : "PUBLIC"}\`
├─▸ 🛡️ *Anti-Delete*  : ${settings.antiDelete ? "🟢 ON" : "🔴 OFF"}
├─▸ 👁️ *Status Seen*  : ${settings.statusSeen ? "🟢 ON" : "🔴 OFF"}
├─▸ 💖 *Status React* : ${settings.statusReact ? "🟢 ON" : "🔴 OFF"} [ ${settings.statusEmoji || "❤️"} ]
├─▸ 💬 *Auto-Reply*   : ${settings.autoReply ? "🟢 ON" : "🔴 OFF"}
├─▸ 💌 *Welcome Card* : ${settings.welcomeCard ? "🟢 ON" : "🔴 OFF"}
├─▸ 🚫 *Anti-Send*    : \`${settings.antiSend ? settings.antiSend.toUpperCase() : "OFF"}\`
├─▸ 📵 *Anti-Call*    : ${settings.antiCall ? "🟢 ON" : "🔴 OFF"}
└────────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *භාවිතා කළ හැකි විධාන:*
  • \`${pref}mode <public|private|group|inbox>\`
  • \`${pref}setting antidel on/off\`
  • \`${pref}setting stseen on/off\`
  • \`${pref}setting stract on/off\`
  • \`${pref}setting autoreply on/off\`
  • \`${pref}setting anticall on/off\`
  • \`${pref}setting antisend <me|from|all|off>\`
  • \`${pref}setting emoji <emoji>\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: dashboardCard }, { quoted: msg });
  }
};
