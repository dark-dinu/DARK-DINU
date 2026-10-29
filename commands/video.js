import axios from "axios";
import yts from "yt-search";

const QUALITY_MAP = Object.freeze({
  "1": "1080p",
  "2": "720p",
  "3": "480p",
  "4": "360p"
});

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
global.videoSessions = global.videoSessions || new Map();

function isYouTubeUrl(input = "") {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(input);
}

export default {
  name: "video",
  aliases: ["ytv", "ytvideo", "ytmp4"],
  category: "download",
  description: "Download YouTube videos with multi-quality selection (1080p to 360p)",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const text = args.join(" ").trim();

    if (!text) {
      sock.sendMessage(from, { react: { text: "🎥", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *YOUTUBE VIDEO GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *භාවිතා කරන ආකාරය:*
  • *${pref}video <video_name_or_url>*

  ✨ *උදාහරණ:*
  • \`${pref}video Alan Walker Faded\`
  • \`${pref}video https://youtu.be/xxxxxx\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "🎬", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = text;
      let title = "YouTube Video Stream";
      let thumbnail = "https://files.catbox.moe/k315x4.jpg";
      let duration = "03:45";

      // Search & Fast Metadata Extractor (Zero API latency on first step)
      const search = await yts(text);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        thumbnail = firstResult.thumbnail || thumbnail;
        duration = firstResult.timestamp || duration;
      } else if (!isYouTubeUrl(text)) {
        throw new Error("අදාළ වීඩියෝව YouTube වෙතින් සොයාගත නොහැකි විය.");
      }

      const videoCard = 
`🎀 ｡ﾟ•┈୨ *YOUTUBE DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🎬 *Title:* ${title.length > 55 ? title.slice(0, 52) + "..." : title}
  ⏱️ *Duration:* ${duration}
  ⚡ *Engine:* Ultra-Fast Cloud Stream

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

      // In-Memory Session Storage
      if (sentMsg?.key?.id) {
        global.videoSessions.set(sentMsg.key.id, {
          from,
          url: targetUrl,
          title
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
        { text: `🌸 *Error:* ${err.message || "Failed to process video softly"}` },
        { quoted: msg }
      );
    }
  },

  // Interactive Reply Handler
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.videoSessions.has(quotedStanzaId)) return false;

    const session = global.videoSessions.get(quotedStanzaId);
    if (session.from !== from) return false;

    const choice = body.trim();
    const selectedQuality = QUALITY_MAP[choice];
    if (!selectedQuality) return false;

    try {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // අලුත් Direct MP4 Stream API Endpoint එක
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp4?url=${encodeURIComponent(session.url)}&quality=${selectedQuality}&api_key=${API_KEY}`;
      
      const res = await axios.get(apiUrl, { timeout: 45000 });
      const dlData = res.data;

      const videoDownloadUrl = 
        dlData?.download_url || 
        dlData?.data?.download_url || 
        dlData?.result?.download_url || 
        dlData?.url || 
        dlData?.data?.url;

      if (!videoDownloadUrl) {
        throw new Error(`තෝරාගත් quality එක [${selectedQuality}] දැනට server එකෙහි නොමැත.`);
      }

      // Direct WhatsApp Video Payload
      await sock.sendMessage(
        from,
        {
          video: { url: videoDownloadUrl },
          mimetype: "video/mp4",
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
      await sock.sendMessage(
        from,
        { text: `❌ *බාගත කිරීම අසාර්ථක විය:* ${err.message}` },
        { quoted: msg }
      ).catch(() => {});
      return true;
    }
  }
};
