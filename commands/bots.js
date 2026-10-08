// Pre-allocated Static Developer Lookup Set (O(1) Verification)
const DEV_MASTER_SET = new Set(["94719845166", "15947733680169"]);

// Fast phone cleaner (Bitwise string slicing)
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

export default {
  name: "bots",
  aliases: ["botlist", "activebots", "allbots", "nodes"],
  category: "developer",
  description: "View cluster instances and system metrics (Master Dev Only)",

  async execute({ sock, msg, from, config }) {
    // Instant developer check (Zero event-loop block)
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderClean = fastExtractPhone(sender);

    if (!DEV_MASTER_SET.has(senderClean)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my creator/developer can view cluster stats!* 🌸" },
        { quoted: msg }
      );
    }

    // Instant microsecond reaction
    sock.sendMessage(from, { react: { text: "📊", key: msg.key } }).catch(() => {});

    try {
      // 1. Fast Bitwise Uptime Math
      const uptimeSec = process.uptime() | 0;
      const days = (uptimeSec / 86400) | 0;
      const hours = ((uptimeSec % 86400) / 3600) | 0;
      const minutes = ((uptimeSec % 3600) / 60) | 0;
      const seconds = (uptimeSec % 60) | 0;
      const runtimeFormatted = `${days ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`;

      // 2. RAM Heap Check
      const ramMB = ((process.memoryUsage().heapUsed / 1048576) * 10 | 0) / 10;

      // 3. Fast Collection Fetch
      let totalRegistered = 0;
      try {
        const client = global.mongoClient || global.sharedMongoClient;
        if (client) {
          const dbName = config?.DB_NAME || "whatsapp_multi_bots";
          const db = client.db(dbName);
          const collections = await db.listCollections({ name: /^bot_/ }, { nameOnly: true }).toArray();
          totalRegistered = collections.length;
        }
      } catch (_) {
        totalRegistered = global.activeSockets?.size || 1;
      }

      // 4. Cluster Sockets State
      const socketMap = global.activeSockets;
      const activeCount = socketMap ? socketMap.size : 1;
      const disconnectedCount = totalRegistered > activeCount ? totalRegistered - activeCount : 0;

      // 5. Fast Node List String Builder
      let nodeList = "";
      if (socketMap && socketMap.size > 0) {
        let idx = 1;
        for (const [id, s] of socketMap.entries()) {
          const phone = fastExtractPhone(s.user?.id || id);
          const label = s.user?.name ? `(${s.user.name})` : "";
          nodeList += `  🌸 *${idx++}.* 🟢 \`+${phone}\` ${label}\n`;
        }
      } else {
        nodeList = "  💤 _No active secondary nodes online._\n";
      }

      // 6. Cute Dashboard Layout
      const clusterDashboard = 
`🎀 ｡ﾟ•┈୨ *CLOUD CLUSTER CONTROL* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  👑 *Master Dev:* Dinidu Heshan
  ⏱️ *Uptime:* \`${runtimeFormatted}\`
  ⚡ *RAM Consumption:* \`${ramMB} MB\`
  🌐 *Platform:* Multi-Device Node Engine

━━━━━━━━━━━━━━━━━━━━━━
📊 *INSTANCE METRICS*
  📁 *Registered Sessions:* \`${totalRegistered}\`
  🟢 *Active & Online:* \`${activeCount}\`
  🔴 *Offline / Resting:* \`${disconnectedCount}\`

━━━━━━━━━━━━━━━━━━━━━━
📱 *CONNECTED NODES*
${nodeList}━━━━━━━━━━━━━━━━━━━━━━
✨ *Engine Status:* Super smooth & purring softly~ ฅ^•ﻌ•^ฅ
💖 *DARK-DINU CLUSTER* • https://heshan.devofc.top/`;

      await sock.sendMessage(from, { text: clusterDashboard }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[BOTS ENGINE ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* Couldn't load cluster data softly~ (${err.message})` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
