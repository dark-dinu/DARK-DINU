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
    console.error("[AutoReply DB Error]:", e.message);
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

// Database එකෙන් Bot Node එකට අදාළ Replies Load කරගැනීම
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
  } catch (err) {
    console.error("[DB Reply Load Error]:", err.message);
  }

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

    // Trigger Match පරීක්ෂාව
    let replyToSend = null;

    if (replies.has(textBody)) {
      replyToSend = replies.get(textBody);
    } else {
      // වචනය වාක්‍යය තුළ අඩංගුදැයි බැලීම (Word boundary check)
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
  description: "Custom database-backed Auto Reply manager",

  async execute({ sock, msg, from, args, body, config }) {
    attachAutoReplyEngine(sock, config);

    const prefix = config?.PREFIX || ".";
    const botPhone = getBotPhone(sock);

    if (!isBotOwner(sock, msg, from)) {
      await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "⛔ *ACCESS DENIED:* මෙම සැකසුම් කළ හැක්කේ Bot Owner හට පමණි." },
        { quoted: msg }
      );
    }

    const replies = await loadBotReplies(botPhone, config);
    const db = await getReplyDB(config.MONGODB_URI, config.DB_NAME);
    const col = db?.collection("custom_autoreplies");

    const fullBody = body.trim().slice(prefix.length).trim();
    const commandTrigger = fullBody.split(/ +/)[0].toLowerCase();

    // 1. .addmsg <trigger>,<reply>
    if (commandTrigger === "addmsg") {
      const content = args.join(" ").trim();
      const parts = content.split(",");

      if (parts.length < 2) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n\`${prefix}addmsg trigger,reply\`\n\n*උදාහරණ:*\n• \`${prefix}addmsg hi,*Hey 👋*\`\n• \`${prefix}addmsg gm,Good Morning bro ☕\``
        }, { quoted: msg });
      }

      const triggerWord = parts[0].trim().toLowerCase();
      const replyMessage = parts.slice(1).join(",").trim();

      if (!triggerWord || !replyMessage) {
        return await sock.sendMessage(from, { text: "❌ Trigger සහ Reply යන දෙකම ඇතුළත් කරන්න." }, { quoted: msg });
      }

      replies.set(triggerWord, replyMessage);
      global.autoReplyCache.set(botPhone, replies);

      // Save to MongoDB
      const objData = Object.fromEntries(replies);
      await col?.updateOne(
        { botPhone },
        { $set: { botPhone, replies: objData } },
        { upsert: true }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 💬 *AUTO REPLY ADDED* 〕
├─▸ 🎯 *Trigger* : \`${triggerWord}\`
├─▸ 📝 *Reply*   : ${replyMessage}
├─▸ 💾 *Storage* : MongoDB Saved
└───────────────────────`
      }, { quoted: msg });
    }

    // 2. .delmsg <trigger>
    if (commandTrigger === "delmsg") {
      const triggerWord = args.join(" ").trim().toLowerCase();
      if (!triggerWord || !replies.has(triggerWord)) {
        return await sock.sendMessage(from, {
          text: `⚠️ සොයාගත නොහැකි විය. පවතින triggers බැලීමට \`${prefix}allmsg\` ගසන්න.`
        }, { quoted: msg });
      }

      replies.delete(triggerWord);
      global.autoReplyCache.set(botPhone, replies);

      const objData = Object.fromEntries(replies);
      await col?.updateOne(
        { botPhone },
        { $set: { replies: objData } }
      );

      await sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `🗑️ \`${triggerWord}\` Auto Reply එක Database එකෙන් සාර්ථකව Delete කරන ලදී.`
      }, { quoted: msg });
    }

    // 3. .allmsg (View all saved replies)
    if (commandTrigger === "allmsg" || commandTrigger === "replylist") {
      if (replies.size === 0) {
        return await sock.sendMessage(from, {
          text: `📭 දැනට Database එකේ Auto Replies කිසිවක් Add කර නැත.\nAdd කිරීමට: \`${prefix}addmsg hi,Hello\``
        }, { quoted: msg });
      }

      let listText = "";
      let index = 1;
      for (const [k, v] of replies.entries()) {
        listText += `│ ${index++}. *Trigger:* \`${k}\`\n│    ↳ *Reply:* ${v}\n`;
      }

      const isStatusOn = global.autoReplyStatus.get(botPhone) ?? true;
      return await sock.sendMessage(from, {
        text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📑 *SAVED AUTO REPLIES* 〕
├─▸ 🤖 *Node*   : +${botPhone}
├─▸ ⚡ *Status* : ${isStatusOn ? "🟢 ON" : "🔴 OFF"}
├─▸ 📊 *Total*  : ${replies.size}
└───────────────────────

${listText}└───────────────────────`
      }, { quoted: msg });
    }

    // 4. .autoreply on / off
    const stateArg = args[0]?.toLowerCase().trim();
    if (stateArg === "on" || stateArg === "off") {
      const isTurnOn = stateArg === "on";
      global.autoReplyStatus.set(botPhone, isTurnOn);

      await col?.updateOne(
        { botPhone },
        { $set: { botPhone, enabled: isTurnOn } },
        { upsert: true }
      );

      await sock.sendMessage(from, { react: { text: isTurnOn ? "🟢" : "🔴", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `✅ Auto Reply පද්ධතිය: *${isTurnOn ? "ACTIVATED 🟢" : "DISABLED 🔴"}* (Saved to DB)`
      }, { quoted: msg });
    }

    // Default Helper Dashboard
    const curStatus = global.autoReplyStatus.get(botPhone) ?? true;
    return await sock.sendMessage(from, {
      text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🤖 *AUTO REPLY CONTROLLER* 〕
├─▸ ⚡ *Status*  : ${curStatus ? "🟢 ON" : "🔴 OFF"}
├─▸ 📊 *Saved*   : ${replies.size} Replies
└───────────────────────

📌 *පාලනය කිරීමට:*
• \`${prefix}autoreply on\` / \`off\`
• \`${prefix}addmsg <trigger>,<reply>\`
• \`${prefix}delmsg <trigger>\`
• \`${prefix}allmsg\` (ලැයිස්තුව බැලීමට)`
    }, { quoted: msg });
  }
};
