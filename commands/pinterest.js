import axios from "axios";

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

export default {
  name: "pinterest",
  aliases: ["pt", "pindl", "pinvideo"],
  category: "download",
  description: "High-speed Pinterest MP4 Video Downloader",

  async execute({ sock, msg, from, args, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      const rawInput = args.join(" ").trim();
      const match = rawInput.match(/https?:\/\/[^\s]+/i);
      const inputUrl = match ? match[0] : "";

      if (!inputUrl) {
        return await sock.sendMessage(
          from,
          { text: `⚠️ *භාවිතය:* \`${prefix}pt <pinterest_url>\`` },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "📥", key: msg.key } }).catch(() => {});

      // 1. Direct Chamindu Pinterest API Call
      const apiUrl = `https://api.chamindu.site/api/v1/media/pinterest/infodl?q=${encodeURIComponent(inputUrl)}&api_key=${API_KEY}`;
      
      const { data: res } = await axios.get(apiUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 25000
      });

      console.log("[PINTEREST RESPONSE]:", JSON.stringify(res));

      // 2. Extract Direct Video Link safely
      let videoUrl = null;
      const rootData = res?.data || res?.result || res;

      // Type 1: Direct keys
      if (typeof rootData === "object" && rootData !== null) {
        if (rootData.video) videoUrl = rootData.video;
        else if (rootData.url && typeof rootData.url === "string" && rootData.url.includes(".mp4")) videoUrl = rootData.url;
        else if (rootData.download_url) videoUrl = rootData.download_url;
      }

      // Type 2: Array check (downloads / medias / videos)
      const list = rootData?.downloads || rootData?.medias || (Array.isArray(rootData) ? rootData : null);
      if (!videoUrl && Array.isArray(list)) {
        const item = list.find(d => 
          (d.type && d.type.toLowerCase().includes("video")) ||
          (d.format && d.format.toLowerCase().includes("mp4")) ||
          (d.url && d.url.includes(".mp4")) ||
          (d.link && d.link.includes(".mp4"))
        );
        if (item) videoUrl = item.url || item.link || item.download_url;
        if (!videoUrl && list[0]?.url) videoUrl = list[0].url;
      }

      if (!videoUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ *VIDEO NOT FOUND:* මේ Pin එකෙන් වීඩියෝ ලින්ක් එකක් ලබාගත නොහැකි විය." },
          { quoted: msg }
        );
      }

      // 3. Download to Buffer (WhatsApp Stream Drop නොවීමට)
      const dlRes = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });

      const videoBuffer = Buffer.from(dlRes.data);

      const caption = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📌 *PINTEREST VIDEO* 〕
├─▸ ⚡ *Engine*   : Chamindu Infodl
├─▸ 🎬 *Format*   : MP4 (HD)
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🥰*`;

      // 4. Send Video to WhatsApp
      await sock.sendMessage(
        from,
        {
          video: videoBuffer,
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
        { text: `❌ *Error:* ${err.response?.data?.message || err.message}` },
        { quoted: msg }
      );
    }
  }
};
