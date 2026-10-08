import { MongoClient } from "mongodb";

// Static Developer Lookup Table (O(1) Memory Set)
const DEV_SET = new Set(["94719845166", "15947733680169"]);

// In-Memory Fast Cache Store
global.botSettingsStore = global.botSettingsStore || new Map();
global.settingsHookedSockets = global.settingsHookedSockets || new WeakSet();

// Fast sub-nanosecond telephone extractor
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

function getDbInstance(appConfig) {
  const client = global.mongoClient || global.sharedMongoClient;
  if (!client) return null;
  return client.db(appConfig?.DB_NAME || "whatsapp_multi_bots");
}

// 1. Fast Memory Cache with Background Fallback
async function loadBotConfig(botPhone, config) {
  if (global.botSettingsStore.has(botPhone)) {
    return global.botSettingsStore.get(botPhone);
  }

  const defaultSettings = {
    botPhone,
    mode: "public",
    antiSend: "off",
    antiDelete: true,
    statusSeen: true,
    statusReact: true,
    statusEmoji: "💖"
  };

  try {
    const db = getDbInstance(config);
    if (db) {
      const col = db.collection("cluster_settings");
      const savedData = await col.findOne({ botPhone });
      if (savedData) {
        delete savedData._id;
        const merged = { ...defaultSettings, ...savedData };
        global.botSettingsStore.set(botPhone, merged);
        return merged;
      } else {
        await col.insertOne(defaultSettings);
      }
    }
  } catch (err) {
    console.error("[DB Settings Fetch Error]:", err.message);
  }

  global.botSettingsStore.set(botPhone, defaultSettings);
  return defaultSettings;
}

// 2. Non-blocking Asynchronous DB Persistence
function saveBotConfig(botPhone, newSettings, config) {
  global.botSettingsStore.set(botPhone, newSettings);
  setImmediate(async () => {
    try {
      const db = getDbInstance(config);
      if (db) {
        const col = db.collection("cluster_settings");
        await col.updateOne(
          { botPhone },
          { $set: newSettings },
          { upsert: true }
        );
      }
    } catch (err) {
      console.error("[DB Settings Save Error]:", err.message);
    }
  });
}

function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  if (msg.key.fromMe) return true;

  const senderJid = msg.key.participant || msg.participant || from || "";
  const cleanSender = fastExtractPhone(senderJid);

  return cleanSender === botPhone || DEV_SET.has(cleanSender);
}

// Low-latency Interceptor Engine
export function attachSettingsEngine(sock, appConfig) {
  if (!sock || global.settingsHookedSockets.has(sock)) return;
  global.settingsHookedSockets.add(sock);

  const botPhone = getBotPhone(sock);
  if (botPhone) loadBotConfig(botPhone, appConfig);

  // Fast-Path Mode Check
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const currentPhone = getBotPhone(sock);
    const settings = global.botSettingsStore.get(currentPhone) || await loadBotConfig(currentPhone, appConfig);

    const isGroup = from.endsWith("@g.us");
    const sender = isGroup
      ? (m.key.participant || m.participant || from)
      : (m.key.fromMe ? (sock.user?.id || from) : from);
    const cleanSender = fastExtractPhone(sender);

    const isOwner = m.key.fromMe || cleanSender === currentPhone || DEV_SET.has(cleanSender);

    if (!isOwner) {
      if (settings.mode === "private") {
        m.message = null;
        return;
      }
      if (settings.mode === "group" && !isGroup) {
        m.message = null;
        return;
      }
      if (settings.mode === "inbox" && isGroup) {
        m.message = null;
        return;
      }
    }
  });

  // Anti-Send Engine
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      if (!m?.message) continue;
      const chatJid = m.key.remoteJid;
      if (!chatJid || chatJid === "status@broadcast") continue;

      const currentPhone = getBotPhone(sock);
      const settings = global.botSettingsStore.get(currentPhone);
      if (!settings || settings.antiSend === "off") continue;

      if ((settings.antiSend === "me" || settings.antiSend === "all") && m.key.fromMe) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }
      if ((settings.antiSend === "from" || settings.antiSend === "all") && !m.key.fromMe) {
        await sock.sendMessage(chatJid, { delete: m.key }).catch(() => {});
      }
    }
  });
}

