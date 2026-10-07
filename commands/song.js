import yts from "yt-search";
import axios from "axios";

global.songSessions = global.songSessions || new Map();
global.songHookedSockets = global.songHookedSockets || new WeakSet();

// 100% Playable Direct MP3 Downloader
async function getPlayableAudio(videoUrl) {
  // Chamindu Native MP3 Endpoint (Direct Playable Audio Stream)
  try {
    const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
    const res = await axios.get(
      `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=${apiKey}`,
      { timeout: 12000 }
    );
    const dl = res.data?.data?.direct_url || res.data?.data?.download_url;
    if (dl) {
      const audioStream = await axios.get(dl, {
        responseType: "arraybuffer",
        timeout: 25000,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      return Buffer.from(audioStream.data);
    }
  } catch (_) {}

  // Fallback 1: Fast BK9 Stream
  try {
    const res2 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { timeout: 10000 });
    const dl2 = res2.data?.BK9?.BK8;
    if (dl2) {
      const stream2 = await axios.get(dl2, { responseType: "arraybuffer", timeout: 25000 });
      return Buffer.from(stream2.data);
    }
  } catch (_) {}

  return null;
}

// Background Auto-Reply Interceptor
function attachSongReplyEngine(sock) {
  if (!sock || global.songHookedSockets.has(sock)) return;
  global.songHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const msgObj = m.message;
    const contextInfo = 
      msgObj.extendedTextMessage?.contextInfo ||
      msgObj.imageMessage?.contextInfo ||
      msgObj.buttonsResponseMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.songSessions.has(quotedId)) return;

    const session = global.songSessions.get(quotedId);
    if (session.from !== from) return;

    const choice = (
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      ""
    ).trim();

    if (!["1", "2", "3"].includes(choice)) return;

    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      const audioBuffer = await getPlayableAudio(session.videoUrl);
      if (!audioBuffer) throw new Error("Audio stream unavailable.");

      if (choice === "1") {
        // Native Playable WhatsApp Audio
        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: m });
      } else if (choice === "2") {
        // Document Format
        await sock.sendMessage(from, {
          document: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${session.title}.mp3`
        }, { quoted: m });
      } else if (choice === "3") {
        // Voice Note (PTT Playable)
        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        }, { quoted: m });
      }

      sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
      global.songSessions.delete(quotedId);
    } catch (err) {
      console.error("[SONG SEND ERR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: m.key } }).catch(() => {});
      sock.sendMessage(from, { text: `❌ සින්දුව එවීමට නොහැකි විය: ${err.message}` }, { quoted: m }).catch(() => {});
    }
  });
}

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
  description: "Fast Playable YouTube Song Downloader",

  async execute({ sock, msg, from, args, config }) {
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
      let thumbnail = null;

      if (!query.startsWith("http://") && !query.startsWith("https://")) {
        const search = await yts(query);
        const video = search?.videos?.[0];

        if (!video) {
          sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await reply("❌ සින්දුව සොයාගැනීමට නොහැකි විය.");
        }

        videoUrl = video.url;
        title = video.title || "YouTube Audio";
        thumbnail = video.thumbnail;
      }

      const songCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎵 *SONG DETAILS* 〕
├─▸ 🎼 *Title* : ${title.slice(0, 45)}...
├─▸ ⚡ *Engine*: ULTRA FAST MP3
└───────────────────────

┌─〔 📥 *SELECT FORMAT* 〕
├─▸ [ 𝟏 ] ❯ 🎵 Audio (Playable MP3)
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
          videoUrl,
          from
        });

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
