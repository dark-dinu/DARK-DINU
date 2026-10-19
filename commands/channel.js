import { delay } from "@whiskeysockets/baileys";

// Fast Invite Code Extractor
function extractInviteCode(input = "") {
  const match = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)/i);
  return match ? match[1] : input.trim();
}

export default {
  name: "channel",
  aliases: ["cfollow", "ch", "newsletter"],
  category: "owner",
  description: "Channel utilities and follower engine",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const activeSockets = global.activeSockets || new Map();
    const socketsList = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

    // 1. Manual Channel Follow Command: .channel follow <link> හෝ .cfollow <link>
    if (args[0]?.toLowerCase() === "follow" || args[0]?.toLowerCase() === "fix") {
      const targetLink = args.slice(1).join(" ").trim();
      const code = targetLink ? extractInviteCode(targetLink) : null;

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      let successCount = 0;
      for (const s of socketsList) {
        try {
          if (typeof s.newsletterFollow === "function") {
            if (code) {
              await s.newsletterFollow(code);
            }
            successCount++;
          }
        } catch (_) {}
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `✨ *Channel Followed!* Online nodes *${successCount}/${socketsList.length}* ක් සාර්ථකව follow කරන ලදී.` },
        { quoted: msg }
      );
    }

    // 2. Default Status Panel (Auto-react තත්ත්වය බලාගැනීම)
    sock.sendMessage(from, { react: { text: "🌸", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL AUTO-REACT STATUS* ୧┈•ﾟ｡ 🐾

⚡ *Core Engine:* Managed via Core System
📢 *Active Monitored Channels:* ${global.targetNewsletterJids ? global.targetNewsletterJids.size : 5}
🤖 *Active Cluster Nodes:* \`${socketsList.length} Online\`

💡 *Manual Commands:*
• *${pref}channel follow <link>* — අලුත් චැනල් එකක් follow කරවීමට

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
