import { MongoClient } from "mongodb";

// Global Shared DB Pool Re-use
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

export default {
  name: "bots",
  aliases: ["botlist", "activebots", "allbots"],
  category: "developer",
  description: "View all active, disconnected bots & system metrics (Developer Only)",

  async execute({ sock, msg, from, config }) {
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    // 1. Strict Developer Verification
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderClean = String(sender).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

    const devNumbers = ["94719845166", "15947733680169"];
    const isDeveloper = devNumbers.includes(senderClean) || sender.includes("15947733680169");

    if (!isDeveloper) {
      sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await reply("⛔ මෙම Command එක භාවිතා කළ හැක්කේ Master Developer ට පමණි!");
    }

    try {
      // Non-blocking Reaction
      sock.sendMessage(from, { react: { text: "📊", key: msg.key } }).catch(() => {});

      // 2. Server Runtime
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const runtimeFormatted = `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m ${seconds}s`;

      // 3. RAM Usage
      const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      // 4. Ultra-Fast Bot Collections Count (Using Persistent Shared Pool)
      let totalSessions = 0;
      try {
        const dbName = config?.DB_NAME || "whatsapp_multi_bots";
        const db = global.sharedMongoClient.db(dbName);
        // Fast optimized filter for collections starting with "bot_"
        const botCols = await db.listCollections({ name: /^bot_/ }, { nameOnly: true }).toArray();
        totalSessions = botCols.length;
      } catch (_) {
        totalSessions = global.activeSockets?.size || 1;
      }

      // 5. Active Sockets Pool
      const botPool = global.activeSockets 
        ? Array.from(global.activeSockets.values()) 
        : [sock];
      const activeCount = botPool.length;
      const disconnectedCount = Math.max(0, totalSessions - activeCount);

      // 6. Active Nodes Formatting
      let activeListText = "";
      if (activeCount > 0) {
        botPool.forEach((s, index) => {
          const botNum = (s.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
          const name = s.user?.name ? `(${s.user.name})` : "";
          activeListText += `│  ${index + 1}. 🟢 +${botNum || "Active Node"} ${name}\n`;
        });
      } else {
        activeListText = "│  _No active bots currently._\n";
      }

      const reportMessage = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 👑 *DEVELOPER CONTROL* 〕
├─▸ 🤖 *System:* MULTI-DEVICE CLUSTER
├─▸ ⏳ *Runtime:* ${runtimeFormatted}
├─▸ 📟 *RAM Usage:* ${ramUsed} MB
└───────────────────────

┌─〔 📊 *BOT STATISTICS* 〕
├─▸ 📁 *Registered:* ${totalSessions}
├─▸ 🟢 *Online:* ${activeCount}
├─▸ 🔴 *Disconnected:* ${disconnectedCount}
└───────────────────────

┌─〔 📱 *ACTIVE NODES* 〕
${activeListText}└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> ⚡ *Status:* Operational 24/7`;

      await sock.sendMessage(from, { text: reportMessage }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("[BOTS CMD ERROR]:", error.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Data ලබා ගැනීමේදී දෝෂයක් මතු විය: ${error.message}`);
    }
  }
};
