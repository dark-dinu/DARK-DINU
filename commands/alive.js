import fs from "fs";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execPromise = promisify(exec);
const ffmpegPath = ffmpegInstaller.path;

// Local Image Loader (root හෝ assets එකේ තියෙන logo image එක ගන්නවා)
function getLocalLogo() {
  const possiblePaths = [
    path.join(process.cwd(), "logo.jpg"),
    path.join(process.cwd(), "logo.png"),
    path.join(process.cwd(), "assets", "logo.jpg"),
    path.join(process.cwd(), "assets", "logo.png")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  return { url: "https://files.catbox.moe/k315x4.jpg" };
}

export default {
  name: "alive",
  aliases: ["bot", "live", "status"],
  category: "general",
  description: "Play voice note and send alive card",

  async execute({ sock, msg, from }) {
    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    try {
      // 1. Download & Convert Audio to Valid WhatsApp PTT Spec using @ffmpeg-installer
      const tempInput = path.join(process.cwd(), `temp_${Date.now()}.ogg`);
      const tempOutput = path.join(process.cwd(), `voice_${Date.now()}.opus`);

      try {
        const audioRes = await axios.get("https://files.catbox.moe/37unrg.ogg", {
          responseType: "arraybuffer",
          timeout: 25000
        });
        fs.writeFileSync(tempInput, Buffer.from(audioRes.data));

        // WhatsApp Opus Standard: 48000Hz, 1 Channel (Mono)
        await execPromise(`"${ffmpegPath}" -y -i "${tempInput}" -c:a libopus -b:a 32k -vbr on -ar 48000 -ac 1 "${tempOutput}"`);

        if (fs.existsSync(tempOutput)) {
          const pttBuffer = fs.readFileSync(tempOutput);

          await sock.sendMessage(
            from,
            {
              audio: pttBuffer,
              mimetype: "audio/ogg; codecs=opus",
              ptt: true
            },
            { quoted: msg }
          );
        }
      } catch (audioErr) {
        console.error("[VOICE ENCODE ERROR]:", audioErr.message);
      } finally {
        if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      }

      // 2. Load Local Image Buffer
      const imageBuffer = getLocalLogo();

      // Runtime Calculation
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const runtimeStr = `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;

      const botName = "DARK-DINU";
      const fixedFooterLink = "https://heshan.devofc.top/";

      // Clean Single-Line Quality Layout
      const aliveCard = 
`🍓 ༆⃝⃤ *Purring Online, Sweetie~* 🎀 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 🌷 *ᴍᴏᴏᴅ :* 100% Sugar & Hugs (ฅ^•ﻌ•^ฅ)
┊◈ ⏳ *ᴜᴘᴛɪᴍᴇ :* ${runtimeStr}
┊◈ 💬 *ᴍꜱɢ :* _Ready for your sweet commands~ ✨_

────────────────────
🍰 *© ${botName} 𝐎ꜰᴄ* 🤍 | 📍 ${fixedFooterLink}`;

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
