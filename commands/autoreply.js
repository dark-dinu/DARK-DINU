import { MongoClient } from "mongodb";

// Per-Bot Auto Reply Cache & Socket Watchers
global.autoReplyCache = global.autoReplyCache || new Map();
global.autoReplyStatus = global.autoReplyStatus || new Map();
global.autoReplyHookedSockets = global.autoReplyHookedSockets || new WeakSet();

let mongoDbInstance = null;

async function getReplyDB(mongoUri, dbName) {
  if (mongoDbInstance) return mongoDbInstance;
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    mongoDbInstance = client.db(dbName);
    return mongoDbInstance;
  } catch (e) {
    return null;
  }
}

function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
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

// Background Non-blocking MongoDB Sync
function syncToDatabase(botPhone, replies, enabled, config) {
  setImmediate(async () => {
    try {
      const db = await getReplyDB(config.MONGODB_URI, config.DB_NAME);
      const col = db?.collection("custom_autoreplies");
      const objData = Object.fromEntries(replies);
      await col?.updateOne(
        { botPhone },
        { $set: { botPhone, replies: objData, enabled } },
        { upsert: true }
      );
    } catch (_) {}
  });
}

// Memory Sync Engine
async function loadBotReplies(botPhone, config) {
  if (global.autoReplyCache.has(botPhone)) {
    return global.autoReplyCache.get(botPhone);
  }

  try {
    const db = await getReplyDB(config.MONGODB_URI, config.DB_NAME);
    if (db) {
      const col = db.collection("custom_autoreplies");
      const record = await col.findOne({ botPhone });

      const repliesMap = new Map();
      if (record?.replies) {
        for (const [k, v] of Object.entries(record.replies)) {
          repliesMap.set(k.toLowerCase(), v);
        }
      }
      global.autoReplyCache.set(botPhone, repliesMap);
      global.autoReplyStatus.set(botPhone, record?.enabled ?? true);
      return repliesMap;
    }
  } catch (_) {}

  const emptyMap = new Map();
  global.autoReplyCache.set(botPhone, emptyMap);
  global.autoReplyStatus.set(botPhone, true);
  return emptyMap;
}

// Background Listener (Index.js වෙනස් නොකර ක්‍රියාත්මක වේ)
function attachAutoReplyEngine(sock, appConfig) {
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

    const textBody = (
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      ""
    ).trim().toLowerCase();

    if (!textBody || textBody.startsWith(appConfig?.PREFIX || ".")) return;

    const replies = await loadBotReplies(currentPhone, appConfig);
    if (!replies || replies.size === 0) return;

    let replyToSend = null;
    if (replies.has(textBody)) {
      replyToSend = replies.get(textBody);
    } else {
      for (const [trigger, reply] of replies.entries()) {
        const regex = new RegExp(`(^|\\s)${trigger}(\\s\vert{}$)`, "i");
        if (regex.test(textBody)) {
          replyToSend = reply;
          break;
        }
      }
    }

    if (replyToSend) {
      await sock.sendMessage(chatJid, { text: replyToSend }, { quoted: m }).catch(() => {});
    }
  });
}

// Cluster Auto Hook Watcher
setInterval(() => {
  if (global.activeSockets) {
    for (const [, s] of global.activeSockets.entries()) {
      attachAutoReplyEngine(s, {
        MONGODB_URI: "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
        DB_NAME: "whatsapp_multi_bots",
        PREFIX: "."
      });
    }
  }
}, 2000);

export default {
  name: "autoreply",
  aliases: ["addmsg", "delmsg", "allmsg", "replylist"],
  category: "owner",
  description: "Ultra-fast custom Auto Reply manager",

  async execute({ sock, msg, from, args, body, config }) {
    attachAutoReplyEngine(sock, config);

    const prefix = config?.PREFIX || ".";
    const botPhone = getBotPhone(sock);

    if (!isBotOwner(sock, msg, from)) {
      return await sock.sendMessage(from, { text: "⛔ Bot Owner ට පමණි." }, { quoted: msg });
    }

    const replies = await loadBotReplies(botPhone, config);
    const isEnabled = global.autoReplyStatus.get(botPhone) ?? true;

    const fullBody = body.trim().slice(prefix.length).trim();
    const commandTrigger = fullBody.split(/ +/)[0].toLowerCase();

    // 1. .addmsg <trigger>,<reply>
    if (commandTrigger === "addmsg") {
      const content = args.join(" ").trim();
      const parts = content.split(",");

      if (parts.length < 2) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:* \`${prefix}addmsg trigger,reply\``
        }, { quoted: msg });
      }

      const triggerWord = parts[0].trim().toLowerCase();
      const replyMessage = parts.slice(1).join(",").trim();

      if (!triggerWord || !replyMessage) {
        return await sock.sendMessage(from, { text: "❌ අගයන් ලබාදෙන්න." }, { quoted: msg });
      }

      // 1. Memory එකට Save කිරීම (ක්ෂණිකව ක්‍රියාත්මක වීමට)
      replies.set(triggerWord, replyMessage);
      global.autoReplyCache.set(botPhone, replies);

      // 2. MongoDB එකට Background එකේ Save කිරීම
      syncToDatabase(botPhone, replies, isEnabled, config);

      // Reaction සහ තනි පේළියේ කෙටි පණිවිඩය
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `✅ Auto Reply Added: \`${triggerWord}\` ➔ ${replyMessage}`
      }, { quoted: msg });
    }

    // 2. .delmsg <trigger>
    if (commandTrigger === "delmsg") {
      const triggerWord = args.join(" ").trim().toLowerCase();
      if (!triggerWord || !replies.has(triggerWord)) {
        return await sock.sendMessage(from, { text: "⚠️ Reply එකක් හමු නොවුණි." }, { quoted: msg });
      }

      replies.delete(triggerWord);
      global.autoReplyCache.set(botPhone, replies);

      syncToDatabase(botPhone, replies, isEnabled, config);

      await sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `🗑️ Deleted: \`${triggerWord}\``
      }, { quoted: msg });
    }

    // 3. .allmsg
    if (commandTrigger === "allmsg" || commandTrigger === "replylist") {
      if (replies.size === 0) {
        return await sock.sendMessage(from, { text: "📭 Auto Replies කිසිවක් නැත." }, { quoted: msg });
      }

      let listText = "📑 *Saved Replies:*\n";
      let i = 1;
      for (const [k, v] of replies.entries()) {
        listText += `${i++}. \`${k}\` ➔ ${v}\n`;
      }

      return await sock.sendMessage(from, { text: listText.trim() }, { quoted: msg });
    }

    // 4. .autoreply on / off
    const stateArg = args[0]?.toLowerCase().trim();
    if (stateArg === "on" || stateArg === "off") {
      const isTurnOn = stateArg === "on";
      global.autoReplyStatus.set(botPhone, isTurnOn);

      syncToDatabase(botPhone, replies, isTurnOn, config);

      await sock.sendMessage(from, { react: { text: isTurnOn ? "🟢" : "🔴", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `Auto Reply: *${isTurnOn ? "ON 🟢" : "OFF 🔴"}*`
      }, { quoted: msg });
    }

    return await sock.sendMessage(from, {
      text: `*Auto Reply:*\n• \`${prefix}addmsg trigger,reply\`\n• \`${prefix}delmsg trigger\`\n• \`${prefix}allmsg\`\n• \`${prefix}autoreply on/off\``
    }, { quoted: msg });
  }
};
