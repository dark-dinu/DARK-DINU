import axios from "axios";

// Fast CDN Buffer Streamer (Bypasses Instagram 403 Forbidden blocks)
async function downloadInstagramMedia(streamUrl) {
  try {
    const res = await axios.get(streamUrl, {
      responseType: "arraybuffer",
      timeout: 35000,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "*/*",
        "Referer": "https://www.instagram.com/"
      }
    });
    return Buffer.from(res.data);
  } catch (_) {
    return null;
  }
}

export default {
  name: "instagram",
  aliases: ["insta", "ig", "igdl", "reel"],
  category: "download",
  description: "Download Instagram Reels, Videos, and Photos softly",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";

    try {
      const rawUrl = args[0]?.trim();

      if (!rawUrl || (!rawUrl.includes("instagram.com") && !rawUrl.includes("instagr.am"))) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *INSTAGRAM DOWNLOAD GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}insta <instagram_post_or_reel_url>\`

  ✨ *Example:*
  \`${pref}insta https://www.instagram.com/reel/DYYnrwzA4Yw/\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      // Microsecond Reaction
      sock.sendMessage(from, { react: { text: "📸", key: msg.key } }).catch(() => {});

      let directDownloadUrl = null;
      let isImage = false;

      // -------------------------------------------------------------
      // 1. PRIMARY ENGINE: Mr-Thinuzz API (Live Working Endpoint)
      // -------------------------------------------------------------
      try {
        const thinuzzKey = "key_525b5ceb068ac7f2";
        const endpoint = `https://mr-thinuzz-api-build.vercel.app/api/instadown/download?url=${encodeURIComponent(rawUrl)}&apiKey=${thinuzzKey}`;

        const res = await axios.get(endpoint, { timeout: 15000 });
        const resData = res.data;

        // Extract deep links across possible schema variations
        const payload = resData?.result || resData?.data || resData;

        if (Array.isArray(payload) && payload.length > 0) {
          const item = payload[0];
          directDownloadUrl = typeof item === "string" ? item : (item.url || item.download_url || item.link);
          if (item?.type === "image" || (directDownloadUrl && directDownloadUrl.includes(".jpg"))) {
            isImage = true;
          }
        } else if (typeof payload === "object" && payload !== null) {
          directDownloadUrl = payload.url || payload.download_url || payload.video_url || payload.media?.[0]?.url;
          if (payload.type === "image" || payload.is_video === false) {
            isImage = true;
          }
        }
      } catch (err) {
        console.error("[THINUZZ API FAIL]:", err.message);
      }

      // -------------------------------------------------------------
      // 2. BACKUP ENGINE: GuruAPI / Siputz Engine
      // -------------------------------------------------------------
      if (!directDownloadUrl) {
        try {
          const guruRes = await axios.get(`https://api.guruapi.tech/insta/v1/igdl?url=${encodeURIComponent(rawUrl)}`, { timeout: 12000 });
          const gData = guruRes.data?.result || guruRes.data?.media;
          if (Array.isArray(gData) && gData.length > 0) {
            directDownloadUrl = gData[0]?.url || gData[0]?.download_url;
            if (gData[0]?.type === "image") isImage = true;
          }
        } catch (_) {}
      }

      // -------------------------------------------------------------
      // 3. BACKUP ENGINE: BK9 Fast Scraper
      // -------------------------------------------------------------
      if (!directDownloadUrl) {
        try {
          const bkRes = await axios.get(`https://bk9.fun/download/instagram?url=${encodeURIComponent(rawUrl)}`, { timeout: 12000 });
          const items = bkRes.data?.BK9;
          if (Array.isArray(items) && items.length > 0) {
            directDownloadUrl = items[0]?.url || items[0]?.link;
            if (items[0]?.type === "image") isImage = true;
          }
        } catch (_) {}
      }

      if (!directDownloadUrl) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: "🌸 *Could not fetch this media!* The post might be private, restricted, or unavailable, honey~"
          },
          { quoted: msg }
        );
      }

      // -------------------------------------------------------------
      // 4. Download Direct Buffer to Prevent Socket/CDN Drops
      // -------------------------------------------------------------
      const mediaBuffer = await downloadInstagramMedia(directDownloadUrl);

      const aestheticCaption = 
`🎀 ｡ﾟ•┈୨ *INSTAGRAM DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📸 *Source:* Instagram Public Reel / Post
  ✨ *Format:* High Definition (${isImage ? "IMAGE" : "VIDEO"})
  ⚡ *Engine:* Ultra-Fast Stream Relay

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 5. Send Video or Image
      if (!isImage) {
        if (mediaBuffer) {
          await sock.sendMessage(
            from,
            { video: mediaBuffer, caption: aestheticCaption, mimetype: "video/mp4" },
            { quoted: msg }
          );
        } else {
          // Buffer fail වුණොත් direct stream URL එකෙන් යවයි
          await sock.sendMessage(
            from,
            { video: { url: directDownloadUrl }, caption: aestheticCaption, mimetype: "video/mp4" },
            { quoted: msg }
          );
        }
      } else {
        if (mediaBuffer) {
          await sock.sendMessage(
            from,
            { image: mediaBuffer, caption: aestheticCaption },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            from,
            { image: { url: directDownloadUrl }, caption: aestheticCaption },
            { quoted: msg }
          );
        }
      }

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[INSTAGRAM ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to download media softly"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
