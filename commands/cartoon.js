import axios from "axios";

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const SEARCH_API = "https://api.chamindu.site/api/v1/movies/cartoons/search";
const INFO_API = "https://api.chamindu.site/api/v1/movies/cartoons/infodl";

// Multi-step session tracking
global.cartoonSearchSessions = global.cartoonSearchSessions || new Map();
global.cartoonEpSessions = global.cartoonEpSessions || new Map();
global.cartoonHooked = global.cartoonHooked || new WeakSet();

// Episode Parser Helper
function parseEpisodes(rawDownloads = []) {
  const epMap = new Map();
  rawDownloads.forEach((item) => {
    const match = item.name.match(/Episode\s+(\d+)/i);
    const epIndex = match ? parseInt(match[1], 10) : epMap.size + 1;
    const typeMatch = item.name.match(/(R2|GDRIVE|MEGA|DIRECT)/i);
    const type = typeMatch ? typeMatch[1].toUpperCase() : "DOWNLOAD";

    if (!epMap.has(epIndex)) {
      epMap.set(epIndex, { epNumber: epIndex, links: [] });
    }
    epMap.get(epIndex).links.push({ type, link: item.link });
  });
  return Array.from(epMap.values()).sort((a, b) => a.epNumber - b.epNumber);
}

// Fetch Full Details & Episode Menu
async function fetchAndSendDetails(sock, from, cartoonUrl, originalMsg) {
  sock.sendMessage(from, { react: { text: "⏳", key: originalMsg.key } }).catch(() => {});

  try {
    const endpoint = `${INFO_API}?q=${encodeURIComponent(cartoonUrl)}&api_key=${API_KEY}`;
    const { data: res } = await axios.get(endpoint, { timeout: 15000 });

    if (!res?.status || !res?.data) {
      return await sock.sendMessage(from, { text: "💔 කාටූන් විස්තර ලබාගැනීමට නොහැකි විය." }, { quoted: originalMsg });
    }

    const d = res.data;
    const title = d.title || "Sinhala Dubbed Cartoon";
    const episodes = parseEpisodes(d.downloads || []);

    let card = 
`🎬 ｡ﾟ•┈୨ *${title}* ୧┈•ﾟ｡ 📺
━━━━━━━━━━━━━━━━━━━━━

📅 *වසර:* \`${d.year || "N/A"}\`  |  ⭐ *IMDb:* \`${d.imdb || "N/A"}\`
🗣️ *භාෂාව:* \`${d.language || "Sinhala Dubbed"}\`
📦 *Episodes:* \`${episodes.length} Available\`

━━━━━━━━━━━━━━━━━━━━━
🍬 *EPISODE LIST:*

`;

    episodes.slice(0, 20).forEach((ep) => {
      card += `  • *${ep.epNumber}* ➔ Episode ${ep.epNumber}\n`;
    });

    if (episodes.length > 20) {
      card += `\n_...තවත් Episodes ${episodes.length - 20} ක් ඇත._\n`;
    }

    card += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *Episode Number එක Reply කරන්න (උදා: 1, 2)*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    sock.sendMessage(from, { react: { text: "🎬", key: originalMsg.key } }).catch(() => {});

    let sentMsg = null;
    if (d.image) {
      sentMsg = await sock.sendMessage(from, { image: { url: d.image }, caption: card }, { quoted: originalMsg });
    } else {
      sentMsg = await sock.sendMessage(from, { text: card }, { quoted: originalMsg });
    }

    if (sentMsg?.key?.id) {
      global.cartoonEpSessions.set(sentMsg.key.id, { from, title, episodes, time: Date.now() });
      setTimeout(() => global.cartoonEpSessions.delete(sentMsg.key.id), 600000);
    }
  } catch (err) {
    sock.sendMessage(from, { text: `⚠️ දෝෂයක්: ${err.message}` }, { quoted: originalMsg });
  }
}

