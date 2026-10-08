import axios from "axios";

// Fast Stream Fetcher with User-Agent Masquerade
async function fetchMediaStream(streamUrl) {
  try {
    const res = await axios.get(streamUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

      if (!rawUrl || !rawUrl.includes("instagram.com")) {
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
      let mediaType = "video"; // "video" | "image"
      let mediaCaption = "";

      // -------------------------------------------------------------
      // 1. ENGINE ALPHA: Thinuzz High-Speed API
      // -------------------------------------------------------------
      try {
        const thinuzzKey = "key_525b5ceb068ac7f2";
        const thinuzzEndpoint = `https://mr-thinuzz-api-build.vercel.app/api/instadown/download?url=${encodeURIComponent(rawUrl)}&apiKey=${thinuzzKey}`;

        const res = await axios.get(thinuzzEndpoint, { timeout: 15000 });
        const resData = res.data;

        const downloadData = resData?.data || resData?.result || resData;

        if (Array.isArray(downloadData)) {
          const item = downloadData[0];
          directDownloadUrl = item?.url || item?.download_url || (typeof item === "string" ? item : null);
          if (item?.type === "image" || (directDownloadUrl && directDownloadUrl.includes(".jpg"))) {
            mediaType = "image";
          }
        } else if (typeof downloadData === "object" && downloadData !== null) {
          directDownloadUrl = downloadData.url || downloadData.download_url || downloadData.video_url || downloadData.media?.[0]?.url;
          if (downloadData.type === "image" || downloadData.is_video === false) {
            mediaType = "image";
          }
        }
      } catch (_) {}

      // -------------------------------------------------------------
      // 2. ENGINE BETA: Chamindu Site Relay
      // -------------------------------------------------------------
      if (!directDownloadUrl) {
        try {
          const chamKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
          const chamUrl = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(rawUrl)}&api_key=${chamKey}`;
          const resCham = await axios.get(chamUrl, { timeout: 15000 });
          const cData = resCham.data?.data || resCham.data?.result || resCham.data;

          if (Array.isArray(cData)) {
            directDownloadUrl = cData[0]?.url || cData[0]?.download_url;
          } else if (typeof cData === "object" && cData !== null) {
            directDownloadUrl = cData.url || cData.download_url;
          }
        } catch (_) {}
      }

      // -------------------------------------------------------------
      // 3. ENGINE GAMMA: BK9 Cloud Fallback
      // -------------------------------------------------------------
      if (!directDownloadUrl) {
        try {
          const bkRes = await axios.get(`https://bk9.fun/download/instagram?url=${encodeURIComponent(rawUrl)}`, { timeout: 12000 });
          const items = bkRes.data?.BK9;
          if (Array.isArray(items) && items.length > 0) {
            directDownloadUrl = items[0]?.url || items[0]?.link;
            if (items[0]?.type === "image") mediaType = "image";
          }
        } catch (_) {}
      }

      if (!directDownloadUrl) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: "🌸 *Could not fetch this media!* The post might be private, age-restricted, or removed, honey~"
          },
          { quoted: msg }
        );
      }

      // -------------------------------------------------------------
      // Stream Media Buffer (Guaranteed Delivery)
      // -------------------------------------------------------------
      const mediaBuffer = await fetchMediaStream(directDownloadUrl);

      const aestheticCaption = 
`🎀 ｡ﾟ•┈୨ *INSTAGRAM DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📸 *Source:* Instagram Public Reel / Post
  ✨ *Format:* High Definition (${mediaType.toUpperCase()})
  ⚡ *Engine:* Ultra-Fast Stream Relay

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // Dispatch Media
      if (mediaType === "video" || directDownloadUrl.includes(".mp4")) {
        if (mediaBuffer) {
          await sock.sendMessage(
            from,
            { video: mediaBuffer, caption: aestheticCaption, mimetype: "video/mp4" },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            from,
            { video: { url: directDownloadUrl }, caption: aestheticCaption },
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
        { text: `🌸 *Glitch detected:* ${err.message || "Network timeout"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
