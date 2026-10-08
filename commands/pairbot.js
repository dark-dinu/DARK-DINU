import axios from "axios";

export default {
  name: "bot",
  aliases: ["pair", "paircode", "clone"],
  category: "general",
  description: "Get bot pairing code instantly without modifying index.js",

  async execute({ sock, msg, from, args }) {
    // Reaction
    sock.sendMessage(from, { react: { text: "🍓", key: msg.key } }).catch(() => {});

    try {
      // 1. අංකය ලබා ගැනීම (.bot පසු අංකයක් ඇත්නම් එය, නැතහොත් command එක එවූ අයගේ අංකය)
      let targetNumber = args.join("").replace(/[^0-9]/g, "");

      if (!targetNumber) {
        const senderJid = msg.key.participant || msg.participant || from || "";
        targetNumber = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      }

      // Valid number check
      if (!targetNumber || targetNumber.length < 9) {
        return await sock.sendMessage(
          from,
          { text: "⚠️ *කරුණාකර නිවැරදි දුරකථන අංකයක් ඇතුළත් කරන්න!*\nඋදා: `.bot 9471xxxxxxx`" },
          { quoted: msg }
        );
      }

      // Quick Waiting Message
      const waitMsg = await sock.sendMessage(
        from,
        {
          text: `🍓 ༆⃝⃤ *DARK-DINU PAIRING ENGINE* 🐾\n\n> ⏳ _Generating pairing code for +${targetNumber}..._`
        },
        { quoted: msg }
      );

      // 2. Fetch Pairing Code from your Web Pairing API
      // (ඔයාගේ pairing server endpoint එකක් ඇත්නම් ඒ URL එක යොදන්න)
      const pairApiUrl = `https://heshan.devofc.top/code?number=${targetNumber}`;
      let pairCode = null;

      try {
        const res = await axios.get(pairApiUrl, { timeout: 25000 });
        pairCode = res.data?.code || res.data?.pairingCode || res.data;
      } catch (apiErr) {
        // Fallback: Web portal එකෙන් direct request එකක් ගන්න බැරි නම් alert එකක් දෙයි
        console.error("[PAIR API ERROR]:", apiErr.message);
      }

      const fixedFooterLink = "https://heshan.devofc.top/";

      if (pairCode && typeof pairCode === "string" && pairCode.length <= 15) {
        // Clean Aesthetic Response Card
        const cardText = 
`🍓 ༆⃝⃤ *DARK-DINU BOT CLONE SYSTEM* 🎀 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 📱 *ɴᴜᴍʙᴇʀ* : +${targetNumber}
┊◈ 🔑 *ᴄᴏᴅᴇ*   : *${pairCode}*
┊◈ 💡 *ɴᴏᴛᴇ*   : _Notification එක click කර Code එක paste කරන්න._

────────────────────
🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍 | 📍 ${fixedFooterLink}`;

        // 1. Send the visual card
        await sock.sendMessage(from, { text: cardText }, { quoted: msg });

        // 2. Send the raw pairing code separately (Copy කරගැනීම පහසු වීමට)
        await sock.sendMessage(from, { text: `${pairCode}` });
      } else {
        // API link එකක් හරහා direct code එක ගන්න බැරි නම් portal guide එක
        await sock.sendMessage(
          from,
          {
            text: 
`🍓 ༆⃝⃤ *DARK-DINU PAIRING PORTAL* 🎀 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 📱 *ɴᴜᴍʙᴇʀ* : +${targetNumber}
┊◈ 🌐 *ᴘᴏʀᴛᴀʟ*  : ${fixedFooterLink}
────────────────────
_ඔබගේ අංකය සඳහා කෙලින්ම අපගේ වෙබ් අඩවියෙන් Pairing Code එක ලබාගන්න._`
          },
          { quoted: msg }
        );
      }

      // Delete wait message if supported
      if (waitMsg?.key) {
        sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

    } catch (err) {
      console.error("[BOT PAIR ERROR]:", err.message);
      await sock.sendMessage(
        from,
        { text: "❌ *Pairing code ලබාගැනීම අසාර්ථක විය. පසුව නැවත උත්සාහ කරන්න.*" },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
