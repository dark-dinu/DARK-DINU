import axios from "axios";

// Fast Image Stream Downloader (Timeout Protected)
async function fetchImageBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    return Buffer.from(res.data);
  } catch (_) {
    return null;
  }
}

export default {
  name: "img",
  aliases: ["image", "gimg", "googleimg", "photo"],
  category: "download",
  description: "Search and download Google images softly",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";

    try {
      const fullText = args.join(" ").trim();

      if (!fullText) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *IMAGE SEARCH GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  • *${pref}img <search_query>*
  • *${pref}img <search_query>,<count>* (Max: 5)

  ✨ *Examples:*
  • \`${pref}img cute anime cat\`
  • \`${pref}img sunset aesthetic,3\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      // Microsecond Reaction
      sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      // Parse Query and Optional Count (.img query,count)
      let query = fullText;
      let count = 1;

      if (fullText.includes(",")) {
        const parts = fullText.split(",");
        query = parts[0].trim();
        const parsedCount = parseInt(parts[1]?.trim(), 10);
        if (!isNaN(parsedCount) && parsedCount > 0) {
          count = Math.min(parsedCount, 5); // Cluster safety lock (Max 5 images per request)
        }
      }

      // Chamindu Image Search API
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/search/image?q=${encodeURIComponent(query)}&api_key=${apiKey}`;

      const res = await axios.get(apiUrl, { timeout: 15000 });
      const data = res.data;

      const imageList = data?.result || data?.data;

      if (!data?.success || !Array.isArray(imageList) || imageList.length === 0) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *No images found* for "${query}", try another sweet keyword darling!` },
          { quoted: msg }
        );
      }

      // Shuffle or Pick Images
      const selectedUrls = imageList.slice(0, Math.min(count, imageList.length));

      let sentCount = 0;
      for (let i = 0; i < selectedUrls.length; i++) {
        const targetUrl = selectedUrls[i];
        const imageBuf = await fetchImageBuffer(targetUrl);

        const captionCard = 
`🎀 ｡ﾟ•┈୨ *IMAGE SEARCH* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🔍 *Query:* ${query}
  🖼️ *Index:* [${i + 1}/${selectedUrls.length}]
  ⚡ *Source:* Google Search Stream

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        if (imageBuf) {
          await sock.sendMessage(
            from,
            { image: imageBuf, caption: captionCard },
            { quoted: i === 0 ? msg : undefined }
          );
          sentCount++;
        } else {
          // Fallback to Direct URL if buffer fetch fails
          try {
            await sock.sendMessage(
              from,
              { image: { url: targetUrl }, caption: captionCard },
              { quoted: i === 0 ? msg : undefined }
            );
            sentCount++;
          } catch (_) {}
        }

        // Gentle 200ms delay to prevent socket drops on multi-image delivery
        if (selectedUrls.length > 1 && i < selectedUrls.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (sentCount > 0) {
        sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      } else {
        throw new Error("Unable to load image buffers from stream");
      }

    } catch (err) {
      console.error("[IMAGE CMD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to fetch images softly"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
