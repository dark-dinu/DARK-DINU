import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import axios from "axios";
import ytSearch from "yt-search";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { delay } from "@whiskeysockets/baileys";

let ffmpegPath = "ffmpeg";
try {
  ffmpegPath = ffmpegInstaller?.path || "ffmpeg";
} catch (_) {
  ffmpegPath = "ffmpeg";
}

const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

global.channelJidCache = global.channelJidCache || new Map();

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// ── Native Buffer Downloader with 20MB Safety Cap ──
async function downloadBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": UA },
      timeout: 35000,
      maxContentLength: 20 * 1024 * 1024
    });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

// ── FFmpeg WhatsApp Voice Note (OGG Opus) Converter ──
function convertToWhatsAppVoice(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempInput = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `out_${tempId}.opus`);

    fs.writeFile(tempInput, inputBuffer, (err) => {
      if (err) return resolve({ buffer: inputBuffer, isOpus: false });

      const cmd = `"${ffmpegPath}" -y -i "${tempInput}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 "${tempOutput}"`;

      exec(cmd, (error) => {
        safeUnlink(tempInput);

        if (!error && fs.existsSync(tempOutput)) {
          try {
            const outBuf = fs.readFileSync(tempOutput);
            safeUnlink(tempOutput);
            return resolve({ buffer: outBuf, isOpus: true });
          } catch (_) {}
        }

        resolve({ buffer: inputBuffer, isOpus: false });
      });
    });
  });
}

// ── Ultra-Fast YouTube Search Engine ──
async function searchYouTube(query) {
  try {
    const res = await ytSearch(query);
    if (!res?.videos?.length) return null;

    const video = res.videos[0];
    return {
      videoId: video.videoId,
      url: video.url,
      title: video.title || "Channel Song",
      duration: video.timestamp || "3:30",
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
    };
  } catch {
    return null;
  }
}

// ── Chamindu API Stream Link Resolver (Multiple Endpoints) ──
async function getAudioDownloadUrl(videoUrl) {
  const enc = encodeURIComponent(videoUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/media/ytmp3/dl?url=${enc}&quality=128&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/media/ytmp4/dl?url=${enc}&quality=360&api_key=${API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { headers: { "User-Agent": UA }, timeout: 15000 });
      const data = res.data;
      if (data) {
        const link =
          data.data?.direct_url ||
          data.data?.download_url ||
          data.data?.download_link ||
          data.direct_url ||
          data.download_url ||
          data.download_link;
        if (typeof link === "string" && /^https?:\/\//i.test(link)) return link;
      }
    } catch (_) {}
  }
  return null;
}

export default {
  name: "csong",
  aliases: ["channelsong", "cvoice", "cplay"],
  category: "channel",
  description: "Post song card & voice audio to WhatsApp Channel",

  async execute({ sock, msg, from, args, config }) {
    const botName = config?.BOT_NAME || "DARK-DINU MD";
    const fullText = (args || []).join(" ").trim();
    const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});

    if (!fullText) {
      return await sock.sendMessage(
        from,
        {
          text: `⚠️ *Usage:*\n*.csong <channel_link> , <song_name>*\n\n*Example:*\n.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V , sadawathiye`
        },
        { quoted: msg }
      );
    }

    // Link සහ සින්දුවේ නම වෙන් කරගැනීම (අගට post IDs /755 ආවත් clean කරගනී)
    const linkMatch = fullText.match(/https?:\/\/(?:www\.)?whatsapp\.com\/channel\/[a-zA-Z0-9_\-\/]+/i);
    let channelLink = "";
    let songName = "";

    if (linkMatch) {
      channelLink = linkMatch[0];
      songName = fullText.replace(channelLink, "").replace(/^[\s,]+|[\s,]+$/g, "").trim();
    } else {
      return await sock.sendMessage(
        from,
        { text: "⚠️ කරුණාකර Channel Link එක සහ සින්දුවේ නම කොමාවකින් (,) වෙන් කර ලබාදෙන්න!" },
        { quoted: msg }
      );
    }

    if (!songName) {
      return await sock.sendMessage(from, { text: "⚠️ කරුණාකර සින්දුවේ නම ලබාදෙන්න!" }, { quoted: msg });
    }

    // Invite code එක පිරිසිදුව ලබා ගැනීම
    let inviteCode = channelLink.split("whatsapp.com/channel/")[1]?.split(/[\/?#]/)[0]?.trim();
    if (!inviteCode) {
      return await sock.sendMessage(from, { text: "❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න!" }, { quoted: msg });
    }

    react("⏳");

    try {
      // 1. Channel JID එක ලබා ගැනීම
      let channelJid = global.channelJidCache.get(inviteCode);
      let channelMeta = null;

      if (!channelJid) {
        try {
          channelMeta = await Promise.race([
            sock.newsletterMetadata("invite", inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]);
          channelJid = channelMeta?.id;
          if (channelJid) global.channelJidCache.set(inviteCode, channelJid);
        } catch (e) {
          console.error("[CSONG NEWSLETTER ERROR]:", e.message);
        }
      }

      if (!channelJid) {
        channelJid = `${inviteCode}@newsletter`;
      }

      if (!channelJid.includes("@")) {
        channelJid = `${channelJid}@newsletter`;
      }

      // 2. YouTube Search
      const video = await searchYouTube(songName);
      if (!video) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ සින්දුව සොයාගත නොහැකි විය." }, { quoted: msg });
      }

      // 3. Audio Download Link එක ලබා ගැනීම
      const audioUrl = await getAudioDownloadUrl(video.url);
      if (!audioUrl) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio stream link එක ලබාගැනීමට නොහැකි විය." }, { quoted: msg });
      }

      const rawBuffer = await downloadBuffer(audioUrl);
      if (!rawBuffer || rawBuffer.length < 5000) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio file එක download කරගැනීම අසාර්ථක විය." }, { quoted: msg });
      }

      // 4. Voice Note බවට Convert කිරීම
      const voice = await convertToWhatsAppVoice(rawBuffer);

      // 5. Card Caption
      const cardCaption = 
`🥰⃝🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

| 🎶 *${botName}*`;

      // 6. Channel එකට Thumbnail Card එක යැවීම
      if (video.thumbnail) {
        await sock.sendMessage(channelJid, {
          image: { url: video.thumbnail },
          caption: cardCaption
        });
      } else {
        await sock.sendMessage(channelJid, { text: cardCaption });
      }

      // Message 2 එකපාර යැවීමෙන් drop වීම වැළැක්වීමට delay එකක්
      await delay(1500);

      // 7. Channel එකට Audio/Voice Note එක යැවීම
      await sock.sendMessage(channelJid, {
        audio: voice.buffer,
        mimetype: voice.isOpus ? "audio/ogg; codecs=opus" : "audio/mp4",
        ptt: true
      });

      react("✅");
      return await sock.sendMessage(
        from,
        {
          text: `✅ *"${video.title}"*\nChannel එකට Voice Note එකක් ලෙස සාර්ථකව Post කරන ලදී! 🎙️🔥`
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("[CSONG MAIN ERROR]:", err.message);
      react("❌");
      return await sock.sendMessage(
        from,
        { text: `❌ Error: ${err.message || "Failed to post to channel"}` },
        { quoted: msg }
      );
    }
  }
};
