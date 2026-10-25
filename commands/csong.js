import axios from "axios";
import ytSearch from "yt-search";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const MAX_SECONDS = 15 * 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Helpers ---------- */

// Direct YouTube MP3 APIs (100% High Availability)
async function getAudioDirect(videoUrl, title) {
  // 1. Siputzx API
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 25000 });
    const dl = res.data?.data?.dl || res.data?.dl || res.data?.result?.download?.url;
    if (dl) return dl;
  } catch (e) {}

  // 2. BK9 API
  try {
    const res = await axios.get(`https://bk9.fun/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 25000 });
    const dl = res.data?.BK9?.downloadUrl || res.data?.result?.downloadUrl || res.data?.result?.url;
    if (dl) return dl;
  } catch (e) {}

  // 3. Widipe / Vreden API
  try {
    const res = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 25000 });
    const dl = res.data?.result?.download?.url || res.data?.result?.url;
    if (dl) return dl;
  } catch (e) {}

  // 4. Chamindu API (Fallback)
  try {
    const res = await axios.get(
      `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(videoUrl)}&api_key=chama_api_9c55e3c6d014abbdf65054f9046a920b`,
      { timeout: 30000 }
    );
    const body = res.data?.result || res.data?.data || res.data;
    const dl = body?.download?.audio || body?.download_url || body?.audio?.url || body?.url;
    if (dl) return dl;
  } catch (e) {}

  return null;
}

const jidCache = new Map();

function extractCode(raw) {
  const m = String(raw).match(/channel\/([A-Za-z0-9_-]{15,})/i);
  if (m) return m[1].split(/[/?#]/)[0];
  const plain = String(raw).trim().split(/[/?\s#]/)[0];
  return plain.length >= 15 ? plain : null;
}

async function getChannelJid(sock, rawTarget, errors) {
  if (/@newsletter$/.test(rawTarget)) return rawTarget;

  const code = extractCode(rawTarget);
  if (!code) return "INVALID";
  if (jidCache.has(code)) return jidCache.get(code);

  const done = (jid) => { jidCache.set(code, jid); return jid; };

  if (typeof sock.newsletterMetadata === "function") {
    try {
      const res = await sock.newsletterMetadata("invite", code);
      if (res?.id) return done(res.id);
    } catch (e) {
      errors.push(`metadata: ${e?.message || e}`);
    }
  }

  return null;
}

function toOpus(inputBuffer) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const inFile = path.join(os.tmpdir(), `csong_${id}.in`);
    const outFile = path.join(os.tmpdir(), `csong_${id}.ogg`);
    const cleanup = () => {
      fs.unlink(inFile, () => {});
      fs.unlink(outFile, () => {});
    };

    fs.writeFileSync(inFile, inputBuffer);

    const ffmpegPath = ffmpegInstaller.path || "ffmpeg";

    const ff = spawn(ffmpegPath, [
      "-y", "-i", inFile,
      "-vn", "-map_metadata", "-1",
      "-c:a", "libopus", "-b:a", "48k", "-ar", "48000", "-ac", "1",
      "-f", "ogg", outFile,
    ]);

    ff.on("error", (err) => { cleanup(); reject(err); });
    ff.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outFile)) { 
        cleanup(); 
        return reject(new Error(`ffmpeg exit: ${code}`)); 
      }
      const out = fs.readFileSync(outFile);
      cleanup();
      resolve(out);
    });
  });
}

async function download(url, timeout = 90000) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout,
    maxContentLength: 80 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return Buffer.from(res.data);
}

function formatDuration(sec) {
  if (!sec) return "--:--";
  if (typeof sec === "string" && sec.includes(":")) return sec;
  const totalSeconds = parseInt(sec, 10);
  if (isNaN(totalSeconds)) return "--:--";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/* ---------- Command ---------- */

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send song card and voice note to WhatsApp channel",

  async execute({ sock, msg, from, args }) {
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
    const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});

    try {
      react("⏳");

      const fullText = args ? (Array.isArray(args) ? args.join(" ") : String(args)) : "";

      if (!fullText.includes(",")) {
        return await reply(
          "ℹ️ *භාවිතය:* `.csong channel_link, song_name`\n\n_උදා: .csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, lelena_"
        );
      }

      const commaIndex = fullText.indexOf(",");
      const rawTarget = fullText.slice(0, commaIndex).trim();
      const songQuery = fullText.slice(commaIndex + 1).trim();

      if (!songQuery) return await reply("❌ සින්දුවේ නම ඇතුළත් කරන්න.");

      // 1. Channel JID
      const lookupErrors = [];
      const channelJid = await getChannelJid(sock, rawTarget, lookupErrors);
      
      if (channelJid === "INVALID") {
        return await reply("❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න.");
      }
      if (!channelJid) {
        return await reply("❌ Channel එක සොයාගත නොහැකි විය. Bot එම Channel එකේ Admin ද බලන්න.");
      }

      // 2. YouTube Search
      const searchResult = await ytSearch(songQuery);
      const video = searchResult?.videos?.[0];
      if (!video) return await reply("❌ අදාළ නමින් සින්දුවක් හමු නොවීය.");
      if (video.seconds && video.seconds > MAX_SECONDS) {
        return await reply("❌ වීඩියෝව විනාඩි 15 ට වඩා දිග වැඩියි.");
      }

      // 3. Audio Direct Link ලබා ගැනීම
      const audioUrl = await getAudioDirect(video.url, video.title);
      if (!audioUrl) {
        return await reply("❌ මේ මොහොතේ Audio link එක ලබා ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.");
      }

      const title = video.title;
      const artist = video.author?.name || "Official Track";
      const duration = formatDuration(video.timestamp || video.seconds);
      const thumbnail = video.thumbnail;

      // 4. Audio Download & Opus PTT Conversion
      let audioBuffer = await download(audioUrl);
      let mimetype = "audio/ogg; codecs=opus";
      
      try {
        audioBuffer = await toOpus(audioBuffer);
      } catch (e) {
        console.error("Opus convert failed, fallback to mp4:", e.message);
        mimetype = "audio/mp4";
      }

      // 5. Clean Poster Card
      const cleanCard =
`🎶  *${title}*

🎤  *Artist* • ${artist}
⏱️  *Length* • ${duration}
📡  *Source* • YouTube

🎧  _Listen to the voice note below_`;

      let sentCard = false;
      if (thumbnail) {
        try {
          const imgBuffer = await download(thumbnail, 20000);
          await sock.sendMessage(channelJid, { image: imgBuffer, caption: cleanCard });
          sentCard = true;
        } catch (e) {}
      }
      if (!sentCard) {
        await sock.sendMessage(channelJid, { text: cleanCard });
      }

      await sleep(1000);

      // 6. Voice note (PTT)
      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype,
        ptt: true,
      });

      react("✔️");
      await reply(`✅ *Channel එකට සාර්ථකව Upload කරන ලදී!*\n\n🎵 *${title}*`);
    } catch (error) {
      console.error("CSong Error:", error);
      react("❌");
      await reply(`⚠️ Error එකක් ආවා: ${error?.message || error}`);
    }
  },
};
