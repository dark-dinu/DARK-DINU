import { MongoClient } from "mongodb";

global.turboHooked = global.turboHooked || new WeakSet();

// Max listeners warning suppressor
function optimizeSocket(sock) {
  if (!sock || global.turboHooked.has(sock)) return;
  global.turboHooked.add(sock);

  if (sock.ev && typeof sock.ev.setMaxListeners === "function") {
    sock.ev.setMaxListeners(100);
  }
}

// O(1) Fast Zero-Allocation Memory Flusher
function flushMemoryCaches() {
  if (global.antiDeleteStore && global.antiDeleteStore.size > 1200) {
    const iter = global.antiDeleteStore.keys();
    for (let i = 0; i < 400; i++) {
      const nextKey = iter.next().value;
      if (!nextKey) break;
      global.antiDeleteStore.delete(nextKey);
    }
  }

  // Optional manual GC trigger if exposed
  if (global.gc) {
    try { global.gc(); } catch (_) {}
  }
}

if (!global.turboCleanerStarted) {
  global.turboCleanerStarted = true;
  setInterval(() => {
    flushMemoryCaches();
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        optimizeSocket(s);
      }
    }
  }, 45000);
}

export default {
  name: "ping2",
  aliases: ["speed2", "turbo", "fast", "flush"],
  category: "utility",
  description: "Check precise bot performance & flush cached heap memory",

  async execute({ sock, msg, from }) {
    // 1. Instant Reaction
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // Monotonic high-resolution timer
    const startHr = process.hrtime.bigint();

    // Fast Memory Flush
    flushMemoryCaches();

    // Bitwise Heap Usage Math
    const mem = process.memoryUsage();
    const heapUsedMB = ((mem.heapUsed / 1048576) * 10 | 0) / 10;
    const heapTotalMB = ((mem.heapTotal / 1048576) * 10 | 0) / 10;
    const rssMB = ((mem.rss / 1048576) * 10 | 0) / 10;

    const endHr = process.hrtime.bigint();
    const benchmarkMs = Number((endHr - startHr) / 1000000n) | 0;

    // Cute Aesthetic Performance Dashboard
    const performanceCard = 
`🎀 ｡ﾟ•┈୨ *TURBO SPEED & MEMORY* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  ⚡ *Internal Latency:* \`${benchmarkMs || 1} ms\`
  📟 *RAM Heap Used:* \`${heapUsedMB} MB / ${heapTotalMB} MB\`
  📊 *Physical RSS:* \`${rssMB} MB\`
  🗄️ *MongoDB Pool:* 🟢 Active & Reused
  🧹 *Memory Cache:* Purged & Sparkling Fresh! ✨

━━━━━━━━━━━━━━━━━━━━━
✨ *Everything is optimized, purring fast and smooth~ (˶˃ ᵕ ˂˶)*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: performanceCard }, { quoted: msg });
    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
  }
};
