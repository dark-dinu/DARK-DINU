import yts from "yt-search";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";

// Global Session Map
global.songSessions = global.songSessions || new Map();

// Dynamic FFmpeg Setup
let ffmpegPath = "ffmpeg";
try {
  const ffmpegInstaller = await import("@ffmpeg-installer/ffmpeg");
  ffmpegPath = ffmpegInstaller.default?.path || "ffmpeg";
} catch (_) {
  ffmpegPath = "ffmpeg";
}

// Convert Audio Buffer to WhatsApp Voice Note (OGG Opus)
function convertToVoice(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempId = Date.now() + "_" + Math.random().toString(36).substring(7);
    const tempIn = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOut = path.join(os.tmpdir(), `out_${tempId}.opus`);

    fs.writeFileSync(tempIn, inputBuffer);

    const cmd = `"${ffmpegPath}" -y -i "${tempIn}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 "${tempOut}"`;

    exec(cmd, (err) => {
      try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch (_) {}
      if (err) return reject(err);

      try {
        const outBuf = fs.readFileSync(tempOut);
        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        resolve(outBuf);
      } catch (rErr) {
        reject(rErr);
      }
    });
  });
}

export default {
  name: "song",
  aliases: ["play", "mp3", "audio"],
  category: "media",
  description: "Search, Select Format and Download YouTube Audio as MP3, Document or Voice",

  async execute({ sock, msg, from, args, config }) {
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const pref = config?.PREFIX || ".";

    try {
      const query = args.join(" ").trim();
      if (!query) {
        return await reply(`⚠️ *කරුණාකර සින්දුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n*උදාහරණ:* \`${pref}song ma diha\``);
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

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

      // High-Speed Multi-Engine Stream URL Extractor
      let downloadUrl = null;

      // Engine 1: Chamindu API
      try {
        const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=${apiKey}`;
        const res = await axios.get(apiUrl, { timeout: 12000 });
        if (res.data?.status && res.data?.data) {
          downloadUrl = res.data.data.download_url || res.data.data.direct_url;
        }
      } catch (_) {}

      // Engine 2: BK9 Fallback
      if (!downloadUrl) {
        try {
          const res2 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
          if (res2.data?.BK9?.BK8) {
            downloadUrl = res2.data.BK9.BK8;
          }
        } catch (_) {}
      }

      // Engine 3: Vreden Fallback
      if (!downloadUrl) {
        try {
          const res3 = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
          if (res3.data?.result?.download?.url) {
            downloadUrl = res3.data.result.download.url;
          }
        } catch (_) {}
      }

      if (!downloadUrl) {
        return await reply("❌ සින්දුවේ Audio සේවාවන් මේ මොහොතේ කාර්යබහුලයි. සුළු වේලාවකින් නැවත උත්සාහ කරන්න.");
      }

      const finalTitle = title || "YouTube Audio";

      // UI Card
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
          if (global.songSessions) global.songSessions.delete(sentMsg.key.id);
        }, 10 * 60 * 1000);
      }

      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("Song Error:", err.message);
      await reply(`❌ දෝෂයකි: ${err.message || "Failed"}`);
    }
  },

  // Auto Universal Reply Handler for index.js
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.songSessions.has(quotedStanzaId)) return false;

    const session = global.songSessions.get(quotedStanzaId);
    if (session.from !== from) return false;

    const replyChoice = body.trim();
    if (!["1", "2", "3"].includes(replyChoice)) return false;

    try {
      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const audioRes = await axios.get(session.url, {
        responseType: "arraybuffer",
        timeout: 45000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (replyChoice === "1") {
        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: false
        }, { quoted: msg });
      } else if (replyChoice === "2") {
        await sock.sendMessage(from, {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: msg });
      } else if (replyChoice === "3") {
        let pttBuf;
        try {
          pttBuf = await convertToVoice(audioBuffer);
        } catch (_) {
          pttBuf = audioBuffer;
        }

        await sock.sendMessage(from, {
          audio: pttBuf,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      global.songSessions.delete(quotedStanzaId);
      return true;
    } catch (replyErr) {
      console.error("[SONG REPLY HANDLER ERROR]:", replyErr.message);
      await sock.sendMessage(from, { text: `❌ Download Failed: ${replyErr.message}` }, { quoted: msg });
      return true;
    }
  }
};
