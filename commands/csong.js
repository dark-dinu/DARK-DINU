import axios from "axios";
import yts from "yt-search";
import ffmpeg from "fluent-ffmpeg";
import { Readable, PassThrough } from "stream";

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

// Helper: Convert Any MP3 Buffer directly into WhatsApp PTT Opus Buffer
function toOpusVoice(inputBuffer) {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", (err) => reject(err));

    ffmpeg(inputStream)
      .noVideo()
      .audioCodec("libopus")
      .audioChannels(1)          // Mono channel for WhatsApp PTT
      .audioFrequency(48000)     // 48kHz standard for Opus
      .audioBitrate("64k")
      .format("ogg")
      .addOutputOptions("-avoid_negative_ts", "make_zero")
      .on("error", (err) => reject(err))
      .pipe(outputStream);
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
  description: "Convert YouTube audio to 100% playable Voice Note for WhatsApp Channels",

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

💡 *භාවිතා කරන ආකාරය (චැනල් එකට පිටින්):*
• \`${pref}csong <channel_link> | <song_name>\`
• \`${pref}csong <channel_link> <song_name>\`

💡 *චැනල් එක ඇතුළත සිට භාවිතා කරන විට:*
• \`${pref}csong <song_name>\`

✨ *උදාහරණයක්:*
• \`${pref}csong https://whatsapp.com/channel/0029VbDQtwMLI8YVtVBnFt1A | Ninda Noyana\`

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = songQuery;
      let title = "Voice Audio Track";
      let duration = "03:45";

      // 1. YouTube Search (Query එක Link එකක් නොවේ නම්)
      const search = await yts(songQuery);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        duration = firstResult.timestamp || duration;
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("අදාළ ගීතය YouTube වෙතින් සොයාගත නොහැකි විය.");
      }

      // 2. Chamindu 320kbps MP3 API Endpoint එකෙන් Audio Stream Link එක ගැනීම
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
        throw new Error("Chamindu API වෙතින් audio stream link එකක් ලබා ගැනීමට නොහැකි විය.");
      }

      // 3. Audio Buffer Download කරගැනීම
      const audioRes = await axios.get(directAudioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const mp3Buffer = Buffer.from(audioRes.data);

      // 4. WhatsApp PTT සඳහා 100% Valid Opus Buffer එකක් බවට Convert කිරීම
      let voiceBuffer;
      try {
        voiceBuffer = await toOpusVoice(mp3Buffer);
      } catch (convErr) {
        console.warn("[FFMPEG CONVERSION FALLBACK]:", convErr.message);
        voiceBuffer = mp3Buffer; // Fallback
      }

      // 5. WhatsApp Channel එකට Voice Note එකක් ලෙස Dispatch කිරීම (No Quoted)
      await sock.sendMessage(targetChannel, {
        audio: voiceBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      // 6. Track Details Text Card එක වෙනම Channel එකට Post කිරීම
      await sock.sendMessage(targetChannel, {
        text: 
`🎶 ｡ﾟ•┈୨ *CHANNEL VOICE TRACK* ୧┈•ﾟ｡ 🎙️
━━━━━━━━━━━━━━━━━━━━━

🎵 *Title:* ${title}
⏱️ *Duration:* ${duration}
⚡ *Bitrate:* 320kbps Direct Cloud Stream
📡 *Destination:* Channel Feed

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      if (!isChannelChat) {
        await sock.sendMessage(
          from,
          { text: `✅ *සාර්ථකයි!* \`${title}\` Voice Note එකක් ලෙස චැනල් එකට Play වන පරිදි Post කරන ලදී.` },
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
    }
  }
};
