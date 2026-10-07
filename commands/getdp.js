export default {
  name: "getdp",
  aliases: ["dp", "pfp", "getpfp"],
  category: "utility",
  description: "Download profile picture of current chat, user, or group in HD quality",

  async execute({ sock, msg, from, args, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetJid = null;
      let targetType = "User";

      // 1. Quoted Message එකක Sender හඳුනාගැනීම
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      
      // 2. Mention කර ඇති අය හඳුනාගැනීම
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      // 3. Command එකෙන් අංකයක් ලබාදී තිබේදැයි බැලීම (උදා: .getdp 947xxxxxxxx)
      const inputNumber = args[0]?.replace(/[^0-9]/g, "");

      if (quotedParticipant) {
        const cleanQuoted = quotedParticipant.split("@")[0].split(":")[0];
        targetJid = `${cleanQuoted}@s.whatsapp.net`;
        targetType = "User";
      } else if (mentionedJid) {
        const cleanMention = mentionedJid.split("@")[0].split(":")[0];
        targetJid = `${cleanMention}@s.whatsapp.net`;
        targetType = "User";
      } else if (inputNumber && inputNumber.length >= 8) {
        targetJid = `${inputNumber}@s.whatsapp.net`;
        targetType = "User";
      } else if (from.endsWith("@g.us")) {
        // Group එකක් ඇතුළේ direct .getdp ගැහුවොත් Group Icon එක ලබාගැනීම
        targetJid = from;
        targetType = "Group";
      } else if (from.endsWith("@s.whatsapp.net")) {
        // Private chat එකක direct .getdp ගැහුවොත් sender ගේ DP එක ලබාගැනීම
        const cleanFrom = from.split("@")[0].split(":")[0];
        targetJid = `${cleanFrom}@s.whatsapp.net`;
        targetType = "User";
      }

      if (!targetJid) {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතය:* චැට් එකේදී \`${prefix}getdp\` හෝ පණිවිඩයකට reply කර \`${prefix}getdp\` ලෙස යවන්න.`
          },
          { quoted: msg }
        );
      }

      // WhatsApp Server එකෙන් Profile Picture URL එක ලබාගැනීම (HD -> Preview Fallback)
      let dpUrl = null;
      try {
        dpUrl = await sock.profilePictureUrl(targetJid, "image");
      } catch (_) {
        try {
          dpUrl = await sock.profilePictureUrl(targetJid, "preview");
        } catch (__) {
          dpUrl = null;
        }
      }

      if (!dpUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: `❌ මෙම ${targetType === "Group" ? "Group එක සඳහා Icon එකක්" : "User සඳහා Profile Picture එකක්"} නොමැත හෝ එය Privacy Settings මඟින් සඟවා ඇත.`
          },
          { quoted: msg }
        );
      }

      const cleanNumber = targetJid.split("@")[0].split(":")[0];
      const captionText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🖼️ *PROFILE PICTURE* 〕
├─▸ 👤 *Target*  : ${targetType === "Group" ? "Group Icon" : `+${cleanNumber}`}
├─▸ ⚡ *Quality* : High Definition (HD)
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(
        from,
        {
          image: { url: dpUrl },
          caption: captionText
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[GETDP ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          text: `❌ DP ලබාගැනීම අසාර්ථක විය: ${err.message}`
        },
        { quoted: msg }
      );
    }
  }
};
