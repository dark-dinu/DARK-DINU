import axios from "axios";
import ytSearch from "yt-search";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const CHAMINDU_API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const MAX_SECONDS = 15 * 60; // 15 minutes limit

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
    if (/audio|mp3|m4a|aac|opus/.test(f.key)) s += 5;
    if (/download|dl/.test(f.key)) s += 3;
    if (/\.(mp3|m4a|aac|opus|ogg)(\?|$)/i.test(f.url)) s += 4;
    if (/thumb|image|avatar|poster|cover|channel/.test(f.key)) s -= 10;
    if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(f.url)) s -= 10;
    if (/video|mp4/.test(f.key) && !/audio/.test(f.key)) s -= 4;
    return s;
  };

  found.sort((a, b) => score(b) - score(a));
  return found[0] && score(found[0]) > 0 ? found[0].url : null;
}

// Multi-API Fetch Engine (Chamindu -> Vreden -> DavidCyril)
async function fetchSongData(videoUrl, videoTitle) {
  // 1. Chamindu API
  try {
    const res = await axios.get(
      `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(videoUrl)}&api_key=${CHAMINDU_API_KEY}`,
      { timeout: 35000 }
    );
    const audio = findAudioUrl(res.data?.result || res.data?.data || res.data);
    if (audio) {
      const d = res.data?.result || res.data?.data || res.data;
      return {
        audioUrl: audio,
        title: d?.title || videoTitle,
        artist: d?.author?.name || d?.author || "YouTube Track",
        thumbnail: d?.thumbnail || null,
        duration: d?.duration || null
      };
    }
  } catch (e) {
    console.error("Chamindu API error:", e?.message || e);
  }

  // 2. Fallback: Vreden API
  try {
    const res = await axios.get(`https://api.vreden.my.id/api/ytplaymp3?query=${encodeURIComponent(videoTitle)}`, { timeout: 35000 });
    const r = res.data?.result;
    if (r?.download?.url) {
      return {
        audioUrl: r.download.url,
        title: r.title || videoTitle,
        artist: r.author?.name || "YouTube Track",
        thumbnail: r.thumbnail || null,
        duration: r.duration || null
      };
    }
  } catch (e) {
    console.error("Vreden API error:", e?.message || e);
  }

  // 3. Fallback: David Cyril API
  try {
    const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 35000 });
    const r = res.data?.result;
    if (r?.download_url) {
      return {
        audioUrl: r.download_url,
        title: r.title || videoTitle,
        artist: "YouTube Track",
        thumbnail: null,
        duration: null
      };
    }
  } catch (e) {
    console.error("David Cyril API error:", e?.message || e);
  }

  return null;
}

async function getChannelJid(sock, rawTarget) {
  if (rawTarget.endsWith("@newsletter")) return rawTarget;

  const code = rawTarget
    .replace(/https?:\/\/(www\.)?whatsapp\.com\/channel\//i, "")
    .split("/")[0]
    .split("?")[0]
    .trim();

  if (!code || code.length < 15) return "INVALID";

  // 1. Baileys official
  try {
    const res = await sock.newsletterMetadata("invite", code);
    if (res?.id) return res.id;
  } catch (e) {
    console.error("newsletterMetadata error:", e?.message || e);
  }

  // 2. Web page scrape fallback
  try {
    const page = await axios.get(`https://whatsapp.com/channel/${code}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
    });
    const m =
      String(page.data).match(/(120363\d+@newsletter)/i) ||
      String(page.data).match(/newsletter_jid&quot;:&quot;(\d+)&quot;/i);
    if (m) return m[1].includes("@") ? m[1] : `${m[1]}@newsletter`;
  } catch (e) {
    console.error("Scrape fallback failed:", e?.message || e);
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

    const ff = spawn("ffmpeg", [
      "-y", "-i", inFile,
      "-vn", "-map_metadata", "-1",
      "-c:a", "libopus", "-b:a", "48k", "-ar", "48000", "-ac", "1",
      "-f", "ogg", outFile,
    ]);

    ff.on("error", (err) => { cleanup(); reject(err); });
    ff.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outFile)) { cleanup(); return reject(new Error(`ffmpeg exit ${code}`)); }
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
    maxContentLength: 70 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return Buffer.from(res.data);
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

      // 1. Channel JID සොයා ගැනීම
      const channelJid = await getChannelJid(sock, rawTarget);
      if (channelJid === "INVALID") return await reply("❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න.");
      if (!channelJid) {
        return await reply("❌ Channel එක සොයාගත නොහැකි විය. Link එක නිවැරදිද සහ Bot එම Channel එකේ Admin කෙනෙක්දැයි බලන්න.");
      }

      // 2. YouTube Search
      const searchResult = await ytSearch(songQuery);
      const video = searchResult?.videos?.[0];
      if (!video) return await reply("❌ අදාළ නමින් සින්දුවක් හමු නොවීය.");
      if (video.seconds && video.seconds > MAX_SECONDS) {
        return await reply("❌ වීඩියෝව විනාඩි 15 ට වඩා දිග වැඩියි.");
      }

      // 3. Multi-API Engine එක හරහා Audio ලබා ගැනීම
      const songInfo = await fetchSongData(video.url, video.title);

      if (!songInfo || !songInfo.audioUrl) {
        return await reply("❌ මේ මොහොතේ සින්දුවේ Audio එක Download කර ගැනීමට නොහැකි විය. පසුව උත්සාහ කරන්න.");
      }

      const title = songInfo.title || video.title;
      const artist = songInfo.artist || video.author?.name || "Official Track";
      const duration = songInfo.duration || video.timestamp || "--:--";
      const thumbnail = songInfo.thumbnail || video.thumbnail;

      // 4. Audio Download + Voice Note (Opus) Convert
      let audioBuffer = await download(songInfo.audioUrl);
      let mimetype = "audio/ogg; codecs=opus";
      try {
        audioBuffer = await toOpus(audioBuffer);
      } catch (e) {
        console.error("ffmpeg convert failed, fallback to original m4a/mp3:", e.message);
        mimetype = "audio/mp4";
      }

      // 5. Clean Poster Card -> Channel
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
      if (!sentCard) await sock.sendMessage(channelJid, { text: cleanCard });

      await sleep(800);

      // 6. Voice note (PTT) -> Channel
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
      await reply(`⚠️ Error එකක් ආවා: ${error?.response?.data?.message || error.message || error}`);
    }
  },
};
