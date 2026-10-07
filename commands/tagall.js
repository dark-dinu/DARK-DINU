export default {
  name: "tagall",
  aliases: ["everyone", "all"],
  category: "group",
  description: "Tag all members in the group",

  async execute({ sock, msg, from, args }) {
    try {
      // 1. Group Validation
      if (!from.endsWith("@g.us")) {
        return await sock.sendMessage(
          from,
          { 
            text: "⚠️ *ACCESS DENIED*\n\nThis command can only be used inside groups." 
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "📢", key: msg.key } }).catch(() => {});

      // 2. Fetch Group Metadata
      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata?.participants || [];

      if (!participants.length) {
        return await sock.sendMessage(
          from,
          { 
            text: "⚠️ *ERROR:* Failed to retrieve group member list." 
          },
          { quoted: msg }
        );
      }

      // 3. Sender Admin Check
      const sender = msg.key.participant || from;
      const cleanSender = sender.split(":")[0].replace(/[^0-9]/g, "");
      const isSenderAdmin = participants.some(
        (p) => p.id.split(":")[0].replace(/[^0-9]/g, "") === cleanSender && (p.admin === "admin" || p.admin === "superadmin")
      );

      if (!isSenderAdmin) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "⚠️ *ACCESS DENIED*\n\nOnly group admins can use this command!" },
          { quoted: msg }
        );
      }

      // 4. Custom Announcement Content
      const customMessage = args.join(" ").trim() || "Attention Everyone!";

      let tagText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📢 *GROUP ANNOUNCEMENT* 〕
├─▸ 👥 *Total Members:* ${participants.length}
├─▸ 💬 *Notice:* ${customMessage}
└───────────────────────

┌─〔 👥 *MENTIONED MEMBERS* 〕\n`;

      const mentions = [];

      for (let i = 0; i < participants.length; i++) {
        const memberId = participants[i].id;
        const number = memberId.split("@")[0].split(":")[0];
        tagText += `├─▸ [${i + 1}] @${number}\n`;
        mentions.push(memberId);
      }

      tagText += 
`└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      // 5. Send Announcement Message with Mentions
      await sock.sendMessage(
        from,
        {
          text: tagText,
          mentions: mentions
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[TAGALL COMMAND ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { 
          text: `❌ *TAGALL FAILED:* ${err.message || "An unexpected error occurred."}` 
        },
        { quoted: msg }
      );
    }
  }
};
