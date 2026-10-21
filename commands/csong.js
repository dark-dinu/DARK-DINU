import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { Readable, PassThrough } from "stream";

// FFmpeg path එක සකස් කිරීම
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Audio එක PTT Opus (OGG) බවට හරවන function එක
const toPTT = (buffer) => {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(buffer);
    inputStream.push(null);

    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", (err) => reject(err));

    ffmpeg(inputStream)
      .noVideo()
      .audioCodec("libopus")
      .format("ogg")
      .audioBitrate("64k")
      .outputOptions([
        "-avoid_negative_ts make_zero",
        "-map_metadata -1"
      ])
      .on("error", (err) => reject(err))
      .pipe(outputStream);
  });
};

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send song card and real PTT voice note directly to a WhatsApp Channel",

  async execute({ sock, msg, from, text, args }) {
    const botName = "ʜᴇꜱʜᴀɴ ᴏꜰᴄ";
    const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";

    const raw = text || (args && args.join(" ")) || "";

    // 1. Channel link එකෙන් invite code එක සහ Song name එක වෙන් කර ගැනීම
    const channelMatch = raw.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/i);

    if (!channelMatch) {
      return await sock.sendMessage(
        from,
        {
          text: `❗ *Channel Link එකක් හමු නොවුණි!*\n\n> උදා: \`.csong https://whatsapp.com/channel/0029Vb9GVpd0wajsDAReUJ2k, lelena\``
        },
        { quoted: msg }
      );
    }

    const inviteCode = channelMatch[1];
    const songName = raw.replace(channelMatch[0], "").replace(/^[,\s]+/, "").trim();

    if (!songName) {
      return await sock.sendMessage(
        from,
        { text: "❗ *කරුණාකර සින්දුවේ නම ලබාදෙන්න!*" },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // 2. Channel JID එක ලබා ගැනීම
      let channelJid = "";
      try {
        const metadata = await sock.newsletterMetadata("invite", inviteCode);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(
          from,
          { text: `❌ *Channel එක සොයාගත නොහැක:* ${e.message || e}` },
          { quoted: msg }
        );
      }

      // 3. API එකෙන් සින්දුව ලබා ගැනීම
      const res = await axios.get(`https://api.chamindu.xyz/api/v1/download/ytmp3`, {
        params: {
          q: songName,
          apiKey: API_KEY
        },
        timeout: 30000
      });

      const result = res.data?.result || res.data?.data || res.data;
      const title = result.title || songName;
      const duration = result.timestamp || result.duration || "03:45";
      const thumbnail = result.thumbnail || result.image || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600";
      const audioUrl = result.download?.url || result.download_url || result.dl_url || result.url;

      if (!audioUrl) {
        throw new Error("API එකෙන් Audio Link එකක් හමු නොවුණි.");
      }

      // 4. Clean Music Card එක Channel එකට යැවීම
      const captionText = 
`🥰⃝🎶 *“ ${title} ”*

0:00 ◁◁  II  ▷▷ ${duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

☘️ *${botName}*`;

      await sock.sendMessage(channelJid, {
        image: { url: thumbnail },
        caption: captionText
      });

      // 5. Audio එක download කර PTT (Voice Note) බවට convert කිරීම
      const rawAudio = await axios.get(audioUrl, { responseType: "arraybuffer" });
      const pttBuffer = await toPTT(Buffer.from(rawAudio.data));

      // 6. Voice Note (PTT Waveform) එකක් ලෙස Channel එකට යැවීම
      await sock.sendMessage(channelJid, {
        audio: pttBuffer,
        mimetype: "audio/ogg; codecs=opus",
        ptt: true
      });

      // සාර්ථක පණිවිඩය
      await sock.sendMessage(
        from,
        { text: `✅ *සින්දුව සාර්ථකව Voice Note එකක් ලෙස Channel එකට යවන ලදී!*\n\n🎵 *Song:* ${title}` },
        { quoted: msg }
      );

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("CSONG ERROR:", error);
      await sock.sendMessage(
        from,
        { text: `❌ *දෝෂය:* ${error.response?.data?.message || error.message || error}` },
        { quoted: msg }
      );
    }
  }
};
