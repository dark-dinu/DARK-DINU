export default {
  name: "jid",
  aliases: ["lid", "infojid", "who"],
  category: "utility",
  description: "Inspect JID, LID, and Chat metadata",

  async execute({ sock, msg, from }) {
    // Non-blocking Reaction (Instant trigger)
    sock.sendMessage(from, { react: { text: "🕷️", key: msg.key } }).catch(() => {});

    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedParticipant = contextInfo?.participant;
      const mentionedJid = contextInfo?.mentionedJid?.[0];

      // Target JID Resolve
      const targetJid = 
        quotedParticipant || 
        mentionedJid || 
        (from.endsWith("@g.us") ? (msg.key.participant || from) : from);

      const targetLid = contextInfo?.participantPn || "N/A";
      const isGroup = from.endsWith("@g.us");

      const text = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎯 *CHAT & ID METADATA* 〕
├─▸ 👤 *Target JID:* \`${targetJid}\`
├─▸ 🆔 *Target LID:* \`${targetLid}\`
├─▸ 📍 *Chat JID:* \`${from}\`
├─▸ 👥 *Chat Type:* ${isGroup ? "Group Chat" : "Direct Message"}
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (e) {
      console.error("[JID ERROR]:", e.message);
    }
  }
};
