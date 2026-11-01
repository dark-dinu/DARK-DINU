import axios from "axios";
import yts from "yt-search";
import { spawn } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const FFMPEG_PATH = ffmpegInstaller.path || "ffmpeg";

// ⚠️ හැකි නම් මේක env එකක දාන්න (CHAMA_API_KEY)
const API_KEY = process.env.CHAMA_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";

const CHANNEL_LINK_RE = /https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([0-9A-Za-z_-]+)/i;
const CHANNEL_JID_RE = /\b\d+@newsletter\b/i;

function isYouTubeUrl(input = "") {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(input);
}

// "link , song" / "link | song" / "link song" සියල්ලම support කරයි
function parseInput(text) {
  let channelInput = null;
  let rest = text;

  const jid = text.match(CHANNEL_JID_RE);
  const link = text.match(CHANNEL_LINK_RE);

  if (jid) {
    channelInput = jid[0];
    rest = text.replace(jid[0], "");
  } else if (link) {
    channelInput = link[0];
    rest = text.replace(link[0], "");
  }

  const songQuery = rest.replace(/^[\s,|]+|[\s,|]+$/g, "").trim();
  return { channelInput, songQuery };
}

async function resolveChannelJid(sock, input) {
  if (!input) return null;
  if (input.endsWith("@newsletter")) return input;

  const m = input.match(CHANNEL_LINK_RE);
  const code = m ? m[1] : input.trim();

  try {
    const meta = await sock.newsletterMetadata("invite", code);
    if (meta?.id) return meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
  } catch (e) {
    console.error("[CSONG] newsletterMetadata error:", e?.message);
  }
  return null;
}

// MP3 -> OGG/OPUS (WhatsApp voice note format)
function toOpus(buffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_PATH, [
      "-i", "pipe:0",
      "-vn",
      "-c:a", "libopus",
      "-b:a", "64k",
      "-ar", "48000",
      "-ac", "1",
      "-f", "ogg",
      "pipe:1"
    ]);
    const chunks = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.stderr.on("data", () => {});
    ff.on("error", reject);
    ff.stdin.on("error", () => {});
    ff.on("close", (code) => {
      const out = Buffer.concat(chunks);
      code === 0 && out.length ? resolve(out) : reject(new Error("ffmpeg convert failed"));
    });
    ff.stdin.end(buffer);
  });
}

async function downloadBuffer(url, timeout = 60000) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return Buffer.from(res.data);
}

export default {
  name: "csong",
  aliases: ["cplay", "channelplay", "channelsong", "cvoice"],
  category: "channel",
  description: "Send song card + voice note directly to WhatsApp Channels",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join(" ").trim();
    const isChannelChat = from.endsWith("@newsletter");

    let targetChannel = null;
    let songQuery = "";

    if (isChannelChat) {
      targetChannel = from;
      songQuery = fullText;
    } else {
      const parsed = parseInput(fullText);
      songQuery = parsed.songQuery;
      if (parsed.channelInput) {
        targetChannel = await resolveChannelJid(sock, parsed.channelInput);
        if (!targetChannel) {
          return await sock.sendMessage(
            from,
            { text: "⚠️ *චැනල් එක සොයාගත නොහැකි විය.* Link එක නිවැරදිදැයි පරීක්ෂා කරන්න." },
            { quoted: msg }
          );
        }
      }
    }

    if (!songQuery || !targetChannel) {
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text:
`╔═════════════════════════════╗
   🎙️ 𝐂 𝐇 𝐀 𝐍 𝐍 𝐄 𝐋  𝐒 𝐎 𝐍 𝐆
╚═════════════════════════════╝

💡 *භාවිතා කරන ආකාරය:*
• \`${pref}csong <channel_link>, <song_name>\`
• \`${pref}csong <song_name>\` (චැනල් එක ඇතුළතදී)

✨ *උදාහරණයක්:*
• \`${pref}csong https://whatsapp.com/channel/xxxx, Lelena\`

👑 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = songQuery;
      let title = "Audio Track";
      let duration = "03:15";
      let seconds = 0;
      let thumbUrl = null;
      let author = "";

      // 1. YouTube Search
      const search = await yts(songQuery);
      const first = search?.videos?.[0];

      if (first) {
        targetUrl = first.url;
        title = first.title || title;
        duration = first.timestamp || duration;
        seconds = first.seconds || 0;
        thumbUrl = first.thumbnail || first.image || null;
        author = first.author?.name || "";
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("ගීතය සොයාගත නොහැකි විය.");
      }

      // 2. API call
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(targetUrl)}&quality=320kbps&api_key=${API_KEY}`;
      const res = await axios.get(apiUrl, { timeout: 45000 });
      const d = res.data;

      const directAudioUrl =
        d?.download_url ||
        d?.data?.download_url ||
        d?.result?.download_url ||
        d?.url ||
        d?.data?.url;

      if (!directAudioUrl) throw new Error("Audio download link එකක් ලබා ගැනීමට නොහැකි විය.");

      // 3. Download audio + thumbnail (parallel)
      const [audioBuffer, thumbBuffer] = await Promise.all([
        downloadBuffer(directAudioUrl, 90000),
        thumbUrl ? downloadBuffer(thumbUrl, 20000).catch(() => null) : Promise.resolve(null)
      ]);

      // 4. Song card (image + caption) -> Channel
      const caption =
`🎶 ｡ﾟ•┈୨ *CHANNEL AUDIO STREAM* ୧┈•ﾟ｡ 🎙️
━━━━━━━━━━━━━━━━━━━━━

🎵 *Title:* ${title}
${author ? `🎤 *Artist:* ${author}\n` : ""}⏱️ *Duration:* ${duration}
⚡ *Bitrate:* 320kbps
📡 *Destination:* Channel Feed

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      if (thumbBuffer) {
        await sock.sendMessage(targetChannel, { image: thumbBuffer, caption });
      } else {
        await sock.sendMessage(targetChannel, { text: caption });
      }

      // 5. Voice note -> Channel (OGG/OPUS, ptt)
      try {
        const opus = await toOpus(audioBuffer);
        await sock.sendMessage(targetChannel, {
          audio: opus,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
          seconds
        });
      } catch (convErr) {
        console.error("[CSONG] opus convert failed, fallback mp3:", convErr.message);
        await sock.sendMessage(targetChannel, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false,
          seconds
        });
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      if (!isChannelChat) {
        await sock.sendMessage(
          from,
          { text: `✅ *සාර්ථකයි!* \`${title}\` චැනල් එකට Post කරන ලදී.` },
          { quoted: msg }
        );
      }
    } catch (err) {
      console.error("[CSONG ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ *අසාර්ථකයි:* ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
