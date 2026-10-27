import axios from "axios";

// Active Chamindu API Key
const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";

// Fast CDN Buffer Streamer (Bypasses Instagram 403 Forbidden blocks)
async function downloadInstagramMedia(streamUrl) {
  try {
    const res = await axios.get(streamUrl, {
      responseType: "arraybuffer",
      timeout: 45000,
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
      const rawInput = args.join(" ").trim();
      const match = rawInput.match(/https?:\/\/[^\s]+/i);
      const rawUrl = match ? match[0] : "";

      if (!rawUrl || (!rawUrl.includes("instagram.com") && !rawUrl.includes("instagr.am"))) {
        sock.sendMessage(from, { react: { text: "📥", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *INSTAGRAM DOWNLOAD GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}insta <instagram_post_or_reel_url>\`

  ✨ *Example:*
  \`${pref}insta https://www.instagram.com/reel/De2bNIWSZdB/\`

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
      // 1. PRIMARY ENGINE: Chamindu Instagram API
      // -------------------------------------------------------------
      try {
        const endpoint = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(rawUrl)}&api_key=${CHAMA_API_KEY}`;
        const { data: res } = await axios.get(endpoint, {
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 20000
        });

        const root = res?.data || res?.result || res;

        // Type A: Media array (e.g. data.media / data.downloads / Array)
        const mediaList = Array.isArray(root) ? root : (root?.media || root?.downloads || root?.medias || []);
        if (Array.isArray(mediaList) && mediaList.length > 0) {
          const item = mediaList[0];
          directDownloadUrl = typeof item === "string" ? item : (item.url || item.download_url || item.link);
          if (item?.type === "image" || (directDownloadUrl && (directDownloadUrl.includes(".jpg") || directDownloadUrl.includes(".webp")))) {
            isImage = true;
          }
        }

        // Type B: Direct object fields
        if (!directDownloadUrl && typeof root === "object" && root !== null) {
          directDownloadUrl = root.video || root.url || root.download_url || root.video_url || root.image || root.photo;
          if (root.type === "image" || root.is_video === false || (!root.video && (root.image || root.photo))) {
            isImage = true;
          }
        }
      } catch (err) {
        console.error("[CHAMINDU INSTA ERROR]:", err.message);
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
  ⚡ *Engine:* Chamindu Media Relay

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 5. Send Video or Image safely
      if (!isImage) {
        if (mediaBuffer) {
          await sock.sendMessage(
            from,
            { video: mediaBuffer, caption: aestheticCaption, mimetype: "video/mp4" },
            { quoted: msg }
          );
        } else {
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
