import { MongoClient } from "mongodb";

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
      await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await reply("⛔ මෙම Command එක භාවිතා කළ හැක්කේ Master Developer ට පමණි!");
    }

    try {
      await sock.sendMessage(from, { react: { text: "📊", key: msg.key } }).catch(() => {});

      // 2. Server Runtime Calculation
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const runtimeFormatted = `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m ${seconds}s`;

      // 3. RAM Usage
      const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      // 4. Database Total Bots Count (MongoDB bot_ collections ගණනය කිරීම)
      let totalSessions = 0;
      try {
        const client = new MongoClient(config.MONGODB_URI);
        await client.connect();
        const db = client.db(config.DB_NAME);
        const collections = await db.listCollections().toArray();
        totalSessions = collections.filter(c => c.name.startsWith("bot_")).length;
        await client.close();
      } catch (_) {
        totalSessions = global.activeSockets?.size || 1;
      }

      // 5. Active Sockets Pool
      const botPool = global.activeSockets 
        ? Array.from(global.activeSockets.values()) 
        : [sock];
      const activeCount = botPool.length;
      const disconnectedCount = Math.max(0, totalSessions - activeCount);

      // 6. Active Bot Phone Numbers Format කිරීම
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
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("[BOTS CMD ERROR]:", error.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Data ලබා ගැනීමේදී දෝෂයක් මතු විය: ${error.message}`);
    }
  }
};
