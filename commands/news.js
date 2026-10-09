import fs from "fs";
import path from "path";
import axios from "axios";

// Static API Configs
const API_BASE = "https://supunofc.site/api/news";
const API_KEY = "supun-tvo5olfxylo98b8l6b9lq174";

// In-Memory Storage & Daemon Locks
global.autoNewsSubs = global.autoNewsSubs || new Set();
global.lastPublishedNewsTitle = global.lastPublishedNewsTitle || "";
global.autoNewsDaemonRunning = global.autoNewsDaemonRunning || false;

const BACKUP_DIR = path.join(process.cwd(), "session_backups");
const BACKUP_FILE = path.join(BACKUP_DIR, "news_subs.json");

if (!fs.existsSync(BACKUP_DIR)) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) {}
}

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

// 1. Dual-Storage Load (MongoDB + Local JSON)
async function initNewsStorage() {
  try {
    const db = getDbInstance();
    if (db) {
      const col = db.collection("news_subscribers");
      const savedDocs = await col.find({}).toArray();
      for (const doc of savedDocs) {
        if (doc._id) global.autoNewsSubs.add(doc._id);
      }
    }
  } catch (_) {}

  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const data = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach(id => global.autoNewsSubs.add(id));
      }
    }
  } catch (_) {}
}

// 2. Dual-Storage Sync
async function syncNewsSub(targetJid, isDelete = false) {
  try {
    if (isDelete) global.autoNewsSubs.delete(targetJid);
    else global.autoNewsSubs.add(targetJid);

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(Array.from(global.autoNewsSubs), null, 2));

    const db = getDbInstance();
    if (db) {
      const col = db.collection("news_subscribers");
      if (isDelete) await col.deleteOne({ _id: targetJid });
      else await col.updateOne({ _id: targetJid }, { $set: { jid: targetJid, updatedAt: new Date() } }, { upsert: true });
    }
  } catch (_) {}
}

initNewsStorage();

// 3. API Fetchers
async function fetchLankadeepaNews() {
  try {
    const res = await axios.get(`${API_BASE}/lankadeepa?apikey=${API_KEY}`, { timeout: 10000 });
    if (res.data?.success && res.data?.results) {
      return res.data.results;
    }
  } catch (err) {
    console.error("[NEWS API ERR - Lankadeepa]:", err.message);
  }
  return null;
}

async function fetchNasa(type = "news") {
  try {
    const res = await axios.get(`${API_BASE}/nasa?type=${type}&apikey=${API_KEY}`, { timeout: 10000 });
    if (res.data?.success && res.data?.results) {
      return res.data.results;
    }
  } catch (err) {
    console.error(`[NEWS API ERR - NASA (${type})]:`, err.message);
  }
  return null;
}

