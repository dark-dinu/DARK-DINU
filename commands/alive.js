import fs from "fs";
import path from "path";
import axios from "axios";

// Local Logo Loader (root folder එකේ logo.jpg හෝ logo.png කියවයි)
function getLocalLogo() {
  const possiblePaths = [
    path.join(process.cwd(), "logo.jpg"),
    path.join(process.cwd(), "logo.png"),
    path.join(process.cwd(), "assets", "logo.jpg"),
    path.join(process.cwd(), "assets", "logo.png")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  return { url: "https://files.catbox.moe/k315x4.jpg" };
}

export default {
  name: "alive",
  aliases: ["bot", "live", "status"],
  category: "general",
  description: "Play voice note and send clean single-line alive card",

  async execute({ sock, msg, from }) {
    sock.sendMessage(from, { react: { text: "🥰", key: msg.key } }).catch(() => {});

    try {
      // 1. Voice Note Buffer Fetch & Send (WhatsApp 100% Playable)
      try {
        const audioRes = await axios.get("https://files.catbox.moe/37unrg.ogg", {
          responseType: "arraybuffer",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 20000
        });

        await sock.sendMessage(
          from,
          {
            audio: Buffer.from(audioRes.data),
            mimetype: "audio/ogg; codecs=opus",
            ptt: true
          },
          { quoted: msg }
        );
      } catch (audioErr) {
        console.error("[ALIVE AUDIO ERROR]:", audioErr.message);
      }

      // 2. Load Local Image Buffer
      const imageBuffer = getLocalLogo();

      // Runtime Calculation (Compact)
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const runtimeStr = `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;

      const botName = "DARK-DINU";
      const fixedFooterLink = "https://heshan.devofc.top/";

      // Clean Single-Line Quality Layout (No Boxes)
      const aliveCard = 
`🍓 ༆⃝⃤ *Purring Online, Sweetie~* 🎀 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 🌷 *ᴍᴏᴏᴅ :* 100% Sugar & Hugs (ฅ^•ﻌ•^ฅ)
┊◈ ⏳ *ᴜᴘᴛɪᴍᴇ :* ${runtimeStr}
┊◈ 💬 *ᴍꜱɢ :* _Ready for your sweet commands~ ✨_

────────────────────
🍰 *© ${botName} 𝐎ꜰᴄ* 🤍 | ➥ ${fixedFooterLink}`;

      // 3. Send Image with Caption
      await sock.sendMessage(
        from,
        {
          image: imageBuffer,
          caption: aliveCard
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[ALIVE ERROR]:", err.message);
      await sock.sendMessage(
        from,
        {
          text: `🍓 *DARK-DINU MD IS ONLINE* ✨\n\n📍 https://heshan.devofc.top/`
        },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