// Interactive Number Reply Engine
function hookCartoonInteractive(sock) {
  if (!sock || global.cartoonHooked.has(sock)) return;
  global.cartoonHooked.add(sock);

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

    // STEP 1: Search Result එකක් තෝරාගත් විට
    if (global.cartoonSearchSessions.has(quotedId)) {
      const searchSession = global.cartoonSearchSessions.get(quotedId);
      if (searchSession.from === from && chosenNum >= 1 && chosenNum <= searchSession.results.length) {
        global.cartoonSearchSessions.delete(quotedId);
        const selected = searchSession.results[chosenNum - 1];
        await fetchAndSendDetails(sock, from, selected.link || selected.url, m);
        return;
      }
    }

    // STEP 2: Episode Number එකක් තෝරාගත් විට
    if (global.cartoonEpSessions.has(quotedId)) {
      const epSession = global.cartoonEpSessions.get(quotedId);
      if (epSession.from === from && chosenNum >= 1 && chosenNum <= epSession.episodes.length) {
        const ep = epSession.episodes[chosenNum - 1];
        sock.sendMessage(from, { react: { text: "📥", key: m.key } }).catch(() => {});

        let epCard = 
`🎬 ｡ﾟ•┈୨ *DOWNLOAD LINKS* ୧┈•ﾟ｡ 📺
━━━━━━━━━━━━━━━━━━━━━

✨ *Series:* ${epSession.title}
📦 *Episode:* Episode ${chosenNum}

`;
        ep.links.forEach((l) => {
          epCard += `🔹 *${l.type}:*\n🔗 ${l.link}\n\n`;
        });

        epCard += `━━━━━━━━━━━━━━━━━━━━━\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;
        await sock.sendMessage(from, { text: epCard }, { quoted: m });
      }
    }
  });
}

export default {
  name: "cartoon",
  aliases: ["cartoondl", "ben10", "cartoons"],
  category: "download",
  description: "Search and download Sinhala dubbed cartoons by title",

  async execute({ sock, msg, from, args, prefix, config: appConfig }) {
    hookCartoonInteractive(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(
        from,
        { text: `🌸 *භාවිතය:* \`${pref}cartoon <කාටූන් එකේ නම හෝ cartoons.lk link>\`\n*උදාහරණ:* \`${pref}cartoon ben 10\`` },
        { quoted: msg }
      );
    }

    // Link එකක් දුන්නොත් කෙලින්ම විස්තර පෙන්වීම
    if (query.includes("cartoons.lk")) {
      return await fetchAndSendDetails(sock, from, query, msg);
    }

    sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    try {
      // Name Search
      const searchUrl = `${SEARCH_API}?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
      const { data: res } = await axios.get(searchUrl, { timeout: 15000 });

      const results = res?.data || res?.result || res?.results || [];

      if (!results || results.length === 0) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `💔 \`"${query}"\` නමින් කිසිදු කාටූන් එකක් සොයාගත නොහැකි විය.` },
          { quoted: msg }
        );
      }

      let searchCard = 
`🎬 ｡ﾟ•┈୨ *CARTOON SEARCH RESULTS* ୧┈•ﾟ｡ 🔍
━━━━━━━━━━━━━━━━━━━━━

🔍 *Search:* \`${query}\`
📦 *Results:* ${results.length} Cartoons Found

`;

      results.slice(0, 10).forEach((item, idx) => {
        const itemTitle = item.title || item.name || "Cartoon";
        searchCard += `  *${idx + 1}.* ${itemTitle}\n`;
      });

      searchCard += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *Reply with the number (1-${Math.min(results.length, 10)}) to view episodes!*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

      const sentMsg = await sock.sendMessage(from, { text: searchCard }, { quoted: msg });

      if (sentMsg?.key?.id) {
        global.cartoonSearchSessions.set(sentMsg.key.id, {
          from,
          results: results.slice(0, 10),
          time: Date.now()
        });
        setTimeout(() => global.cartoonSearchSessions.delete(sentMsg.key.id), 300000);
      }

    } catch (err) {
      console.error("[CARTOON SEARCH ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `⚠️ සෙවීමේදී දෝෂයක් සිදු විය: ${err.message}` }, { quoted: msg });
    }
  }
};
