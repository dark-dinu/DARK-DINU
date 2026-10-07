import { jidNormalizedUser, delay } from "@whiskeysockets/baileys";
import axios from "axios";

// Memory & Hook Trackers
global.welcomedSessions = global.welcomedSessions || new Set();
global.connWatcherSockets = global.connWatcherSockets || new WeakSet();

const DEVELOPER_NUMBER = "94719845166";
const BOT_LOGO_URL = "https://files.catbox.moe/k315x4.jpg";

// Safe Image Buffer Cache (හැම පාරම download නොවී සුපිරි speed එකට යැවීමට)
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

// 100% Reliable Card Sender
async function sendCardMessage(sock, targetJid, captionText) {
  const imgBuffer = await getLogoBuffer();
  try {
    if (imgBuffer) {
      await sock.sendMessage(targetJid, {
        image: imgBuffer,
        caption: captionText
      });
    } else {
      // Image එක fail වුණොත් Text එක හෝ යවයි
      await sock.sendMessage(targetJid, { text: captionText });
    }
  } catch (err) {
    // Retry with plain text on socket error
    await sock.sendMessage(targetJid, { text: captionText }).catch(() => {});
  }
}

// Main Dispatcher Engine
async function dispatchWelcomeCards(sock, botPhone, force = false) {
  if (!force && global.welcomedSessions.has(botPhone)) return;
  global.welcomedSessions.add(botPhone);

  // Socket එක fully sync වෙනකම් පොඩි delay එකක්
  await delay(2000);

  const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour12: true });
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

  // 1. බොට් Link කරපු කෙනාට (Owner / Own Number)
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

  // WhatsApp normalized JID එක ලබා ගැනීම (Saved Messages වලට 100% deliver වේ)
  const ownerJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : `${botPhone}@s.whatsapp.net`;
  await sendCardMessage(sock, ownerJid, ownerCard);

  // 2. ඔයාට (Master Developer) Alert එකක්
  if (botPhone !== DEVELOPER_NUMBER) {
    const devAlertCard = 
`╔══════════════════════╗
   🚀 𝐍 𝐄 𝐖  𝐁 𝐎 𝐓  𝐋 𝐈 𝐍 𝐊 𝐄 𝐃
╚══════════════════════╝

┌─〔 👑 *DEVELOPER NOTIFICATION* 〕
├─▸ 🤖 *Linked Number* : +${botPhone}
├─▸ ⏰ *Linked Time*   : ${timeStr}
├─▸ 📅 *Date*          : ${dateStr}
├─▸ 🌐 *Cluster State* : Active (${global.activeSockets?.size || 1} Nodes)
└───────────────────────

> ⚡ නව Bot Node එකක් සාර්ථකව Pair වී Cloud එකට එක් විය!`;

    const devJid = `${DEVELOPER_NUMBER}@s.whatsapp.net`;
    await sendCardMessage(sock, devJid, devAlertCard);
  }
}

// Background Hook (Loop Overhead ඉවත් කර සකසන ලදී)
function hookConnectionListener(sock) {
  if (!sock || global.connWatcherSockets.has(sock)) return;
  global.connWatcherSockets.add(sock);

  // දැනටමත් online නම් වහාම check කර යැවීම
  if (sock.user?.id) {
    const botPhone = getBotPhone(sock);
    if (botPhone && !global.welcomedSessions.has(botPhone)) {
      dispatchWelcomeCards(sock, botPhone);
    }
  }

  // අනාගත reconnect/open events අල්ලා ගැනීම
  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      const botPhone = getBotPhone(sock);
      if (botPhone && !global.welcomedSessions.has(botPhone)) {
        dispatchWelcomeCards(sock, botPhone);
      }
    }
  });
}

// Optimized Cluster Watcher (CPU Freeze එක සම්පූර්ණයෙන්ම නැති කර ඇත)
if (!global.connWatcherIntervalStarted) {
  global.connWatcherIntervalStarted = true;
  setInterval(() => {
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        hookConnectionListener(s);
      }
    }
  }, 15000);
}

export default {
  name: "connection",
  aliases: ["testconn", "welcomecheck"],
  category: "owner",
  description: "Handles first-time bot link welcome cards for Owner and Developer",

  async execute({ sock, msg, from }) {
    const botPhone = getBotPhone(sock);
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // Manual Test (.testconn)
    await dispatchWelcomeCards(sock, botPhone, true);
    await sock.sendMessage(from, { text: "✅ Connecting Card එක සාර්ථකව යවන ලදී!" }, { quoted: msg });
  }
};
