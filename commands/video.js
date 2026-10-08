import axios from "axios";
import yts from "yt-search";

// Pre-allocated Static Resolution Lookup Table (O(1) Map)
const QUALITY_MAP = Object.freeze({
  "1": "1080p",
  "2": "720p",
  "3": "480p",
  "4": "360p"
});

// In-Memory Global Video Session Store
global.videoSessions = global.videoSessions || new Map();

// Fast YouTube URL/ID Extractor
function isYouTubeUrl(input = "") {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(input);
}

export default {
  name: "video",
  aliases: ["ytv", "ytvideo", "ytmp4"],
  category: "download",
  description: "Download YouTube videos with multi-quality selection (1080p to 360p)",

  async execute({ sock, msg, from, args, config }) {
    const text = args.join(" ").trim();
    const prefix = config?.PREFIX || ".";

    if (!text) {
      sock.sendMessage(from, { react: { text: "🎥", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *YOUTUBE VIDEO GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  • *${prefix}video <video_name_or_url>*

  ✨ *Examples:*
  • \`${prefix}video Alan Walker Faded\`
  • \`${prefix}video https://youtu.be/xxxxxx\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    // Instant Microsecond Reaction
    sock.sendMessage(from, { react: { text: "🎬", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = text;
      let title = "YouTube Video";
      let thumbnail = "https://files.catbox.moe/k315x4.jpg";

      // Search Query Resolution
      if (!isYouTubeUrl(text)) {
        try {
          const search = await yts(text);
          const firstResult = search?.videos?.[0];
          if (firstResult?.url) {
            targetUrl = firstResult.url;
            title = firstResult.title || title;
            thumbnail = firstResult.thumbnail || thumbnail;
          }
        } catch (_) {}
      }

      // Metadata API Pipeline
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetUrl)}&quality=360p&format=mp4&api_key=${apiKey}`;

      const res = await axios.get(apiUrl, { timeout: 25000 });
      const resData = res.data;

      if (!resData || (!resData.status && !resData.success)) {
        throw new Error("Could not fetch video information. Please try another link or title, honey~");
      }

      const item = resData.data || resData;
      title = item.title || title;
      thumbnail = item.thumbnail || thumbnail;

      // Cute Interactive Card UI
      const videoCard = 
`🎀 ｡ﾟ•┈୨ *YOUTUBE DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🎬 *Title:* ${title.slice(0, 42)}...
  🌐 *Platform:* YouTube Video Stream
  ⚡ *Engine:* Ultra-Fast Cloud Converter

━━━━━━━━━━━━━━━━━━━━━
🍬 *Reply with your preferred resolution:*

  🌟 *1* ➔ 1080p (Full HD Crisp)
  🎬 *2* ➔ 720p (High Definition)
  📱 *3* ➔ 480p (Standard Definition)
  ⚡ *4* ➔ 360p (Data Saver Mode)

━━━━━━━━━━━━━━━━━━━━━
_Reply with 1, 2, 3 or 4 to download softly~ (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      const sentMsg = await sock.sendMessage(
        from,
        {
          image: { url: thumbnail },
          caption: videoCard
        },
        { quoted: msg }
      );

      // In-Memory Session with 8-Minute Auto-Eviction
      if (sentMsg?.key?.id) {
        global.videoSessions.set(sentMsg.key.id, {
          from,
          url: targetUrl,
          title,
          apiKey
        });

        setTimeout(() => {
          global.videoSessions.delete(sentMsg.key.id);
        }, 480000);
      }

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[VIDEO CMD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to process video softly"}` },
        { quoted: msg }
      );
    }
  },

  // Fast Interactive Reply Handler
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.videoSessions.has(quotedStanzaId)) return false;

    const session = global.videoSessions.get(quotedStanzaId);
    if (session.from !== from) return false;

    const choice = body.trim();
    const selectedQuality = QUALITY_MAP[choice];
    if (!selectedQuality) return false;

    try {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(session.url)}&quality=${selectedQuality}&format=mp4&api_key=${session.apiKey}`;
      const res = await axios.get(apiUrl, { timeout: 45000 });
      const downloadData = res.data?.data || res.data;

      const videoDownloadUrl = downloadData?.download_url || downloadData?.direct_url || downloadData?.url;

      if (!videoDownloadUrl) {
        throw new Error(`Chosen quality [${selectedQuality}] is currently unavailable on servers`);
      }

      await sock.sendMessage(
        from,
        {
          video: { url: videoDownloadUrl },
          caption: `🎬 *${session.title}* [${selectedQuality}]\n\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      global.videoSessions.delete(quotedStanzaId);
      return true;

    } catch (err) {
      console.error("[VIDEO DOWNLOAD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* Failed to deliver video stream: ${err.message}` },
        { quoted: msg }
      ).catch(() => {});
      return true;
    }
  }
};
