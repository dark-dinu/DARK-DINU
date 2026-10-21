import axios from "axios";
import ytSearch from "yt-search";
import { delay } from "@whiskeysockets/baileys";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const FFMPEG_PATH = ffmpegInstaller?.path || "ffmpeg";
const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

global.channelJidCache = global.channelJidCache || new Map();

// ── Native Buffer Downloader ──
async function downloadBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": UA },
      timeout: 50000,
      maxContentLength: 45 * 1024 * 1024
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error("[BUFFER ERROR]:", e.message);
    return null;
  }
}

// ── YouTube Search Engine ──
async function searchYouTube(query) {
  try {
    const res = await ytSearch(query);
    if (!res?.videos?.length) return null;

    const video = res.videos[0];
    return {
      videoId: video.videoId,
      url: video.url,
      title: video.title || "Channel Song",
      duration: video.timestamp || "3:30",
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
    };
  } catch {
    return null;
  }
}

// ── Chamindu API v1 MP3 Resolver ──
async function getAudioDownloadUrl(videoUrl) {
  const enc = encodeURIComponent(videoUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=320kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=128kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { headers: { "User-Agent": UA }, timeout: 15000 });
      const data = res.data;
      if (data) {
        const link =
          data.data?.download_url ||
          data.data?.direct_url ||
          data.data?.url ||
          data.download_url ||
          data.direct_url ||
          data.result?.download_url ||
          data.url;
        if (typeof link === "string" && /^https?:\/\//i.test(link)) return link;
      }
    } catch (_) {}
  }
  return null;
}

export default {
  name: "csong",
  aliases: ["channelsong", "cvoice", "cplay"],
  category: "channel",
  description: "Post song card & playable audio to WhatsApp Channel",

  async execute({ sock, msg, from, args, config }) {
    const botName = config?.BOT_NAME || "DARK-DINU MD";
    const fullText = (args || []).join(" ").trim();
    const react = (emoji) =>
      sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});

    if (!fullText) {
      return await sock.sendMessage(
        from,
        {
          text: `⚠️ *භාවිතය:*\n*.csong <channel_link> , <song_name>*\n\n*උදාහරණ:*\n.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V , sadawathiye`
        },
        { quoted: msg }
      );
    }

    const linkMatch = fullText.match(/https?:\/\/(?:www\.)?whatsapp\.com\/channel\/[a-zA-Z0-9_\-\/]+/i);
    let channelLink = "";
    let songName = "";

    if (linkMatch) {
      channelLink = linkMatch[0];
      songName = fullText.replace(channelLink, "").replace(/^[\s,]+|[\s,]+$/g, "").trim();
    } else {
      return await sock.sendMessage(
        from,
        { text: "⚠️ කරුණාකර Channel Link එක සහ සින්දුවේ නම කොමාවකින් (,) වෙන් කර ලබාදෙන්න!" },
        { quoted: msg }
      );
    }

    if (!songName) {
      return await sock.sendMessage(from, { text: "⚠️ කරුණාකර සින්දුවේ නම ලබාදෙන්න!" }, { quoted: msg });
    }

    let inviteCode = channelLink.split("whatsapp.com/channel/")[1]?.split(/[\/?#]/)[0]?.trim();
    if (!inviteCode) {
      return await sock.sendMessage(from, { text: "❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න!" }, { quoted: msg });
    }

    react("⏳");

    try {
      // 1. Channel JID හරියටම ලබා ගැනීම
      let channelJid = global.channelJidCache.get(inviteCode);

      if (!channelJid) {
        try {
          const meta = await Promise.race([
            sock.newsletterMetadata("invite", inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]);
          channelJid = meta?.id;
          if (channelJid) global.channelJidCache.set(inviteCode, channelJid);
        } catch (e) {
          console.error("[META FETCH ERR]:", e.message);
        }
      }

      if (!channelJid) channelJid = `${inviteCode}@newsletter`;
      if (!channelJid.includes("@newsletter")) channelJid = `${channelJid.split("@")[0]}@newsletter`;

      // 2. YouTube Search
      const video = await searchYouTube(songName);
      if (!video) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ සින්දුව සොයාගත නොහැකි විය." }, { quoted: msg });
      }

      // 3. Audio Stream Link එක Chamindu API හරහා ලබා ගැනීම
      const audioUrl = await getAudioDownloadUrl(video.url);
      if (!audioUrl) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio Download Link එක ලබාගත නොහැකි විය." }, { quoted: msg });
      }

      // 4. Audio සහ Thumbnail Buffers බාගත කිරීම
      const [rawAudioBuffer, imgBuffer] = await Promise.all([
        downloadBuffer(audioUrl),
        downloadBuffer(video.thumbnail)
      ]);

      if (!rawAudioBuffer || rawAudioBuffer.length < 5000) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio file එක බාගත වීම අසාර්ථක විය." }, { quoted: msg });
      }

      const cardCaption =
`🥰⃝🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

| ☘️ *${botName}*`;

      // 5. Channel එකට Post කිරීම
      // A. Thumbnail Card එක පළමුව යැවීම
      if (imgBuffer) {
        await sock.sendMessage(channelJid, {
          image: imgBuffer,
          caption: cardCaption
        });
      } else {
        await sock.sendMessage(channelJid, { text: cardCaption });
      }

      // Rate limit එකෙන් message drop නොවීමට delay එකක්
      await delay(1800);

      // B. Audio එක Document එකක් ලෙස යැවීම (Channels වල 100% play වේ)
      const cleanFileName = `${video.title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "song"}.mp3`;
      await sock.sendMessage(channelJid, {
        document: rawAudioBuffer,
        mimetype: "audio/mpeg",
        fileName: cleanFileName
      });

      react("✅");
      return await sock.sendMessage(
        from,
        {
          text: `✅ *"${video.title}"*\nChannel එකට Image Card එක සහ Audio File එක සාර්ථකව Post කරන ලදී! 🎶✨`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[CSONG FATAL ERROR]:", err);
      react("❌");
      return await sock.sendMessage(
        from,
        { text: `❌ Glitch: ${err.message || "Failed to post to channel"}` },
        { quoted: msg }
      );
    }
  }
};
