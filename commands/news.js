import fs from "fs";
import path from "path";
import axios from "axios";
import { generateWAMessageContent, generateWAMessageFromContent } from "@whiskeysockets/baileys";

const API_KEY = "supun-tvo5olfxylo98b8l6b9lq174";
const NEWS_SOURCES = Object.freeze([
  { id: "lankadeepa", name: "ලංකාදීප", tag: "🇱🇰 LANKADEEPA", url: `https://supunofc.site/api/news/lankadeepa?apikey=${API_KEY}` },
  { id: "newslk", name: "NewsLK", tag: "🇱🇰 NEWS.LK", url: `https://supunofc.site/api/news/newslk?apikey=${API_KEY}` },
  { id: "theverge", name: "The Verge AI", tag: "🤖 THE VERGE | AI", url: `https://supunofc.site/api/news/theverge/ai-artificial-intelligence?apikey=${API_KEY}` },
  { id: "techcrunch", name: "TechCrunch AI", tag: "⚡ TECHCRUNCH | AI", url: `https://supunofc.site/api/news/techcrunch/artificial-intelligence?apikey=${API_KEY}` },
  { id: "bbc", name: "BBC News", tag: "🌍 BBC WORLD", url: `https://supunofc.site/api/news/bbc?apikey=${API_KEY}` },
  { id: "nasa_news", name: "NASA News", tag: "🚀 NASA DISCOVERY", url: `https://supunofc.site/api/news/nasa?type=news&apikey=${API_KEY}` },
  { id: "nasa_missions", name: "NASA Missions", tag: "🛰️ NASA MISSIONS", url: `https://supunofc.site/api/news/nasa?type=missions&apikey=${API_KEY}` }
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
  global.seenNewsTitles.add(title);
  try {
    const arr = Array.from(global.seenNewsTitles).slice(-200);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2));
  } catch (_) {}
}

initStorage();

function extractChannelInvite(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z]+)/i);
  return match ? match[1] : input.trim();
}

async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const clean = input.trim();
  if (clean.endsWith("@newsletter") || clean.endsWith("@g.us")) return clean;

  const code = extractChannelInvite(clean);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      return meta?.id || null;
    }
  } catch (_) {}
  return null;
}

// Download image buffer safely with browser headers
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

async function fetchSourceNews(endpointUrl) {
  try {
    const res = await axios.get(endpointUrl, { timeout: 8000 });
    if (!res.data?.success || !res.data?.results) return null;

    const r = res.data.results;
    return {
      title: (r.title || "").trim(),
      image: r.image || null,
      publish: r.publish || r.date || "Just Now",
      desc: (r.dec || r.description || "").trim(),
      link: r.link || ""
    };
  } catch (_) {
    return null;
  }
}

