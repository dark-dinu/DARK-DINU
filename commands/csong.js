import fs from "fs";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

// 🟢 FFmpeg Binary Path එක නිවැරදිව Set කිරීම
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const TEMP_DIR = path.join(process.cwd(), "temp");

if (!fs.existsSync(TEMP_DIR)) {
  try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch (_) {}
}

// MP3 එක WhatsApp PTT Opus එකක් බවට Convert කරන Function එක
function convertMp3ToOpusPtt(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libopus")
      .audioChannels(1)          // Mono channel for WhatsApp Voice Note
      .audioFrequency(48000)     // 48000Hz (WhatsApp Standard)
      .audioBitrate("64k")
      .format("ogg")
      .addOutputOptions("-avoid_negative_ts", "make_zero")
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

function isYouTubeUrl(input = "") {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(input);
}

function extractInviteCode(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z_-]+)/i);
  return match ? match[1] : input.trim();
}

async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const clean = input.trim();
  if (clean.endsWith("@newsletter")) return clean;

  const code = extractInviteCode(clean);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) return meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
    }
  } catch (_) {}
  return null;
}

export default {
  name: "csong",
  aliases: ["cplay", "channelplay", "channelsong", "cvoice"],
  category: "channel",
  description: "Download, transcode to Opus, and send 100% playable Voice Note to Channels",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join(" ").trim();
    const isChannelChat = from.endsWith("@newsletter");

    let targetChannel = isChannelChat ? from : null;
    let songQuery = fullText;

    if (!isChannelChat) {
      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        targetChannel = await resolveChannelJid(sock, parts[0].trim());
        songQuery = parts.slice(1).join("|").trim();
      } else {
        const firstArg = args[0] || "";
        if (firstArg.includes("whatsapp.com/channel/") || firstArg.endsWith("@newsletter")) {
          targetChannel = await resolveChannelJid(sock, firstArg);
          songQuery = args.slice(1).join(" ").trim();
        }
      }
    }

    if (!songQuery || (!targetChannel && !isChannelChat)) {
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`╔═════════════════════════════╗
   🎙️ 𝐂 𝐇 𝐀 𝐍 𝐍 𝐄 𝐋  𝐕 𝐎 𝐈 𝐂 𝐄
╚═════════════════════════════╝

💡 *භාවිතා කරන ආකාරය:*
• \`${pref}csong <channel_link> | <song_name>\`
• \`${pref}csong <channel_link> <song_name>\`
• \`${pref}csong <song_name>\` (චැනල් එක ඇතුළතදී)

✨ *උදාහරණයක්:*
• \`${pref}csong https://whatsapp.com/channel/xxxx | Lelena\`

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const timestamp = Date.now();
    const rawMp3Path = path.join(TEMP_DIR, `raw_${timestamp}.mp3`);
    const opusPttPath = path.join(TEMP_DIR, `ptt_${timestamp}.opus`);

    try {
      let targetUrl = songQuery;
      let title = "Voice Track";
      let duration = "03:15";

      // 1. YouTube Search
      const search = await yts(songQuery);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        duration = firstResult.timestamp || duration;
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("YouTube වෙතින් ගීතය හමු නොවීය.");
      }

      // 2. Chamindu API වෙතින් Audio Link එක ලබාගැනීම
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(targetUrl)}&quality=320kbps&api_key=${API_KEY}`;
      const res = await axios.get(apiUrl, { timeout: 45000 });
      const dlData = res.data;

      const directAudioUrl = 
        dlData?.download_url || 
        dlData?.data?.download_url || 
        dlData?.result?.download_url || 
        dlData?.url || 
        dlData?.data?.url;

      if (!directAudioUrl) {
        throw new Error("Audio download link එකක් ලබා ගැනීමට නොහැකි විය.");
      }

      // 3. MP3 එක Temp File එකක් ලෙස Save කරගැනීම
      const audioRes = await axios.get(directAudioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      fs.writeFileSync(rawMp3Path, Buffer.from(audioRes.data));

      // 4. FFmpeg Installer මඟින් WhatsApp PTT Opus Format එකට Convert කිරීම
      await convertMp3ToOpusPtt(rawMp3Path, opusPttPath);
      const finalVoiceBuffer = fs.readFileSync(opusPttPath);

      // 5. WhatsApp Channel එකට Voice Note එක Send කිරීම (Zero Quoted Payload)
      await sock.sendMessage(targetChannel, {
        audio: finalVoiceBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      // 6. Voice එක සාර්ථකව send වූ පසු විස්තර පත (Text Card) Channel එකට යැවීම
      await sock.sendMessage(targetChannel, {
        text: 
`🎶 ｡ﾟ•┈୨ *CHANNEL VOICE TRACK* ୧┈•ﾟ｡ 🎙️
━━━━━━━━━━━━━━━━━━━━━

🎵 *Title:* ${title}
⏱️ *Duration:* ${duration}
⚡ *Format:* High Quality Opus Voice Stream
📡 *Destination:* Channel Feed

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      if (!isChannelChat) {
        await sock.sendMessage(
          from,
          { text: `✅ *සාර්ථකයි!* \`${title}\` Voice Note එකක් ලෙස චැනල් එකට Play වන ආකාරයෙන් Post විය.` },
          { quoted: msg }
        );
      }

    } catch (err) {
      console.error("[CSONG FATAL ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ *අසාර්ථකයි:* ${err.message}` },
        { quoted: msg }
      );
    } finally {
      // Temp files clean කිරීම (Memory leak වැළැක්වීමට)
      try { if (fs.existsSync(rawMp3Path)) fs.unlinkSync(rawMp3Path); } catch (_) {}
      try { if (fs.existsSync(opusPttPath)) fs.unlinkSync(opusPttPath); } catch (_) {}
    }
  }
};
