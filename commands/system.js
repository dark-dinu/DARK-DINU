import os from "os";

export default {
  name: "system",
  aliases: ["node", "ram", "uptime", "status"],
  category: "system",
  description: "Check system resources and active bot instances",

  async execute({ sock, msg, from, activeBotsCount }) {
    try {
      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const usedMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

      // Current Bot ID / Number
      const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      const currentNode = botNumber ? `bot_${botNumber}` : "cluster_node_main";

      // Active Nodes Count
      const nodesCount = global.activeSockets?.size || activeBotsCount || 1;

      const dashboard = 
`⚡ *DARK-DINU CORE ENGINE* ⚡

🤖 *Active Node:* \`${currentNode}\`
🌐 *Total Connected Nodes:* \`${nodesCount}\`
⏳ *Uptime:* \`${hours}h ${mins}m ${secs}s\`
🧠 *Memory Usage:* \`${usedMem} MB\`
🖥️ *Total Host RAM:* \`${totalMem} GB\`
🖤 *Status:* \`OPTIMAL\``;

      await sock.sendMessage(from, { text: dashboard }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (e) {
      console.error("[SYSTEM ERROR]:", e);
    }
  }
};
