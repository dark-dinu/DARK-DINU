import yts from "yt-search";
import axios from "axios";

global.songSessions = global.songSessions || new Map();
global.songHookedSockets = global.songHookedSockets || new WeakSet();

// Fast APIs Pool for Instant YouTube Audio URL
async function getFastAudioUrl(videoUrl) {
  // Engine 1: DavidCyril API (Ultra Fast Direct Stream)
  try {
    const res1 = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });
    if (res1.data?.success && res1.data?.result?.download_url) {
      return res1.data.result.download_url;
    }
  } catch (_) {}

  // Engine 2: Siputzx Direct API
  try {
    const res2 = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });     if (res2.data?.status && res2.data?.data?.dl) {       return res2.data.data.dl;     }   } catch (_) {}    // Engine 3: Chamindu Fast Backup (128kbps is 3x faster than 320kbps)   try {     const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";     const res3 = await axios.get(`https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=${apiKey}`, { timeout: 7000 });     const dl = res3.data?.data?.direct_url \vert{}\vert{} res3.data?.data?.download_url;     if (dl) return dl;   } catch (_) {}    // Engine 4: BK9 Fallback   try {     const res4 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { timeout: 7000 });
    if (res4.data?.BK9?.BK8) return res4.data.BK9.BK8;
  } catch (_) {}

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

    sock.sendMessage(from, { react: { text: "⚡", key: m.key } }).catch(() => {});

    try {
      const audioUrl = session.url;

      // 1. Audio (MP3) - Direct Stream
      if (choice === "1") {
        await sock.sendMessage(from, {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: false
        }, { quoted: m });
      } 
      // 2. Document (File) - Direct Stream
      else if (choice === "2") {
        await sock.sendMessage(from, {
          document: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`         }, { quoted: m });       }        // 3. Voice Note (PTT) - Fast Opus Audio Stream       else if (choice === "3") {         await sock.sendMessage(from, {           audio: { url: audioUrl },           mimetype: "audio/ogg; codecs=opus",           ptt: true         }, { quoted: m });       }        sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});       global.songSessions.delete(quotedId);     } catch (err) {       sock.sendMessage(from, { react: { text: "❌", key: m.key } }).catch(() => {});       sock.sendMessage(from, { text: `❌ බාගත කිරීම අසාර්ථක විය: ${err.message}` }, { quoted: m }).catch(() => {});
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
  description: "Fastest YouTube Song Downloader",

  async execute({ sock, msg, from, args, config }) {
    attachSongReplyEngine(sock);
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const pref = config?.PREFIX || ".";

    try {
      const query = args.join(" ").trim();
      if (!query) {
        return await reply(`⚠️ *කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n*උදාහරණ:* \`${pref}song kuweniye\``);
      }

      sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let videoUrl = query;
      let title = "";
      let duration = "";
      let thumbnail = "";

      if (!query.startsWith("http://") && !query.startsWith("https://")) {
        const search = await yts(query);
        const video = search?.videos?.[0];

        if (!video) {
          return await reply("❌ සින්දුව සොයාගැනීමට නොහැකි විය. වෙනත් නමක් ලබාදෙන්න.");
        }

        videoUrl = video.url;
        title = video.title;
        duration = video.timestamp || "3:00";
        thumbnail = video.thumbnail;
      }

      // Fast Parallel Stream Resolution
      const downloadUrl = await getFastAudioUrl(videoUrl);

      if (!downloadUrl) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply("❌ සින්දුවේ Audio සේවාවන් මේ මොහොතේ කාර්යබහුලයි. සුළු මොහොතකින් නැවත උත්සාහ කරන්න.");
      }

      const finalTitle = title || "YouTube Audio";

      const songCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎵 *SONG DETAILS* 〕
├─▸ 🎼 *Title*    : ${finalTitle}
├─▸ ⏳ *Duration* : ${duration}
├─▸ ⚡ *Speed*    : TURBO STREAM
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
          title: finalTitle,
          url: downloadUrl,
          from: from
        });

        setTimeout(() => {
          global.songSessions?.delete(sentMsg.key.id);
        }, 5 * 60 * 1000);
      }

      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("Song Error:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ දෝෂයකි: ${err.message || "Failed"}`);
    }
  }
};