// Low-Level Safe Dispatcher (Works on Channels, Groups, & Chats)
async function dispatchNewsPost(sock, targetJid, item, tag) {
  const newsCard = 
`🚨 ｡ﾟ•┈୨ *BREAKING UPDATE* ୧┈•ﾟ｡ 📰
━━━━━━━━━━━━━━━━━━━━━

📢 *Source:* \`${tag}\`
📰 *${item.title}*

📅 *Time:* \`${item.publish}\`

${item.desc ? item.desc : ""}

${item.link ? `🔗 *Read Full Article:* ${item.link}` : ""}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

  try {
    const isNewsletter = targetJid.endsWith("@newsletter");
    const imgBuffer = await fetchImageBuffer(item.image);

    if (isNewsletter) {
      // 1. Try Baileys Newsletter Relay Stream
      try {
        if (imgBuffer && typeof sock.waUploadToServer === "function") {
          const mediaContent = await generateWAMessageContent(
            { image: imgBuffer, caption: newsCard },
            { upload: sock.waUploadToServer }
          );
          const fullMsg = generateWAMessageFromContent(targetJid, mediaContent, {});
          await sock.relayMessage(targetJid, fullMsg.message, { messageId: fullMsg.key.id });
          return true;
        }
      } catch (err) {
        console.warn(`[RELAY ATTEMPT FAILED]: ${err.message}, falling back to direct send...`);
      }

      // 2. Fallback to sock.sendMessage
      if (imgBuffer) {
        await sock.sendMessage(targetJid, { image: imgBuffer, caption: newsCard });
      } else {
        await sock.sendMessage(targetJid, { text: newsCard });
      }
      return true;
    }

    // Standard Chat / Group Sending
    if (imgBuffer) {
      await sock.sendMessage(targetJid, { image: imgBuffer, caption: newsCard });
    } else {
      await sock.sendMessage(targetJid, { text: newsCard });
    }
    return true;

  } catch (err) {
    console.error(`[NEWS DISPATCH FAILED -> ${targetJid}]:${err.message}`);
    // Final emergency fallback: plain text send
    try {
      await sock.sendMessage(targetJid, { text: newsCard });
      return true;
    } catch (_) {
      return false;
    }
  }
}

// Background Auto-News Daemon (Checks every 40s)
export function startContinuousNewsDaemon(sock) {
  if (global.autoNewsLoopActive) return;
  global.autoNewsLoopActive = true;

  setInterval(async () => {
    if (global.autoNewsSubs.size === 0) return;

    for (const src of NEWS_SOURCES) {
      const item = await fetchSourceNews(src.url);
      if (!item || !item.title) continue;

      if (global.seenNewsTitles.has(item.title)) continue;
      recordPublishedTitle(item.title);

      for (const targetJid of global.autoNewsSubs) {
        await dispatchNewsPost(sock, targetJid, item, src.tag);
      }
    }
  }, 40000);
}

export default {
  name: "news",
  aliases: ["lankadeepa", "newslk", "theverge", "techcrunch", "bbc", "nasa", "autonews"],
  category: "news",
  description: "Live news feed with guaranteed channel & chat auto-publishing",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    startContinuousNewsDaemon(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const fullBody = body.trim();
    const cmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const opt = args[0]?.toLowerCase()?.trim();

    // -------------------------------------------------------------
    // Auto-Publisher Controls (.news auto on <link/jid>)
    // -------------------------------------------------------------
    if (opt === "auto" || cmd === "autonews") {
      const state = (cmd === "autonews" ? args[0] : args[1])?.toLowerCase()?.trim();
      const rawTarget = (cmd === "autonews" ? args[1] : args[2])?.trim();

      let targetJid = from;
      if (rawTarget) {
        targetJid = await resolveChannelJid(sock, rawTarget) || rawTarget;
      }

      if (state === "on") {
        await syncSubscriber(targetJid, false);
        sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        // Instant dispatch of latest Lankadeepa news as proof
        const testItem = await fetchSourceNews(NEWS_SOURCES[0].url);
        let sent = false;
        if (testItem) {
          sent = await dispatchNewsPost(sock, targetJid, testItem, NEWS_SOURCES[0].tag);
          recordPublishedTitle(testItem.title);
        }

        sock.sendMessage(from, { react: { text: sent ? "💖" : "⚠️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`✨ *Auto-News Activated Successfully!* 🚀
━━━━━━━━━━━━━━━━━━━━━
📢 *Destination:* \`${targetJid}\`
🚀 *Instant Delivery:* ${sent ? "🟢 Sent successfully right now!" : "⚠️ Failed (Make sure bot is an Admin of this channel!)"}
📡 *Active Feeds:* Lankadeepa, NewsLK, BBC, The Verge, TechCrunch, NASA

_New breaking posts will dispatch automatically within 40 seconds._
💖 *DARK-DINU MD*`
          },
          { quoted: msg }
        );
      }

      if (state === "off") {
        await syncSubscriber(targetJid, true);
        sock.sendMessage(from, { react: { text: "🔕", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Removed:* Channel alerts stopped for \`${targetJid}\`` },
          { quoted: msg }
        );
      }

      if (state === "list") {
        let listText = `🎀 ｡ﾟ•┈୨ *ACTIVE NEWS TARGETS* ୧┈•ﾟ｡ 📰\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        global.autoNewsSubs.forEach((id, idx) => {
          listText += `  • ${idx + 1}. \`${id}\`\n`;
        });
        listText += `\n━━━━━━━━━━━━━━━━━━━━━\n💖 *DARK-DINU MD*`;
        return await sock.sendMessage(from, { text: listText }, { quoted: msg });
      }

      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *AUTO-NEWS GUIDE* ୧┈•ﾟ｡ 🐾

  • *${pref}news auto on <channel_link>* ➔ Channel එකට On කරන්න
  • *${pref}news auto on <channel_jid>*  ➔ Direct JID එකට On කරන්න
  • *${pref}news auto off <channel_link>* ➔ Off කරන්න
  • *${pref}news auto list* ➔ Active Targets බලන්න

💖 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // Manual Trigger Command
    // -------------------------------------------------------------
    const directMap = {
      "lankadeepa": NEWS_SOURCES[0],
      "newslk": NEWS_SOURCES[1],
      "theverge": NEWS_SOURCES[2],
      "techcrunch": NEWS_SOURCES[3],
      "bbc": NEWS_SOURCES[4],
      "nasa": NEWS_SOURCES[5]
    };

    let selectedSource = directMap[cmd] || (opt && directMap[opt]) || NEWS_SOURCES[0];

    sock.sendMessage(from, { react: { text: "📰", key: msg.key } }).catch(() => {});
    const item = await fetchSourceNews(selectedSource.url);

    if (!item) {
      return await sock.sendMessage(from, { text: "💔 *Could not fetch news right now!*" }, { quoted: msg });
    }

    const manualCard = 
`📰 ｡ﾟ•┈୨ *${selectedSource.tag}* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

📰 *${item.title}*

📅 *Time:* \`${item.publish}\`

${item.desc ? item.desc : ""}

${item.link ? `🔗 *Read Full Article:* ${item.link}` : ""}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    const imgBuffer = await fetchImageBuffer(item.image);
    if (imgBuffer) {
      return await sock.sendMessage(from, { image: imgBuffer, caption: manualCard }, { quoted: msg });
    } else {
      return await sock.sendMessage(from, { text: manualCard }, { quoted: msg });
    }
  }
};
