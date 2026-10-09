import axios from "axios";

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const BASE_URL = "https://api.chamindu.site/api/v1";

// Source Identifier & Route Mapper
function detectSource(link) {
  if (link.includes("lakvisiontv.net")) {
    return { type: "lakvision", endpoint: `${BASE_URL}/cartoons/lakvision/infodl?q=${encodeURIComponent(link)}&api_key=${API_KEY}`, param: "q" };
  }
  if (link.includes("luciferdonghua.org")) {
    return { type: "lucifer", endpoint: `${BASE_URL}/anime/luciferdonghua/infodl?q=${encodeURIComponent(link)}&api_key=${API_KEY}`, param: "q" };
  }
  if (link.includes("animexin.dev") || link.includes("animexin.vip")) {
    return { type: "animexin", endpoint: `${BASE_URL}/anime/animexin/infodl?q=${encodeURIComponent(link)}&api_key=${API_KEY}`, param: "q" };
  }
  if (link.includes("gogoanime.")) {
    return { type: "gogoanime", endpoint: `${BASE_URL}/anime/gogoanime/dl?url=${encodeURIComponent(link)}&api_key=${API_KEY}`, param: "url" };
  }
  if (link.includes("animepahe.")) {
    return { type: "animepahe", endpoint: `${BASE_URL}/anime/animepahe/dl?url=${encodeURIComponent(link)}&api_key=${API_KEY}`, param: "url" };
  }
  if (link.includes("cartoons.lk")) {
    return { type: "cartoons", endpoint: `${BASE_URL}/movies/cartoons/infodl?q=${encodeURIComponent(link)}&api_key=${API_KEY}`, param: "q" };
  }
  return null;
}

export default {
  name: "media",
  aliases: ["anime", "donghua", "lakvision", "gogo", "pahe", "cartoondl"],
  category: "download",
  description: "Download Anime, Donghua, Lakvision & Cartoons directly from supported links",

  async execute({ sock, msg, from, args, prefix, config: appConfig }) {
    const pref = prefix || appConfig?.PREFIX || ".";
    const input = args[0]?.trim();

    if (!input || !input.startsWith("http")) {
      const helpMenu = 
`🌸 ｡ﾟ•┈୨ *ANIME & CARTOON SUITE* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

ලින්ක් එක ලබාදී කෙලින්ම Direct Video හෝ Download Links ලබාගන්න!

📌 *භාවිතය:* \`${pref}media <link>\`
(නැතහොත් \`${pref}anime <link>\`, \`${pref}donghua <link>\`)

🌐 *සහය දක්වන වෙබ් අඩවි (Supported Sources):*
  1️⃣ *Lakvision TV* ➔ ලංකාවේ පරණ කාටූන්, ටෙලි නාට්‍ය
  2️⃣ *Lucifer Donghua* ➔ චීන Anime (BTTH, Perfect World...)
  3️⃣ *Animexin* ➔ Chinese 3D Donghua Series
  4️⃣ *Gogoanime* ➔ ජපන් Anime (Subbed & Dubbed)
  5️⃣ *Animepahe* ➔ High Quality Anime (Solo Leveling, etc.)
  6️⃣ *Cartoons.lk* ➔ සිංහල හඬකැවූ කාටූන්

✨ *උදාහරණයක්:*
\`${pref}media https://animepahe.ch/solo-leveling-season-2-arise-from-the-shadow-dub-episode-1/\`

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: helpMenu }, { quoted: msg });
    }

    const route = detectSource(input);
    if (!route) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ සහය නොදක්වන ලින්ක් එකකි! කරුණාකර Lakvision, LuciferDonghua, Animexin, Gogoanime හෝ Animepahe ලින්ක් එකක් ලබාදෙන්න." },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      const { data: res } = await axios.get(route.endpoint, { timeout: 20000 });
      const d = res?.data || res?.result || res?.results || res;

      if (!d || (typeof d === "object" && Object.keys(d).length === 0)) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: "💔 අදාළ ලින්ක් එකෙන් වීඩියෝ දත්ත ලබාගැනීමට නොහැකි විය." }, { quoted: msg });
      }

      const title = d.title || d.name || "Video Content";
      const image = d.image || d.poster || d.thumbnail || null;
      const downloads = d.downloads || d.download_links || d.links || [];
      const directVideo = d.stream || d.video || d.direct_link || (downloads[0]?.link);

      // Attempt Direct Document Video Sending if under 150MB or stream available
      let fileSent = false;
      if (directVideo && (directVideo.includes(".mp4") || directVideo.includes(".mkv") || directVideo.includes("storage"))) {
        try {
          sock.sendMessage(from, { react: { text: "🚀", key: msg.key } }).catch(() => {});
          const fileName = `${title.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30)}.mp4`;

          await sock.sendMessage(
            from,
            {
              document: { url: directVideo },
              mimetype: "video/mp4",
              fileName: fileName,
              caption: `🎬 *${title}*\n🏷️ *Source:* \`${route.type.toUpperCase()}\`\n💖 *DARK-DINU MD*`
            },
            { quoted: msg }
          );
          fileSent = true;
          sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        } catch (_) {
          fileSent = false;
        }
      }

      // If direct video stream not sent, deliver aesthetically formatted Direct Download Card
      if (!fileSent) {
        let card = 
`🎬 ｡ﾟ•┈୨ *MEDIA DOWNLOAD READY* ୧┈•ﾟ｡ 🍿
━━━━━━━━━━━━━━━━━━━━━

✨ *Title:* ${title}
🏷️ *Platform:* \`${route.type.toUpperCase()}\`

📦 *AVAILABLE DOWNLOAD LINKS:*
`;

        if (Array.isArray(downloads) && downloads.length > 0) {
          downloads.slice(0, 10).forEach((item, idx) => {
            const dlName = item.name || item.quality || `Link ${idx + 1}`;
            card += `\n🔹 *${idx + 1}. ${dlName}*\n   🔗 ${item.link || item.url || item}\n`;
          });
        } else if (directVideo) {
          card += `\n🔗 *Direct Download:* ${directVideo}\n`;
        } else {
          card += `\n_Links extracted, browser download recommended._\n`;
        }

        card += `\n━━━━━━━━━━━━━━━━━━━━━\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        sock.sendMessage(from, { react: { text: "📥", key: msg.key } }).catch(() => {});

        if (image) {
          return await sock.sendMessage(from, { image: { url: image }, caption: card }, { quoted: msg });
        } else {
          return await sock.sendMessage(from, { text: card }, { quoted: msg });
        }
      }

    } catch (err) {
      console.error("[MEDIA SUITE ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `⚠️ දත්ත ලබාගැනීමේදී දෝෂයක් ආවා: ${err.message}` }, { quoted: msg });
    }
  }
};
