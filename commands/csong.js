import axios from "axios";
import yts from "yt-search";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const PREFIX = "[CSONG]";
const CHAMA_API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const MAX_AUDIO_SIZE = 60 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function log(step, message) {
  console.log(`${PREFIX} ${step}: ${message}`);
}

function cleanup(file) {
  try {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (error) {
    log("CLEANUP", error.message);
  }
}

function getOwners(config) {
  return [
    "15947733680169",
    "94719845166",
    ...(Array.isArray(config?.OWNER_NUMBERS) ? config.OWNER_NUMBERS : [])
  ].map((value) => String(value).replace(/\D/g, ""));
}

function isOwner({ msg, sender, config }) {
  if (msg?.key?.fromMe) return true;

  const identities = [
    sender,
    msg?.key?.participant,
    msg?.key?.participantAlt,
    msg?.key?.remoteJid,
    msg?.key?.remoteJidAlt
  ];

  const owners = getOwners(config);

  return identities.some((value) => {
    if (!value) return false;
    const number = String(value)
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");
    return owners.includes(number);
  });
}

// 100% Fail-safe Channel Resolver
async function getChannelJid(sock, input) {
  const value = String(input || "").trim();

  // කෙලින්ම 120363xxx@newsletter එකක් දුන්නොත්
  if (value.endsWith("@newsletter")) {
    return value;
  }

  const match = value.match(/channel\/([A-Za-z0-9]{15,30})/i);
  if (!match) {
    throw new Error("වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න.");
  }

  const inviteCode = match[1];
  log("CHANNEL", `Looking up ${inviteCode}`);

  // 1. Baileys newsletterMetadata
  if (typeof sock.newsletterMetadata === "function") {
    try {
      const metadata = await sock.newsletterMetadata("invite", inviteCode);
      if (metadata?.id && String(metadata.id).endsWith("@newsletter")) {
        log("CHANNEL", `Resolved via Baileys: ${metadata.id}`);
        return metadata.id;
      }
    } catch (e) {
      log("CHANNEL", `Baileys metadata failed: ${e?.message || e}`);
    }
  }

  // 2. Web Scrape Fallback
  try {
    const page = await axios.get(`https://whatsapp.com/channel/${inviteCode}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15000
    });
    const html = String(page.data);
    const m = html.match(/(120363\d+@newsletter)/i) || 
              html.match(/"id":"(120363\d+@newsletter)"/i) ||
              html.match(/newsletter_jid&quot;:&quot;(\d+)&quot;/i);

    if (m) {
      const extracted = m[1].includes("@newsletter") ? m[1] : `${m[1]}@newsletter`;
      log("CHANNEL", `Resolved via Web: ${extracted}`);
      return extracted;
    }
  } catch (err) {
    log("CHANNEL", `Web scrape failed: ${err.message}`);
  }

  // 3. Subscribed Newsletters Cache එකෙන් සෙවීම (බොට් Admin ඉන්න Channel List එකෙන්)
  try {
    if (typeof sock.newsletterSubscribed === "function") {
      const subs = await sock.newsletterSubscribed();
      if (Array.isArray(subs)) {
        for (const ch of subs) {
          if (ch.invite_code === inviteCode || ch.id?.includes(inviteCode)) {
            log("CHANNEL", `Resolved via Subscribed: ${ch.id}`);
            return ch.id;
          }
        }
      }
    }
  } catch (e) {}

  throw new Error("Channel එක හඳුනාගත නොහැකි විය. Link එක වෙනුවට Channel එකේ JID (120363...@newsletter) එක ලබා දී උත්සාහ කරන්න.");
}

function getAudioDuration(file) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(file, (error, metadata) => {
      const duration = Number(metadata?.format?.duration);
      if (error || !Number.isFinite(duration) || duration <= 0) {
        return resolve(180);
      }
      resolve(Math.round(duration));
    });
  });
}

function convertToOpus(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .noVideo()
      .audioCodec("libopus")
      .audioChannels(1)
      .audioFrequency(48000)
      .audioBitrate("64k")
      .format("ogg")
      .outputOptions([
        "-avoid_negative_ts", "make_zero",
        "-map_metadata", "-1"
      ])
      .on("end", () => {
        if (!fs.existsSync(output) || fs.statSync(output).size < 1000) {
          return reject(new Error("Opus audio file එක හිස්."));
        }
        resolve(output);
      })
      .on("error", reject)
      .save(output);
  });
}

async function downloadBuffer(url, maxSize) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000,
    maxContentLength: maxSize,
    maxBodyLength: maxSize,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Accept: "*/*"
    }
  });

  const buffer = Buffer.from(response.data);
  if (!buffer.length || buffer.length > maxSize) {
    throw new Error("Downloaded file එකේ size එක වැරදියි.");
  }
  return buffer;
}

async function fetchYouTubeDownload(targetYoutubeUrl) {
  // New Chamindu MP3 Endpoint
  try {
    log("DOWNLOAD", "Requesting Chamindu MP3 API...");
    const response = await axios.get("https://api.chamindu.site/api/v1/youtube/mp3", {
      params: {
        url: targetYoutubeUrl,
        quality: "320kbps",
        api_key: CHAMA_API_KEY
      },
      timeout: 60000
    });

    const data = response.data;
    const downloadUrl =
      data?.download_url ||
      data?.data?.download_url ||
      data?.result?.download_url ||
      data?.downloadUrl ||
      data?.url;

    if (downloadUrl && /^https?:\/\//i.test(downloadUrl)) {
      return {
        downloadUrl,
        title: data?.title || data?.data?.title || data?.result?.title || "",
        thumbnail: data?.thumbnail || data?.data?.thumbnail || data?.result?.thumbnail || ""
      };
    }
  } catch (err) {
    log("DOWNLOAD", `Primary MP3 endpoint failed: ${err.message}`);
  }

  // Fallback endpoint
  try {
    log("DOWNLOAD", "Requesting fallback download endpoint...");
    const resFallback = await axios.get("https://api.chamindu.site/api/v1/youtube/download", {
      params: {
        url: targetYoutubeUrl,
        quality: "128k",
        format: "mp3",
        api_key: CHAMA_API_KEY
      },
      timeout: 45000
    });

    const data2 = resFallback.data;
    const dl2 =
      data2?.download_url ||
      data2?.data?.download_url ||
      data2?.result?.download_url;

    if (dl2 && /^https?:\/\//i.test(dl2)) {
      return {
        downloadUrl: dl2,
        title: data2?.title || data2?.data?.title || "",
        thumbnail: data2?.thumbnail || data2?.data?.thumbnail || ""
      };
    }
  } catch (err2) {
    log("DOWNLOAD", `Fallback endpoint failed: ${err2.message}`);
  }

  throw new Error("YouTube download API එකෙන් download link එකක් ලබා ගැනීමට නොහැකි විය.");
}

export default {
  name: "csong",
  aliases: ["channelsong", "cs"],
  category: "music",
  description: "Send song poster and voice note to WhatsApp Channel",

  async execute({ sock, msg, from, args, sender, config }) {
    let inputFile;
    let outputFile;

    const reply = async (text) => {
      try {
        await sock.sendMessage(from, { text }, { quoted: msg });
      } catch (error) {
        log("REPLY", error.message);
      }
    };

    try {
      if (!isOwner({ msg, sender, config })) {
        return await reply("❌ මේ command එක භාවිතා කිරීමට අවසර නැහැ (Bot Owner / Dev Only).");
      }

      const fullText = (args || []).join(" ").trim();
      const comma = fullText.indexOf(",");

      if (comma < 0) {
        return await reply(
          "🎵 *CSONG USAGE*\n\n" +
          "`.csong Channel_Link, Song_Name`\n\n" +
          "*උදාහරණය:*\n" +
          "`.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, ma diha`"
        );
      }

      const channelInput = fullText.slice(0, comma).trim();
      const songQuery = fullText.slice(comma + 1).trim();

      if (!channelInput || !songQuery) {
        return await reply("❌ Channel link එක සහ Song name එක ඇතුළත් කරන්න.");
      }

      await reply(
        "⏳ *HESHAN OFC MUSIC*\n\n" +
        "🎵 Song එක සොයමින් පවතී...\n" +
        "🖼️ Poster සහ Voice Note Channel එකට සූදානම් කරනවා."
      );

      // 1. Channel JID
      const channelJid = await getChannelJid(sock, channelInput);

      // 2. YouTube Search
      let video;
      if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(songQuery)) {
        video = {
          url: songQuery.startsWith("http") ? songQuery : `https://${songQuery}`,
          title: songQuery,
          thumbnail: "",
          timestamp: "03:45"
        };
      } else {
        const search = await yts(songQuery);
        video = search?.videos?.[0];
        if (!video?.url) {
          throw new Error("YouTube හි සින්දුව හමු වුණේ නැහැ.");
        }
      }

      log("SEARCH", video.title || songQuery);

      // 3. New API Call
      const yt = await fetchYouTubeDownload(video.url);
      const title = yt.title || video.title || songQuery;
      const thumbnail = yt.thumbnail || video.thumbnail || "";
      const durationStr = video.timestamp || "03:45";

      // 4. Send Poster Card to Channel
      if (thumbnail) {
        try {
          const image = await downloadBuffer(thumbnail, MAX_IMAGE_SIZE);
          const caption = 
`│ 🎵⃝✨ H E S H A N   O F C   M U S I C

❖ TITLE : ${title}

01:23 ───🔘──────── ${durationStr}
⇄     ◁   ❚❚   ▷     ↻

➥ Don't forget to enjoy the song and leave a reaction! 🥰🎶

│ 🕊️ HESHAN OFC : SONG HUB`;

          await sock.sendMessage(channelJid, {
            image,
            caption
          });
          log("POSTER", "Card send completed");
        } catch (error) {
          log("POSTER ERROR", error.message);
        }
      }

      // 5. Download Audio & Convert to Opus Waveform PTT
      inputFile = path.join(os.tmpdir(), `csong_${crypto.randomUUID()}.bin`);
      outputFile = path.join(os.tmpdir(), `csong_${crypto.randomUUID()}.ogg`);

      const audioBuffer = await downloadBuffer(yt.downloadUrl, MAX_AUDIO_SIZE);
      fs.writeFileSync(inputFile, audioBuffer);
      log("AUDIO", `Downloaded ${audioBuffer.length} bytes`);

      await convertToOpus(inputFile, outputFile);
      const durationSeconds = await getAudioDuration(outputFile);
      const opusData = fs.readFileSync(outputFile);

      // Channel Waveform Bars
      const waveformBars = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        waveformBars[i] = Math.floor(Math.random() * 75) + 25;
      }

      // 6. Send Voice Note to Channel
      await sock.sendMessage(channelJid, {
        audio: opusData,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true,
        seconds: durationSeconds,
        waveform: waveformBars
      });
      log("AUDIO", "Voice Note send completed");

      await reply(
        "✅ *CSONG COMPLETED!*\n\n" +
        `🎵 *Title:* ${title}\n` +
        `⏱️ *Duration:* ${durationStr}\n\n` +
        "🖼️ Song Poster සහ 🎤 Voice Note සාර්ථකව Channel එකට Upload කරන ලදී."
      );
    } catch (error) {
      log("FATAL", error.stack || error.message);
      await reply(
        "❌ *CSONG FAILED*\n\n" +
        `${error.message || error}\n\n` +
        "_කරුණාකර Bot අදාළ Channel එකේ Admin ද සහ Link එක නිවැරදිදැයි බලන්න._"
      );
    } finally {
      cleanup(inputFile);
      cleanup(outputFile);
    }
  }
};
