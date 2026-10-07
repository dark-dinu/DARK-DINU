import yts from "yt-search";
import axios from "axios";

global.songSessions = global.songSessions || new Map();
global.songHookedSockets = global.songHookedSockets || new WeakSet();

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

// Ultra-Fast Info & Direct Audio Resolver
async function fetchMediaData(videoUrl) {
  try {
    const apiUrl = `https://api.chamindu.site/api/v1/media/ytmp4/info?url=${encodeURIComponent(videoUrl)}&api_key=${API_KEY}`;
    const res = await axios.get(apiUrl, { timeout: 10000 });
    
    if (res.data?.success && res.data?.data) {
      const data = res.data.data;
      
      // WhatsApp වලට වඩාත්ම සුදුසු Medium M4A Audio (Direct Google Stream) එක තෝරා ගැනීම
      const audios = data.audio_formats || [];
      const bestAudio = 
        audios.find(a => a.quality === "AUDIO_QUALITY_MEDIUM" && a.format === "m4a") ||
        audios.find(a => a.format === "m4a") ||
        audios[0];

      return {
        title: data.title || "YouTube Audio",
        channel: data.channel || "YouTube Artist",
        thumbnail: data.thumbnail,
        audioUrl: bestAudio?.download_link || bestAudio?.direct_url || null,
        duration: data.duration_label || "Audio"
      };
    }
  } catch (err) {
    console.error("[CHAMA API ERR]:", err.message);
  }
  return null;
}

// Background Auto-Reply Interceptor (Zero-Lag Delivery)
function attachSongReplyEngine(sock) {
  if (!sock || global.songHookedSockets.has(sock)) return;
  global.songHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const contextInfo = 
      m.message.extendedTextMessage?.contextInfo ||
      m.message.imageMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.songSessions.has(quotedId)) return;

    const session = global.songSessions.get(quotedId);
    if (session.from !== from) return;

    const choice = (
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      ""
    ).trim();

    if (!["1", "2", "3"].includes(choice)) return;

    // React Non-blocking
    sock.sendMessage(from, { react: { text: "⚡", key: m.key } }).catch(() => {});

    try {
      const streamUrl = session.audioUrl;
      if (!streamUrl) throw new Error("Audio direct link unavailable.");

      // Direct Stream Delivery (No Bot RAM buffer lag)
      if (choice === "1") {
        await sock.sendMessage(from, {
          audio: { url: streamUrl },
          mimetype: "audio/mp4",
          ptt: false
        }, { quoted: m });
      } else if (choice === "2") {
        await sock.sendMessage(from, {
          document: { url: streamUrl },
          mimetype: "audio/mp4",
          fileName: `${session.title}.m4a`
        }, { quoted: m });
      } else if (choice === "3") {
        await sock.sendMessage(from, {
          audio: { url: streamUrl },
          mimetype: "audio/mp4",
          ptt: true
        }, { quoted: m });
      }

      sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
      global.songSessions.delete(quotedId);
    } catch (err) {
      sock.sendMessage(from, { react: { text: "❌", key: m.key } }).catch(() => {});
      sock.sendMessage(from, { text: `❌ බාගත කිරීම අසාර්ථක විය: ${err.message}` }, { quoted: m }).catch(() => {});
    }
  });
}

// Cluster Watcher
if (!global.songWatcherStarted) {
  global.songWatcherStarted = true;
  setInterval(() => {
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        attachSongReplyEngine(s);
      }
    }
  }, 20000);
}

export default {
  name: "song",
  aliases: ["play", "mp3", "audio"],
  category: "media",
  description: "Fast Direct YouTube Audio Downloader via Chama API",

  async execute({ sock, msg, from, args, config }) {
    // 1. Instant Reaction
    sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
    attachSongReplyEngine(sock);

    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const pref = config?.PREFIX || ".";

    try {
      const query = args.join(" ").trim();
      if (!query) {
        return await reply(`⚠️ *කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n*උදාහරණ:* \`${pref}song kuweniye\``);
      }

      let videoUrl = query;

      // YouTube Link එකක් නොවේ නම් ඉක්මනින් search කිරීම
      if (!query.startsWith("http://") && !query.startsWith("https://")) {
        const searchPromise = yts(query);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 4000)
        );

        const search = await Promise.race([searchPromise, timeoutPromise]).catch(() => null);
        const video = search?.videos?.[0];

        if (!video) {
          sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await reply("❌ සින්දුව සොයාගැනීමට නොහැකි විය. වෙනත් නමක් ලබාදෙන්න.");
        }

        videoUrl = video.url;
      }

      // 2. Chama Media API එකෙන් තොරතුරු සහ Direct Links ලබා ගැනීම
      const media = await fetchMediaData(videoUrl);

      if (!media || !media.audioUrl) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply("❌ මෙම සින්දුව ලබා ගැනීමට නොහැකි විය. සුළු මොහොතකින් නැවත උත්සාහ කරන්න.");
      }

      const songCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎵 *SONG DETAILS* 〕
├─▸ 🎼 *Title*    : ${media.title.slice(0, 45)}...
├─▸ 🎙️ *Artist*   : ${media.channel}
├─▸ ⚡ *Speed*    : ULTRA FAST CDN
└───────────────────────

┌─〔 📥 *SELECT FORMAT* 〕
├─▸ [ 𝟏 ] ❯ 🎵 Audio (MP3/M4A)
├─▸ [ 𝟐 ] ❯ 📁 Document (File)
├─▸ [ 𝟑 ] ❯ 🎙️ Voice Note (PTT)
└───────────────────────

> 💬 *Reply with number (1-3) to download*
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`;

      let sentMsg;
      if (media.thumbnail) {
        sentMsg = await sock.sendMessage(from, {
          image: { url: media.thumbnail },
          caption: songCard
        }, { quoted: msg });
      } else {
        sentMsg = await reply(songCard);
      }

      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, {
          title: media.title,
          audioUrl: media.audioUrl,
          from
        });

        // 5 Minutes Auto-Clean
        setTimeout(() => {
          global.songSessions?.delete(sentMsg.key.id);
        }, 5 * 60 * 1000);
      }

      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[SONG CMD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ දෝෂයකි: ${err.message || "Failed"}`);
    }
  }
};
