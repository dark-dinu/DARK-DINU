import yts from "yt-search";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

// FFmpeg Setup
let ffmpegPath = "ffmpeg";
try {
  ffmpegPath = ffmpegInstaller?.path || "ffmpeg";
} catch (_) {
  ffmpegPath = "ffmpeg";
}

// Any Audio -> WhatsApp Native Playable Voice Note (OGG Opus) Converter
function convertToOpusVoice(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempInput = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `out_${tempId}.opus`);

    fs.writeFileSync(tempInput, inputBuffer);

    // WhatsApp New Specs: OGG Container, libopus codec, 48000Hz, Mono channel, 64k bitrate
    const cmd = `"${ffmpegPath}" -y -i "${tempInput}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -f ogg "${tempOutput}"`;

    exec(cmd, (err) => {
      try { if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput); } catch (_) {}

      if (err) return reject(err);

      try {
        const out = fs.readFileSync(tempOutput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        resolve(out);
      } catch (readErr) {
        reject(readErr);
      }
    });
  });
}

// WhatsApp Playable Voice Waveform Dummy Generator (64 bars)
function generateVoiceWaveform() {
  const bars = [];
  for (let i = 0; i < 64; i++) {
    bars.push(Math.floor(Math.random() * 70) + 10);
  }
  return Uint8Array.from(bars);
}

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "channel",
  description: "Send Song Card & Real WhatsApp Playable Voice Note to Channel",

  async execute({ sock, msg, from, args, config }) {
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const pref = config?.PREFIX || ".";

    try {
      const fullText = args.join(" ").trim();
      const parts = fullText.split(",");

      if (parts.length < 2) {
        return await reply(`⚠️ *භාවිතය:*\n*${pref}csong <channel_link> , <song_name>*\n\n*උදාහරණ:*\n${pref}csong https://whatsapp.com/channel/0029VaXXXXX , kuweniye`);
      }

      const channelLink = parts[0].trim();
      const songName = parts.slice(1).join(",").trim();

      const inviteMatch = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/);
      const inviteCode = inviteMatch ? inviteMatch[1] : null;

      if (!inviteCode) {
        return await reply("❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න!");
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 1. Channel JID ලබා ගැනීම
      let channelJid = null;
      try {
        const channelMeta = await sock.newsletterMetadata("invite", inviteCode);
        channelJid = channelMeta?.id;
      } catch (e) {
        console.error("Channel metadata error:", e);
      }

      if (!channelJid) {
        return await reply("❌ Channel එක සොයාගත නොහැකි විය. Bot අදාළ Channel එකේ Admin ද යන්න පරීක්ෂා කරන්න.");
      }

      if (!channelJid.endsWith("@newsletter")) {
        channelJid = `${channelJid.replace(/[^0-9]/g, "")}@newsletter`;
      }

      // 2. YouTube Search
      const search = await yts(songName);
      const video = search.videos[0];
      if (!video) return await reply("❌ සින්දුව සොයාගත නොහැකි විය.");

      // 3. Audio Download API
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      let audioDownloadUrl = null;

      try {
        const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(video.url)}&quality=128kbps&format=mp3&api_key=${apiKey}`;
        const res = await axios.get(apiUrl, { timeout: 20000 });
        audioDownloadUrl = res.data?.data?.direct_url || res.data?.data?.download_url || res.data?.direct_url || res.data?.download_url;
      } catch (_) {}

      if (!audioDownloadUrl) {
        try {
          const fallbackApi = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(video.url)}&quality=360p&format=mp4&api_key=${apiKey}`;
          const res2 = await axios.get(fallbackApi, { timeout: 20000 });
          audioDownloadUrl = res2.data?.data?.direct_url || res2.data?.data?.download_url || res2.data?.direct_url;
        } catch (_) {}
      }

      if (!audioDownloadUrl) {
        return await reply("❌ Audio Download කරගැනීමට නොහැකි විය. නැවත උත්සාහ කරන්න.");
      }

      // 4. Buffering
      const [audioRes, imgRes] = await Promise.all([
        axios.get(audioDownloadUrl, { responseType: "arraybuffer", timeout: 60000, headers: { "User-Agent": "Mozilla/5.0" } }),
        axios.get(video.thumbnail, { responseType: "arraybuffer" })
      ]);

      const rawAudioBuffer = Buffer.from(audioRes.data);
      const imgBuffer = Buffer.from(imgRes.data);

      // 5. Convert to WhatsApp Playable Opus Voice
      let voiceBuffer;
      try {
        voiceBuffer = await convertToOpusVoice(rawAudioBuffer);
      } catch (convErr) {
        console.warn("Opus Conversion Fallback:", convErr.message);
        voiceBuffer = rawAudioBuffer;
      }

      const cardCaption = 
`🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.timestamp || "4:00"}

Use Headphones For Best Experience.... 🎧🎵

| ⚡ *DARK-DINU CORE*`;

      // 6. Card Banner එක Channel එකට යැවීම
      await sock.sendMessage(channelJid, {
        image: imgBuffer,
        caption: cardCaption
      });

      // 7. New Update Real Voice Note (Waveform & Direct Play Button සහිතව)
      await sock.sendMessage(channelJid, {
        audio: voiceBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        waveform: generateVoiceWaveform()
      });

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      await reply(`✅ *"${video.title}"*\nChannel එකට Playable Voice Note එකක් ලෙස සාර්ථකව Post කරන ලදී! 🎙️🔥`);

    } catch (err) {
      console.error("[CSONG ERROR]:", err);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Error: ${err.message || "Failed to post to channel."}`);
    }
  }
};
