import axios from "axios";

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const BASE_URL = "https://api.chamindu.site/api/v1";

global.mediaSearchSessions = global.mediaSearchSessions || new Map();
global.mediaEngineHooked = global.mediaEngineHooked || new WeakSet();

// 1. Live Search via DuckDuckGo HTML scraper
async function searchWebTarget(siteQuery, query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${siteQuery} ${query}`)}`;
    const { data: html } = await axios.get(url, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
      }
    });

    const results = [];
    const linkRegex = new RegExp(`https?:\\/\\/(?:www\\.)?${siteQuery.replace('.', '\\.')}\\/[a-zA-Z0-9\\-_\\/?=]+`, "gi");
    const rawMatches = html.match(linkRegex) || [];
    const unique = [...new Set(rawMatches)].filter(l => !l.includes("/page/") && !l.includes("/tag/") && !l.endsWith(".ch/") && !l.endsWith(".by/"));

    for (const link of unique.slice(0, 8)) {
      let slug = link.split("/").filter(Boolean).pop() || "Anime Episode";
      let title = slug.replace(/[-_]/g, " ").replace(/\.php.*/, "").replace(/\b\w/g, l => l.toUpperCase());
      results.push({ title, link });
    }

    return results;
  } catch (err) {
    console.error("[SEARCH ERROR]:", err.message);
    return [];
  }
}

// 2. Fetch Chamindu Download API
async function fetchMediaData(link) {
  let endpoint = "";
  if (link.includes("animepahe.")) {
    endpoint = `${BASE_URL}/anime/animepahe/dl?url=${encodeURIComponent(link)}&api_key=${API_KEY}`;
  } else if (link.includes("gogoanime.")) {
    endpoint = `${BASE_URL}/anime/gogoanime/dl?url=${encodeURIComponent(link)}&api_key=${API_KEY}`;
  } else if (link.includes("lakvisiontv.")) {
    endpoint = `${BASE_URL}/cartoons/lakvision/infodl?q=${encodeURIComponent(link)}&api_key=${API_KEY}`;
  } else if (link.includes("luciferdonghua.")) {
    endpoint = `${BASE_URL}/anime/luciferdonghua/infodl?q=${encodeURIComponent(link)}&api_key=${API_KEY}`;
  }

  if (!endpoint) return null;
  const { data } = await axios.get(endpoint, { timeout: 20000 });
  return data?.data || data?.result || data;
}