export default {
  name: "setting",
  aliases: ["settings", "botmode", "mode", "antisend", "config"],
  category: "owner",
  description: "Cute & fast persistent cluster settings manager",

  async execute({ sock, msg, from, args, body, config: botAppConfig }) {
    attachSettingsEngine(sock, botAppConfig);

    const prefix = botAppConfig?.PREFIX || ".";
    const botPhone = getBotPhone(sock);
    const settings = await loadBotConfig(botPhone, botAppConfig);

    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my sweet master can change bot configurations!* 🌸" },
        { quoted: msg }
      );
    }

    const fullBody = body.trim().slice(prefix.length).trim();
    const commandTrigger = fullBody.split(/\s+/)[0].toLowerCase();

    // 1. Anti-Send Controller (.antisend me / from / all / off)
    if (commandTrigger === "antisend") {
      const modeArg = args[0]?.toLowerCase().trim();
      if (!["me", "from", "all", "off"].includes(modeArg)) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *ANTI-SEND OPTIONS* ୧┈•ﾟ｡ 🐾

  • *${prefix}antisend me*   ➔ Auto-delete messages sent by me
  • *${prefix}antisend from* ➔ Auto-delete incoming messages
  • *${prefix}antisend all*  ➔ Auto-delete all messages
  • *${prefix}antisend off*  ➔ Disable anti-send

  ⚙️ *Current Mode:* \`${settings.antiSend.toUpperCase()}\`
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      settings.antiSend = modeArg;
      saveBotConfig(botPhone, settings, botAppConfig);

      sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `✨ *Anti-Send Updated!* Active mode set to: \`${modeArg.toUpperCase()}\` softly. 🌸`
        },
        { quoted: msg }
      );
    }

    // 2. Mode Controller (.mode public / private / group / inbox)
    if (commandTrigger === "mode" || commandTrigger === "botmode") {
      let modeArg = args[0]?.toLowerCase().trim();

      if (modeArg === "privet" || modeArg === "prv" || modeArg === "pvt") modeArg = "private";
      else if (modeArg === "pub" || modeArg === "pbl") modeArg = "public";
      else if (modeArg === "grp" || modeArg === "groups") modeArg = "group";
      else if (modeArg === "dm" || modeArg === "ib") modeArg = "inbox";

      if (!["public", "private", "group", "inbox"].includes(modeArg)) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *BOT WORK MODES* ୧┈•ﾟ｡ 🐾

  • *${prefix}mode public*  ➔ Open to all users & chats 🌐
  • *${prefix}mode private* ➔ Only respond to owner 🔒
  • *${prefix}mode group*   ➔ Active only in groups 👥
  • *${prefix}mode inbox*   ➔ Active only in direct messages 💌

  ⚙️ *Current Mode:* \`${settings.mode.toUpperCase()}\`
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      settings.mode = modeArg;
      saveBotConfig(botPhone, settings, botAppConfig);

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *Bot Mode Updated!* Successfully shifted to \`${modeArg.toUpperCase()}\` mode sweetly~ ✨`
        },
        { quoted: msg }
      );
    }

    // 3. Status & Anti-Delete Sync Toggles
    const subAction = args[0]?.toLowerCase();
    const subVal = args[1]?.toLowerCase();

    if (subAction === "antidel") {
      const state = subVal === "on";
      settings.antiDelete = state;
      global.antiDeleteSettings?.set(botPhone, state);
      saveBotConfig(botPhone, settings, botAppConfig);

      sock.sendMessage(from, { react: { text: state ? "🛡️" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *Anti-Delete Guardian:* *${state ? "ACTIVATED 🛡️✨" : "DISABLED 💤"}*` },
        { quoted: msg }
      );
    }

    if (subAction === "stseen") {
      const state = subVal === "on";
      settings.statusSeen = state;
      if (global.statusSettings?.get(botPhone)) global.statusSettings.get(botPhone).seen = state;
      saveBotConfig(botPhone, settings, botAppConfig);

      sock.sendMessage(from, { react: { text: state ? "👁️" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *Status Auto-Seen:* *${state ? "ACTIVATED 👁️✨" : "DISABLED 💤"}*` },
        { quoted: msg }
      );
    }

    if (subAction === "stract") {
      const state = subVal === "on";
      settings.statusReact = state;
      if (global.statusSettings?.get(botPhone)) global.statusSettings.get(botPhone).react = state;
      saveBotConfig(botPhone, settings, botAppConfig);

      sock.sendMessage(from, { react: { text: state ? "💖" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *Status Auto-React:* *${state ? "ACTIVATED 💖✨" : "DISABLED 💤"}*` },
        { quoted: msg }
      );
    }

    // 4. Main Cute Configuration Dashboard
    sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});

    const dashboardCard = 
`🎀 ｡ﾟ•┈୨ *SETTINGS & CONTROL* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  📱 *Bot Instance:* \`+${botPhone}\`
  🎯 *Working Mode:* \`${settings.mode.toUpperCase()}\`
  🚫 *Anti-Send:* \`${settings.antiSend.toUpperCase()}\`
  🛡️ *Anti-Delete:* ${settings.antiDelete ? "🟢 ON" : "🔴 OFF"}
  👁️ *Status Seen:* ${settings.statusSeen ? "🟢 ON" : "🔴 OFF"}
  💖 *Status React:* ${settings.statusReact ? "🟢 ON" : "🔴 OFF"}
  🍭 *React Symbol:* ${settings.statusEmoji}
  💾 *Database Sync:* 🟢 Cloud Memory

━━━━━━━━━━━━━━━━━━━━━━
🍬 *QUICK CONTROL COMMANDS*
  • *${prefix}mode <public|private|group|inbox>*
  • *${prefix}antisend <me|from|all|off>*
  • *${prefix}setting antidel <on|off>*
  • *${prefix}setting stseen <on|off>*
  • *${prefix}setting stract <on|off>*

━━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: dashboardCard }, { quoted: msg });
  }
};
