import axios from "axios";

const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";

// pin.it redirect expander
async function expandUrl(shortUrl) {
  try {
    const res = await axios.get(shortUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36"
      }
    });
    return res.headers.location || shortUrl;
  } catch (err) {
    if (err.response?.headers?.location) {
      return err.response.headers.location;
    }
    return shortUrl;
  }
}

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

      if (!inputUrl || (!inputUrl.includes("pinterest.com") && !inputUrl.includes("pin.it"))) {
        return await sock.sendMessage(
          from,
          { 
            text: `⚠️ *INVALID USAGE*\n\nකරුණාකර නිවැරදි Pinterest වීඩියෝ ලින්ක් එකක් ලබාදෙන්න.\n\n*උදාහරණ:* \`${prefix}pt https://pin.it/xxxxxx\`` 
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "📥", key: msg.key } }).catch(() => {});

      // 1. Resolve redirect for pin.it
      let targetUrl = inputUrl;
      if (inputUrl.includes("pin.it")) {
        targetUrl = await expandUrl(inputUrl);
      }

      let videoUrl = null;

      // 2. Primary: Chamindu API
      try {
        const chamaUrl = `https://api.chamindu.site/api/v1/media/pinterest/infodl?q=${encodeURIComponent(targetUrl)}&api_key=${CHAMA_API_KEY}`;
        const { data: res } = await axios.get(chamaUrl, { timeout: 15000 });
        const pData = res?.data || res?.result || res;

        if (Array.isArray(pData?.downloads)) {
          const item = pData.downloads.find(d => 
            (d.format && d.format.toLowerCase().includes("mp4")) ||
            (d.type && d.type.toLowerCase().includes("video")) ||
            (d.url && d.url.includes(".mp4")) ||
            (d.link && d.link.includes(".mp4"))
          );
          if (item) videoUrl = item.url || item.link;
        }

        if (!videoUrl && pData?.video) videoUrl = pData.video;
        if (!videoUrl && pData?.url && pData.url.includes(".mp4")) videoUrl = pData.url;
      } catch (_) {}

      // 3. Fallback 1: BK9 Pinterest API (No-Key Direct)
      if (!videoUrl) {
        try {
          const bkUrl = `https://bk9.fun/download/pinterest?url=${encodeURIComponent(targetUrl)}`;
          const { data: bkRes } = await axios.get(bkUrl, { timeout: 12000 });
          const bkd = bkRes?.BK9 || bkRes?.data || bkRes?.result;
          if (Array.isArray(bkd)) {
            const v = bkd.find(x => x.url && x.url.includes(".mp4"));
            if (v) videoUrl = v.url;
          } else if (bkd?.url && bkd.url.includes(".mp4")) {
            videoUrl = bkd.url;
          }
        } catch (_) {}
      }

      // 4. Fallback 2: Siputzx Pinterest API
      if (!videoUrl) {
        try {
          const sipuUrl = `https://api.siputzx.my.id/api/d/pinterest?url=${encodeURIComponent(targetUrl)}`;
          const { data: sRes } = await axios.get(sipuUrl, { timeout: 12000 });
          const sMedia = sRes?.data;
          if (Array.isArray(sMedia)) {
            const vid = sMedia.find(m => m.type === "video" || (m.url && m.url.includes(".mp4")));
            if (vid) videoUrl = vid.url;
          } else if (sMedia?.video) {
            videoUrl = sMedia.video;
          }
        } catch (_) {}
      }

      if (!videoUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ *VIDEO NOT FOUND:* වීඩියෝවක් හමු නොවීය. ලින්ක් එක වීඩියෝවක් බව තහවුරු කරගන්න." },
          { quoted: msg }
        );
      }

      // 5. Download Video Buffer (WhatsApp Direct URL Stream Failures වළක්වයි)
      const streamRes = await axios({
        url: videoUrl,
        method: "GET",
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
      });

      const videoBuffer = Buffer.from(streamRes.data);

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
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🥰*`;

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
        { text: `❌ *ERROR:* ${err.message || "Failed to process video"}` },
        { quoted: msg }
      );
    }
  }
};
