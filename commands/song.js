import yts from "yt-search";
import axios from "axios";

global.songSessions = global.songSessions || new Map();
global.songHookedSockets = global.songHookedSockets || new WeakSet();

// Direct Fast Audio Downloader (Fail-safe Engines)
async function fetchAudioBuffer(videoUrl) {
  // Engine 1: Chamindu API Fast Stream
  try {
    const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
    const res = await axios.get(`https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=${apiKey}`, { timeout: 8000 });
    const dl = res.data?.data?.direct_url || res.data?.data?.download_url;
    if (dl) {
      const audioStream = await axios.get(dl, { responseType: "arraybuffer", timeout: 20000 });
      return Buffer.from(audioStream.data);
    }
  } catch (_) {}

  // Engine 2: BK9 Fast Audio
  try {
    const res = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 });
    const dl = res.data?.BK9?.BK8;
    if (dl) {
      const audioStream = await axios.get(dl, { responseType: "arraybuffer", timeout: 20000 });
      return Buffer.from(audioStream.data);
    }
  } catch (_) {}

  // Engine 3: DavidCyril Stream
  try {
    const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 });
    const dl = res.data?.result?.download_url;
    if (dl) {
      const audioStream = await axios.get(dl, { responseType: "arraybuffer", timeout: 20000 });
      return Buffer.from(audioStream.data);
    }
  } catch (_) {}

  return null;
}

// Background Auto-Reply Watcher
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

    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      const buffer = await fetchAudioBuffer(session.url);
      if (!buffer) throw new Error("Audio download servers are busy.");

      if (choice === "1") {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: false
        }, { quoted: m });
      } else if (choice === "2") {
        await sock.sendMessage(from, {
          document: buffer,
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: m });
      } else if (choice === "3") {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/ogg; codecs=opus",
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
  description: "Ultra-Fast YouTube Song Downloader",

  async execute({ sock, msg, from, args, config }) {
    // 1. Instant Reaction (Node.js event loop එකට ඉස්සරින්ම Fire වේ)
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
      let title = "YouTube Audio";
      let duration = "N/A";
      let thumbnail = null;

      if (!query.startsWith("http://") && !query.startsWith("https://")) {
        // Fast search with 4-second hard cutoff timeout
        const searchPromise = yts(query);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Search timeout")), 4000)
        );

        const search = await Promise.race([searchPromise, timeoutPromise]).catch(() => null);
        const video = search?.videos?.[0];

        if (!video) {
          sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await reply("❌ සින්දුව සොයාගැනීමට නොහැකි විය. වෙනත් නමක් ලබාදෙන්න.");
        }

        videoUrl = video.url;
        title = video.title || "YouTube Audio";
        duration = video.timestamp || "3:00";
        thumbnail = video.thumbnail;
      }

      const songCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎵 *SONG DETAILS* 〕
├─▸ 🎼 *Title*    : ${title}
├─▸ ⏳ *Duration* : ${duration}
└───────────────────────

┌─〔 📥 *SELECT FORMAT* 〕
├─▸ [ 𝟏 ] ❯ 🎵 Audio (MP3)
├─▸ [ 𝟐 ] ❯ 📁 Document (File)
├─▸ [ 𝟑 ] ❯ 🎙️ Voice Note (PTT)
└───────────────────────

> 💬 *Reply with number (1-3) to download*
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`;

      let sentMsg;
      if (thumbnail) {
        sentMsg = await sock.sendMessage(from, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } else {
        sentMsg = await reply(songCard);
      }

      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, {
          title,
          url: videoUrl,
          from
        });

        setTimeout(() => {
          global.songSessions?.delete(sentMsg.key.id);
        }, 5 * 60 * 1000);
      }

      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[SONG MAIN ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ දෝෂයකි: ${err.message || "Search Error"}`);
    }
  }
};
