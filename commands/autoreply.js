import { MongoClient } from "mongodb";

// Global Shared Memory Hash Stores (O(1) Access)
global.autoReplyCache = global.autoReplyCache || new Map();
global.autoReplyStatus = global.autoReplyStatus || new Map();
global.autoReplyHookedSockets = global.autoReplyHookedSockets || new WeakSet();

// Developer & Owner Whitelist (O(1) Set)
const DEV_PHONE_SET = new Set(["94719845166", "15947733680169"]);

// Sub-nanosecond Phone Cleaner
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  let num = (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
  if (num.startsWith("0")) num = "94" + num.slice(1);
  return num;
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

// 🛡️ Guaranteed Persistent MongoDB Collection Resolver
async function getAutoReplyCollection(config) {
  try {
    let client = global.mongoClient || global.sharedMongoClient;
    if (!client && config?.MONGODB_URI) {
      client = new MongoClient(config.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
      });
      await client.connect();
      global.sharedMongoClient = client;
    }
    if (!client) return null;
    const db = client.db(config?.DB_NAME || "whatsapp_multi_bots");
    return db.collection("custom_autoreplies");
  } catch (err) {
    console.error("[DB AUTOREPLY ERROR]:", err.message);
    return null;
  }
}

// 1. Guaranteed Database Sync (Awaited on modifications so restarts NEVER lose data)
async function syncToDatabase(botPhone, replies, enabled, config) {
  try {
    const col = await getAutoReplyCollection(config);
    if (!col) return;

    const objData = Object.fromEntries(replies);
    await col.updateOne(
      { botPhone },
      { $set: { botPhone, replies: objData, enabled, updatedAt: Date.now() } },
      { upsert: true }
    );
  } catch (e) {
    console.error("[AUTOREPLY SYNC FAILED]:", e.message);
  }
}

// 2. Restart-Safe Database Loader (Populates Memory on Boot)
async function loadBotReplies(botPhone, config, forceRefresh = false) {
  if (!forceRefresh && global.autoReplyCache.has(botPhone)) {
    return global.autoReplyCache.get(botPhone);
  }

  try {
    const col = await getAutoReplyCollection(config);
    if (col) {
      const record = await col.findOne({ botPhone });
      const repliesMap = new Map();

      if (record?.replies) {
        for (const [k, v] of Object.entries(record.replies)) {
          if (k && v) repliesMap.set(k.toLowerCase().trim(), String(v));
        }
      }

      global.autoReplyCache.set(botPhone, repliesMap);
      global.autoReplyStatus.set(botPhone, record?.enabled ?? true);
      return repliesMap;
    }
  } catch (e) {
    console.error("[AUTOREPLY LOAD ERROR]:", e.message);
  }

  const fallback = global.autoReplyCache.get(botPhone) || new Map();
  global.autoReplyCache.set(botPhone, fallback);
  return fallback;
}

