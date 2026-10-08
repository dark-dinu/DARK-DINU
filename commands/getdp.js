import axios from "axios";

// Fast sub-nanosecond JID cleaner
function fastCleanJid(raw = "") {
  const atIdx = raw.indexOf("@");
  const base = atIdx !== -1 ? raw.slice(0, atIdx) : raw;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

export default {
  name: "getdp",
  aliases: ["dp", "pfp", "getpfp"],
  category: "utility",
  description: "Download profile picture of user or group in cute HD",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";

    // Instant microsecond cute reaction
    sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    try {
      let targetJid = null;
      let targetType = "User";

      const rawMsg = msg.message?.ephemeralMessage?.message || msg.message;
      const contextInfo =
        rawMsg?.extendedTextMessage?.contextInfo ||
        rawMsg?.imageMessage?.contextInfo ||
        rawMsg?.videoMessage?.contextInfo;

      const quotedParticipant = contextInfo?.participant;
      const mentionedJid = contextInfo?.mentionedJid?.[0];
      const inputNumber = args[0] ? fastCleanJid(args[0]) : null;

      // 1. O(1) Fast Priority Target Resolver
      if (quotedParticipant) {
        targetJid = `${fastCleanJid(quotedParticipant)}@s.whatsapp.net`;
        targetType = "User";
      } else if (mentionedJid) {
        targetJid = `${fastCleanJid(mentionedJid)}@s.whatsapp.net`;
        targetType = "User";
      } else if (inputNumber && inputNumber.length >= 7) {
        targetJid = `${inputNumber}@s.whatsapp.net`;
        targetType = "User";
      } else if (from.endsWith("@g.us")) {
        targetJid = from;
        targetType = "Group";
      } else if (from.endsWith("@s.whatsapp.net")) {
        targetJid = `${fastCleanJid(from)}@s.whatsapp.net`;
        targetType = "User";
      }

      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *GET DP GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  • Reply to any sweet user's message with *${pref}getdp*
  • Tag a user: *${pref}getdp @user*
  • Send in a group to fetch Group Icon: *${pref}getdp*

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      // 2. High-Speed Profile Picture Fetch Pipeline
      let dpUrl = null;
      try {
        dpUrl = await Promise.race([
          sock.profilePictureUrl(targetJid, "image"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500))
        ]);
      } catch (_) {
        try {
          dpUrl = await Promise.race([
            sock.profilePictureUrl(targetJid, "preview"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500))
          ]);
        } catch (__) {
          dpUrl = null;
        }
      }

      if (!dpUrl) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: `🌸 *No Profile Picture found!* Either privacy settings are hiding it or no avatar is set for this ${targetType.toLowerCase()}, honey~`
          },
          { quoted: msg }
        );
      }

      const displayTarget = targetType === "Group" ? "Group Icon" : `+${fastCleanJid(targetJid)}`;

      // Cute Pastel Layout
      const captionCard = 
`🎀 ｡ﾟ•┈୨ *PROFILE PICTURE* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👤 *Target:* \`${displayTarget}\`
  ✨ *Quality:* Crisp HD Stream (˶˃ ᵕ ˂˶)
  🍰 *Type:* ${targetType} Profile Avatar

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 3. Fast Zero-Overhead Direct Media Dispatch
      await sock.sendMessage(
        from,
        {
          image: { url: dpUrl },
          caption: captionCard
        },
        { quoted: msg }
      );

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[GETDP ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Could not fetch DP softly"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
