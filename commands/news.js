import fs from "fs";
import path from "path";
import axios from "axios";
import { generateWAMessageContent, generateWAMessageFromContent } from "@whiskeysockets/baileys";

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

const NEWS_SOURCES = Object.freeze([
  {
    id: "hiru",
    name: "Hiru News",
    tag: "🇱🇰 HIRU NEWS",
    url: `https://api.chamindu.site/api/v1/media/hirunews?limit=10&api_key=${API_KEY}`
  },
  {
    id: "derana",
    name: "Ada Derana",
    tag: "🇱🇰 ADA DERANA",
    url: `https://api.chamindu.site/api/v1/media/adaderana?limit=10&api_key=${API_KEY}`
  },
  {
    id: "newsfirst",
    name: "News First",
    tag: "🇱🇰 NEWS FIRST",
    url: `https://api.chamindu.site/api/v1/media/newsfirst?limit=10&api_key=${API_KEY}`
  }
]);

global.autoNewsSubs = global.autoNewsSubs || new Set();
global.seenNewsTitles = global.seenNewsTitles || new Set();
global.autoNewsLoopActive = global.autoNewsLoopActive || false;

const BACKUP_DIR = path.join(process.cwd(), "session_backups");
const BACKUP_FILE = path.join(BACKUP_DIR, "news_subs.json");
const HISTORY_FILE = path.join(BACKUP_DIR, "news_history.json");

if (!fs.existsSync(BACKUP_DIR)) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) {}
}

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

async function initStorage() {
  try {
    const db = getDbInstance();
    if (db) {
      const docs = await db.collection("news_subscribers").find({}).toArray();
      docs.forEach((d) => { if (d._id) global.autoNewsSubs.add(d._id); });
    }
  } catch (_) {}

  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const arr = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      if (Array.isArray(arr)) arr.forEach((id) => global.autoNewsSubs.add(id));
    }
    if (fs.existsSync(HISTORY_FILE)) {
      const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
      if (Array.isArray(history)) history.forEach((t) => global.seenNewsTitles.add(t));
    }
  } catch (_) {}
}

async function syncSubscriber(targetJid, isDelete = false) {
  try {
    if (isDelete) global.autoNewsSubs.delete(targetJid);
    else global.autoNewsSubs.add(targetJid);

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(Array.from(global.autoNewsSubs), null, 2));

    const db = getDbInstance();
    if (db) {
      const col = db.collection("news_subscribers");
      if (isDelete) await col.deleteOne({ _id: targetJid });
      else await col.updateOne({ _id: targetJid }, { $set: { jid: targetJid, date: new Date() } }, { upsert: true });
    }
  } catch (_) {}
}

function recordPublishedTitle(title) {
  if (!title) return;
  global.seenNewsTitles.add(title);
  try {
    const arr = Array.from(global.seenNewsTitles).slice(-300);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2));
  } catch (_) {}
}

initStorage();

function extractInviteCode(input = "") {
  const channelMatch = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z]+)/i);
  if (channelMatch) return { type: "channel", code: channelMatch[1] };

  const groupMatch = input.match(/(?:chat\.whatsapp\.com\/)([0-9A-Za-z]+)/i);
  if (groupMatch) return { type: "group", code: groupMatch[1] };

  return { type: "raw", code: input.trim() };
}

async function resolveTargetJid(sock, input) {
  if (!input) return null;
  const clean = input.trim();
  if (clean.endsWith("@newsletter") || clean.endsWith("@g.us") || clean.endsWith("@s.whatsapp.net")) {
    return clean;
  }

  const parsed = extractInviteCode(clean);

  if (parsed.type === "channel") {
    try {
      if (typeof sock.newsletterMetadata === "function") {
        const meta = await sock.newsletterMetadata("invite", parsed.code);
        return meta?.id || null;
      }
    } catch (_) {}
  } else if (parsed.type === "group") {
    try {
      if (typeof sock.groupGetInviteInfo === "function") {
        const info = await sock.groupGetInviteInfo(parsed.code);
        return info?.id ? `${info.id}@g.us` : null;
      }
    } catch (_) {}
  }

  return clean;
}

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    return Buffer.from(res.data);
  } catch (_) {
    return null;
  }
}

