import axios from "axios";

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const SEARCH_API = "https://api.chamindu.site/api/v1/movies/sinhalasub/search";
const INFO_API = "https://api.chamindu.site/api/v1/movies/sinhalasub/infodl";

// Multi-step session tracking
global.movieSearchSessions = global.movieSearchSessions || new Map();
global.movieQualitySessions = global.movieQualitySessions || new Map();
global.movieHooked = global.movieHooked || new WeakSet();

// Parse movie downloads helper
function parseMovieDownloads(downloads = []) {
  if (!Array.isArray(downloads)) return [];
  return downloads.map((item, idx) => {
    const name = item.name || item.quality || item.title || `Option ${idx + 1}`;
    const link = item.link || item.url || item.download || "N/A";
    const size = item.size ? ` [${item.size}]` : "";
    return { name: `${name}${size}`, link };
  });
}

// Fetch Full Details & Quality Menu
async function fetchAndSendMovieDetails(sock, from, movieUrl, originalMsg) {
  sock.sendMessage(from, { react: { text: "⏳", key: originalMsg.key } }).catch(() => {});

  try {
    const endpoint = `${INFO_API}?q=${encodeURIComponent(movieUrl)}&api_key=${API_KEY}`;
    const { data: res } = await axios.get(endpoint, { timeout: 15000 });

    const d = res?.data || res?.result || res;
    if (!d || (!d.title && !d.name)) {
      return await sock.sendMessage(from, { text: "💔 චිත්‍රපටයේ විස්තර ලබාගැනීමට නොහැකි විය." }, { quoted: originalMsg });
    }

    const title = d.title || d.name || "Sinhala Subtitled Movie";
    const year = d.year || d.release_year || "N/A";
    const imdb = d.imdb || d.rating || "N/A";
    const duration = d.runtime || d.duration || "N/A";
    const genres = Array.isArray(d.genres) ? d.genres.join(", ") : (d.genres || "Movie");
    const image = d.image || d.poster || d.thumbnail || null;
    const desc = (d.story || d.description || d.synopsis || "").slice(0, 250);

    const downloadList = parseMovieDownloads(d.downloads || d.download_links || d.links || []);

    let card = 
`🎬 ｡ﾟ•┈୨ *${title}* ୧┈•ﾟ｡ 🍿
━━━━━━━━━━━━━━━━━━━━━

📅 *Year:* \`${year}\`  |  ⭐ *IMDb:* \`${imdb}\`
⏳ *Runtime:* \`${duration}\`  |  🎭 *Genres:* \`${genres}\`

📖 *Story:*
_${desc ? desc : "No story available"}..._

━━━━━━━━━━━━━━━━━━━━━
📦 *AVAILABLE QUALITIES:*

`;

    downloadList.forEach((item, idx) => {
      card += `  • *${idx + 1}* ➔${item.name}\n`;
    });

    card += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *Reply with Quality Number (උදා: 1, 2)* to get the download link!
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    sock.sendMessage(from, { react: { text: "🍿", key: originalMsg.key } }).catch(() => {});

    let sentMsg = null;
    if (image) {
      sentMsg = await sock.sendMessage(from, { image: { url: image }, caption: card }, { quoted: originalMsg });
    } else {
      sentMsg = await sock.sendMessage(from, { text: card }, { quoted: originalMsg });
    }

    if (sentMsg?.key?.id && downloadList.length > 0) {
      global.movieQualitySessions.set(sentMsg.key.id, {
        from,
        title,
        downloadList,
        time: Date.now()
      });
      setTimeout(() => global.movieQualitySessions.delete(sentMsg.key.id), 600000);
    }
  } catch (err) {
    sock.sendMessage(from, { text: `⚠️ දෝෂයක්: ${err.message}` }, { quoted: originalMsg });
  }
}

