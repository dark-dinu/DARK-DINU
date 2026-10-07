import axios from "axios";

export default {
  name: "pinterest",
  aliases: ["pt", "pindl", "pinvideo"],
  category: "download",
  description: "High-speed Pinterest MP4 Video Downloader",

  async execute({ sock, msg, from, args, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      const inputUrl = args.join(" ").trim();

      if (!inputUrl) {
        return await sock.sendMessage(
          from,
          { 
            text: `⚠️ *INVALID USAGE*\n\nPlease provide a valid Pinterest Video link.\n\n*Usage:* \`${prefix}pt <pinterest_url>\`\n*Example:* \`${prefix}pt https://pin.it/xxxxxx\`` 
          },
          { quoted: msg }
        );
      }

      if (!inputUrl.includes("pinterest.com") && !inputUrl.includes("pin.it")) {
        return await sock.sendMessage(
          from,
          { text: "❌ *INVALID LINK:* Please enter a valid Pinterest link." },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 1. Unshorten pin.it Link with low latency GET request
      let fullUrl = inputUrl;
      if (inputUrl.includes("pin.it")) {
        try {
          const redirectRes = await axios.get(inputUrl, {
            maxRedirects: 5,
            timeout: 10000,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          fullUrl = redirectRes.request?.res?.responseUrl || redirectRes.config?.url || inputUrl;
        } catch (_) {}
      }

      // 2. Primary Fast Relay: Chamindu API
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/media/pinterest/infodl?q=${encodeURIComponent(fullUrl)}&api_key=${apiKey}`;

      let videoUrl = null;

      try {
        const { data } = await axios.get(apiUrl, { timeout: 15000 });
        if (data?.data && Array.isArray(data.data.downloads)) {
          const vItem = data.data.downloads.find(d => 
            (d.type && d.type.toLowerCase().includes("video")) ||
            (d.name && d.name.toLowerCase().includes("video")) ||
            (d.link && d.link.includes(".mp4"))
          );
          if (vItem) videoUrl = vItem.link;
        }
      } catch (_) {}

      // 3. Ultra-Fast Fallback: Supun API
      if (!videoUrl) {
        try {
          const supunApi = `https://supunofc.site/api/download/down/pin/dl?url=${encodeURIComponent(fullUrl)}&apikey=supun-tvo5olfxylo98b8l6b9lq174`;
          const sRes = await axios.get(supunApi, { timeout: 15000 });
          const sData = sRes.data?.result || sRes.data?.data || sRes.data;

          if (typeof sData === "object" && sData !== null) {
            videoUrl = sData.video || sData.video_url || sData.nowm || sData.url_video;
            if (!videoUrl && Array.isArray(sData.downloads)) {
              const sv = sData.downloads.find(i => 
                (i.type && i.type.includes("video")) || 
                (i.url && i.url.includes(".mp4"))
              );
              if (sv) videoUrl = sv.url || sv.link;
            }
          }
        } catch (_) {}
      }

      // 4. If No Video Found (Images rejected strictly)
      if (!videoUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ *VIDEO NOT FOUND:* No MP4 video stream detected for this pin. Please ensure the link contains an actual video." },
          { quoted: msg }
        );
      }

      const caption = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📌 *PINTEREST VIDEO* 〕
├─▸ ⚡ *Engine*   : Ultra Stream Relay
├─▸ 🎬 *Format*   : MP4 Video (HD)
├─▸ 🌐 *Platform* : Pinterest
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      // 5. Direct Video Dispatch
      await sock.sendMessage(
        from,
        {
          video: { url: videoUrl },
          caption: caption,
          mimetype: "video/mp4"
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[PINTEREST ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ *DOWNLOAD FAILED:* ${err.message || "Network timeout / Server unreachable"}` },
        { quoted: msg }
      );
    }
  }
};
