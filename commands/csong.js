import axios from "axios";
import ytSearch from "yt-search";
import { delay } from "@whiskeysockets/baileys";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// Chamindu API Key (.env එකෙන් හෝ direct fallback එකෙන් ගනී)
const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

global.channelJidCache = global.channelJidCache || new Map();

// ── Native Buffer Downloader ──
async function downloadBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": UA },
      timeout: 50000,
      maxContentLength: 40 * 1024 * 1024
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error("[BUFFER ERROR]:", e.message);
    return null;
  }
}

// ── MP3 → OGG Opus (Voice Note Converter) ──
async function toVoiceNote(buffer) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inp = path.join(os.tmpdir(), `${id}.mp3`);
  const out = path.join(os.tmpdir(), `${id}.ogg`);
  try {
    fs.writeFileSync(inp, buffer);
    await new Promise((resolve, reject) => {
      const p = spawn("ffmpeg", [
        "-y", "-i", inp, "-vn",
        "-c:a", "libopus", "-b:a", "64k",
        "-ar", "48000", "-ac", "1",
        "-f", "ogg", out
      ]);
      p.on("error", reject);
      p.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error("ffmpeg failed with code: " + code))
      );
    });
    return fs.readFileSync(out);
  } catch (err) {
    console.error("[FFMPEG ERROR, FALLBACK TO RAW]:", err.message);
    return buffer; // FFmpeg නැතිනම් raw buffer එක යවයි
  } finally {
    if (fs.existsSync(inp)) fs.unlinkSync(inp);
    if (fs.existsSync(out)) fs.unlinkSync(out);
  }
}

// ── YouTube Search Engine ──
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

// ── Chamindu API v1 MP3 Resolver ──
async function getAudioDownloadUrl(videoUrl) {
  const enc = encodeURIComponent(videoUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=320kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=128kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { headers: { "User-Agent": UA }, timeout: 15000 });
      const data = res.data;
      if (data) {
        const link =
          data.data?.download_url ||
          data.data?.direct_url ||
          data.data?.url ||
          data.download_url ||
          data.direct_url ||
          data.result?.download_url ||
          data.url;
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
  description: "Post song card & voice note directly to WhatsApp Channel",

  async execute({ sock, msg, from, args, config }) {
    const botName = config?.BOT_NAME || "DARK-DINU MD";
    const fullText = (args || []).join(" ").trim();
    const react = (emoji) =>
      sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});

    if (!fullText) {
      return await sock.sendMessage(
        from,
        {
          text: `⚠️ *භාවිතය:*\n*.csong <channel_link> , <song_name>*\n\n*උදාහරණ:*\n.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V , sadawathiye`
        },
        { quoted: msg }
      );
    }

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

    // Channel post IDs තිබුණොත් අයින් කර inviteCode එක පිරිසිදුව ලබා ගැනීම
    let inviteCode = channelLink.split("whatsapp.com/channel/")[1]?.split(/[\/?#]/)[0]?.trim();
    if (!inviteCode) {
      return await sock.sendMessage(from, { text: "❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න!" }, { quoted: msg });
    }

    react("⏳");

    try {
      // 1. Channel JID ලබා ගැනීම
      let channelJid = global.channelJidCache.get(inviteCode);

      if (!channelJid) {
        try {
          const meta = await Promise.race([
            sock.newsletterMetadata("invite", inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]);
          channelJid = meta?.id;
          if (channelJid) global.channelJidCache.set(inviteCode, channelJid);
        } catch (e) {
          console.error("[META FETCH ERR]:", e.message);
        }
      }

      if (!channelJid) channelJid = `${inviteCode}@newsletter`;
      if (!channelJid.includes("@newsletter")) channelJid = `${channelJid.split("@")[0]}@newsletter`;

      // 2. YouTube Search
      const video = await searchYouTube(songName);
      if (!video) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ සින්දුව සොයාගත නොහැකි විය." }, { quoted: msg });
      }

      // 3. Audio Download URL ලබා ගැනීම
      const audioUrl = await getAudioDownloadUrl(video.url);
      if (!audioUrl) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio Download Link එක Chamindu API මඟින් ලබාගත නොහැකි විය." }, { quoted: msg });
      }

      // 4. Download Media Buffers
      const [rawAudioBuffer, imgBuffer] = await Promise.all([
        downloadBuffer(audioUrl),
        downloadBuffer(video.thumbnail)
      ]);

      if (!rawAudioBuffer || rawAudioBuffer.length < 5000) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio file එක බාගත වීම අසාර්ථක විය." }, { quoted: msg });
      }

      const cardCaption =
`🥰⃝🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

| ☘️ *${botName}*`;

      // 5. Channel එකට Post කිරීම
      // A. Thumbnail Card එක යැවීම
      if (imgBuffer) {
        await sock.sendMessage(channelJid, {
          image: imgBuffer,
          caption: cardCaption
        });
      } else {
        await sock.sendMessage(channelJid, { text: cardCaption });
      }

      await delay(2000);

      // B. Voice Note (MP3 → OGG Opus) convert කර යැවීම
      const voiceBuffer = await toVoiceNote(rawAudioBuffer);

      await sock.sendMessage(channelJid, {
        audio: voiceBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      react("✅");
      return await sock.sendMessage(
        from,
        {
          text: `✅ *"${video.title}"*\nChannel එකට Image Card එක සහ Voice Note එක සාර්ථකව Post කරන ලදී! 🎶✨`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[CSONG FATAL ERROR]:", err);
      react("❌");
      return await sock.sendMessage(
        from,
        { text: `❌ Glitch: ${err.message || "Failed to post to channel"}` },
        { quoted: msg }
      );
    }
  }
};