// Interactive Number Reply Engine
function hookMovieInteractive(sock) {
  if (!sock || global.movieHooked.has(sock)) return;
  global.movieHooked.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const quotedId = rawMsg?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!quotedId) return;

    const text = (rawMsg.conversation || rawMsg.extendedTextMessage?.text || "").trim();
    const chosenNum = parseInt(text, 10);
    if (isNaN(chosenNum)) return;

    // STEP 1: Search Results වලින් Movie එකක් තෝරාගත් විට
    if (global.movieSearchSessions.has(quotedId)) {
      const searchSession = global.movieSearchSessions.get(quotedId);
      if (searchSession.from === from && chosenNum >= 1 && chosenNum <= searchSession.results.length) {
        global.movieSearchSessions.delete(quotedId);
        const selected = searchSession.results[chosenNum - 1];
        await fetchAndSendMovieDetails(sock, from, selected.link || selected.url, m);
        return;
      }
    }

    // STEP 2: Quality Number එක තෝරාගත් විට
    if (global.movieQualitySessions.has(quotedId)) {
      const qSession = global.movieQualitySessions.get(quotedId);
      if (qSession.from === from && chosenNum >= 1 && chosenNum <= qSession.downloadList.length) {
        const item = qSession.downloadList[chosenNum - 1];
        sock.sendMessage(from, { react: { text: "📥", key: m.key } }).catch(() => {});

        let dlCard = 
`🎬 ｡ﾟ•┈୨ *DIRECT MOVIE DOWNLOAD* ୧┈•ﾟ｡ 🚀
━━━━━━━━━━━━━━━━━━━━━

✨ *Movie:* ${qSession.title}
📦 *Quality:* ${item.name}

🔗 *Download Link:*
${item.link}

━━━━━━━━━━━━━━━━━━━━━
_Link එක browser එකෙන් open කර direct download කරගන්න._
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        await sock.sendMessage(from, { text: dlCard }, { quoted: m });
      }
    }
  });
}

export default {
  name: "sinhalasub",
  aliases: ["movie", "subdl", "moviedl"],
  category: "download",
  description: "Search and download Sinhala subtitled movies by name",

  async execute({ sock, msg, from, args, prefix, config: appConfig }) {
    hookMovieInteractive(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *භාවිතය:* \`${pref}movie <නම හෝ sinhalasub.lk link>\`\n\n*උදාහරණයක්:* \`${pref}movie deadpool\``
        },
        { quoted: msg }
      );
    }

    // Direct Link ලබාදුනහොත්
    if (query.includes("sinhalasub.lk")) {
      return await fetchAndSendMovieDetails(sock, from, query, msg);
    }

    sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    try {
      // Movie Search by Name
      const searchUrl = `${SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
      const { data: res } = await axios.get(searchUrl, { timeout: 15000 });

      const results = res?.data || res?.result || res?.results || [];

      if (!results || results.length === 0) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `💔 \`"${query}"\` නමින් කිසිදු චිත්‍රපටයක් sinhalasub.lk හි හමු නොවීය.` },
          { quoted: msg }
        );
      }

      let searchCard = 
`🎬 ｡ﾟ•┈୨ *SINHALASUB SEARCH RESULTS* ୧┈•ﾟ｡ 🔍
━━━━━━━━━━━━━━━━━━━━━

🔎 *Search Query:* \`${query}\`
📦 *Found:* ${results.length} Movies

`;

      results.slice(0, 10).forEach((item, idx) => {
        const itemTitle = item.title || item.name || "Movie";
        searchCard += `  *${idx + 1}.* ${itemTitle}\n`;
      });

      searchCard += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *Reply with the number (1-${Math.min(results.length, 10)}) to view details!*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

      const sentMsg = await sock.sendMessage(from, { text: searchCard }, { quoted: msg });

      if (sentMsg?.key?.id) {
        global.movieSearchSessions.set(sentMsg.key.id, {
          from,
          results: results.slice(0, 10),
          time: Date.now()
        });
        setTimeout(() => global.movieSearchSessions.delete(sentMsg.key.id), 300000);
      }

    } catch (err) {
      console.error("[MOVIE SEARCH ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `⚠️ චිත්‍රපට සෙවීමේදී දෝෂයක් සිදු විය: ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
