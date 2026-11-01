import fs from "fs";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_9c55e3c6d014abbdf65054f9046a920b";
const API_TIMEOUT = 25000;
const DL_TIMEOUT = 45000;
const TEMP_DIR = path.join(process.cwd(), "temp");

try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch (_) {}

// Channel JID cache: වෙනම metadata call එක එක පාරක් විතරක්
const channelCache = new Map();

function convertToOpusPtt(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libopus")
      .audioChannels(1)
      .audioFrequency(48000)
      .audioBitrate("64k")
      .format("ogg")
      .outputOptions(["-application", "voip"])
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
}

function isYouTubeUrl(input = "") {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(input);
}

function extractInviteCode(input = "") {
  const match = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)/i);
  return match ? match[1] : input.trim();
}

async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const clean = input.trim();
  if (clean.endsWith("@newsletter")) return clean;

  const code = extractInviteCode(clean);
  if (channelCache.has(code)) return channelCache.get(code);

  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) {
        const jid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        channelCache.set(code, jid);
        return jid;
      }
    }
  } catch (_) {}
  return null;
}

// Channel එකට voice note යවීම: පළමු direct upload, අසාර්ථක වුණොත් පැරණි forward relay එක
async function sendVoiceToChannel(sock, targetChannel, audioBuffer) {
  try {
    const sent = await sock.sendMessage(targetChannel, {
      audio: audioBuffer,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true
    });
    if (sent?.key?.id) return sent;
    throw new Error("channel upload key නොලැබුණි");
  } catch (directErr) {
    console.error("[CSONG] direct upload failed, using relay:", directErr.message);
    const myJid = sock.user.id.includes(":")
      ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
      : sock.user.id;
    const inbox = await sock.sendMessage(myJid, {
      audio: audioBuffer,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true
    });
    const sent = await sock.sendMessage(targetChannel, { forward: inbox });
    if (!sent?.key?.id) throw new Error("Channel එකට යැවීම තහවුරු කළ නොහැකි විය.");
    return sent;
  }
}

export default {
  name: "csong",
  aliases: ["cplay", "channelplay", "channelsong", "cvoice"],
  category: "channel",
  description: "Send playable Voice Note to WhatsApp Channels",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join(" ").trim();
    const isChannelChat = from.endsWith("@newsletter");

    let targetChannel = isChannelChat ? from : null;
    let songQuery = fullText;

    if (!isChannelChat) {
      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        targetChannel = await resolveChannelJid(sock, parts[0].trim());
        songQuery = parts.slice(1).join("|").trim();
      } else {
        const firstArg = args[0] || "";
        if (firstArg.includes("whatsapp.com/channel/") || firstArg.endsWith("@newsletter")) {
          targetChannel = await resolveChannelJid(sock, firstArg);
          songQuery = args.slice(1).join(" ").trim();
        }
      }
    }

    if (!songQuery || (!targetChannel && !isChannelChat)) {
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text:
`🎙️ *CHANNEL VOICE*
💡 \`${pref}csong <channel_link> | <song_name>\`
✨ \`${pref}csong https://whatsapp.com/channel/xxxx | Lelena\`
👑 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const stamp = Date.now();
    const rawPath = path.join(TEMP_DIR, `raw_${stamp}.mp3`);
    const opusPath = path.join(TEMP_DIR, `ptt_${stamp}.ogg`);

    try {
      // 1. Search
      let targetUrl = songQuery;
      let title = "Voice Track";
      let duration = "";

      const search = await yts(songQuery);
      const first = search?.videos?.[0];
      if (first) {
        targetUrl = first.url;
        title = first.title || title;
        duration = first.timestamp || "";
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("YouTube වෙතින් ගීතය සොයාගත නොහැකි විය.");
      }

      // 2. Download link
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(targetUrl)}&quality=320kbps&api_key=${API_KEY}`;
      const { data: dl } = await axios.get(apiUrl, { timeout: API_TIMEOUT });
      const audioUrl =
        dl?.download_url || dl?.data?.download_url || dl?.result?.download_url ||
        dl?.url || dl?.data?.url;
      if (!audioUrl) throw new Error("Audio download link එකක් ලබා ගැනීමට නොහැකි විය.");

      // 3. Download + convert
      const audioRes = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: DL_TIMEOUT,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      fs.writeFileSync(rawPath, Buffer.from(audioRes.data));
      await convertToOpusPtt(rawPath, opusPath);
      const voiceBuffer = fs.readFileSync(opusPath);

      // 4. Channel එකට voice note (sent receipt එක තහවුරු කරයි)
      await sendVoiceToChannel(sock, targetChannel, voiceBuffer);

      // 5. Text card (voice note එකට පසු)
      await sock.sendMessage(targetChannel, {
        text:
`🎶 *CHANNEL VOICE TRACK* 🎙️
━━━━━━━━━━━━━━━━━━━━━
🎵 *Title:* ${title}${duration ? `\n⏱️ *Duration:* ${duration}` : ""}
⚡ *Format:* Opus Voice Note
━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD*`
      });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      if (!isChannelChat) {
        await sock.sendMessage(
          from,
          { text: `✅ *සාර්ථකයි!* \`${title}\` චැනල් එකට යැවිණි.` },
          { quoted: msg }
        );
      }
    } catch (err) {
      console.error("[CSONG ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `⚠️ *අසාර්ථකයි:* ${err.message}` }, { quoted: msg });
    } finally {
      for (const p of [rawPath, opusPath]) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
      }
    }
  }
};
