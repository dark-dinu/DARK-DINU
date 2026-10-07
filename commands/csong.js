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

// Ultra-Reliable Opus Converter
function convertToOpusVoice(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempInput = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `out_${tempId}.ogg`);

    fs.writeFileSync(tempInput, inputBuffer);

    const cmd = `"${ffmpegPath}" -y -i "${tempInput}" -c:a libopus -b:a 64k -ar 48000 -ac 1 "${tempOutput}"`;

    exec(cmd, (err) => {
      try { if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput); } catch (_) {}

      if (err) {
        // FFmpeg fail වුණොත් මුල් buffer එකම fallback එකක් ලෙස ලබාදෙයි
        return resolve(inputBuffer);
      }

      try {
        const out = fs.readFileSync(tempOutput);
        if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        resolve(out);
      } catch (_) {
        resolve(inputBuffer);
      }
    });
  });
}

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
  description: "Send Song Card & Playable Audio to WhatsApp Channel",

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

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 1. Channel JID සහ Admin Role එක Check කිරීම
      let channelMeta = null;
      try {
        channelMeta = await sock.newsletterMetadata("invite", inviteCode);
      } catch (e) {
        return await reply(`❌ Channel තොරතුරු ලබාගත නොහැකි විය: ${e.message}`);
      }

      if (!channelMeta?.id) {
        return await reply("❌ Channel එක හමු නොවීය.");
      }

      let channelJid = channelMeta.id;
      if (!channelJid.endsWith("@newsletter")) {
        channelJid = `${channelJid}@newsletter`;
      }

      // Role Check (බොට් Admin ද යන්න)
      const role = channelMeta.viewer_metadata?.role || "GUEST";
      if (role !== "ADMIN" && role !== "OWNER") {
        return await reply(`⛔ *අවසර නැත:* මෙම බොට් අදාළ Channel එකේ Admin කෙනෙක් නොවේ! (වත්මන් තත්ත්වය: ${role})\nකරුණාකර බොට්ගේ නම්බර් එක Channel Admin කරන්න.`);
      }

      // 2. YouTube Search
      const search = await yts(songName);
      const video = search?.videos?.[0];
      if (!video) return await reply("❌ සින්දුව සොයාගත නොහැකි විය.");

      // 3. Audio Download API
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      let audioDownloadUrl = null;

      try {
        const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(video.url)}&quality=128kbps&format=mp3&api_key=${apiKey}`;
        const res = await axios.get(apiUrl, { timeout: 15000 });
        audioDownloadUrl = res.data?.data?.direct_url || res.data?.data?.download_url || res.data?.direct_url || res.data?.download_url;
      } catch (_) {}

      if (!audioDownloadUrl) {
        try {
          const fallbackApi = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(video.url)}&quality=360p&format=mp4&api_key=${apiKey}`;
          const res2 = await axios.get(fallbackApi, { timeout: 15000 });
          audioDownloadUrl = res2.data?.data?.direct_url || res2.data?.data?.download_url || res2.data?.direct_url;
        } catch (_) {}
      }

      if (!audioDownloadUrl) {
        return await reply("❌ Audio එක Download කරගැනීමට නොහැකි විය.");
      }

      // 4. Download Audio & Thumbnail
      const [audioRes, imgRes] = await Promise.all([
        axios.get(audioDownloadUrl, { responseType: "arraybuffer", timeout: 45000 }),
        axios.get(video.thumbnail, { responseType: "arraybuffer", timeout: 10000 })
      ]);

      const rawAudioBuffer = Buffer.from(audioRes.data);
      const imgBuffer = Buffer.from(imgRes.data);

      // 5. Convert to WhatsApp Voice Format
      const finalVoiceBuffer = await convertToOpusVoice(rawAudioBuffer);

      const cardCaption = 
`🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.timestamp || "4:00"}

Use Headphones For Best Experience.... 🎧🎵

| ⚡ *DARK-DINU CORE*`;

      // 6. Send Card to Channel
      await sock.sendMessage(channelJid, {
        image: imgBuffer,
        caption: cardCaption
      });

      // 7. Send Voice Note to Channel
      await sock.sendMessage(channelJid, {
        audio: finalVoiceBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        waveform: generateVoiceWaveform()
      });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      await reply(`✅ *"${video.title}"*\nChannel එකට සාර්ථකව Post කරන ලදී! 🎙️🔥`);

    } catch (err) {
      console.error("[CSONG ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ දෝෂයකි: ${err.message || "Channel එකට post කිරීමට නොහැකි විය."}`);
    }
  }
};
