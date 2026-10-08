export default {
  name: "jid",
  aliases: ["lid", "infojid", "who"],
  category: "utility",
  description: "Inspect JID, LID, and Chat metadata with cute styling",

  async execute({ sock, msg, from }) {
    // Microsecond instant cute reaction
    sock.sendMessage(from, { react: { text: "🏷️", key: msg.key } }).catch(() => {});

    try {
      const rawMsg = msg.message?.ephemeralMessage?.message || msg.message;
      const contextInfo =
        rawMsg?.extendedTextMessage?.contextInfo ||
        rawMsg?.imageMessage?.contextInfo ||
        rawMsg?.videoMessage?.contextInfo;

      const quotedParticipant = contextInfo?.participant;
      const mentionedJid = contextInfo?.mentionedJid?.[0];

      // O(1) Fast Priority Target Resolver
      const isGroup = from.endsWith("@g.us");
      const targetJid =
        quotedParticipant ||
        mentionedJid ||
        (isGroup ? (msg.key.participant || from) : (msg.key.fromMe ? (sock.user?.id || from) : from));

      // Resolve LID or Phone Number Context if available
      const targetLid = contextInfo?.participantPn || contextInfo?.remoteJid || "Not Provided";

      const metadataCard = 
`🎀 ｡ﾟ•┈୨ *JID & CHAT METADATA* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👤 *Target JID:* \`${targetJid}\`
  🆔 *Target LID:* \`${targetLid}\`
  📍 *Current Chat:* \`${from}\`
  💌 *Chat Type:* ${isGroup ? "Group Chat 👥" : "Direct Message 💌"}

━━━━━━━━━━━━━━━━━━━━━
✨ *Identity inspection complete softly~ (˶˃ ᵕ ˂˶)*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      await sock.sendMessage(from, { text: metadataCard }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[JID COMMAND ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Could not read JID metadata softly"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
