import { delay } from "@whiskeysockets/baileys";

// Link වූ nodes නිරීක්ෂණය කරන Session Memory Store
global.welcomedSessions = global.welcomedSessions || new Set();
global.connWatcherSockets = global.connWatcherSockets || new WeakSet();

// Developer & Bot Info Settings
const DEVELOPER_NUMBER = "94719845166";
const BOT_LOGO_URL = "https://files.catbox.moe/k315x4.jpg"; // ඔයාගේ Bot Logo Link එක

function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

// Welcome Messages Dispatch Engine
async function dispatchWelcomeCards(sock, botPhone) {
  // එකම session එකකට දෙවරක් message යැවීම වැළැක්වීම
  if (global.welcomedSessions.has(botPhone)) return;
  global.welcomedSessions.add(botPhone);

  // Connection එක 100% establish වන තුරු තත්පර 3ක් රැඳී සිටීම
  await delay(3000);

  const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour12: true });
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

  // -------------------------------------------------------------------
  // 1. බොට් LINK කරපු කෙනාට (BOT OWNER) යන WELCOME MESSAGE එක
  // -------------------------------------------------------------------
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
├─▸ 💖 *Auto React Status: 🟢 ACTIVE
├─▸ 🎯 *Default Mode*   : PUBLIC
└───────────────────────

📌 *ප්‍රයෝජනවත් Commands:*
• \`.menu\` - විධාන ලැයිස්තුව ලබාගැනීමට
• \`.setting\` - Settings වෙනස් කිරීමට
• \`.mode\` - Public / Private මාරු කිරීමට

> 👑 *Developer:* DINIDU HESHAN
> ⚡ *Powered by Dark-Dinu Cloud Engine*`;

  const ownerJid = `${botPhone}@s.whatsapp.net`;
  try {
    await sock.sendMessage(ownerJid, {
      image: { url: BOT_LOGO_URL },
      caption: ownerCard
    });
  } catch (err) {
    console.error(`[!] Failed sending welcome to owner +${botPhone}:`, err.message);
  }

  // -------------------------------------------------------------------
  // 2. ඔයාට (MASTER DEVELOPER) එන ALERT MESSAGE එක
  // -------------------------------------------------------------------
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
    try {
      await sock.sendMessage(devJid, {
        image: { url: BOT_LOGO_URL },
        caption: devAlertCard
      });
    } catch (err) {
      console.error("[!] Failed sending alert to developer:", err.message);
    }
  }
}

// Background Listener (Socket එක Pair වූ මොහොත අල්ලා ගැනීම)
function hookConnectionListener(sock) {
  if (!sock || global.connWatcherSockets.has(sock)) return;
  global.connWatcherSockets.add(sock);

  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection === "open") {
      const botPhone = getBotPhone(sock);
      if (botPhone) {
        await dispatchWelcomeCards(sock, botPhone);
      }
    }
  });

  // දැනටමත් socket එක open වී ඇත්නම් (Immediate Sync)
  if (sock.user?.id) {
    const botPhone = getBotPhone(sock);
    if (botPhone && !global.welcomedSessions.has(botPhone)) {
      dispatchWelcomeCards(sock, botPhone);
    }
  }
}

// Active Bot Sockets සියල්ල පසුබිමෙන් Hook කිරීම
setInterval(() => {
  if (global.activeSockets) {
    for (const [, s] of global.activeSockets.entries()) {
      hookConnectionListener(s);
    }
  }
}, 2000);

export default {
  name: "connection",
  aliases: ["testconn", "welcomecheck"],
  category: "owner",
  description: "Handles first-time bot link welcome cards for Owner and Developer",

  async execute({ sock, msg, from }) {
    const botPhone = getBotPhone(sock);
    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    
    // Command එකෙන් Manual test කිරීමට (.testconn)
    global.welcomedSessions.delete(botPhone);
    await dispatchWelcomeCards(sock, botPhone);
    await sock.sendMessage(from, { text: "✅ Test Connecting Card සාර්ථකව යවන ලදී!" }, { quoted: msg });
  }
};
