import yts from "yt-search";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";

global.songSessions = global.songSessions || new Map();
global.songHookedSockets = global.songHookedSockets || new WeakSet();

let ffmpegPath = "ffmpeg";
try {
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  ffmpegPath = ffmpegInstaller.default?.path || "ffmpeg";
} catch (_) {
  ffmpegPath = "ffmpeg";
}

// Ultra-fast Voice Note Converter
function convertToVoice(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempIn = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOut = path.join(os.tmpdir(), `out_${tempId}.ogg`);

    fs.writeFileSync(tempIn, inputBuffer);

    const cmd = `"${ffmpegPath}" -y -i "${tempIn}" -c:a libopus -b:a 64k -ar 48000 -ac 1 "${tempOut}"`;

    exec(cmd, (err) => {
      try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch (_) {}
      if (err) return resolve(inputBuffer);

      try {
        const outBuf = fs.readFileSync(tempOut);
        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        resolve(outBuf);
      } catch (_) {
        resolve(inputBuffer);
      }
    });
  });
}

// Background Auto-Reply Handler (Instant Detection)
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
      if (choice === "1") {
        // Direct Audio URL Streaming (නැවත Download නොකර කෙලින්ම යවයි - Ultra Fast)
        await sock.sendMessage(from, {
          audio: { url: session.url },
          mimetype: "audio/mp4",
          ptt: false
        }, { quoted: m });
      } else if (choice === "2") {
        // Direct Document Stream
        await sock.sendMessage(from, {
          document: { url: session.url },
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: m });
      } else if (choice === "3") {
        // Voice Note (PTT)
        const audioRes = await axios.get(session.url, {
          responseType: "arraybuffer",
          timeout: 25000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        const pttBuf = await convertToVoice(Buffer.from(audioRes.data));

        await sock.sendMessage(from, {
          audio: pttBuf,
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
  description: "Search, Select Format and Download YouTube Audio as MP3, Document or Voice",

  async execute({ sock, msg, from, args, config }) {
    attachSongReplyEngine(sock);
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const pref = config?.PREFIX || ".";

    try {
      const query = args.join(" ").trim();
      if (!query) {
        return await reply(`⚠️ *කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n*උදාහරණ:* \`${pref}song ma diha\``);
      }

      sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let videoUrl = query;
      let title = "";
      let duration = "";
      let views = "";
      let artist = "";
      let uploadYear = "";
      let thumbnail = "";

      if (!query.startsWith("http://") && !query.startsWith("https://")) {
        const search = await yts(query);
        const video = search?.videos?.[0];

        if (!video) {
          return await reply("❌ සින්දුව සොයාගැනීමට නොහැකි විය. වෙනත් නමක් ලබාදෙන්න.");
        }

        videoUrl = video.url;
        title = video.title;
        duration = video.timestamp || "320kbps";
        views = Number(video.views || 0).toLocaleString();
        artist = video.author?.name || "YouTube Artist";
        uploadYear = video.ago || "N/A";
        thumbnail = video.thumbnail;
      }

      // Fastest Parallel Engine Fetch
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const fetchChamindu = axios.get(`https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=${apiKey}`, { timeout: 8000 })
        .then(r => r.data?.data?.download_url || r.data?.data?.direct_url)
        .catch(() => null);

      const fetchBk9 = axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 })
        .then(r => r.data?.BK9?.BK8)
        .catch(() => null);

      const fetchVreden = axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 })
        .then(r => r.data?.result?.download?.url)
        .catch(() => null);

      // Race/Parallel resolution for lightning speed
      const results = await Promise.all([fetchChamindu, fetchBk9, fetchVreden]);
      const downloadUrl = results.find(url => typeof url === "string" && url.length > 5);

      if (!downloadUrl) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply("❌ සින්දුවේ Audio සේවාවන් මේ මොහොතේ කාර්යබහුලයි. සුළු වේලාවකින් නැවත උත්සාහ කරන්න.");
      }

      const finalTitle = title || "YouTube Audio";

      const songCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎵 *SONG DETAILS* 〕
├─▸ 🎼 *Title*    : ${finalTitle}
├─▸ ⏳ *Duration* : ${duration}
├─▸ 👁️ *Views*    : ${views}
├─▸ 🎙️ *Artist*   : ${artist}
├─▸ 📅 *Upload*   : ${uploadYear}
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
          from: from,
          createdAt: Date.now()
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
