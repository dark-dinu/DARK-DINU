import yts from "yt-search";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

let ffmpegPath = "ffmpeg";
try {
  ffmpegPath = ffmpegInstaller?.path || "ffmpeg";
} catch (_) {
  ffmpegPath = "ffmpeg";
}

// Global In-Memory Song Session Store (O(1) Hash Map)
global.songSessions = global.songSessions || new Map();
global.songHookedSockets = global.songHookedSockets || new WeakSet();

// Safe Temp File Remover
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// Convert MP3 to WhatsApp Native PTT (Opus Mono 48kHz)
function convertToOpusVoice(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${(Math.random() * 1e9) | 0}`;
    const tempIn = path.join(os.tmpdir(), `sin_${tempId}.mp3`);
    const tempOut = path.join(os.tmpdir(), `sout_${tempId}.ogg`);

    fs.writeFile(tempIn, inputBuffer, (writeErr) => {
      if (writeErr) return resolve(inputBuffer);

      const cmd = `"${ffmpegPath}" -y -i "${tempIn}" -c:a libopus -b:a 64k -ar 48000 -ac 1 "${tempOut}"`;

      exec(cmd, (execErr) => {
        safeUnlink(tempIn);
        if (execErr) return resolve(inputBuffer);

        fs.readFile(tempOut, (readErr, outBuf) => {
          safeUnlink(tempOut);
          if (readErr || !outBuf) return resolve(inputBuffer);
          resolve(outBuf);
        });
      });
    });
  });
}

// Fast Waveform Vector (Zero dynamic array overhead)
function getFastWaveform() {
  const bars = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    bars[i] = ((Math.random() * 65) | 0) + 15;
  }
  return bars;
}

// Direct High-Speed Stream Downloader
async function getPlayableAudio(videoUrl) {
  const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

  try {
    const res = await axios.get(
      `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=${apiKey}`,
      { timeout: 12000 }
    );
    const dl = res.data?.data?.direct_url || res.data?.data?.download_url || res.data?.direct_url;
    if (dl) {
      const audioStream = await axios.get(dl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      return Buffer.from(audioStream.data);
    }
  } catch (_) {}

  // Fallback Mirror
  try {
    const res2 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { timeout: 10000 });
    const dl2 = res2.data?.BK9?.BK8;
    if (dl2) {
      const stream2 = await axios.get(dl2, { responseType: "arraybuffer", timeout: 30000 });
      return Buffer.from(stream2.data);
    }
  } catch (_) {}

  return null;
}

// Non-blocking Fast Reply Listener
export function attachSongReplyEngine(sock) {
  if (!sock || global.songHookedSockets.has(sock)) return;
  global.songHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const contextInfo =
      rawMsg?.extendedTextMessage?.contextInfo ||
      rawMsg?.imageMessage?.contextInfo ||
      rawMsg?.buttonsResponseMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.songSessions.has(quotedId)) return;

    const session = global.songSessions.get(quotedId);
    if (session.from !== from) return;

    const choice = (
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      ""
    ).trim();

    if (choice !== "1" && choice !== "2" && choice !== "3") return;

    // Instant Microsecond Reaction
    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      const audioBuffer = await getPlayableAudio(session.videoUrl);
      if (!audioBuffer) throw new Error("Audio stream unavailable at the moment");

      if (choice === "1") {
        // Native WhatsApp Playable Audio
        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: m });
      } else if (choice === "2") {
        // Document File
        await sock.sendMessage(from, {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: m });
      } else if (choice === "3") {
        // High-Quality Opus Voice Note with Waveform
        const voiceBuffer = await convertToOpusVoice(audioBuffer);
        await sock.sendMessage(from, {
          audio: voiceBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
          waveform: getFastWaveform()
        }, { quoted: m });
      }

      sock.sendMessage(from, { react: { text: "💖", key: m.key } }).catch(() => {});
      global.songSessions.delete(quotedId);

    } catch (err) {
      console.error("[SONG SEND ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: m.key } }).catch(() => {});
      sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Could not deliver audio softly"}` },
        { quoted: m }
      ).catch(() => {});
    }
  });
}

export default {
  name: "song",
  aliases: ["play", "mp3", "audio"],
  category: "media",
  description: "Fast playable YouTube audio and voice note downloader",

  async execute({ sock, msg, from, args, config }) {
    sock.sendMessage(from, { react: { text: "🎶", key: msg.key } }).catch(() => {});
    attachSongReplyEngine(sock);

    const pref = config?.PREFIX || ".";

    try {
      const query = args.join(" ").trim();
      if (!query) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *SONG DOWNLOAD GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}song <song_name_or_url>\`

  ✨ *Example:*
  \`${pref}song kuweniye\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      let videoUrl = query;
      let title = "YouTube Audio";
      let thumbnail = null;
      let duration = "N/A";

      if (!query.startsWith("http://") && !query.startsWith("https://")) {
        const search = await yts(query);
        const video = search?.videos?.[0];

        if (!video) {
          sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(
            from,
            { text: `🌸 *No tracks found* for "${query}", try another query darling!` },
            { quoted: msg }
          );
        }

        videoUrl = video.url;
        title = video.title || "YouTube Audio";
        thumbnail = video.thumbnail;
        duration = video.timestamp || "3:30";
      }

      // Cute Interactive Card UI
      const songCard = 
`🎀 ｡ﾟ•┈୨ *AUDIO DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🎵 *Title:* ${title.slice(0, 42)}...
  ⏳ *Duration:* \`${duration}\`
  ⚡ *Engine:* Ultra-Fast Cloud Stream

━━━━━━━━━━━━━━━━━━━━━
🍬 *Reply with your preferred format:*

  🌸 *1* ➔ Playable Audio (MP3) 🎧
  📁 *2* ➔ Document File (Original) 📄
  🎙️ *3* ➔ Voice Note (PTT Waveform) 💬

━━━━━━━━━━━━━━━━━━━━━
_Reply with 1, 2 or 3 to download softly~ (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      let sentMsg;
      if (thumbnail) {
        sentMsg = await sock.sendMessage(from, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(from, { text: songCard }, { quoted: msg });
      }

      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, {
          title,
          videoUrl,
          from
        });

        // 5-Minute TTL Memory Prune
        setTimeout(() => {
          global.songSessions.delete(sentMsg.key.id);
        }, 300000);
      }

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[SONG CMD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to process audio softly"}` },
        { quoted: msg }
      );
    }
  }
};
