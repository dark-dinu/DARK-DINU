// High-Speed In-Memory Hash Maps (Zero DB Read Bottleneck)
global.autoReplyCache = global.autoReplyCache || new Map();
global.autoReplyStatus = global.autoReplyStatus || new Map();
global.autoReplyHookedSockets = global.autoReplyHookedSockets || new WeakSet();

// Static O(1) Owner Validation Table
const DEV_PHONE_SET = new Set(["94719845166", "15947733680169"]);

// Fast phone extraction helper
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  if (msg.key.fromMe) return true;

  const senderJid = msg.key.participant || msg.participant || from || "";
  const senderPhone = fastExtractPhone(senderJid);

  return senderPhone === botPhone || DEV_PHONE_SET.has(senderPhone);
}

// Background Non-blocking MongoDB Sync Engine (Zero lag for users)
function syncToDatabase(botPhone, replies, enabled, dbName) {
  setImmediate(async () => {
    try {
      const client = global.mongoClient || global.sharedMongoClient;
      if (!client) return;
      const db = client.db(dbName || "whatsapp_multi_bots");
      const col = db.collection("custom_autoreplies");

      const objData = Object.fromEntries(replies);
      await col.updateOne(
        { botPhone },
        { $set: { botPhone, replies: objData, enabled } },
        { upsert: true }
      );
    } catch (_) {}
  });
}

// Fast In-Memory Loader
async function loadBotReplies(botPhone, config) {
  if (global.autoReplyCache.has(botPhone)) {
    return global.autoReplyCache.get(botPhone);
  }

  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db(config?.DB_NAME || "whatsapp_multi_bots");
      const col = db.collection("custom_autoreplies");
      const record = await col.findOne({ botPhone });

      const repliesMap = new Map();
      if (record?.replies) {
        for (const [k, v] of Object.entries(record.replies)) {
          repliesMap.set(k.toLowerCase().trim(), v);
        }
      }
      global.autoReplyCache.set(botPhone, repliesMap);
      global.autoReplyStatus.set(botPhone, record?.enabled ?? true);
      return repliesMap;
    }
  } catch (_) {}

  const fallbackMap = new Map();
  global.autoReplyCache.set(botPhone, fallbackMap);
  global.autoReplyStatus.set(botPhone, true);
  return fallbackMap;
}

// Low-latency message interceptor
export function attachAutoReplyEngine(sock, appConfig) {
  if (!sock || global.autoReplyHookedSockets.has(sock)) return;
  global.autoReplyHookedSockets.add(sock);

  const botPhone = getBotPhone(sock);
  if (botPhone) loadBotReplies(botPhone, appConfig);

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const chatJid = m.key.remoteJid;
    if (!chatJid || chatJid === "status@broadcast") return;

    const currentPhone = getBotPhone(sock);
    const isEnabled = global.autoReplyStatus.get(currentPhone) ?? true;
    if (!isEnabled) return;

    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const textBody = (
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      rawMsg.imageMessage?.caption ||
      rawMsg.videoMessage?.caption ||
      ""
    ).trim().toLowerCase();

    const prefix = appConfig?.PREFIX || ".";
    if (!textBody || textBody.startsWith(prefix)) return;

    const replies = global.autoReplyCache.get(currentPhone);
    if (!replies || replies.size === 0) return;

    // Fast-Path 1: Exact Hash Match (O(1) Speed)
    let matchedReply = replies.get(textBody);

    // Fast-Path 2: Token Word Match (Sub-millisecond)
    if (!matchedReply) {
      const words = textBody.split(/\s+/);
      for (const word of words) {
        if (replies.has(word)) {
          matchedReply = replies.get(word);
          break;
        }
      }
    }

    if (matchedReply) {
      sock.sendMessage(chatJid, { text: matchedReply }, { quoted: m }).catch(() => {});
    }
  });
}

