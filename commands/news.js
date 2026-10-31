import fs from "fs";
import path from "path";
import axios from "axios";

// ⚠️ API Key එක .env එකෙන් හෝ direct fallback එකෙන් ලබා ගනී
const API_KEY = process.env.NEWS_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const POLL_MS = 45000;
const MAX_PER_SOURCE = 3;      // එක cycle එකකදී උපරිම පුවත් ගණන
const SEND_DELAY_MS = 1500;    // Flood/Rate-limit වැළැක්වීමේ delay එක
const CAPTION_LIMIT = 1000;

// සකස් කරන ලද නිවැරදි Chamindu News APIs
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
global.newsSock = global.newsSock || null;

const BACKUP_DIR = path.join(process.cwd(), "session_backups");
const BACKUP_FILE = path.join(BACKUP_DIR, "news_subs.json");
const HISTORY_FILE = path.join(BACKUP_DIR, "news_history.json");

try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

/* ───────────── Storage ───────────── */

let storageReady = null;
function initStorage() {
  if (storageReady) return storageReady;
  storageReady = (async () => {
    try {
      const db = getDbInstance();
      if (db) {
        const docs = await db.collection("news_subscribers").find({}).toArray();
        docs.forEach((d) => d._id && global.autoNewsSubs.add(d._id));
      }
    } catch (_) {}
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const arr = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
        if (Array.isArray(arr)) arr.forEach((id) => global.autoNewsSubs.add(id));
      }
    } catch (_) {}
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const h = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
        if (Array.isArray(h)) h.forEach((t) => global.seenNewsTitles.add(t));
      }
    } catch (_) {}
  })();
  return storageReady;
}

async function syncSubscriber(jid, isDelete = false) {
  if (isDelete) global.autoNewsSubs.delete(jid);
  else global.autoNewsSubs.add(jid);

  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify([...global.autoNewsSubs], null, 2));
  } catch (_) {}

  try {
    const db = getDbInstance();
    if (db) {
      const col = db.collection("news_subscribers");
      if (isDelete) await col.deleteOne({ _id: jid });
      else await col.updateOne({ _id: jid }, { $set: { jid, date: new Date() } }, { upsert: true });
    }
  } catch (_) {}
}

function markSeen(title) {
  if (!title) return;
  global.seenNewsTitles.add(title);
  try {
    const arr = [...global.seenNewsTitles].slice(-500);
    global.seenNewsTitles = new Set(arr);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2));
  } catch (_) {}
}

/* ───────────── JID resolve ───────────── */

function extractInviteCode(input = "") {
  const ch = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)/i);
  if (ch) return { type: "channel", code: ch[1] };
  const gr = input.match(/chat\.whatsapp\.com\/([0-9A-Za-z_-]+)/i);
  if (gr) return { type: "group", code: gr[1] };
  return { type: "raw", code: input.trim() };
}

const isValidJid = (j) => /@(newsletter|g\.us|s\.whatsapp\.net)$/.test(j || "");

async function resolveTargetJid(sock, input) {
  if (!input) return null;
  const clean = input.trim();
  if (isValidJid(clean)) return clean;

  const parsed = extractInviteCode(clean);

  try {
    if (parsed.type === "channel" && typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", parsed.code);
      if (meta?.id) return meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
    } else if (parsed.type === "group" && typeof sock.groupGetInviteInfo === "function") {
      const info = await sock.groupGetInviteInfo(parsed.code);
      if (info?.id) return info.id.endsWith("@g.us") ? info.id : `${info.id}@g.us`;
    }
  } catch (_) {}

  const digits = clean.replace(/[^0-9]/g, "");
  if (parsed.type === "raw" && digits.length >= 9 && digits.length === clean.replace(/[+\s-]/g, "").length) {
    return `${digits}@s.whatsapp.net`;
  }
  return null;
}

/* ───────────── News fetch ───────────── */

async function fetchSourceNews(url) {
  try {
    const res = await axios.get(url, { 
      timeout: 12000, 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } 
    });
    const p = res.data;

    let items = [];
    if (Array.isArray(p)) items = p;
    else if (Array.isArray(p?.data)) items = p.data;
    else if (Array.isArray(p?.results)) items = p.results;
    else if (Array.isArray(p?.result)) items = p.result;
    else if (p?.result && typeof p.result === "object") items = [p.result];
    else if (p?.data && typeof p.data === "object") items = [p.data];

    return items
      .map((r) => ({
        title: String(r.title || r.heading || "").trim(),
        image: r.image || r.thumbnail || r.img || null,
        publish: String(r.date || r.time || r.datetime || r.published_at || "Just Now"),
        desc: String(r.desc || r.description || r.news || r.summary || "").trim(),
        link: r.link || r.url || ""
      }))
      .filter((x) => x.title);
  } catch (err) {
    console.warn(`[NEWS FETCH FAILED] ${err.message}`);
    return [];
  }
}

