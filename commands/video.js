import axios from "axios";
import yts from "yt-search";

if (!global.videoSessions) {
  global.videoSessions = new Map();
}

export default {
  name: "video",
  aliases: ["ytv", "ytvideo", "ytmp4"],
  category: "download",
  description: "Download YouTube video by link or name (1080p, 720p, 480p, 360p)",

  async execute({ sock, msg, from, args, config }) {
    try {
      const text = args.join(" ").trim();
      const prefix = config?.PREFIX || ".";

      if (!text) {
        return await sock.sendMessage(
          from,
          { 
            text: `⚠️ *කරුණාකර වීඩියෝවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n\n*භාවිතය:*\n• \`${prefix}video Alan Walker Faded\`\n• \`${prefix}video https://youtu.be/xxxxxx\`` 
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetUrl = text;
      const isYtLink = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/.test(text);

      // Search Query එකක් ලබා දුනහොත් URL එක ලබා ගැනීම
      if (!isYtLink) {
        try {
          const search = await yts(text);
          const firstResult = search?.videos?.[0];
          if (firstResult && firstResult.url) {
            targetUrl = firstResult.url;
          } else {
            const searchRes = await axios.get(`https://weeb-api.vercel.app/ytsearch?query=${encodeURIComponent(text)}`, { timeout: 15000 });
            const item = searchRes.data?.[0] || searchRes.data?.results?.[0];
            if (item && item.url) targetUrl = item.url;
          }
        } catch (searchErr) {
          console.error("[YT SEARCH ERR]:", searchErr.message);
        }
      }

      // Metadata / Thumbnail ලබා ගැනීම
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetUrl)}&quality=360p&format=mp4&api_key=${apiKey}`;

      const res = await axios.get(apiUrl, { timeout: 30000 });
      const resData = res.data;

      if (!resData || (!resData.status && !resData.success)) {
        throw new Error("වීඩියෝවේ තොරතුරු සොයාගත නොහැකි විය. වෙනත් නමක් හෝ Link එකක් උත්සාහ කරන්න.");
      }

      const item = resData.data || resData;
      const title = item.title || "YouTube Video";
      const thumbnail = item.thumbnail || "https://files.catbox.moe/k315x4.jpg";

      // Dark-Dinu Quality Selection Menu Card
      const videoCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎬 *YOUTUBE DOWNLOADER* 〕
├─▸ 📌 *Title:* ${title.slice(0, 48)}...
├─▸ 🌐 *Platform:* YouTube Video
└───────────────────────

*බාගත කිරීමට අවශ්‍ය අංකය Reply කරන්න:*

┌─▸ [1] 🌟 *1080p (Full HD)*
├─▸ [2] 🎬 *720p (HD Video)*
├─▸ [3] 📱 *480p (Standard SD)*
└─▸ [4] ⚡ *360p (Data Saver)*

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      const sentMsg = await sock.sendMessage(
        from,
        {
          image: { url: thumbnail },
          caption: videoCard
        },
        { quoted: msg }
      );

      // Session එක Memory එකේ Store කිරීම
      if (sentMsg?.key?.id) {
        global.videoSessions.set(sentMsg.key.id, {
          from: from,
          url: targetUrl,
          title,
          apiKey
        });

        // විනාඩි 10 කට පසු Session එක clear කිරීම
        setTimeout(() => {
          if (global.videoSessions && global.videoSessions.has(sentMsg.key.id)) {
            global.videoSessions.delete(sentMsg.key.id);
          }
        }, 10 * 60 * 1000);
      }

      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[YOUTUBE VIDEO ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { 
          text: `❌ වීඩියෝව ලබාගත නොහැකි විය: ${err.message || "Network Error"}` 
        },
        { quoted: msg }
      );
    }
  },

  // Auto Universal Reply Handler for index.js
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.videoSessions.has(quotedStanzaId)) return false;

    const session = global.videoSessions.get(quotedStanzaId);
    if (session.from !== from) return false;

    const choice = body.trim();
    const qualityMap = {
      "1": "1080p",
      "2": "720p",
      "3": "480p",
      "4": "360p"
    };

    if (!qualityMap[choice]) return false;

    const selectedQuality = qualityMap[choice];

    try {
      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(session.url)}&quality=${selectedQuality}&format=mp4&api_key=${session.apiKey}`;
      const res = await axios.get(apiUrl, { timeout: 45000 });
      const downloadData = res.data?.data || res.data;

      const videoDownloadUrl = downloadData?.download_url || downloadData?.direct_url || downloadData?.url;

      if (!videoDownloadUrl) {
        throw new Error(`තෝරාගත් Quality (${selectedQuality}) එක ලබා ගැනීමට නොහැකි විය.`);
      }

      await sock.sendMessage(
        from,
        {
          video: { url: videoDownloadUrl },
          caption: `🎬 *${session.title}* [${selectedQuality}]\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      global.videoSessions.delete(quotedStanzaId);
      return true;
    } catch (err) {
      console.error("[VIDEO DOWNLOAD REPLY ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ වීඩියෝව Download කර ගැනීමට නොහැකි විය: ${err.message}` },
        { quoted: msg }
      );
      return true;
    }
  }
};
