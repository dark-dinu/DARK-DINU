import axios from 'axios';
import yts from 'yt-search';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { delay } from '@whiskeysockets/baileys';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Default WhatsApp Channel Link
const DEFAULT_CHANNEL = 'https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T';

// Active Chamindu API Key (.env එකෙන් හෝ direct key එකෙන් ගනී)
const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || 'chama_api_9c55e3c6d014abbdf65054f9046a920b';

function getDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.format?.duration) return resolve(60);
      resolve(Math.round(metadata.format.duration));
    });
  });
}

function convertToOpus(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libopus')
      .audioChannels(1)
      .audioFrequency(48000)
      .audioBitrate('64k')
      .format('ogg')
      .outputOptions([
        '-avoid_negative_ts make_zero',
        '-map_metadata -1'
      ])
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

async function resolveChannelJid(sock, channelInput) {
  let input = (channelInput || '').trim();
  if (input.endsWith('@newsletter')) return input;

  const match = input.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    const inviteCode = match[1].split('/')[0];
    if (typeof sock.newsletterMetadata === 'function') {
      try {
        const meta = await sock.newsletterMetadata('invite', inviteCode);
        if (meta?.id) return meta.id;
      } catch (e) {
        console.error('Newsletter meta error:', e.message);
      }
    }
    return `${inviteCode}@newsletter`;
  }
  return input;
}

// ── Chamindu Toolkit API Stream Resolver ──
async function fetchYouTubeDownload(targetYoutubeUrl) {
  const enc = encodeURIComponent(targetYoutubeUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${enc}&api_key=${CHAMA_API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=320kbps&api_key=${CHAMA_API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${CHAMA_API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const { data: res } = await axios.get(ep, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 20000
      });

      if (res) {
        const dl =
          res.data?.audio?.download_url ||
          res.data?.audio?.url ||
          res.data?.download_url ||
          res.data?.direct_url ||
          res.data?.url ||
          res.download_url ||
          res.direct_url ||
          res.result?.download_url ||
          res.result?.url ||
          res.url;

        if (dl && typeof dl === 'string' && /^https?:\/\//i.test(dl)) {
          return {
            downloadUrl: dl,
            title: res.data?.title || res.title || res.result?.title || '',
            thumbnail: res.data?.thumbnail || res.thumbnail || res.result?.thumbnail || ''
          };
        }
      }
    } catch (_) {}
  }

  return null;
}

export default {
  name: 'csong',
  desc: 'Send YouTube song as card and playable voice note to a channel',
  category: 'channel',

  async execute({ sock, msg, from, args, config }) {
    const fullText = (args || []).join(' ').trim();
    const quotedText =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      '';

    const input = fullText || quotedText;

    if (!input) {
      return await sock.sendMessage(
        from,
        {
          text:
            `⚠️ *භාවිතය:*\n\n` +
            `1️⃣ *Default Channel:* \`.csong <Song Name or YouTube Link>\`\n` +
            `2️⃣ *Custom Channel:* \`.csong <Channel Link>, <Song Name or YouTube Link>\``
        },
        { quoted: msg }
      );
    }

    let channelInput = DEFAULT_CHANNEL;
    let songQuery = input;

    if (input.includes(',')) {
      const parts = input.split(',');
      channelInput = parts[0].trim();
      songQuery = parts.slice(1).join(',').trim();
    }

    // Reaction
    sock.sendMessage(from, { react: { text: '🎶', key: msg.key } }).catch(() => {});

    const tempDir = os.tmpdir();
    const tempInputFile = path.join(tempDir, `raw_${Date.now()}.bin`);
    const tempOutputFile = path.join(tempDir, `vn_${Date.now()}.ogg`);

    try {
      const targetChannelJid = await resolveChannelJid(sock, channelInput);

      let targetYoutubeUrl = songQuery;
      let searchedTitle = songQuery;
      let searchedThumbnail = '';
      let searchedDuration = '03:45';

      const isYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(songQuery);

      if (!isYoutubeUrl) {
        const searchResult = await yts(songQuery);
        if (!searchResult?.videos?.length) {
          sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, { text: '❌ සින්දුව YouTube හි සොයාගත නොහැකි විය.' }, { quoted: msg });
        }
        const video = searchResult.videos[0];
        targetYoutubeUrl = video.url;
        searchedTitle = video.title;
        searchedThumbnail = video.thumbnail;
        searchedDuration = video.timestamp || '03:45';
      }

      // API හරහා download link එක ලබා ගැනීම
      const ytData = await fetchYouTubeDownload(targetYoutubeUrl);

      if (!ytData?.downloadUrl) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ YouTube API එකෙන් download link එකක් ලබාගත නොහැකි විය.' }, { quoted: msg });
      }

      const finalTitle = ytData.title || searchedTitle;
      const finalThumbnail = ytData.thumbnail || searchedThumbnail;

      // 1. Send Song Card Image to Channel
      const songCardCaption =
`> *🎵⃝✨ H E S H A N   O F C   M U S I C* 

*❖ ᴛɪᴛʟᴇ :* ${finalTitle}

01:23 ───🔘──────── ${searchedDuration}
⇄     ◁   ❚❚   ▷     ↻

\`\`\`➥ Don't forget to enjoy the song and leave a reaction! 🥰🎶\`\`\`

> *🕊️ ʜᴇꜱʜᴀɴ ᴏꜰᴄ : ꜱᴏɴɢ ʜᴜʙ*`;

      if (finalThumbnail) {
        await sock.sendMessage(targetChannelJid, {
          image: { url: finalThumbnail },
          caption: songCardCaption
        });
      }

      // 2. Download Media Buffer
      const fileResponse = await axios({
        url: ytData.downloadUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': '*/*'
        }
      });

      const mediaBuffer = Buffer.from(fileResponse.data);

      if (mediaBuffer.length < 10000) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ බාගත කළ Audio file එක දෝෂ සහිතයි. නැවත උත්සාහ කරන්න.' }, { quoted: msg });
      }

      fs.writeFileSync(tempInputFile, mediaBuffer);

      // 3. Convert to WhatsApp Opus PTT
      await convertToOpus(tempInputFile, tempOutputFile);
      const audioSeconds = await getDuration(tempOutputFile);

      // 4. Generate Waveform Bars
      const dummyWaveform = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        dummyWaveform[i] = Math.floor(Math.random() * 80) + 20;
      }

      const opusBuffer = fs.readFileSync(tempOutputFile);

      // Channel dispatch delay
      await delay(1500);

      // 5. Send Playable Voice Note (PTT) to Channel
      await sock.sendMessage(targetChannelJid, {
        audio: opusBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        seconds: audioSeconds,
        waveform: dummyWaveform
      });

      sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `✅ *Success!* Song card එක සහ Voice note එක Channel එකට සාර්ථකව Post කරන ලදී.` },
        { quoted: msg }
      );

    } catch (error) {
      console.error('Csong Error:', error);
      sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ දෝෂයක් සිදුවිය: ${error.message}` }, { quoted: msg });
    } finally {
      if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
      if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
    }
  }
};