/* ───────────── Dispatch ───────────── */

function buildCard(item, tag, forCaption) {
  const head =
`🚨 ｡ﾟ•┈୨ *BREAKING NEWS* ୧┈•ﾟ｡ 📰
━━━━━━━━━━━━━━━━━━━━━

📢 *මූලාශ්‍රය:* \`${tag}\`
📰 *${item.title}*

📅 *වේලාව:* \`${item.publish}\``;

  const tail =
`${item.link ? `\n\n🔗 *සම්පූර්ණ පුවත:* ${item.link}` : ""}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

  let desc = item.desc || "";
  const max = forCaption ? CAPTION_LIMIT : 3500;
  const room = max - head.length - tail.length - 4;
  if (desc.length > room) desc = desc.slice(0, Math.max(0, room - 1)).trimEnd() + "…";

  return `${head}${desc ? `\n\n${desc}` : ""}${tail}`;
}

async function dispatchNewsPost(sock, jid, item, tag) {
  const hasImg = typeof item.image === "string" && /^https?:\/\//.test(item.image);

  if (hasImg) {
    try {
      await sock.sendMessage(jid, { 
        image: { url: item.image }, 
        caption: buildCard(item, tag, true) 
      });
      return true;
    } catch (e) {
      console.warn(`[NEWS IMAGE FAILED -> ${jid}] ${e.message} — text එකෙන් යවනවා`);
    }
  }

  try {
    await sock.sendMessage(jid, { text: buildCard(item, tag, false) });
    return true;
  } catch (e) {
    console.error(`[NEWS SEND FAILED -> ${jid}] ${e.message}`);
    return false;
  }
}

/* ───────────── Daemon ───────────── */

let tickRunning = false;

async function tick() {
  if (tickRunning) return;
  const sock = global.newsSock;
  if (!sock || global.autoNewsSubs.size === 0) return;
  tickRunning = true;

  try {
    for (const src of NEWS_SOURCES) {
      const items = await fetchSourceNews(src.url);
      if (!items.length) continue;

      let fresh = items.filter((i) => !global.seenNewsTitles.has(i.title));
      if (!fresh.length) continue;

      // මුල්වරට run වන විට flood වීම වැළැක්වීම
      if (fresh.length === items.length && items.length > MAX_PER_SOURCE) {
        items.slice(1).forEach((i) => markSeen(i.title));
        fresh = [items[0]];
      }

      const batch = fresh.slice(0, MAX_PER_SOURCE).reverse();
      fresh.slice(MAX_PER_SOURCE).forEach((i) => markSeen(i.title));

      for (const item of batch) {
        markSeen(item.title);
        for (const jid of [...global.autoNewsSubs]) {
          await dispatchNewsPost(global.newsSock, jid, item, src.tag);
          await sleep(SEND_DELAY_MS);
        }
      }
    }
  } catch (e) {
    console.error("[NEWS TICK ERROR]", e.message);
  } finally {
    tickRunning = false;
  }
}

export function startContinuousNewsDaemon(sock) {
  if (sock) global.newsSock = sock;
  if (global.autoNewsLoopActive) return;
  global.autoNewsLoopActive = true;
  initStorage().then(() => {
    setInterval(tick, POLL_MS);
    tick();
  });
}

/* ───────────── Command ───────────── */

const SINGLE_SOURCE_CMDS = { hirunews: 0, derana: 1, newsfirst: 2 };

export default {
  name: "news",
  aliases: ["autonews", "delnews", "stopnews", "hirunews", "derana", "newsfirst"],
  category: "news",
  description: "Live news auto-publisher for channels, groups, and chats",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    await initStorage();
    startContinuousNewsDaemon(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const cmd = (body || "").trim().slice(pref.length).trim().split(/\s+/)[0]?.toLowerCase();
    const first = args[0]?.toLowerCase();
    const react = (text) => sock.sendMessage(from, { react: { text, key: msg.key } }).catch(() => {});
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    // 0. තනි මූලාශ්‍රයකින් පුවත් බැලීම (.hirunews / .derana / .newsfirst)
    if (cmd in SINGLE_SOURCE_CMDS) {
      const src = NEWS_SOURCES[SINGLE_SOURCE_CMDS[cmd]];
      react("⏳");
      const items = await fetchSourceNews(src.url);
      if (!items.length) { 
        react("❌"); 
        return reply("⚠️ දැනට පුවත් ලබාගත නොහැක. පසුව උත්සාහ කරන්න."); 
      }
      const ok = await dispatchNewsPost(sock, from, items[0], src.tag);
      return react(ok ? "✅" : "❌");
    }

    // 1. නවත්වන්න (.delnews / .news stop)
    if (cmd === "delnews" || cmd === "stopnews" || first === "stop" || first === "off") {
      const raw = first === "stop" || first === "off" ? args[1] : args[0];
      let target = from;
      if (raw) {
        target = await resolveTargetJid(sock, raw);
        if (!target) return reply("⚠️ *වලංගු Channel Link එකක් හෝ JID එකක් ලබා දෙන්න!*");
      }
      const existed = global.autoNewsSubs.has(target);
      await syncSubscriber(target, true);
      react("🔕");
      return reply(
        existed
          ? `🛑 *Auto-News Service Stopped!*\n\n📢 *ඉවත් කළ ස්ථානය:* \`${target}\`\n\n_මෙම ස්ථානයට පුවත් යැවීම නතර කරන ලදී._\n💖 *DARK-DINU MD*`
          : `ℹ️ \`${target}\` සක්‍රීය ලැයිස්තුවේ නොමැත.`
      );
    }

    // 2. සක්‍රීය කරන්න (.news <link / jid / here>)
    const inputArg = args.join(" ").trim();
    if (inputArg) {
      react("⏳");
      const target = ["here", "on"].includes(first) && args.length === 1
        ? from
        : await resolveTargetJid(sock, inputArg);

      if (!target) {
        react("❌");
        return reply("⚠️ *වලංගු Channel Link එකක් හෝ JID එකක් ලබා දෙන්න!*");
      }

      await syncSubscriber(target, false);

      const items = await fetchSourceNews(NEWS_SOURCES[0].url);
      let sent;
      if (items.length) {
        sent = await dispatchNewsPost(sock, target, items[0], NEWS_SOURCES[0].tag);
        if (sent) markSeen(items[0].title);
      } else {
        sent = await dispatchNewsPost(sock, target, {
          title: "DARK-DINU AUTO NEWS ACTIVATED",
          publish: "Just Now",
          desc: "Dark-Dinu Auto News පද්ධතිය සාර්ථකව සම්බන්ධ විය.",
          link: "https://heshan.devofc.top/",
          image: null
        }, "SYSTEM");
      }

      react(sent ? "✅" : "⚠️");
      return reply(
`✨ *Auto-News සක්‍රීය කරන ලදී!* 🚀
━━━━━━━━━━━━━━━━━━━━━
📢 *Destination:* \`${target}\`
📡 *මූලාශ්‍ර:* Hiru News, Ada Derana, News First
⚡ *පළමු පුවත යැවීම:* ${sent ? "🟢 සාර්ථකයි!" : "⚠️ අසාර්ථකයි (Bot අදාළ Channel/Group එකේ Admin කෙනෙක් බව තහවුරු කරගන්න)"}

🛑 *නැවත නවත්වන්නේ කෙසේද:*
• \`${pref}delnews ${inputArg}\`

_අලුත් පුවත් ලැබෙන සැණින් ස්වයංක්‍රීයව මෙතැනට Update වේ._
💖 *DARK-DINU MD*`
      );
    }

    // 3. Help UI
    return reply(
`╔═════════════════════════════╗
   📰 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐍 𝐄 𝐖 𝐒
╚═════════════════════════════╝

💡 *ස්වයංක්‍රීය පුවත් සක්‍රීය කිරීමට:*
├ 📢 \`${pref}news <channel_link>\`
├ 👥 \`${pref}news <group_link>\`
├ 💬 \`${pref}news <chat_jid>\`
╰ 📍 \`${pref}news here\` (මෙම chat එකට)

🛑 *සේවාව නැවැත්වීමට:*
╰ 🔕 \`${pref}delnews <channel_link / jid>\`

📰 *එක් වරක් පුවතක් බැලීමට:*
╰ \`${pref}hirunews\` • \`${pref}derana\` • \`${pref}newsfirst\`

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
    );
  }
};
