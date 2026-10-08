import fs from "fs";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execPromise = promisify(exec);
const ffmpegPath = ffmpegInstaller.path;

// Global In-Memory Cache for converted PTT Audio (Zero delay on repeated calls)
let cachedPttBuffer = null;
let isCachingAudio = false;

// Safe file remover helper
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// Local / Remote Logo Loader
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

// Fetch & Cache Audio in WhatsApp Mono Opus format
async function getVoiceNoteBuffer() {
  if (cachedPttBuffer) return cachedPttBuffer;
  if (isCachingAudio) return null;

  isCachingAudio = true;
  const tempInput = path.join(process.cwd(), `temp_${Date.now()}.ogg`);
  const tempOutput = path.join(process.cwd(), `voice_${Date.now()}.opus`);

  try {
    const audioRes = await axios.get("https://files.catbox.moe/37unrg.ogg", {
      responseType: "arraybuffer",
      timeout: 15000
    });

    fs.writeFileSync(tempInput, Buffer.from(audioRes.data));

    // Convert to optimal WhatsApp Opus format
    await execPromise(
      `"${ffmpegPath}" -y -i "${tempInput}" -c:a libopus -b:a 32k -vbr on -ar 48000 -ac 1 "${tempOutput}"`
    );

    if (fs.existsSync(tempOutput)) {
      cachedPttBuffer = fs.readFileSync(tempOutput);
      return cachedPttBuffer;
    }
  } catch (err) {
    console.error("[VOICE ENCODE ERROR]:", err.message);
    return null;
  } finally {
    safeUnlink(tempInput);
    safeUnlink(tempOutput);
    isCachingAudio = false;
  }
  return null;
}

export default {
  name: "alive",
  aliases: ["bot", "live", "status"],
  category: "general",
  description: "Check bot status with a cute voice note & card",

  async execute({ sock, msg, from, config }) {
    // Soft cute reaction
    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    try {
      // 1. Calculate Uptime
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const runtimeStr = `${hours ? `${hours}h ` : ""}${minutes}m ${seconds}s`;

      const botName = config?.BOT_NAME || "DARK-DINU MD";
      const siteLink = "https://heshan.devofc.top/";

      // 2. Ultra-Cute Layout
      const aliveCard = 
`🎀 ｡ﾟ•┈୨ *ONLINE & PURRING* ୧┈•ﾟ｡ 🐾
*━━━━━━━━━━━━━━━━━━━━━━*

  ✗🌸 *Status:* Feeling sweet & ready for you! (˶˃ ᵕ ˂˶)
  ✗⏱️ *Uptime:* \`${runtimeStr}\`
  ✗⚡ *Speed:* Lightning Fast Cloud
  ✗🍰 *Mood:* 100% Cotton Candy & Sunshine ✨

*━━━━━━━━━━━━━━━━━━━━━━*
🐾 *Need help?* Type \`${config?.PREFIX || "."}menu\` anytime sweetheart!
🤍 *© ${botName}* • ${siteLink}`;

      // 3. Send Image Status Card
      await sock.sendMessage(
        from,
        {
          image: getLocalLogo(),
          caption: aliveCard
        },
        { quoted: msg }
      );

      // 4. Send Instant PTT Audio
      const voiceBuffer = await getVoiceNoteBuffer();
      if (voiceBuffer) {
        await sock.sendMessage(
          from,
          {
            audio: voiceBuffer,
            mimetype: "audio/ogg; codecs=opus",
            ptt: true
          },
          { quoted: msg }
        );
      }

    } catch (err) {
      console.error("[ALIVE COMMAND ERROR]:", err.message);
      await sock.sendMessage(
        from,
        {
          text: `🌸 *Yay! I am awake and healthy, darling!* ✨\n\n🔗 *Website:* https://heshan.devofc.top/`
        },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
