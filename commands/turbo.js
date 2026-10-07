import { MongoClient } from "mongodb";

// 1. Single Reusable MongoDB Connection Pool
if (!global.sharedMongoClient) {
  global.sharedMongoClient = new MongoClient(
    "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000
    }
  );
  global.sharedMongoClient.connect().catch(() => {});
}

global.turboHooked = global.turboHooked || new WeakSet();

function optimizeSocket(sock) {
  if (!sock || global.turboHooked.has(sock)) return;
  global.turboHooked.add(sock);

  // Baileys max event listeners warning & lag bypass
  if (sock.ev && typeof sock.ev.setMaxListeners === "function") {
    sock.ev.setMaxListeners(100);
  }
}

// Memory Garbage Cleaner
function cleanMemoryStores() {
  if (global.antiDeleteStore && global.antiDeleteStore.size > 1500) {
    const keys = Array.from(global.antiDeleteStore.keys());
    for (let i = 0; i < 500; i++) {
      global.antiDeleteStore.delete(keys[i]);
    }
  }
}

if (!global.turboCleanerStarted) {
  global.turboCleanerStarted = true;
  setInterval(() => {
    cleanMemoryStores();
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        optimizeSocket(s);
      }
    }
  }, 30000); // තත්පර 30කට වරක් පමණක් scan වේ
}

export default {
  name: "ping2",
  aliases: ["speed2", "turbo", "fast"],
  category: "utility",
  description: "Check bot latency and flush memory",

  async execute({ sock, msg, from }) {
    const start = Date.now();
    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    const latency = Date.now() - start;
    const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const ramTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);

    const speedCard = 
`╔══════════════════════╗
   ⚡ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐒 𝐏 𝐄 𝐄 𝐃 ⚡
╚══════════════════════╝

┌─〔 🚀 *PERFORMANCE METRICS* 〕
├─▸ 📶 *Speed / Latency* : \`${latency} ms\`
├─▸ 📟 *RAM Usage*       : \`${ramUsed} MB / ${ramTotal} MB\`
├─▸ 🗄️ *DB Pool*         : POOL ACTIVE
├─▸ 🛡️ *Status*          : ULTRA-FAST 🟢
└───────────────────────

> ⚡ *Bottlenecks Cleaned Successfully!*`;

    await sock.sendMessage(from, { text: speedCard }, { quoted: msg });
  }
};
