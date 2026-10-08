import fs from "fs";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execPromise = promisify(exec);
const ffmpegPath = ffmpegInstaller.path;

// Global Fast RAM Buffers
let preloadedVoice = null;
let preloadedLogo = null;

// Safe file remover
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// 1. Instant Memory Preloader (Bot එක ඔන් වෙද්දිම background එකේ බඩු ලෑස්ති කරගන්නවා)
(async function initAssets() {
  try {
    // Preload Logo into RAM
    const possiblePaths = [
      path.join(process.cwd(), "logo.jpg"),
      path.join(process.cwd(), "logo.png"),
      path.join(process.cwd(), "assets", "logo.jpg"),
      path.join(process.cwd(), "assets", "logo.png")
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        preloadedLogo = fs.readFileSync(p);
        break;
      }
    }
    if (!preloadedLogo) preloadedLogo = { url: "https://files.catbox.moe/k315x4.jpg" };

    // Preload & Pre-encode Voice Note once into RAM
    const tempIn = path.join(process.cwd(), `init_${Date.now()}.ogg`);
    const tempOut = path.join(process.cwd(), `init_${Date.now()}.opus`);

    const res = await axios.get("https://files.catbox.moe/37unrg.ogg", {
      responseType: "arraybuffer",
      timeout: 10000
    });

    fs.writeFileSync(tempIn, Buffer.from(res.data));
    await execPromise(`"${ffmpegPath}" -y -i "${tempIn}" -c:a libopus -b:a 32k -vbr on -ar 48000 -ac 1 "${tempOut}"`);

    if (fs.existsSync(tempOut)) {
      preloadedVoice = fs.readFileSync(tempOut);
    }
    safeUnlink(tempIn);
    safeUnlink(tempOut);
  } catch (e) {
    console.error("[Alive Preload Warning]:", e.message);
  }
})();

export default {
  name: "alive",
  aliases: ["bot", "live", "status"],
  category: "general",
  description: "Instant status check with cute voice and banner",

  async execute({ sock, msg, from, config }) {
    // ⚡ ZERO-DELAY INSTANT REACTION (Not waiting for anything!)
    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    // Uptime String Calculation (Ultra-fast bitwise math)
    const uptimeSec = process.uptime() | 0;
    const hours = (uptimeSec / 3600) | 0;
    const minutes = ((uptimeSec % 3600) / 60) | 0;
    const seconds = (uptimeSec % 60) | 0;
    const runtimeStr = `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;

    const botName = config?.BOT_NAME || "DARK-DINU MD";
    const siteLink = "https://heshan.devofc.top/";

    const aliveCard = 
`🎀 ｡ﾟ•┈୨ *ONLINE & READY* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  🌸 *Status:* Active & Super Speedy! (˶˃ ᵕ ˂˶)
  ⏱️ *Uptime:* \`${runtimeStr}\`
  ⚡ *Response:* Instant Flash 
  🍰 *Mood:* 100% Cuteness & Care ✨

━━━━━━━━━━━━━━━━━━━━━━
🐾 *Commands:* Type \`${config?.PREFIX || "."}menu\` darling!
🤍 *© ${botName}* • ${siteLink}`;

    // Parallel Dispatch: Card එකයි Voice එකයි එකවරම යැවීම
    const tasks = [
      sock.sendMessage(
        from,
        {
          image: preloadedLogo || { url: "https://files.catbox.moe/k315x4.jpg" },
          caption: aliveCard
        },
        { quoted: msg }
      )
    ];

    if (preloadedVoice) {
      tasks.push(
        sock.sendMessage(
          from,
          {
            audio: preloadedVoice,
            mimetype: "audio/ogg; codecs=opus",
            ptt: true
          },
          { quoted: msg }
        )
      );
    }

    // Execute both concurrently for lightning speed
    Promise.allSettled(tasks).catch(() => {});
  }
};