// API Parser
async function fetchSourceNews(endpointUrl) {
  try {
    const res = await axios.get(endpointUrl, { timeout: 12000 });
    const payload = res.data;

    let items = [];
    if (Array.isArray(payload)) items = payload;
    else if (Array.isArray(payload?.data)) items = payload.data;
    else if (Array.isArray(payload?.results)) items = payload.results;
    else if (Array.isArray(payload?.result)) items = payload.result;
    else if (payload?.result && typeof payload.result === "object") items = [payload.result];

    if (!items.length) return [];

    return items.map((r) => ({
      title: (r.title || r.heading || "").trim(),
      image: r.image || r.thumbnail || r.img || null,
      publish: r.date || r.time || r.datetime || r.published_at || "Just Now",
      desc: (r.desc || r.description || r.news || r.summary || "").trim(),
      link: r.link || r.url || ""
    })).filter(x => x.title);
  } catch (err) {
    return [];
  }
}

// Guaranteed Channel Newsletter Dispatcher
async function dispatchNewsPost(sock, targetJid, item, tag) {
  const newsCard = 
`🚨 ｡ﾟ•┈୨ *BREAKING NEWS* ୧┈•ﾟ｡ 📰
━━━━━━━━━━━━━━━━━━━━━

📢 *මූලාශ්‍රය:* \`${tag}\`
📰 *${item.title}*

📅 *වේලාව:* \`${item.publish}\`

${item.desc ? item.desc : ""}

${item.link ? `🔗 *සම්පූර්ණ පුවත:* ${item.link}` : ""}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

  try {
    const isNewsletter = targetJid.endsWith("@newsletter");
    const imgBuffer = await fetchImageBuffer(item.image);

    // Channel (Newsletter) Dispatch Mechanism
    if (isNewsletter) {
      if (imgBuffer) {
        // Baileys media relay to channel
        const mediaContent = await generateWAMessageContent(
          {
            image: imgBuffer,
            caption: newsCard
          },
          { upload: sock.waUploadToServer }
        );

        const fullMsg = generateWAMessageFromContent(
          targetJid,
          mediaContent,
          {}
        );

        await sock.relayMessage(targetJid, fullMsg.message, {
          messageId: fullMsg.key.id
        });
        return true;
      } else {
        // Text-only channel message
        const textContent = await generateWAMessageContent(
          { text: newsCard },
          { upload: sock.waUploadToServer }
        );
        const fullMsg = generateWAMessageFromContent(targetJid, textContent, {});
        await sock.relayMessage(targetJid, fullMsg.message, { messageId: fullMsg.key.id });
        return true;
      }
    }

    // Standard Groups and Chats
    if (imgBuffer) {
      await sock.sendMessage(targetJid, { image: imgBuffer, caption: newsCard });
    } else {
      await sock.sendMessage(targetJid, { text: newsCard });
    }
    return true;

  } catch (err) {
    console.error(`[NEWS DISPATCH FAILED -> ${targetJid}]:`, err.message);
    // Emergency Fallback
    try {
      await sock.sendMessage(targetJid, { text: newsCard });
      return true;
    } catch (_) {
      return false;
    }
  }
}

// Background Auto-News Loop (Every 45 seconds)
export function startContinuousNewsDaemon(sock) {
  if (global.autoNewsLoopActive) return;
  global.autoNewsLoopActive = true;

  setInterval(async () => {
    if (global.autoNewsSubs.size === 0) return;

    for (const src of NEWS_SOURCES) {
      const items = await fetchSourceNews(src.url);
      if (!items || !items.length) continue;

      for (const item of items) {
        if (global.seenNewsTitles.has(item.title)) continue;
        recordPublishedTitle(item.title);

        for (const targetJid of global.autoNewsSubs) {
          await dispatchNewsPost(sock, targetJid, item, src.tag);
        }
        break; // Source එකකින් එකක් පමණක් යවයි
      }
    }
  }, 45000);
}

export default {
  name: "news",
  aliases: ["autonews", "delnews", "stopnews", "hirunews", "derana", "newsfirst"],
  category: "news",
  description: "Guaranteed Live news auto-publisher for channels, groups, and chats",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    startContinuousNewsDaemon(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const fullBody = body.trim();
    const cmd = fullBody.slice(pref.length).trim().split(/\s+/)[0]?.toLowerCase();
    const inputArg = args.join(" ").trim();

    // 1. Delete / Stop Command (.delnews)
    if (cmd === "delnews" || cmd === "stopnews" || args[0]?.toLowerCase() === "stop" || args[0]?.toLowerCase() === "off") {
      const rawTarget = (args[0]?.toLowerCase() === "stop" || args[0]?.toLowerCase() === "off") ? args[1] : args[0];
      let targetJid = from;

      if (rawTarget) {
        targetJid = await resolveTargetJid(sock, rawTarget) || rawTarget;
      }

      await syncSubscriber(targetJid, true);
      sock.sendMessage(from, { react: { text: "🔕", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: `🛑 *Auto-News Service Stopped!*\n\n📢 *ඉවත් කළ ස්ථානය:* \`${targetJid}\`\n\n_මෙම ස්ථානයට පුවත් යැවීම නතර කරන ලදී._\n💖 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    // 2. Setup Auto-News (.news <channel_link / group_link / jid>)
    if (inputArg) {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = await resolveTargetJid(sock, inputArg);

      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "⚠️ *වලංගු Channel Link එකක් හෝ JID එකක් ලබා දෙන්න!*" },
          { quoted: msg }
        );
      }

      await syncSubscriber(targetJid, false);

      // Latest Hiru News එක අරන් Channel එකට ක්ෂණිකව යැවීම
      const testItems = await fetchSourceNews(NEWS_SOURCES[0].url);
      let sent = false;
      if (testItems.length > 0) {
        sent = await dispatchNewsPost(sock, targetJid, testItems[0], NEWS_SOURCES[0].tag);
        if (sent) recordPublishedTitle(testItems[0].title);
      }

      sock.sendMessage(from, { react: { text: sent ? "✅" : "⚠️", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: 
`✨ *Auto-News සක්‍රීය කරන ලදී!* 🚀
━━━━━━━━━━━━━━━━━━━━━
📢 *Destination:* \`${targetJid}\`
📡 *මූලාශ්‍ර:* Hiru News, Ada Derana, News First
⚡ *පළමු පුවත යැවීම:* ${sent ? "🟢 සාර්ථකයි! (චැනල් එක බලන්න)" : "⚠️ අසාර්ථකයි (Bot අදාළ Channel එකේ Admin කෙනෙක් බව තහවුරු කරගන්න)"}

🛑 *නැවත නවත්වන්නේ කෙසේද:*
• \`${pref}delnews ${inputArg}\`

_මෙහි සිට අලුත් පුවත් ලැබෙන සැණින් ස්වයංක්‍රීයව මෙතැනට Update වේ._
💖 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    // 3. Help Menu
    return await sock.sendMessage(
      from,
      {
        text: 
`╔═════════════════════════════╗
   📰 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐍 𝐄 𝐖 𝐒
╚═════════════════════════════╝

💡 *ස්වයංක්‍රීය පුවත් සක්‍රීය කිරීමට:*
├ 📢 \`${pref}news <channel_link>\`
├ 👥 \`${pref}news <group_link>\`
╰ 💬 \`${pref}news <chat_jid>\`

🛑 *සේවාව නැවැත්වීමට:*
╰ 🔕 \`${pref}delnews <channel_link / jid>\`

📡 *සහය දක්වන පුවත් සේවා:*
• Hiru News • Ada Derana • News First

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
