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
  description: "Send audio track directly to WhatsApp Channels",

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
   🎙️ 𝐂 𝐇 𝐀 𝐍 𝐍 𝐄 𝐋  𝐒 𝐎 𝐍 𝐆
╚═════════════════════════════╝

💡 *භාවිතා කරන ආකාරය:*
• \`${pref}csong <channel_link> | <song_name>\`
• \`${pref}csong <song_name>\` (චැනල් එක ඇතුළතදී)

✨ *උදාහරණයක්:*
• \`${pref}csong https://whatsapp.com/channel/xxxx | Lelena\`

👑 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = songQuery;
      let title = "Audio Track";
      let duration = "03:15";

      // 1. YouTube Search
      const search = await yts(songQuery);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        duration = firstResult.timestamp || duration;
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("ගීතය සොයාගත නොහැකි විය.");
      }

      // 2. Chamindu API Call
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

      // 3. Audio Buffer Download කිරීම
      const audioRes = await axios.get(directAudioUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      // 4. WhatsApp Channel එකට Audio එක Push කිරීම
      // Newsletters වල audio යවද්දී quoted: null විය යුතු අතර, direct stream buffer යැවිය යුතුය
      await sock.sendMessage(
        targetChannel,
        {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: true
        }
      );

      // 5. Song Details Text Card
      await sock.sendMessage(targetChannel, {
        text: 
`🎶 ｡ﾟ•┈୨ *CHANNEL AUDIO STREAM* ୧┈•ﾟ｡ 🎙️
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
          { text: `✅ *සාර්ථකයි!* \`${title}\` චැනල් එකට Post කරන ලදී.` },
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
