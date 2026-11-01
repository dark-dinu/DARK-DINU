import axios from "axios";
import yts from "yt-search";
import { generateWAMessageContent, generateWAMessageFromContent } from "@whiskeysockets/baileys";

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

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
  description: "Send 100% playable Voice & Image to WhatsApp Channels using Newsletter Protocol",

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

✨ *උදාහරණයක්:*
• \`${pref}csong https://whatsapp.com/channel/xxxx | Lelena\`

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = songQuery;
      let title = "Voice Audio Track";
      let duration = "03:15";
      let thumbnail = null;

      // 1. YouTube Search
      const search = await yts(songQuery);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        duration = firstResult.timestamp || duration;
        thumbnail = firstResult.thumbnail;
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("YouTube වෙතින් ගීතය හමු නොවීය.");
      }

      // 2. Chamindu API එකෙන් Audio Download Link එක ගැනීම
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
        throw new Error("Audio download link එක ලබාගත නොහැකි විය.");
      }

      // 3. Audio Buffer Download කරගැනීම
      const audioRes = await axios.get(directAudioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      const songCaption = 
`🎶 ｡ﾟ•┈୨ *CHANNEL AUDIO STREAM* ୧┈•ﾟ｡ 🎙️
━━━━━━━━━━━━━━━━━━━━━

🎵 *Title:* ${title}
⏱️ *Duration:* ${duration}
⚡ *Bitrate:* 320kbps Direct Stream
📡 *Destination:* Channel Feed

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 4. 🔴 WhatsApp Channel එකට Image/Audio යැවීමේ නියම ක්‍රමය (Newsletter Media Relay):
      try {
        // Thumbnail Buffer
        let thumbBuffer = null;
        if (thumbnail) {
          const tRes = await axios.get(thumbnail, { responseType: "arraybuffer", timeout: 10000 }).catch(() => null);
          if (tRes) thumbBuffer = Buffer.from(tRes.data);
        }

        // 1. මුලින්ම Thumbnail Image එක Caption එක සමඟ Channel එකට Relay කිරීම
        if (thumbBuffer && typeof sock.waUploadToServer === "function") {
          const imgMedia = await generateWAMessageContent(
            { image: thumbBuffer, caption: songCaption },
            { upload: sock.waUploadToServer, mediaTypeOverride: "image" }
          );
          const fullImgMsg = generateWAMessageFromContent(targetChannel, imgMedia, {});
          await sock.relayMessage(targetChannel, fullImgMsg.message, { messageId: fullImgMsg.key.id });
        } else {
          // Image නැත්නම් Text එක පමණක් Relay කිරීම
          await sock.sendMessage(targetChannel, { text: songCaption });
        }

        // 2. ඊළඟට Voice Note (Audio) එක Channel එකට Relay කිරීම
        if (typeof sock.waUploadToServer === "function") {
          const audioMedia = await generateWAMessageContent(
            {
              audio: audioBuffer,
              mimetype: "audio/mp4",
              ptt: true
            },
            { upload: sock.waUploadToServer, mediaTypeOverride: "audio" }
          );

          const fullAudioMsg = generateWAMessageFromContent(targetChannel, audioMedia, {});
          await sock.relayMessage(targetChannel, fullAudioMsg.message, { messageId: fullAudioMsg.key.id });
        } else {
          // Direct fallback
          await sock.sendMessage(targetChannel, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          });
        }

      } catch (uploadError) {
        console.error("[NEWSLETTER MEDIA UPLOAD CRASH]:", uploadError.message);
        throw new Error("Channel media upload එක fail විය. Server error: " + uploadError.message);
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      if (!isChannelChat) {
        await sock.sendMessage(
          from,
          { text: `✅ *සාර්ථකයි!* \`${title}\` Image එක සහ Voice Note එක සමඟ චැනල් එකට Post විය.` },
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
