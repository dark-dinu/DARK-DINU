import axios from "axios";

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const INFO_API = "https://api.chamindu.site/api/v1/movies/cartoons/infodl";

global.cartoonSearchSessions = global.cartoonSearchSessions || new Map();
global.cartoonEpSessions = global.cartoonEpSessions || new Map();
global.cartoonHooked = global.cartoonHooked || new WeakSet();

// 1. Google Fallback Scraper (Bypasses Cloudflare block on cartoons.lk search)
async function searchCartoonsUniversal(query) {
  try {
    const googleUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent("site:cartoons.lk " + query)}`;
    const { data: html } = await axios.get(googleUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
      }
    });

    const results = [];
    const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    // Alternative simple link extraction
    const rawLinks = html.match(/https?:\/\/(?:www\.)?cartoons\.lk\/[a-zA-Z0-9\-]+\//gi) || [];
    const uniqueLinks = [...new Set(rawLinks)].filter(l => !l.endsWith("/page/") && !l.includes("/tag/") && !l.includes("/category/"));

    for (const link of uniqueLinks.slice(0, 8)) {
      // Clean slug to title
      const slug = link.replace("https://cartoons.lk/", "").replace(/\//g, "").replace(/-/g, " ");
      const title = slug.replace(/\b\w/g, l => l.toUpperCase());
      results.push({ title, link });
    }

    return results;
  } catch (err) {
    console.error("[FALLBACK SEARCH FAILED]:", err.message);
    return [];
  }
}

// 2. Parse Episodes from API
function parseEpisodes(rawDownloads = []) {
  const epMap = new Map();
  rawDownloads.forEach((item) => {
    const match = item.name.match(/Episode\s+(\d+)/i);
    const epIndex = match ? parseInt(match[1], 10) : epMap.size + 1;
    const isDirect = item.link.includes(".r2.cloudflarestorage.com") || item.name.includes("R2");

    if (!epMap.has(epIndex)) {
      epMap.set(epIndex, { epNumber: epIndex, streamLink: null, gdriveLink: null });
    }

    const current = epMap.get(epIndex);
    if (isDirect && !current.streamLink) {
      current.streamLink = item.link;
    } else if (!current.gdriveLink) {
      current.gdriveLink = item.link;
    }
  });

  return Array.from(epMap.values()).sort((a, b) => a.epNumber - b.epNumber);
}

// 3. Fetch Full Info using Chamindu Infodl API
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

📅 *Year:* \`${d.year || "N/A"}\`  |  ⭐ *IMDb:* \`${d.imdb || "N/A"}\`
🗣️ *Language:* \`${d.language || "Sinhala Dubbed"}\`
📦 *Episodes:* \`${episodes.length} Available\`

━━━━━━━━━━━━━━━━━━━━━
🍬 *EPISODE LIST:*

`;

    episodes.slice(0, 15).forEach((ep) => {
      card += `  • *${ep.epNumber}* ➔ Episode ${ep.epNumber}\n`;
    });

    if (episodes.length > 15) {
      card += `\n_...තවත් Episodes ${episodes.length - 15} ක් ඇත._\n`;
    }

    card += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *Episode එකේ අංකය (1, 2, 3...) Reply කරන්න.*
_Video Document එක කෙලින්ම එවනු ඇත!_ 📥
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

// 4. Interactive Reply Listener
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

    // STEP 1: Search Selection
    if (global.cartoonSearchSessions.has(quotedId)) {
      const searchSession = global.cartoonSearchSessions.get(quotedId);
      if (searchSession.from === from && chosenNum >= 1 && chosenNum <= searchSession.results.length) {
        global.cartoonSearchSessions.delete(quotedId);
        const selected = searchSession.results[chosenNum - 1];
        await fetchAndSendDetails(sock, from, selected.link, m);
        return;
      }
    }

    // STEP 2: Episode Video Upload
    if (global.cartoonEpSessions.has(quotedId)) {
      const epSession = global.cartoonEpSessions.get(quotedId);
      if (epSession.from === from && chosenNum >= 1 && chosenNum <= epSession.episodes.length) {
        const ep = epSession.episodes[chosenNum - 1];
        const targetVideoUrl = ep.streamLink || ep.gdriveLink;

        if (!targetVideoUrl) {
          return await sock.sendMessage(from, { text: "💔 මෙම Episode එකට download link එකක් හමු නොවීය." }, { quoted: m });
        }

        sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});
        const statusMsg = await sock.sendMessage(
          from,
          { text: `🚀 *Uploading Episode ${chosenNum}...*\n_වීඩියෝව upload වෙමින් පවතී, සුළු මොහොතක් රැඳී සිටින්න..._` },
          { quoted: m }
        );

        try {
          const fileName = `${epSession.title.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 30)} - E${chosenNum}.mkv`;

          await sock.sendMessage(
            from,
            {
              document: { url: targetVideoUrl },
              mimetype: "video/mp4",
              fileName: fileName,
              caption: `🎬 *${epSession.title}*\n📦 *Episode:* Episode ${chosenNum}\n💖 *DARK-DINU MD*`
            },
            { quoted: m }
          );

          sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
          if (statusMsg?.key) {
            await sock.sendMessage(from, { delete: statusMsg.key }).catch(() => {});
          }

        } catch (uploadErr) {
          sock.sendMessage(from, { react: { text: "⚠️", key: m.key } }).catch(() => {});
          await sock.sendMessage(
            from,
            { text: `⚠️ Video එක auto upload වීමට නොහැකි විය. Direct link එක:\n\n🔗 ${targetVideoUrl}` },
            { quoted: m }
          );
        }
      }
    }
  });
}

export default {
  name: "cartoon",
  aliases: ["cartoondl", "ben10", "cartoons"],
  category: "download",
  description: "Search and download Sinhala dubbed cartoon video files",

  async execute({ sock, msg, from, args, prefix, config: appConfig }) {
    hookCartoonInteractive(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(
        from,
        { text: `🌸 *භාවිතය:* \`${pref}cartoon <කාටූන් නම>\`\n*උදාහරණ:* \`${pref}cartoon Scooby-Doo\`` },
        { quoted: msg }
      );
    }

    if (query.includes("cartoons.lk")) {
      return await fetchAndSendDetails(sock, from, query, msg);
    }

    sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    const results = await searchCartoonsUniversal(query);

    if (results.length === 0) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `💔 \`"${query}"\` නමින් cartoons.lk හි කිසිදු කාටූන් එකක් සොයාගත නොහැකි විය.` }, { quoted: msg });
    }

    let searchCard = 
`🎬 ｡ﾟ•┈୨ *CARTOON SEARCH RESULTS* ୧┈•ﾟ｡ 🔍
━━━━━━━━━━━━━━━━━━━━━

🔍 *Search:* \`${query}\`
📦 *Found:* ${results.length} Matches

`;

    results.forEach((item, idx) => {
      searchCard += `  *${idx + 1}.* ${item.title}\n`;
    });

    searchCard += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *කැමති කාටූන් එකේ අංකය (1-${results.length}) Reply කරන්න!*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
    const sentMsg = await sock.sendMessage(from, { text: searchCard }, { quoted: msg });

    if (sentMsg?.key?.id) {
      global.cartoonSearchSessions.set(sentMsg.key.id, {
        from,
        results,
        time: Date.now()
      });
      setTimeout(() => global.cartoonSearchSessions.delete(sentMsg.key.id), 300000);
    }
  }
};