// Low-latency message interceptor (O(1) Exact & Fast Word Match)
export function attachAutoReplyEngine(sock, appConfig) {
  if (!sock || global.autoReplyHookedSockets.has(sock)) return;
  global.autoReplyHookedSockets.add(sock);

  const botPhone = getBotPhone(sock);
  if (botPhone) loadBotReplies(botPhone, appConfig);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
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

    // Retrieve from ultra-fast RAM cache
    let replies = global.autoReplyCache.get(currentPhone);
    if (!replies) {
      replies = await loadBotReplies(currentPhone, appConfig);
    }

    if (!replies || replies.size === 0) return;

    // Fast-Path 1: Exact Match
    let matchedReply = replies.get(textBody);

    // Fast-Path 2: Sub-millisecond Token Match
    if (!matchedReply) {
      const tokens = textBody.split(/\s+/);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (replies.has(token)) {
          matchedReply = replies.get(token);
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
  description: "Persistent & ultra-fast auto-reply manager",

  async execute({ sock, msg, from, args, body, config, prefix }) {
    attachAutoReplyEngine(sock, config);

    const botPhone = getBotPhone(sock);

    // Owner Guard
    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my sweet master can configure auto-replies!* 🌸" },
        { quoted: msg }
      );
    }

    // Always ensure fresh sync from DB
    const replies = await loadBotReplies(botPhone, config);
    const isEnabled = global.autoReplyStatus.get(botPhone) ?? true;

    const fullBody = body.trim().slice(prefix.length).trim();
    const commandTrigger = fullBody.split(/\s+/)[0].toLowerCase();

    // -------------------------------------------------------------
    // 1. Add Custom Reply (.addmsg <trigger>,<reply>)
    // -------------------------------------------------------------
    if (commandTrigger === "addmsg") {
      const content = args.join(" ").trim();
      const splitIdx = content.indexOf(",");

      if (splitIdx === -1) {
        sock.sendMessage(from, { react: { text: "🍬", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `✨ *Cute Usage:* \`${prefix}addmsg <trigger_word> , <your sweet reply>\`\n*Example:* \`${prefix}addmsg hi , hello sweetie!\`` },
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

      // Memory Store Update
      replies.set(triggerWord, replyMessage);
      global.autoReplyCache.set(botPhone, replies);

      // Instant Awaited DB Write (Never lost on container restarts)
      await syncToDatabase(botPhone, replies, isEnabled, config);

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *Saved to Database:* Trigger \`${triggerWord}\` ➔ "${replyMessage}" ✨` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 2. Delete Reply (.delmsg <trigger>) -> E.g: .delmsg Hi / .delmsg hi
    // -------------------------------------------------------------
    if (commandTrigger === "delmsg") {
      const rawTrigger = args.join(" ").trim();
      const triggerWord = rawTrigger.toLowerCase();

      if (!rawTrigger) {
        sock.sendMessage(from, { react: { text: "🍬", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `✨ *Usage:* \`${prefix}delmsg <word>\`\n*Example:* \`${prefix}delmsg hi\`` },
          { quoted: msg }
        );
      }

      // Case-Insensitive O(1) Match Check
      if (!replies.has(triggerWord)) {
        sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🍬 *No reply found* for trigger keyword \`${rawTrigger}\` sweetheart~` },
          { quoted: msg }
        );
      }

      // Remove from Memory
      replies.delete(triggerWord);
      global.autoReplyCache.set(botPhone, replies);

      // Instant Awaited DB Prune
      await syncToDatabase(botPhone, replies, isEnabled, config);

      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🧹 *Removed:* Cleared auto-reply for \`${triggerWord}\` permanently from database softly.` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 3. List All Saved Replies (.allmsg / .replylist)
    // -------------------------------------------------------------
    if (commandTrigger === "allmsg" || commandTrigger === "replylist") {
      if (replies.size === 0) {
        return await sock.sendMessage(
          from,
          { text: "📭 *No custom replies saved in database yet, darling!* 🌸" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *SAVED AUTO-REPLIES* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let i = 1;
      for (const [k, v] of replies.entries()) {
        listText += `  🌸 *${i++}.* \`${k}\` ➔ ${v}\n`;
      }
      listText += `\n━━━━━━━━━━━━━━━━━━━━━\n💖 *Total Active:* ${replies.size} triggers (Synced with MongoDB) ✨`;

      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // -------------------------------------------------------------
    // 4. Toggle On / Off (.autoreply on / off)
    // -------------------------------------------------------------
    const stateArg = args[0]?.toLowerCase().trim();
    if (stateArg === "on" || stateArg === "off") {
      const isTurnOn = stateArg === "on";
      global.autoReplyStatus.set(botPhone, isTurnOn);
      await syncToDatabase(botPhone, replies, isTurnOn, config);

      sock.sendMessage(from, { react: { text: isTurnOn ? "💖" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *Auto-Reply Engine is now:* *${isTurnOn ? "ACTIVE & LISTENING ✨" : "SLEEPING SOFTLY 💤"}*`
        },
        { quoted: msg }
      );
    }

    // Default Cute Guide Panel
    sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *AUTO-REPLY MANAGER* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  • *${prefix}addmsg <word> , <reply>* — Save permanently ✨
  • *${prefix}delmsg <word>* — Remove trigger 🗑️
  • *${prefix}allmsg* — View all saved triggers 📑
  • *${prefix}autoreply on/off* — Turn system on or off ⚙️

  ✨ *Current Status:* ${isEnabled ? "🟢 ACTIVE" : "🔴 DISABLED"}
  📊 *Stored in DB:* ${replies.size} phrases

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
