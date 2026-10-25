import axios from "axios";
import ytSearch from "yt-search";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";
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

// Multi-API Fetch Engine (Chamindu -> Vreden -> David Cyril)
async function fetchSongDetails(videoUrl, videoTitle) {
  // 1. Chamindu Toolkit API
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
    console.error("Chamindu API primary failed:", e?.response?.data || e.message);
  }

  // 2. Backup API 1: Vreden Play API
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
    console.error("Vreden backup failed:", e?.message || e);
  }

  // 3. Backup API 2: David Cyril API
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
    console.error("David Cyril backup failed:", e?.message || e);
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

function findNewsletterId(obj) {
  let out = null;
  const walk = (n) => {
    if (out || !n) return;
    if (typeof n === "string") {
      const m = n.match(/(\d{15,}@newsletter)/);
      if (m) out = m[1];
      return;
    }
    if (typeof n === "object") Object.values(n).forEach(walk);
  };
  walk(obj);
  return out;
}

async function rawInviteQuery(sock, code) {
  const queryIds = ["6563316087068696", "9926858900719341", "6620195908089573"];
  let lastErr;
  for (const id of queryIds) {
    try {
      const payload = {
        variables: {
          input: { key: code, type: "INVITE", view_role: "GUEST" },
          fetch_viewer_metadata: true,
          fetch_full_image: true,
          fetch_creation_time: true,
        },
      };
      const result = await sock.query({
        tag: "iq",
        attrs: { to: "s.whatsapp.net", type: "get", xmlns: "w:mex" },
        content: [{ tag: "query", attrs: { query_id: id }, content: Buffer.from(JSON.stringify(payload)) }],
      });
      const child = (result?.content || []).find((c) => c.tag === "result");
      const json = JSON.parse(child.content.toString());
      const jid = findNewsletterId(json);
      if (jid) return jid;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("raw query: JID not found");
}

async function getChannelJid(sock, rawTarget, errors) {
  if (/@newsletter$/.test(rawTarget)) return rawTarget;

  const code = extractCode(rawTarget);
  if (!code) return "INVALID";
  if (jidCache.has(code)) return jidCache.get(code);

  const done = (jid) => { jidCache.set(code, jid); return jid; };

  // 1. Baileys newsletterMetadata
  if (typeof sock.newsletterMetadata === "function") {
    for (const call of [
      () => sock.newsletterMetadata("invite", code),
      () => sock.newsletterMetadata("INVITE", code),
      () => sock.newsletterMetadata(code),
    ]) {
      try {
        const res = await call();
        const jid = res?.id || findNewsletterId(res);
        if (jid) return done(jid);
      } catch (e) {
        errors.push(`metadata: ${e?.message || e}`);
      }
    }
  } else {
    errors.push("sock.newsletterMetadata function not found");
  }

  // 2. Raw WMex query fallback
  try {
    const jid = await rawInviteQuery(sock, code);
    if (jid) return done(jid);
  } catch (e) {
    errors.push(`raw: ${e?.message || e}`);
  }

  // 3. Web HTML Scraping fallback
  try {
    const page = await axios.get(`https://whatsapp.com/channel/${code}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      timeout: 15000,
    });
    const jid = findNewsletterId(String(page.data));
    if (jid) return done(jid);
    errors.push("web: JID not found in markup");
  } catch (e) {
    errors.push(`web: ${e?.message || e}`);
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
    maxContentLength: 80 * 1024 * 1024,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  return Buffer.from(res.data);
}

/* ---------- Command Implementation ---------- */

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
      const lookupErrors = [];
      const channelJid = await getChannelJid(sock, rawTarget, lookupErrors);
      if (channelJid === "INVALID") return await reply("❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න.");
      if (!channelJid) {
        return await reply(
          "❌ Channel එක හඳුනාගත නොහැකි විය.\n\n_හේතුව:_ Bot එම Channel එකේ Admin බව සහ Link එක නිවැරදි බව පරීක්ෂා කරන්න."
        );
      }

      // 2. YouTube Search
      const searchResult = await ytSearch(songQuery);
      const video = searchResult?.videos?.[0];
      if (!video) return await reply("❌ අදාළ නමින් සින්දුවක් හමු නොවීය.");
      if (video.seconds && video.seconds > MAX_SECONDS) {
        return await reply("❌ මේ වීඩියෝව විනාඩි 15 ට වඩා දිග වැඩියි.");
      }

      // 3. API Engine එකෙන් Song Data & Audio URL ලබාගැනීම
      const songData = await fetchSongDetails(video.url, video.title);
      if (!songData || !songData.audioUrl) {
        return await reply("❌ මේ මොහොතේ සින්දුවේ Audio එක ලබා ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.");
      }

      const title = songData.title || video.title;
      const artist = songData.artist || video.author?.name || "Official Track";
      const duration = songData.duration || video.timestamp || "--:--";
      const thumbnail = songData.thumbnail || video.thumbnail;

      // 4. Audio Download කර Voice Note (Opus) එකට Convert කිරීම
      let audioBuffer = await download(songData.audioUrl);
      let mimetype = "audio/ogg; codecs=opus";
      try {
        audioBuffer = await toOpus(audioBuffer);
      } catch (e) {
        console.error("FFmpeg not available or failed, falling back to mp4:", e.message);
        mimetype = "audio/mp4";
      }

      // 5. Clean Poster Card එක Channel එකට යැවීම
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
      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype,
        ptt: true,
      });

      react("✔️");
      await reply(`✅ *Channel එකට සාර්ථකව Upload කරන ලදී!*\n\n🎵 *${title}*`);
    } catch (error) {
      console.error("CSong Final Error:", error);
      react("❌");
      await reply(`⚠️ Error එකක් ආවා: ${error?.response?.data?.message || error.message || error}`);
    }
  },
};
