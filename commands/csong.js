import axios from "axios";
import ytSearch from "yt-search";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// Hardcoded Chamindu API Key & Endpoints
const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const MAX_SECONDS = 15 * 60; // උපරිම විනාඩි 15

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Helpers ---------- */

function findAudioUrl(data) {
  const found = [];
  const walk = (node, keyPath) => {
    if (!node) return;
    if (typeof node === "string") {
      if (/^https?:\/\//i.test(node)) found.push({ url: node, key: keyPath.toLowerCase() });
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${keyPath}.${i}`));
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, `${keyPath}.${k}`);
    }
  };
  walk(data, "");

  const score = (f) => {
    let s = 0;
    if (/audio|mp3|m4a|aac|opus/.test(f.key)) s += 6;
    if (/download|dl|link/.test(f.key)) s += 3;
    if (/\.(mp3|m4a|aac|opus|ogg)(\?|$)/i.test(f.url)) s += 5;
    if (/thumb|image|avatar|poster|cover|channel|photo/.test(f.key)) s -= 12;
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(f.url)) s -= 12;
    if (/video|mp4/.test(f.key) && !/audio/.test(f.key)) s -= 4;
    return s;
  };

  found.sort((a, b) => score(b) - score(a));
  return found[0] && score(found[0]) > 0 ? found[0].url : null;
}

// Chamindu API එකෙන් කෙලින්ම Data ගැනීම (Secondary Fallbacks සහිතව)
async function fetchSongDetails(videoUrl, videoTitle) {
  // 1. Chamindu Toolkit API (Direct Hardcoded Key)
  try {
    const res = await axios.get(
      `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(videoUrl)}&api_key=${API_KEY}`,
      { timeout: 35000 }
    );
    const body = res.data?.result || res.data?.data || res.data;
    const directUrl = findAudioUrl(body);
    if (directUrl) {
      return {
        audioUrl: directUrl,
        title: body?.title || videoTitle,
        artist: body?.author?.name || body?.author || "YouTube Artist",
        thumbnail: typeof body?.thumbnail === "string" ? body.thumbnail : null,
        duration: body?.duration || null
      };
    }
  } catch (e) {
    console.error("Chamindu API error:", e?.response?.data || e.message);
  }

  // 2. Backup Fallback 1: Vreden Play API
  try {
    const res = await axios.get(`https://api.vreden.my.id/api/ytplaymp3?query=${encodeURIComponent(videoTitle)}`, { timeout: 30000 });
    const result = res.data?.result;
    if (result?.download?.url) {
      return {
        audioUrl: result.download.url,
        title: result.title || videoTitle,
        artist: result.author?.name || "YouTube Artist",
        thumbnail: result.thumbnail || null,
        duration: result.duration || null
      };
    }
  } catch (e) {
    console.error("Vreden backup error:", e?.message || e);
  }

  // 3. Backup Fallback 2: David Cyril API
  try {
    const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 30000 });
    const result = res.data?.result;
    if (result?.download_url) {
      return {
        audioUrl: result.download_url,
        title: result.title || videoTitle,
        artist: "YouTube Artist",
        thumbnail: null,
        duration: null
      };
    }
  } catch (e) {
    console.error("David Cyril backup error:", e?.message || e);
  }

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
      errors.push(`metadata error: ${e?.message || e}`);
    }
  } else {
    errors.push("sock.newsletterMetadata ශ්‍රිතය හමු නොවීය");
  }

  return null;
}

// @ffmpeg-installer/ffmpeg path එක මඟින් නිවැරදිව Opus Voice Note එකකට හැරවීම
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
        return reject(new Error(`ffmpeg exit code: ${code}`)); 
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

      // 1. Channel JID හඳුනා ගැනීම
      const lookupErrors = [];
      const channelJid = await getChannelJid(sock, rawTarget, lookupErrors);
      
      if (channelJid === "INVALID") {
        return await reply("❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න.");
      }
      
      if (!channelJid) {
        return await reply(
          `❌ Channel එක සොයාගත නොහැකි විය.\n\n_දෝෂය:_ ${lookupErrors.join("\n") || "Unknown"}\n\n*සටහන:* Bot එම Channel එකේ Admin ද සහ Link එක නිවැරදිදැයි බලන්න.`
        );
      }

      // 2. YouTube Search
      const searchResult = await ytSearch(songQuery);
      const video = searchResult?.videos?.[0];
      if (!video) return await reply("❌ අදාළ නමින් සින්දුවක් හමු නොවීය.");
      if (video.seconds && video.seconds > MAX_SECONDS) {
        return await reply("❌ මේ වීඩියෝව විනාඩි 15 ට වඩා දිග වැඩියි.");
      }

      // 3. Audio & Details ලබා ගැනීම
      const songData = await fetchSongDetails(video.url, video.title);
      if (!songData || !songData.audioUrl) {
        return await reply("❌ මේ මොහොතේ Audio link එක ලබා ගැනීමට නොහැකි විය.");
      }

      const title = songData.title || video.title;
      const artist = songData.artist || video.author?.name || "Official Track";
      const duration = formatDuration(songData.duration || video.seconds || video.timestamp);
      const thumbnail = songData.thumbnail || video.thumbnail;

      // 4. Download & Voice Note Conversion
      let audioBuffer = await download(songData.audioUrl);
      let mimetype = "audio/ogg; codecs=opus";
      
      try {
        audioBuffer = await toOpus(audioBuffer);
      } catch (e) {
        console.error("Opus convert failed, fallback to audio/mp4:", e.message);
        mimetype = "audio/mp4";
      }

      // 5. Clean Card එක Channel එකට යැවීම
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
        } catch (e) {
          console.error("Thumbnail send failed:", e?.message || e);
        }
      }
      if (!sentCard) {
        await sock.sendMessage(channelJid, { text: cleanCard });
      }

      await sleep(1000);

      // 6. Voice note (PTT Waveform) Channel එකට යැවීම
      try {
        await sock.sendMessage(channelJid, {
          audio: audioBuffer,
          mimetype,
          ptt: true,
        });
      } catch (sendErr) {
        throw new Error(`Channel එකට Voice Note යැවීමට නොහැකි විය (Bot Admin ද බලන්න): ${sendErr.message}`);
      }

      react("✔️");
      await reply(`✅ *Channel එකට සාර්ථකව Upload කරන ලදී!*\n\n🎵 *${title}*`);
    } catch (error) {
      console.error("CSong Final Error:", error);
      react("❌");
      await reply(`⚠️ Error එකක් ආවා: ${error?.message || error}`);
    }
  },
};
