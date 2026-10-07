export default {
  name: "jid",
  aliases: ["lid", "infojid", "who"],
  category: "utility",
  description: "Inspect JID, LID, and Chat metadata",

  async execute({ sock, msg, from }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const targetJid = quoted?.participant || (from.endsWith("@g.us") ? msg.key.participant : from);
      const targetLid = quoted?.participantPn || "N/A";
      const isGroup = from.endsWith("@g.us");

      const text = 
`🎯 *DARK-DINU METADATA* 🎯

👤 *Target JID:* \`${targetJid}\`
🆔 *Target LID:* \`${targetLid}\`
📍 *Chat JID:* \`${from}\`
👥 *Chat Type:* ${isGroup ? "Group Chat" : "Direct Message"}`;

      await sock.sendMessage(from, { text }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
    } catch (e) {
      console.error("[JID ERROR]:", e.message);
    }
  }
};