// 3. Interactive Listener for Selecting Numbers (1, 2, 3...)
function hookMediaInteractive(sock) {
  if (!sock || global.mediaEngineHooked.has(sock)) return;
  global.mediaEngineHooked.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const quotedId = rawMsg?.extendedTextMessage?.contextInfo?.stanzaId;
    if (!quotedId || !global.mediaSearchSessions.has(quotedId)) return;

    const session = global.mediaSearchSessions.get(quotedId);
    if (session.from !== from) return;

    const userText = (rawMsg.conversation || rawMsg.extendedTextMessage?.text || "").trim();
    const chosenIndex = parseInt(userText, 10);
    if (isNaN(chosenIndex) || chosenIndex < 1 || chosenIndex > session.results.length) return;

    const selectedItem = session.results[chosenIndex - 1];
    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      const d = await fetchMediaData(selectedItem.link);
      if (!d) {
        return await sock.sendMessage(from, { text: "💔 අදාළ episode එකේ download links ලබාගැනීමට නොහැකි විය." }, { quoted: m });
      }

      const title = d.title || selectedItem.title || "Selected Anime";
      const image = d.image || d.poster || null;
      const downloads = d.downloads || d.links || [];
      const directVideo = d.stream || d.video || (downloads[0]?.link);

      let sentVideo = false;
      if (directVideo && (directVideo.includes(".mp4") || directVideo.includes(".mkv") || directVideo.includes("storage"))) {
        try {
          sock.sendMessage(from, { react: { text: "🚀", key: m.key } }).catch(() => {});
          await sock.sendMessage(
            from,
            {
              document: { url: directVideo },
              mimetype: "video/mp4",
              fileName: `${title.slice(0, 30)}.mp4`,
              caption: `🎬 *${title}*\n💖 *DARK-DINU MD*`
            },
            { quoted: m }
          );
          sentVideo = true;
          sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
        } catch (_) {}
      }

      if (!sentVideo) {
        let card = 
`🎬 ｡ﾟ•┈୨ *${title}* ୧┈•ﾟ｡ 🍿
━━━━━━━━━━━━━━━━━━━━━

📦 *DOWNLOAD OPTIONS:*
`;

        if (Array.isArray(downloads) && downloads.length > 0) {
          downloads.slice(0, 10).forEach((item, idx) => {
            const name = item.name || item.quality || `Option ${idx + 1}`;
            card += `\n🔹 *${idx + 1}. ${name}*\n   🔗 ${item.link || item.url || item}\n`;
          });
        } else if (directVideo) {
          card += `\n🔗 *Direct Stream:* ${directVideo}\n`;
        } else {
          card += `\n🔗 *Source Page:* ${selectedItem.link}\n`;
        }

        card += `\n━━━━━━━━━━━━━━━━━━━━━\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        sock.sendMessage(from, { react: { text: "📥", key: m.key } }).catch(() => {});

        if (image) {
          await sock.sendMessage(from, { image: { url: image }, caption: card }, { quoted: m });
        } else {
          await sock.sendMessage(from, { text: card }, { quoted: m });
        }
      }

    } catch (err) {
      sock.sendMessage(from, { text: `⚠️ දෝෂයක්: ${err.message}` }, { quoted: m });
    }
  });
}

export default {
  name: "anime",
  aliases: ["lakvision", "donghua", "gogo", "pahe"],
  category: "download",
  description: "Search and download Anime by name",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    hookMediaInteractive(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    const full = (body || "").trim();
    const cmd = full.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const query = args.join(" ").trim();

    if (!query) {
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *භාවිතය:* \`${pref}anime <නම>\`\n*උදාහරණයක්:* \`${pref}anime hunter x hunter\``
        },
        { quoted: msg }
      );
    }

    // Direct link එකක් දුන්නොත් කෙලින්ම ගන්න
    if (query.startsWith("http")) {
      const d = await fetchMediaData(query);
      if (!d) return await sock.sendMessage(from, { text: "💔 මෙම ලින්ක් එකෙන් දත්ත ලබාගත නොහැක." }, { quoted: msg });
      const dlLink = d.stream || d.video || d.downloads?.[0]?.link || query;
      return await sock.sendMessage(from, { text: `🔗 *Download Link:* ${dlLink}` }, { quoted: msg });
    }

    sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    // Target domain route
    let targetSite = "animepahe.ch";
    if (cmd === "lakvision") targetSite = "lakvisiontv.net";
    if (cmd === "donghua") targetSite = "luciferdonghua.org";
    if (cmd === "gogo") targetSite = "gogoanime.by";

    const results = await searchWebTarget(targetSite, query);

    if (results.length === 0) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `💔 \`"${query}"\` නමින් ප්‍රතිඵල කිසිවක් හමු නොවීය.` }, { quoted: msg });
    }

    let searchCard = 
`🎬 ｡ﾟ•┈୨ *ANIME SEARCH RESULTS* ୧┈•ﾟ｡ 🔍
━━━━━━━━━━━━━━━━━━━━━

🔍 *Search:* \`${query}\`
🏷️ *Source:* \`${targetSite}\`

`;

    results.forEach((item, idx) => {
      searchCard += `  *${idx + 1}.* ${item.title}\n`;
    });

    searchCard += 
`━━━━━━━━━━━━━━━━━━━━━
💬 *කැමති අංකය (1-${results.length}) Reply කරන්න!*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
    const sentMsg = await sock.sendMessage(from, { text: searchCard }, { quoted: msg });

    if (sentMsg?.key?.id) {
      global.mediaSearchSessions.set(sentMsg.key.id, {
        from,
        results,
        time: Date.now()
      });
      setTimeout(() => global.mediaSearchSessions.delete(sentMsg.key.id), 300000);
    }
  }
};
