import axios from "axios";

export default {
  name: "getdp",
  aliases: ["dp", "pfp", "getpfp"],
  category: "utility",
  description: "Download profile picture of current chat, user, or group in HD quality",

  async execute({ sock, msg, from, args, config }) {
    const prefix = config?.PREFIX || ".";
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    try {
      // Non-blocking Reaction
      sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetJid = null;
      let targetType = "User";

      // 1. Quoted Message Sender
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedParticipant = contextInfo?.participant;
      const mentionedJid = contextInfo?.mentionedJid?.[0];
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
        targetJid = from;
        targetType = "Group";
      } else if (from.endsWith("@s.whatsapp.net")) {
        const cleanFrom = from.split("@")[0].split(":")[0];
        targetJid = `${cleanFrom}@s.whatsapp.net`;
        targetType = "User";
      }

      if (!targetJid) {
        return await reply(`⚠️ *භාවිතය:* චැට් එකේදී \`${prefix}getdp\` හෝ පණිවිඩයකට reply කර \`${prefix}getdp\` ලෙස යවන්න.`);
      }

      // 2. Fast Profile Picture Fetch with Timeout Protection
      let dpUrl = null;
      try {
        dpUrl = await Promise.race([
          sock.profilePictureUrl(targetJid, "image"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
        ]);
      } catch (_) {
        try {
          dpUrl = await Promise.race([
            sock.profilePictureUrl(targetJid, "preview"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
          ]);
        } catch (__) {
          dpUrl = null;
        }
      }

      if (!dpUrl) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply(`❌ මෙම ${targetType === "Group" ? "Group එක සඳහා Icon එකක්" : "User සඳහා Profile Picture එකක්"} නොමැත හෝ Privacy Settings මඟින් සඟවා ඇත.`);
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

      // 3. Fast Direct Buffer Streaming
      try {
        const imgRes = await axios.get(dpUrl, { responseType: "arraybuffer", timeout: 8000 });
        await sock.sendMessage(
          from,
          {
            image: Buffer.from(imgRes.data),
            caption: captionText
          },
          { quoted: msg }
        );
      } catch (_) {
        // Fallback to URL direct
        await sock.sendMessage(
          from,
          {
            image: { url: dpUrl },
            caption: captionText
          },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[GETDP ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ DP ලබාගැනීම අසාර්ථක විය: ${err.message}`);
    }
  }
};