export default {
  name: "autoreply",
  aliases: ["addmsg", "delmsg", "allmsg", "replylist"],
  category: "owner",
  description: "Cute & lightning fast auto-reply manager",

  async execute({ sock, msg, from, args, body, config, prefix }) {
    attachAutoReplyEngine(sock, config);

    const botPhone = getBotPhone(sock);
    const dbName = config?.DB_NAME || "whatsapp_multi_bots";

    // Owner Guard
    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my sweet master can configure auto-replies!* 🌸" },
        { quoted: msg }
      );
    }

    const replies = await loadBotReplies(botPhone, config);
    const isEnabled = global.autoReplyStatus.get(botPhone) ?? true;

    const fullBody = body.trim().slice(prefix.length).trim();
    const commandTrigger = fullBody.split(/\s+/)[0].toLowerCase();

    // 1. Add Custom Reply (.addmsg <trigger>,<reply>)
    if (commandTrigger === "addmsg") {
      const content = args.join(" ").trim();
      const splitIdx = content.indexOf(",");

      if (splitIdx === -1) {
        sock.sendMessage(from, { react: { text: "🍬", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `✨ *Cute Usage:* \`${prefix}addmsg trigger_word, your sweet reply\`` },
          { quoted: msg }
        );
      }

      const triggerWord = content.slice(0, splitIdx).trim().toLowerCase();
      const replyMessage = content.slice(splitIdx + 1).trim();

      if (!triggerWord || !replyMessage) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Oopsie!* Both trigger word and reply message are needed, honey~" },
          { quoted: msg }
        );
      }

      replies.set(triggerWord, replyMessage);
      global.autoReplyCache.set(botPhone, replies);
      syncToDatabase(botPhone, replies, isEnabled, dbName);

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *Sweet!* Saved auto-reply for \`${triggerWord}\` ➔ "${replyMessage}" ✨` },
        { quoted: msg }
      );
    }

    // 2. Delete Reply (.delmsg <trigger>)
    if (commandTrigger === "delmsg") {
      const triggerWord = args.join(" ").trim().toLowerCase();
      if (!triggerWord || !replies.has(triggerWord)) {
        sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🍬 *No reply found* for keyword \`${triggerWord || "..."}\` sweetheart~` },
          { quoted: msg }
        );
      }

      replies.delete(triggerWord);
      global.autoReplyCache.set(botPhone, replies);
      syncToDatabase(botPhone, replies, isEnabled, dbName);

      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🧹 *Removed:* Cleared auto-reply for \`${triggerWord}\` softly.` },
        { quoted: msg }
      );
    }

    // 3. List All Saved Replies (.allmsg / .replylist)
    if (commandTrigger === "allmsg" || commandTrigger === "replylist") {
      if (replies.size === 0) {
        return await sock.sendMessage(
          from,
          { text: "📭 *No custom replies saved yet, darling!* 🌸" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *ACTIVE AUTO-REPLIES* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let i = 1;
      for (const [k, v] of replies.entries()) {
        listText += `  🌸 *${i++}.* \`${k}\` ➔ ${v}\n`;
      }
      listText += `\n━━━━━━━━━━━━━━━━━━━━━\n💖 *Total:* ${replies.size} triggers active ✨`;

      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // 4. Toggle On / Off (.autoreply on / off)
    const stateArg = args[0]?.toLowerCase().trim();
    if (stateArg === "on" || stateArg === "off") {
      const isTurnOn = stateArg === "on";
      global.autoReplyStatus.set(botPhone, isTurnOn);
      syncToDatabase(botPhone, replies, isTurnOn, dbName);

      sock.sendMessage(from, { react: { text: isTurnOn ? "💖" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *Auto-Reply Engine is now:* *${isTurnOn ? "ACTIVE & LISTENING ✨" : "SLEEPING SOFTLY 💤"}*`
        },
        { quoted: msg }
      );
    }

    // Help Panel
    sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *AUTO-REPLY MANAGER* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  • *${prefix}addmsg <word>,<reply>* — Save new trigger ✨
  • *${prefix}delmsg <word>* — Remove trigger 🗑️
  • *${prefix}allmsg* — View all triggers 📑
  • *${prefix}autoreply on/off* — Turn system on or off ⚙️

  ✨ *Current Status:* ${isEnabled ? "🟢 ACTIVE" : "🔴 DISABLED"}
  📊 *Stored Replies:* ${replies.size} phrases

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
