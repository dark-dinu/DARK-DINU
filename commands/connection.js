import { jidNormalizedUser, delay } from "@whiskeysockets/baileys";
import axios from "axios";
import fs from "fs";
import path from "path";

// Static Developer Lookup & Constants
const DEVELOPER_NUMBER = "94719845166";
const BOT_LOGO_FALLBACK = "https://files.catbox.moe/k315x4.jpg";

// High-speed In-Memory State Cache
global.connWatcherSockets = global.connWatcherSockets || new WeakSet();
global.activeNotifiedCache = global.activeNotifiedCache || new Set();

// Pre-allocated Global Logo Buffer (Loads once into RAM)
let preloadedLogoBuffer = null;

(async function initLogoMemory() {
  try {
    const localPaths = [
      path.join(process.cwd(), "logo.jpg"),
      path.join(process.cwd(), "logo.png"),
      path.join(process.cwd(), "assets", "logo.jpg"),
      path.join(process.cwd(), "assets", "logo.png")
    ];

    for (const p of localPaths) {
      if (fs.existsSync(p)) {
        preloadedLogoBuffer = fs.readFileSync(p);
        return;
      }
    }

    const res = await axios.get(BOT_LOGO_FALLBACK, {
      responseType: "arraybuffer",
      timeout: 8000
    });
    preloadedLogoBuffer = Buffer.from(res.data);
  } catch (_) {
    preloadedLogoBuffer = null;
  }
})();

// Fast phone extraction helper
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

// Persistent Check via Shared MongoDB Client
async function isAlreadyWelcomed(botPhone) {
  if (global.activeNotifiedCache.has(botPhone)) return true;
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (!client) return false;
    const db = client.db("whatsapp_multi_bots");
    const doc = await db.collection("cluster_links").findOne({ botPhone });
    if (doc?.welcomed) {
      global.activeNotifiedCache.add(botPhone);
      return true;
    }
  } catch (_) {}
  return false;
}

async function markAsWelcomed(botPhone) {
  global.activeNotifiedCache.add(botPhone);
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (!client) return;
    const db = client.db("whatsapp_multi_bots");
    await db.collection("cluster_links").updateOne(
      { botPhone },
      { $set: { botPhone, welcomed: true, linkedAt: new Date() } },
      { upsert: true }
    );
  } catch (_) {}
}

// Ultra-fast Card Dispatcher
async function sendCardMessage(sock, targetJid, captionText) {
  const logoPayload = preloadedLogoBuffer || { url: BOT_LOGO_FALLBACK };
  try {
    await sock.sendMessage(targetJid, {
      image: logoPayload,
      caption: captionText
    });
  } catch (_) {
    await sock.sendMessage(targetJid, { text: captionText }).catch(() => {});
  }
}

// Low-latency Welcome Card Engine
export async function dispatchWelcomeCards(sock, botPhone, isForce = false) {
  if (!botPhone) return;

  if (!isForce) {
    const alreadyDone = await isAlreadyWelcomed(botPhone);
    if (alreadyDone) return;
  }

  await markAsWelcomed(botPhone);
  await delay(1500);

  const timeStr = new Date().toLocaleTimeString("en-US", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

  // 1. Cute Bot Owner Card
  const ownerCard = 
`🎀 ｡ﾟ•┈୨ *CONNECTED & PURRING* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🌸 *Your Bot Node:* \`+${botPhone}\`
  📶 *Status:* Active 24/7 Cloud (˶˃ ᵕ ˂˶)
  ⏰ *Linked Time:* ${timeStr}
  📅 *Date:* ${dateStr}
  ✨ *Prefix:* \`.\`

━━━━━━━━━━━━━━━━━━━━━
🛡️ *ACTIVE DEFENSE SHIELDS*
  🛡️ *Anti-Delete:* 🟢 Active & Guarding
  👁️ *Status Auto-Read:* 🟢 Active
  💖 *Cute Auto-React:* 🟢 Active
  🎯 *Default Mode:* Public

━━━━━━━━━━━━━━━━━━━━━
🍬 *Sweet Useful Commands:*
  • *.menu* — Browse all commands 🌸
  • *.alive* — Check bot heartbeat ✨
  • *.antidelete* — Toggle delete monitor 🐾

💖 *DARK-DINU CLUSTER* • https://heshan.devofc.top/`;

  const ownerJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : `${botPhone}@s.whatsapp.net`;

  // Parallel Non-Blocking Dispatch (Owner + Developer)
  const tasks = [sendCardMessage(sock, ownerJid, ownerCard)];

  if (botPhone !== DEVELOPER_NUMBER) {
    const activeNodesCount = global.activeSockets?.size || 1;
    const devAlertCard = 
`🎀 ｡ﾟ•┈୨ *NEW BOT NODE LINKED* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👑 *Cluster Dev Alert*
  📱 *Linked Number:* \`+${botPhone}\`
  🕒 *Connected Time:* ${timeStr}
  📅 *Date:* ${dateStr}
  🌐 *Active Cloud Nodes:* \`${activeNodesCount} Instances\`

━━━━━━━━━━━━━━━━━━━━━
✨ *A fresh bot node has successfully paired and joined the cloud cluster!* 🐾`;

    const devJid = `${DEVELOPER_NUMBER}@s.whatsapp.net`;
    tasks.push(sendCardMessage(sock, devJid, devAlertCard));
  }

  await Promise.allSettled(tasks);
}

// Low-latency Socket Watcher Hook
export function hookConnectionListener(sock) {
  if (!sock || global.connWatcherSockets.has(sock)) return;
  global.connWatcherSockets.add(sock);

  if (sock.user?.id) {
    const botPhone = getBotPhone(sock);
    if (botPhone) {
      dispatchWelcomeCards(sock, botPhone, false);
    }
  }
}

export default {
  name: "connection",
  aliases: ["testconn"],
  category: "owner",
  description: "Test cute bot welcome cards with logo banner",

  async execute({ sock, msg, from }) {
    const botPhone = getBotPhone(sock);
    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    await dispatchWelcomeCards(sock, botPhone, true);
    await sock.sendMessage(
      from,
      { text: "✨ *Yay!* Test connection card with logo sent successfully, sweetheart! 🌸" },
      { quoted: msg }
    );
  }
};
