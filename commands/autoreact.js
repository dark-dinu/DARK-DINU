// Per-Bot Auto React Settings Cache
global.autoReactSettings = global.autoReactSettings || new Map();
global.autoReactHookedSockets = global.autoReactHookedSockets || new WeakSet();

// Reaction Emojis Pool
const EMOJI_LIST = [
  "❤️", "🔥", "✨", "🤍", "🖤", "💯", "🌸", "⚡", "🥰", 
  "😎", "🥺", "😇", "🕊️", "🦋", "💥", "🌹", "🎉", "👑"
];

function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

function getReactConfig(botPhone) {
  if (!global.autoReactSettings.has(botPhone)) {
    global.autoReactSettings.set(botPhone, {
      enabled: false,
      target: "all" // all | group | inbox
    });
  }
  return global.autoReactSettings.get(botPhone);
}

function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

  const devNumbers = ["94719845166", "15947733680169"];
  return msg.key.fromMe || senderPhone === botPhone || devNumbers.includes(senderPhone);
}

// Background Listener Engine (Ultra-Fast & Non-Blocking)
function attachAutoReactEngine(sock) {
  if (!sock || global.autoReactHookedSockets.has(sock)) return;
  global.autoReactHookedSockets.add(sock);

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;

    for (const m of messages) {
      if (!m?.message || m.key.fromMe) continue; // බොට්ගේම මැසේජ් skip කර speed වැඩි කරයි

      const chatJid = m.key.remoteJid;
      if (!chatJid || chatJid === "status@broadcast") continue;

      const botPhone = getBotPhone(sock);
      const config = getReactConfig(botPhone);
      if (!config.enabled) continue;

      const isGroup = chatJid.endsWith("@g.us");

      // Target filter
      if (config.target === "group" && !isGroup) continue;
      if (config.target === "inbox" && isGroup) continue;

      // Random Emoji Reaction (Non-blocking background send)
      const randomEmoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
      sock.sendMessage(chatJid, {
        react: {
          text: randomEmoji,
          key: m.key
        }
      }).catch(() => {});
    }
  });
}

// Optimized Cluster Watcher (තත්පර 20කට වරක් පමණක් Check වේ)
if (!global.autoReactIntervalStarted) {
  global.autoReactIntervalStarted = true;
  setInterval(() => {
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        attachAutoReactEngine(s);
      }
    }
  }, 20000);
}

export default {
  name: "autoreact",
  aliases: ["areact", "autoreaction"],
  category: "utility",
  description: "Auto react to incoming messages in Group or Inbox",

  async execute({ sock, msg, from, args, config }) {
    attachAutoReactEngine(sock);

    const prefix = config?.PREFIX || ".";
    const botPhone = getBotPhone(sock);
    const reactSettings = getReactConfig(botPhone);

    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "⛔ *ACCESS DENIED:* මෙම setting එක වෙනස් කළ හැක්කේ Bot Owner ට පමණි." },
        { quoted: msg }
      );
    }

    const state = args[0]?.toLowerCase().trim();
    const scope = args[1]?.toLowerCase().trim();

    // 1. On / Off Handlers
    if (state === "on" || state === "off") {
      const isEnable = state === "on";
      reactSettings.enabled = isEnable;

      if (isEnable && scope) {
        if (["group", "grp"].includes(scope)) reactSettings.target = "group";
        else if (["inbox", "dm", "ib"].includes(scope)) reactSettings.target = "inbox";
        else reactSettings.target = "all";
      }

      global.autoReactSettings.set(botPhone, reactSettings);
      sock.sendMessage(from, { react: { text: isEnable ? "💖" : "🔒", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 💖 *AUTO REACT SYSTEM* 〕
├─▸ 🤖 *Bot Node* : +${botPhone}
├─▸ ⚡ *Status*   : ${isEnable ? "🟢 ACTIVATED" : "🔴 DISABLED"}
├─▸ 🎯 *Scope*    : \`${reactSettings.target.toUpperCase()}\`
└───────────────────────

${isEnable ? "දැන් ලැබෙන සියලුම පණිවිඩ වලට Auto React වැටෙනු ඇත." : "Auto React පහසුකම අක්‍රීය කරන ලදී."}`
        },
        { quoted: msg }
      );
    }

    // 2. Direct Scope Handlers
    if (["group", "inbox", "all"].includes(state)) {
      reactSettings.target = state;
      reactSettings.enabled = true;
      global.autoReactSettings.set(botPhone, reactSettings);

      sock.sendMessage(from, { react: { text: "⚙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `✅ *Auto React Scope යාවත්කාලීන විය:*\n\n🎯 *Scope:* \`${state.toUpperCase()}\`\n⚡ *Status:* 🟢 ACTIVATED`
        },
        { quoted: msg }
      );
    }

    return await sock.sendMessage(
      from,
      {
        text: `⚠️ *භාවිතය:*\n• \`${prefix}autoreact on\` - සියලුම chats සඳහා සක්‍රීය කිරීමට\n• \`${prefix}autoreact on group\` - Groups වලට පමණක්\n• \`${prefix}autoreact on inbox\` - Inbox වලට පමණක්\n• \`${prefix}autoreact off\` - අක්‍රීය කිරීමට\n\n*වත්මන් තත්ත්වය:* ${reactSettings.enabled ? "🟢 ON" : "🔴 OFF"} | Scope: \`${reactSettings.target.toUpperCase()}\``
      },
      { quoted: msg }
    );
  }
};
