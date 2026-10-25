import axios from "axios";
import yts from "yt-search";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const CHAMA_API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

const ALLOWED_USERS = [
  "15947733680169",
  "15947733680169@lid",
  "94719845166",
  "94719845166@s.whatsapp.net"
];

// Audio එකේ duration එක තත්පර වලින් ලබා ගැනීම
function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.format?.duration) return resolve(180);
      resolve(Math.round(metadata.format.duration));
    });
  });
}

// WhatsApp Channel එකට Playable Voice Note (Opus PTT) බවට හරවන function එක
function convertToOpusPtt(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libopus")
      .audioChannels(1)
      .audioFrequency(48000)
      .audioBitrate("64k")
      .format("ogg")
      .outputOptions([
        "-avoid_negative_ts make_zero",
        "-map_metadata -1"
      ])
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

// Channel Invite Code එකෙන් නියම 120363... JID එක ලබා ගැනීම
async function getChannelJid(sock, channelInput) {
  let input = channelInput.trim();
  if (input.endsWith("@newsletter")) return input;

  const match = input.match(/channel\/([a-zA-Z0-9]{20,28})/i);
  if (!match || !match[1]) {
    throw new Error("වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න.");
  }

  const inviteCode = match[1];

  // 1. Baileys official metadata lookup
  try {
    const meta = await sock.newsletterMetadata("invite", inviteCode);
    if (meta?.id && String(meta.id).endsWith("@newsletter")) {
      return meta.id;
    }
  } catch (err) {
    console.warn("newsletterMetadata failed, trying scrape fallback...");
  }

  // 2. Web scrape fallback
  try {
    const page = await axios.get(`https://whatsapp.com/channel/${inviteCode}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 15000,
    });
    const html = String(page.data);
    const m = html.match(/(120363\d+@newsletter)/i) || 
              html.match(/newsletter_jid&quot;:&quot;(\d+)&quot;/i);
    if (m) {
      return m[1].includes("@newsletter") ? m[1] : `${m[1]}@newsletter`;
    }
  } catch (e) {
    console.error("Scrape fallback failed:", e.message);
  }

  throw new Error("Channel එක හඳුනාගත නොහැකි විය. Bot එම Channel එකේ Admin ද බලන්න.");
}

// Chamindu API එකෙන් YouTube Audio එක ලබා ගැනීම
async function fetchYouTubeDownload(targetYoutubeUrl) {
  try {
    const directUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetYoutubeUrl)}&quality=128k&format=mp3&api_key=${CHAMA_API_KEY}`;
    const { data: res } = await axios.get(directUrl, { timeout: 45000 });
    const dl = res?.download_url || res?.data?.download_url || res?.result?.download_url;
    if (dl) {
      return { 
        downloadUrl: dl, 
        title: res?.title || res?.data?.title || "", 
        thumbnail: res?.thumbnail || res?.data?.thumbnail || "" 
      };
    }
  } catch (err) {
    console.warn("Direct MP3 failed, trying MP4 format...");
  }

  try {
    const videoUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetYoutubeUrl)}&quality=360p&format=mp4&api_key=${CHAMA_API_KEY}`;
    const { data: res2 } = await axios.get(videoUrl, { timeout: 45000 });
    const dl2 = res2?.download_url || res2?.data?.download_url || res2?.result?.download_url;
    if (dl2) {
      return { 
        downloadUrl: dl2, 
        title: res2?.title || res2?.data?.title || "", 
        thumbnail: res2?.thumbnail || res2?.data?.thumbnail || "" 
      };
    }
  } catch (e) {
    console.error("YouTube download error:", e.message);
  }

  return null;
}

export default {
  name: "csong",
  aliases: ["channelsong", "cs"],
  category: "music",
  description: "Send YouTube song as card and playable voice note to a channel",

  async execute({ sock, msg, from, args, sender, config }) {
    // 1. Authorization (LID, fromMe, Developer Number)
    const isFromMe = Boolean(msg.key?.fromMe);
    const participant = msg.key?.participant || "";
    const rawSender = String(sender || "");
    const rawFrom = String(from || "");

    const allIdentities = [rawSender, rawFrom, participant].join(" ");
    const isAuthorized =
      isFromMe ||
      ALLOWED_USERS.some((target) => allIdentities.includes(target)) ||
      (config?.OWNER_NUMBERS && config.OWNER_NUMBERS.some((num) => allIdentities.includes(num)));

    if (!isAuthorized) {
      return await sock.sendMessage(from, { 
        text: "❌ *Access Denied:* මෙම command එක භාවිතා කළ හැක්කේ Bot Owner සහ Developer ට පමණි." 
      }, { quoted: msg });
    }

    const fullText = (args || []).join(" ").trim();

    if (!fullText.includes(",")) {
      return await sock.sendMessage(from, { 
        text: `⚠️ *භාවිතා කරන ආකාරය:*\n\n\`.csong <Channel Link>, <Song Name>\`\n\n_උදා: .csong https://whatsapp.com/channel/0029VbBtXBMICVfnpV20wl27, lelena_` 
      }, { quoted: msg });
    }

    const commaIndex = fullText.indexOf(",");
    const channelInput = fullText.slice(0, commaIndex).trim();
    const songQuery = fullText.slice(commaIndex + 1).trim();

    if (!channelInput || !songQuery) {
      return await sock.sendMessage(from, { 
        text: "❌ කරුණාකර Channel Link එක සහ Song Name එක ඇතුළත් කරන්න." 
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: "⏳ Processing song card & voice note for channel..." }, { quoted: msg });

    const tempDir = os.tmpdir();
    const tempInputFile = path.join(tempDir, `raw_${Date.now()}.bin`);
    const tempOutputFile = path.join(tempDir, `vn_${Date.now()}.ogg`);

    try {
      // Channel JID එක ලබා ගැනීම
      const targetChannelJid = await getChannelJid(sock, channelInput);

      let targetYoutubeUrl = songQuery;
      let searchedTitle = songQuery;
      let searchedThumbnail = "";
      let searchedDuration = "03:45";

      const isYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(songQuery);
      
      if (!isYoutubeUrl) {
        const searchResult = await yts(songQuery);
        if (!searchResult?.videos?.length) {
          return await sock.sendMessage(from, { text: "❌ YouTube හි අදාළ සින්දුව හමු නොවීය." }, { quoted: msg });
        }
        const video = searchResult.videos[0];
        targetYoutubeUrl = video.url;
        searchedTitle = video.title;
        searchedThumbnail = video.thumbnail;
        searchedDuration = video.timestamp || "03:45";
      }

      const ytData = await fetchYouTubeDownload(targetYoutubeUrl);

      if (!ytData?.downloadUrl) {
        return await sock.sendMessage(from, { text: "❌ YouTube Download Link එක ලබා ගැනීමට නොහැකි විය." }, { quoted: msg });
      }

      const finalTitle = ytData.title || searchedTitle;
      const finalThumbnail = ytData.thumbnail || searchedThumbnail;

      // 1. Song Card Caption (ස්ක්‍රීන්ෂොට් එකේ ඇති නිවැරදි Format එක)
      const songCardCaption = 
`│ 🎵⃝✨ H E S H A N   O F C   M U S I C

❖ TITLE : ${finalTitle}

01:23 ───🔘──────── ${searchedDuration}
⇄     ◁   ❚❚   ▷     ↻

➥ Don't forget to enjoy the song and leave a reaction! 🥰🎶

│ 🕊️ HESHAN OFC : SONG HUB`;

      // 2. Poster Card Image එක Channel එකට යැවීම
      if (finalThumbnail) {
        const thumbRes = await axios.get(finalThumbnail, { responseType: "arraybuffer", timeout: 20000 });
        await sock.sendMessage(targetChannelJid, {
          image: Buffer.from(thumbRes.data),
          caption: songCardCaption
        });
      }

      // 3. Audio File එක බාගත කිරීම
      const fileResponse = await axios({
        url: ytData.downloadUrl,
        method: "GET",
        responseType: "arraybuffer",
        timeout: 120000,
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "*/*"
        }
      });

      const mediaBuffer = Buffer.from(fileResponse.data);
      if (mediaBuffer.length < 10000) {
        return await sock.sendMessage(from, { text: "❌ බාගත වූ audio ගොනුව අසම්පූර්ණයි." }, { quoted: msg });
      }

      fs.writeFileSync(tempInputFile, mediaBuffer);

      // 4. FFmpeg මඟින් True WhatsApp Opus PTT එකට Convert කිරීම
      await convertToOpusPtt(tempInputFile, tempOutputFile);
      const audioSeconds = await getAudioDuration(tempOutputFile);

      // 5. Channel එකේ waveform bar එක ලස්සනට render වීමට random waveform data එකක් සෑදීම
      const waveformBars = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        waveformBars[i] = Math.floor(Math.random() * 75) + 25;
      }

      const opusAudioBuffer = fs.readFileSync(tempOutputFile);

      // 6. Playable Voice Note (PTT Waveform) එක Channel එකට යැවීම
      await sock.sendMessage(targetChannelJid, {
        audio: opusAudioBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        seconds: audioSeconds,
        waveform: waveformBars
      });

      await sock.sendMessage(from, { 
        text: `✅ *සාර්ථකයි!* Song Card එක සහ Voice Note එක Channel එකට Upload කරන ලදී.` 
      }, { quoted: msg });

    } catch (error) {
      console.error("[Csong Send Error]:", error);
      await sock.sendMessage(from, { text: `❌ දෝෂයක් සිදු විය: ${error.message || error}` }, { quoted: msg });
    } finally {
      if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
      if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
    }
  }
};
