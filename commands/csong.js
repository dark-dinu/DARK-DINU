import axios from "axios";
import yts from "yt-search";

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
  description: "Send 100% playable Voice Note to WhatsApp Channels without drop",

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

      // 1. YouTube Search
      const search = await yts(songQuery);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        duration = firstResult.timestamp || duration;
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("YouTube වෙතින් ගීතය සොයා ගැනීමට නොහැකි විය.");
      }

      // 2. Chamindu API වෙතින් Direct Audio Stream එක ගැනීම
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
        throw new Error("Chamindu API වෙතින් download link එකක් නොලැබුණි.");
      }

      // 3. Audio එක Buffer එකක් ලෙස download කිරීම
      const audioRes = await axios.get(directAudioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });

      const audioBuffer = Buffer.from(audioRes.data);

      // 4. WhatsApp Channel Voice Note Sending (Dual Engine)
      let voiceSent = false;

      // Method 1: Baileys Native Newsletter Direct Voice Upload
      try {
        await sock.sendMessage(targetChannel, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        });
        voiceSent = true;
      } catch (err1) {
        console.warn("[VOICE OPUS FAILED]:", err1.message);
      }

      // Method 2: Audio/mp4 Voice Fallback (Channel එකේ reject නොවී 100% play වන format එක)
      if (!voiceSent) {
        try {
          await sock.sendMessage(targetChannel, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          });
          voiceSent = true;
        } catch (err2) {
          console.error("[VOICE MP4 FAILED]:", err2.message);
        }
      }

      if (!voiceSent) {
        throw new Error("WhatsApp Channel එකට Voice Note එක upload කිරීමට නොහැකි විය. කරුණාකර Bot අදාළ Channel එකේ Admin ද යන්න පරීක්ෂා කරන්න.");
      }

      // 5. Voice Note එක සාර්ථකව ගිය පසු පමණක් Song Card එක යැවීම
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
          { text: `✅ *සාර්ථකයි!* \`${title}\` Voice Note එකක් ලෙස චැනල් එකට Post විය.` },
          { quoted: msg }
        );
      }

    } catch (err) {
      console.error("[CSONG ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ *අසාර්ථකයි:* ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
