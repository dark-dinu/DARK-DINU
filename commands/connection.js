import { jidNormalizedUser, delay } from "@whiskeysockets/baileys";
import { MongoClient } from "mongodb";
import axios from "axios";

// Global Shared DB Pool
global.sharedMongoClient = global.sharedMongoClient || new MongoClient(
  "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  {
    maxPoolSize: 10,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 5000
  }
);
global.sharedMongoClient.connect().catch(() => {});

global.connWatcherSockets = global.connWatcherSockets || new WeakSet();
global.activeNotifiedCache = global.activeNotifiedCache || new Set();

const DEVELOPER_NUMBER = "94719845166";
const BOT_LOGO_URL = "https://files.catbox.moe/k315x4.jpg";

let cachedLogoBuffer = null;
async function getLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    const res = await axios.get(BOT_LOGO_URL, { responseType: "arraybuffer", timeout: 8000 });
    cachedLogoBuffer = Buffer.from(res.data);
    return cachedLogoBuffer;
  } catch (_) {
    return null;
  }
}

function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

// MongoDB එකේ කලින් Notify කර ඇත්දැයි බැලීම (Persistent Check)
async function isAlreadyWelcomed(botPhone) {
  if (global.activeNotifiedCache.has(botPhone)) return true;
  try {
    const db = global.sharedMongoClient.db("whatsapp_multi_bots");
    const col = db.collection("cluster_links");
    const doc = await col.findOne({ botPhone });
    if (doc?.welcomed) {
      global.activeNotifiedCache.add(botPhone);
      return true;
    }
  } catch (_) {}
  return false;
}

// MongoDB එකේ Welcome Sent ලෙස Mark කිරීම
async function markAsWelcomed(botPhone) {
  global.activeNotifiedCache.add(botPhone);
  try {
    const db = global.sharedMongoClient.db("whatsapp_multi_bots");
    const col = db.collection("cluster_links");
    await col.updateOne(
      { botPhone },
      { $set: { botPhone, welcomed: true, linkedAt: new Date() } },
      { upsert: true }
    );
  } catch (_) {}
}

async function sendCardMessage(sock, targetJid, captionText) {
  const imgBuffer = await getLogoBuffer();
  try {
    if (imgBuffer) {
      await sock.sendMessage(targetJid, {
        image: imgBuffer,
        caption: captionText
      });
    } else {
      await sock.sendMessage(targetJid, { text: captionText });
    }
  } catch (_) {
    await sock.sendMessage(targetJid, { text: captionText }).catch(() => {});
  }
}

async function dispatchWelcomeCards(sock, botPhone, isForce = false) {
  if (!botPhone) return;

  // Manual test එකක් නොවේ නම් සහ දැනටමත් message ගොස් ඇත්නම් කිසිසේත්ම යවන්නේ නැත
  if (!isForce) {
    const alreadyDone = await isAlreadyWelcomed(botPhone);
    if (alreadyDone) return;
  }

  // Welcome Sent ලෙස කලින්ම mark කර නැවත loop වීම වළක්වයි
  await markAsWelcomed(botPhone);
  await delay(2000);

  const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour12: true });
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

  // 1. Bot Owner
  const ownerCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 ⚡ *BOT CONNECTED SUCCESSFULLY* 〕
├─▸ 🤖 *Your Bot Node* : +${botPhone}
├─▸ 📶 *Status*        : ONLINE (24/7)
├─▸ ⏰ *Connected Time*: ${timeStr}
├─▸ 📅 *Date*          : ${dateStr}
├─▸ ⚙️ *Prefix*        : [ . ]
└───────────────────────

┌─〔 🛡️ *PRE-CONFIGURED ENGINES* 〕
├─▸ 🛡️ *Anti-Delete*    : 🟢 ACTIVE
├─▸ 👁️ *Auto Seen Status*: 🟢 ACTIVE
├─▸ 💖 *Auto React Status*: 🟢 ACTIVE
├─▸ 🎯 *Default Mode*   : PUBLIC
└───────────────────────

📌 *ප්‍රයෝජනවත් Commands:*
• \`.menu\` - විධාන ලැයිස්තුව ලබාගැනීමට
• \`.setting\` - Settings වෙනස් කිරීමට
• \`.mode\` - Public / Private මාරු කිරීමට

> 👑 *Developer:* DINIDU HESHAN
> ⚡ *Powered by Dark-Dinu Cloud Engine*`;

  const ownerJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : `${botPhone}@s.whatsapp.net`;
  await sendCardMessage(sock, ownerJid, ownerCard);

  // 2. Master Developer Alert
  if (botPhone !== DEVELOPER_NUMBER) {
    const activeNodesCount = global.activeSockets?.size || 1;
    const devAlertCard = 
`╔══════════════════════╗
   🚀 𝐍 𝐄 𝐖  𝐁 𝐎 𝐓  𝐋 𝐈 𝐍 𝐊 𝐄 𝐃
╚══════════════════════╝

┌─〔 👑 *DEVELOPER NOTIFICATION* 〕
├─▸ 🤖 *Linked Number* : +${botPhone}
├─▸ ⏰ *Linked Time*   : ${timeStr}
├─▸ 📅 *Date*          : ${dateStr}
├─▸ 🌐 *Cluster State* : Active (${activeNodesCount} Nodes)
└───────────────────────

> ⚡ නව Bot Node එකක් සාර්ථකව Pair වී Cloud එකට එක් විය!`;

    const devJid = `${DEVELOPER_NUMBER}@s.whatsapp.net`;
    await sendCardMessage(sock, devJid, devAlertCard);
  }
}

function hookConnectionListener(sock) {
  if (!sock || global.connWatcherSockets.has(sock)) return;
  global.connWatcherSockets.add(sock);

  // Reconnect වෙනකොට message එක නොයන පරිදි connection update එකෙන් dispatchWelcomeCards අයින් කර ඇත
  if (sock.user?.id) {
    const botPhone = getBotPhone(sock);
    if (botPhone) {
      dispatchWelcomeCards(sock, botPhone, false);
    }
  }
}

// Background Scan (Zero Memory Overhead)
if (!global.connWatcherIntervalStarted) {
  global.connWatcherIntervalStarted = true;
  setInterval(() => {
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        hookConnectionListener(s);
      }
    }
  }, 20000);
}

export default {
  name: "connection",
  aliases: ["testconn"],
  category: "owner",
  description: "Handles one-time bot link welcome cards (MongoDB Guarded)",

  async execute({ sock, msg, from }) {
    const botPhone = getBotPhone(sock);
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // Manual Test (.testconn) සඳහා පමණක් force = true වේ
    await dispatchWelcomeCards(sock, botPhone, true);
    await sock.sendMessage(from, { text: "✅ Test Connecting Card සාර්ථකව යවන ලදී!" }, { quoted: msg });
  }
};
