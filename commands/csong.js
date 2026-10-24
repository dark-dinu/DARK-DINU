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

// අලුත්ම API Key එක (.env එකෙන් හෝ direct key එකෙන් ගනී)
const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

global.channelJidCache = global.channelJidCache || new Map();

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// ── Native Buffer Downloader ──
async function downloadBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": UA },
      timeout: 50000,
      maxContentLength: 45 * 1024 * 1024
    });
    return Buffer.from(res.data);
  } catch (e) {
    return null;
  }
}

// ── Low-Latency OGG Opus Voice Note Converter (WhatsApp Native PTT) ──
function convertToOpusVoice(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${(Math.random() * 1e9) | 0}`;
    const tempInput = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `out_${tempId}.ogg`);

    fs.writeFile(tempInput, inputBuffer, (err) => {
      if (err) return resolve(inputBuffer);

      const cmd = `"${ffmpegPath}" -y -i "${tempInput}" -c:a libopus -b:a 64k -ar 48000 -ac 1 "${tempOutput}"`;

      exec(cmd, (execErr) => {
        safeUnlink(tempInput);
        if (execErr) return resolve(inputBuffer);

        fs.readFile(tempOutput, (readErr, outBuf) => {
          safeUnlink(tempOutput);
          if (readErr || !outBuf) return resolve(inputBuffer);
          resolve(outBuf);
        });
      });
    });
  });
}

// ── Fast Waveform Generator (WhatsApp Dynamic Voice Bars) ──
function getFastWaveform() {
  const bars = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    bars[i] = ((Math.random() * 65) | 0) + 15;
  }
  return bars;
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

// ── Updated Chamindu Toolkit API Stream Resolver ──
async function getAudioDownloadUrl(videoUrl) {
  const enc = encodeURIComponent(videoUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${enc}&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=320kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { headers: { "User-Agent": UA }, timeout: 15000 });
      const data = res.data;
      if (data) {
        const link =
          data.data?.audio?.download_url ||
          data.data?.audio?.url ||
          data.data?.download_url ||
          data.data?.direct_url ||
          data.data?.url ||
          data.download_url ||
          data.direct_url ||
          data.result?.download_url ||
          data.result?.url ||
          data.url;

        if (link && typeof link === "string" && /^https?:\/\//i.test(link)) return link;
      }
    } catch (_) {}
  }
  return null;
}

export default {
  name: "csong",
  aliases: ["channelsong", "cvoice", "cplay"],
  category: "channel",
  description: "Post cute song card & voice audio to WhatsApp Channel",

  async execute({ sock, msg, from, args, config }) {
    const botName = config?.BOT_NAME || "DARK-DINU MD";
    const fullText = (args || []).join(" ").trim();
    const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});

    if (!fullText) {
      return await sock.sendMessage(
        from,
        {
          text: `⚠️ *භාවිතය:*\n*.csong <channel_link> , <song_name>*\n\n*උදාහරණ:*\n.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V , sadawathiye`
        },
        { quoted: msg }
      );
    }

    // Link සහ Song Name වෙන් කර ගැනීම
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

    // Invite code එක පමණක් නිවැරදිව වෙන් කර ගැනීම (අගට post ids ආවත් ඉවත් කරයි)
    let inviteCode = channelLink.split("whatsapp.com/channel/")[1]?.split(/[\/?#]/)[0]?.trim();
    if (!inviteCode) {
      return await sock.sendMessage(from, { text: "❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න!" }, { quoted: msg });
    }

    react("⏳");

    try {
      // 1. Channel JID හරියටම Resolve කරගැනීම
      let channelJid = global.channelJidCache.get(inviteCode);

      if (!channelJid) {
        try {
          const meta = await Promise.race([
            sock.newsletterMetadata("invite", inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]);
          channelJid = meta?.id;
          if (channelJid) global.channelJidCache.set(inviteCode, channelJid);
        } catch (_) {}
      }

      if (!channelJid) channelJid = `${inviteCode}@newsletter`;
      if (!channelJid.includes("@newsletter")) channelJid = `${channelJid.split("@")[0]}@newsletter`;

      // 2. YouTube Search
      const video = await searchYouTube(songName);
      if (!video) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ සින්දුව සොයාගත නොහැකි විය." }, { quoted: msg });
      }

      // 3. Audio Stream Link එක Chamindu Toolkit API හරහා ලබා ගැනීම
      const audioUrl = await getAudioDownloadUrl(video.url);
      if (!audioUrl) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio Stream Link එක ලබාගත නොහැකි විය." }, { quoted: msg });
      }

      // 4. Download Audio & Thumbnail Buffers
      const [rawAudioBuffer, imgBuffer] = await Promise.all([
        downloadBuffer(audioUrl),
        downloadBuffer(video.thumbnail)
      ]);

      if (!rawAudioBuffer || rawAudioBuffer.length < 5000) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio file එක download කරගැනීම අසාර්ථක විය." }, { quoted: msg });
      }

      // 5. Convert to Opus Voice Note
      const finalVoiceBuffer = await convertToOpusVoice(rawAudioBuffer);

      const cardCaption = 
`🥰⃝🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

| ☘️ *${botName}*`;

      // 6. Channel එකට Image Card එක යැවීම
      if (imgBuffer) {
        await sock.sendMessage(channelJid, {
          image: imgBuffer,
          caption: cardCaption
        });
      }

      // Rate limit එකෙන් drop නොවීමට delay එකක්
      await delay(1500);

      // 7. Channel එකට Voice Note (PTT) එක යැවීම
      await sock.sendMessage(channelJid, {
        audio: finalVoiceBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        waveform: getFastWaveform()
      });

      react("✅");
      return await sock.sendMessage(
        from,
        {
          text: `✅ *"${video.title}"*\nChannel එකට Image Card එක සහ Voice Note එක සාර්ථකව Post කරන ලදී! 🎙️🔥`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[CSONG ERROR]:", err);
      react("❌");
      return await sock.sendMessage(
        from,
        { text: `❌ Glitch: ${err.message || "Failed to post song"}` },
        { quoted: msg }
      );
    }
  }
};
