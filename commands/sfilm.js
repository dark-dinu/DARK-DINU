import axios from "axios";

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const API_BASE = "https://api.chamindu.site/api/v1/movies/sinhalasub/infodl";

// Multi-quality link parser
function parseMovieDownloads(downloads = []) {
  if (!Array.isArray(downloads)) return [];
  return downloads.map((item, idx) => {
    const name = item.name || item.quality || item.title || `Download Option ${idx + 1}`;
    const link = item.link || item.url || item.download || "N/A";
    const size = item.size ? ` [${item.size}]` : "";
    return { name: `${name}${size}`, link };
  });
}

export default {
  name: "sinhalasub",
  aliases: ["subdl", "movie", "moviedl"],
  category: "download",
  description: "Download Sinhala subtitled movies & direct links from sinhalasub.lk",

  async execute({ sock, msg, from, args, prefix, config: appConfig }) {
    const pref = prefix || appConfig?.PREFIX || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *භාවිතය:* \`${pref}sinhalasub <sinhalasub.lk_url>\`\n\n*උදාහරණයක්:* \`${pref}sinhalasub https://sinhalasub.lk/movies/deadpool-wolverine-2024-sinhala-subtitles/\``
        },
        { quoted: msg }
      );
    }

    if (!query.includes("sinhalasub.lk")) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ කරුණාකර වලංගු *sinhalasub.lk* චිත්‍රපට ලින්ක් එකක් ලබාදෙන්න!" },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      const endpoint = `${API_BASE}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
      const { data: res } = await axios.get(endpoint, { timeout: 15000 });

      if (!res?.status && !res?.success && !res?.data && !res?.result) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "💔 අදාළ චිත්‍රපටයේ විස්තර ලබාගැනීමට නොහැකි විය. ලින්ක් එක පරීක්ෂා කරන්න." },
          { quoted: msg }
        );
      }

      const d = res.data || res.result || res;
      const title = d.title || d.name || "Sinhala Subtitled Movie";
      const year = d.year || d.release_year || "N/A";
      const imdb = d.imdb || d.rating || "N/A";
      const duration = d.runtime || d.duration || "N/A";
      const genres = Array.isArray(d.genres) ? d.genres.join(", ") : (d.genres || "Movie");
      const image = d.image || d.poster || d.thumbnail || null;
      const desc = (d.story || d.description || d.synopsis || "").slice(0, 300);

      const downloadList = parseMovieDownloads(d.downloads || d.download_links || d.links || []);

      let card = 
`🎬 ｡ﾟ•┈୨ *SINHALASUB MOVIE INFO* ୧┈•ﾟ｡ 🍿
━━━━━━━━━━━━━━━━━━━━━

✨ *Movie:* ${title}
📅 *Year:* \`${year}\`  |  ⭐ *IMDb:* \`${imdb}\`
⏳ *Runtime:* \`${duration}\`
🎭 *Genres:* \`${genres}\`

📖 *Story:*
${desc ? `_${desc}..._` : "_No story description available._"}

━━━━━━━━━━━━━━━━━━━━━
📦 *AVAILABLE DOWNLOAD QUALITIES / LINKS:*

`;

      if (downloadList.length > 0) {
        downloadList.slice(0, 10).forEach((item, idx) => {
          card += `🔹 *${idx + 1}. ${item.name}*\n   🔗 ${item.link}\n\n`;
        });
        if (downloadList.length > 10) {
          card += `_...තවත් links ${downloadList.length - 10} ක් ඇත._\n\n`;
        }
      } else if (d.download || d.link) {
        card += `🔗 *Direct Link:* ${d.download || d.link}\n\n`;
      } else {
        card += `_No direct download links found for this movie._\n\n`;
      }

      card += `━━━━━━━━━━━━━━━━━━━━━\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      sock.sendMessage(from, { react: { text: "🎬", key: msg.key } }).catch(() => {});

      if (image) {
        return await sock.sendMessage(
          from,
          { image: { url: image }, caption: card },
          { quoted: msg }
        );
      }

      return await sock.sendMessage(from, { text: card }, { quoted: msg });

    } catch (err) {
      console.error("[SINHALASUB API ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `⚠️ API එකෙන් දත්ත ලබාගැනීමේදී දෝෂයක් සිදු විය: ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
