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

// Global In-Memory Fast Lookup Maps (O(1))
global.ttCache = global.ttCache || new Map();
global.ttHookedSockets = global.ttHookedSockets || new WeakSet();

// Safe Temp Remover
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// Convert Audio to WhatsApp Native PTT Opus
function convertToOpusVoice(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${(Math.random() * 1e9) | 0}`;
    const tempIn = path.join(os.tmpdir(), `ttin_${tempId}.mp3`);
    const tempOut = path.join(os.tmpdir(), `ttout_${tempId}.ogg`);

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

// Low-latency Stream Downloader
async function fetchStreamBuffer(streamUrl) {
  try {
    const res = await axios.get(streamUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    return Buffer.from(res.data);
  } catch (_) {
    return null;
  }
}

// Multi-Engine TikTok Scraper Pipeline
async function fetchTikTokMetadata(targetUrl) {
  // Engine 1: Chamindu API
  try {
    const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
    const res1 = await axios.get(
      `https://api.chamindu.site/api/v1/tiktok?url=${encodeURIComponent(targetUrl)}&api_key=${apiKey}`,
      { timeout: 15000 }
    );
    if (res1.data?.status && res1.data?.data) {
      const d = res1.data.data;
      const dl = d.downloads || {};
      return {
        title: d.title || "TikTok Video",
        author: d.author?.nickname || d.author?.unique_id || "TikTok Creator",
        cover: d.origin_cover || d.cover,
        hd: dl.no_watermark_hd || dl.no_watermark,
        sd: dl.no_watermark_sd || dl.no_watermark,
        audio: dl.audio || d.music_info?.play_url
      };
    }
  } catch (_) {}

  // Engine 2: TikWM Public Cloud
  try {
    const res2 = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
    if (res2.data?.data) {
      const d2 = res2.data.data;
      return {
        title: d2.title || "TikTok Video",
        author: d2.author?.nickname || d2.author?.unique_id || "TikTok Creator",
        cover: d2.cover,
        hd: d2.hdplay || d2.play,
        sd: d2.play,
        audio: d2.music
      };
    }
  } catch (_) {}

  // Engine 3: BK9 Engine
  try {
    const res3 = await axios.get(`https://bk9.fun/download/tiktok?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
    if (res3.data?.BK9) {
      const d3 = res3.data.BK9;
      return {
        title: d3.desc || "TikTok Video",
        author: d3.author?.nickname || "TikTok Creator",
        cover: d3.cover,
        hd: d3.HD || d3.nowm,
        sd: d3.nowm,
        audio: d3.audio
      };
    }
  } catch (_) {}

  return null;
}

// Normalized Chat JID Helper
function cleanJid(jid = "") {
  return jid.split("@")[0].split(":")[0];
}

// Low-latency Reply Hook Engine
export function attachTikTokReplyEngine(sock) {
  if (!sock || global.ttHookedSockets.has(sock)) return;
  global.ttHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const rawMsg = m.message.ephemeralMessage?.message || m.message.viewOnceMessage?.message || m.message;
    const contextInfo =
      rawMsg?.extendedTextMessage?.contextInfo ||
      rawMsg?.imageMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.ttCache.has(quotedId)) return;

    const session = global.ttCache.get(quotedId);
    if (cleanJid(session.chat) !== cleanJid(from)) return;

    const choice = (
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      ""
    ).trim();

    if (choice !== "1" && choice !== "2" && choice !== "3") return;

    // Atomic Lock: prevent double dispatching
    if (session.isProcessing) return;
    session.isProcessing = true;
    global.ttCache.delete(quotedId);

    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      let downloadUrl = "";
      let isAudio = false;

      if (choice === "1") downloadUrl = session.hd || session.sd;
      else if (choice === "2") downloadUrl = session.sd || session.hd;
      else if (choice === "3") {
        downloadUrl = session.audio;
        isAudio = true;
      }

      if (!downloadUrl) throw new Error("Selected media stream is currently unavailable");

      const streamBuffer = await fetchStreamBuffer(downloadUrl);

      const aestheticCaption = 
`🎀 ｡ﾟ•┈୨ *TIKTOK DOWNLOAD* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🎬 *Title:* ${session.title.slice(0, 42)}...
  ✨ *Format:* ${choice === "1" ? "HD No Watermark" : choice === "2" ? "SD Lightweight" : "Audio Track"}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      if (isAudio) {
        if (streamBuffer) {
          const pttBuffer = await convertToOpusVoice(streamBuffer);
          await sock.sendMessage(from, {
            audio: pttBuffer,
            mimetype: "audio/ogg; codecs=opus",
            ptt: true
          }, { quoted: m });
        } else {
          await sock.sendMessage(from, {
            audio: { url: downloadUrl },
            mimetype: "audio/mp4",
            ptt: true
          }, { quoted: m });
        }
      } else {
        if (streamBuffer) {
          await sock.sendMessage(from, {
            video: streamBuffer,
            caption: aestheticCaption,
            mimetype: "video/mp4"
          }, { quoted: m });
        } else {
          await sock.sendMessage(from, {
            video: { url: downloadUrl },
            caption: aestheticCaption,
            mimetype: "video/mp4"
          }, { quoted: m });
        }
      }

      sock.sendMessage(from, { react: { text: "💖", key: m.key } }).catch(() => {});

    } catch (err) {
      console.error("[TIKTOK STREAM ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: m.key } }).catch(() => {});
      sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* Could not deliver TikTok media softly (${err.message})` },
        { quoted: m }
      ).catch(() => {});
    }
  });
}

export default {
  name: "tiktok",
  aliases: ["tt", "tikdl", "ttdl"],
  category: "media",
  description: "Download TikTok HD/SD videos and audio via interactive reply menu softly",

  async execute({ sock, msg, from, args, prefix, config }) {
    attachTikTokReplyEngine(sock);
    const pref = prefix || config?.PREFIX || ".";

    try {
      const url = args[0]?.trim();

      if (!url || (!url.includes("tiktok.com") && !url.includes("vt.tiktok.com"))) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *TIKTOK DOWNLOAD GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}tiktok <tiktok_video_url>\`

  ✨ *Example:*
  \`${pref}tiktok https://vm.tiktok.com/xxxxxx/\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "🎬", key: msg.key } }).catch(() => {});

      const meta = await fetchTikTokMetadata(url);
      if (!meta) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *Could not fetch TikTok video!* Ensure the link is public and valid, darling~" },
          { quoted: msg }
        );
      }

      // Interactive Aesthetic Menu Card
      const caption = 
`🎀 ｡ﾟ•┈୨ *TIKTOK DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📌 *Title:* ${meta.title.slice(0, 42)}...
  👤 *Creator:* @${meta.author}
  ⚡ *Engine:* Multi-Cluster Relay

━━━━━━━━━━━━━━━━━━━━━
🍬 *Reply with your preferred format:*

  🌸 *1* ➔ HD Video (No Watermark) 🌟
  📱 *2* ➔ SD Video (Fast & Light) 🎬
  🎙️ *3* ➔ Voice Note Audio (PTT) 💬

━━━━━━━━━━━━━━━━━━━━━
_Reply with 1, 2 or 3 to download softly~ (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      const coverUrl = meta.cover || "https://files.catbox.moe/k315x4.jpg";
      const sentMsg = await sock.sendMessage(
        from,
        {
          image: { url: coverUrl },
          caption
        },
        { quoted: msg }
      );

      const messageId = sentMsg?.key?.id;
      if (messageId) {
        global.ttCache.set(messageId, {
          chat: from,
          hd: meta.hd,
          sd: meta.sd,
          audio: meta.audio,
          title: meta.title,
          isProcessing: false
        });

        // 5-Minute TTL Cache Eviction
        setTimeout(() => {
          global.ttCache.delete(messageId);
        }, 300000);
      }

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[TIKTOK ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* Failed to process TikTok video (${err.message})` },
        { quoted: msg }
      );
    }
  }
};