// 4. Background Auto News Engine (Checks every 3 minutes)
export function startAutoNewsDaemon(sock) {
  if (global.autoNewsDaemonRunning) return;
  global.autoNewsDaemonRunning = true;

  setInterval(async () => {
    if (global.autoNewsSubs.size === 0) return;

    const data = await fetchLankadeepaNews();
    if (!data || !data.title) return;

    // Check if new breaking news arrived
    if (data.title !== global.lastPublishedNewsTitle) {
      global.lastPublishedNewsTitle = data.title;

      const card = 
`🚨 ｡ﾟ•┈୨ *BREAKING NEWS | ලංකාදීප* ୧┈•ﾟ｡ 📰
━━━━━━━━━━━━━━━━━━━━━

📰 *${data.title}*

📅 *දිනය/වේලාව:* \`${data.publish || "මෑතකදී"}\`

${data.dec ? data.dec.trim() : ""}

🔗 *වැඩිදුර තොරතුරු:* ${data.link}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      for (const targetJid of global.autoNewsSubs) {
        try {
          if (data.image) {
            await sock.sendMessage(targetJid, {
              image: { url: data.image },
              caption: card
            });
          } else {
            await sock.sendMessage(targetJid, { text: card });
          }
        } catch (_) {}
      }
    }
  }, 180000); // 3 minutes
}

// 5. Main Plugin Command Execution
export default {
  name: "news",
  aliases: ["lankadeepa", "nasa", "nasamission", "autonews"],
  category: "news",
  description: "Live news from Lankadeepa and NASA with auto-broadcast engine",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    startAutoNewsDaemon(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const fullBody = body.trim();
    const cmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const opt = args[0]?.toLowerCase()?.trim();

    // -------------------------------------------------------------
    // 1. Auto-News Subscriber Toggle (.news auto on/off)
    // -------------------------------------------------------------
    if (opt === "auto" || cmd === "autonews") {
      const state = (cmd === "autonews" ? args[0] : args[1])?.toLowerCase()?.trim();

      if (state === "on") {
        await syncNewsSub(from, false);
        sock.sendMessage(from, { react: { text: "🔔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "✨ *Auto News Alerts Activated!* අලුත් Breaking News ආපු සැණින් මෙම Chat එකට ලැබෙනු ඇත. 📰" },
          { quoted: msg }
        );
      }

      if (state === "off") {
        await syncNewsSub(from, true);
        sock.sendMessage(from, { react: { text: "🔕", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🧹 *Auto News Alerts Disabled!* Breaking News ලැබීම නවතා දමන ලදී." },
          { quoted: msg }
        );
      }

      return await sock.sendMessage(
        from,
        { text: `🌸 *භාවිතය:* \`${pref}news auto on\` හෝ \`${pref}news auto off\`` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 2. NASA News (.nasa / .news nasa)
    // -------------------------------------------------------------
    if (cmd === "nasa" || (cmd === "news" && opt === "nasa")) {
      sock.sendMessage(from, { react: { text: "🚀", key: msg.key } }).catch(() => {});

      const data = await fetchNasa("news");
      if (!data) {
        return await sock.sendMessage(from, { text: "💔 *NASA News fetch කිරීමට නොහැකි විය! පසුව උත්සාහ කරන්න.*" }, { quoted: msg });
      }

      const nasaCard = 
`🌌 ｡ﾟ•┈୨ *NASA RECENT NEWS* ୧┈•ﾟ｡ 🚀
━━━━━━━━━━━━━━━━━━━━━

🛸 *Title:* ${data.title || "NASA Update"}
📅 *Date:* \`${data.publish || data.date || "Latest"}\`

${data.dec || data.description || ""}

${data.link ? `🔗 *Read More:* ${data.link}` : ""}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      if (data.image) {
        return await sock.sendMessage(from, { image: { url: data.image }, caption: nasaCard }, { quoted: msg });
      } else {
        return await sock.sendMessage(from, { text: nasaCard }, { quoted: msg });
      }
    }

    // -------------------------------------------------------------
    // 3. NASA Missions (.nasamission / .news mission)
    // -------------------------------------------------------------
    if (cmd === "nasamission" || (cmd === "news" && (opt === "mission" || opt === "missions"))) {
      sock.sendMessage(from, { react: { text: "🛰️", key: msg.key } }).catch(() => {});

      const data = await fetchNasa("missions");
      if (!data) {
        return await sock.sendMessage(from, { text: "💔 *NASA Missions fetch කිරීමට නොහැකි විය! පසුව උත්සාහ කරන්න.*" }, { quoted: msg });
      }

      const missionCard = 
`🛰️ ｡ﾟ•┈୨ *NASA MISSIONS UPDATE* ୧┈•ﾟ｡ 🌌
━━━━━━━━━━━━━━━━━━━━━

🪐 *Mission:* ${data.title || "NASA Space Mission"}
📅 *Date:* \`${data.publish || data.date || "Active"}\`

${data.dec || data.description || ""}

${data.link ? `🔗 *Details:* ${data.link}` : ""}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      if (data.image) {
        return await sock.sendMessage(from, { image: { url: data.image }, caption: missionCard }, { quoted: msg });
      } else {
        return await sock.sendMessage(from, { text: missionCard }, { quoted: msg });
      }
    }

    // -------------------------------------------------------------
    // 4. Default: Lankadeepa Live News (.news / .lankadeepa)
    // -------------------------------------------------------------
    sock.sendMessage(from, { react: { text: "📰", key: msg.key } }).catch(() => {});

    const news = await fetchLankadeepaNews();
    if (!news) {
      return await sock.sendMessage(from, { text: "💔 *පුවත් ලබාගැනීමට නොහැකි විය! පසුව උත්සාහ කරන්න.*" }, { quoted: msg });
    }

    const newsCard = 
`📰 ｡ﾟ•┈୨ *LANKADEEPA LATEST NEWS* ୧┈•ﾟ｡ 🇱🇰
━━━━━━━━━━━━━━━━━━━━━

📰 *${news.title}*

📅 *දිනය/වේලාව:* \`${news.publish || "මෑතකදී"}\`

${news.dec ? news.dec.trim() : ""}

🔗 *Read Full Article:* ${news.link}

━━━━━━━━━━━━━━━━━━━━━
🍬 *OTHER NEWS COMMANDS:*
  • *${pref}news auto on/off* ➔ Auto Breaking News Push
  • *${pref}nasa* ➔ NASA Space News
  • *${pref}nasamission* ➔ NASA Missions

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    if (news.image) {
      return await sock.sendMessage(from, { image: { url: news.image }, caption: newsCard }, { quoted: msg });
    } else {
      return await sock.sendMessage(from, { text: newsCard }, { quoted: msg });
    }
  }
};
