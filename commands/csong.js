import axios from 'axios';
import yts from 'yt-search';
import { exec } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { delay } from '@whiskeysockets/baileys';

const ffmpegPath = ffmpegInstaller?.path || 'ffmpeg';

// Default WhatsApp Channel Link
const DEFAULT_CHANNEL = 'https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T';

// Active Chamindu API Key
const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || 'chama_api_9c55e3c6d014abbdf65054f9046a920b';

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

// ── Ultra-Fast Low CPU Opus Converter (Non-blocking Child Process) ──
function fastOpusConvert(inputBuffer) {
  return new Promise((resolve) => {
    const tempId = `${Date.now()}_${(Math.random() * 1e9) | 0}`;
    const tempIn = path.join(os.tmpdir(), `in_${tempId}.mp3`);
    const tempOut = path.join(os.tmpdir(), `out_${tempId}.ogg`);

    fs.writeFile(tempIn, inputBuffer, (err) => {
      if (err) return resolve(inputBuffer);

      // Fast single-pass mono libopus conversion (Instant)
      const cmd = `"${ffmpegPath}" -y -i "${tempIn}" -vn -c:a libopus -b:a 48k -ar 48000 -ac 1 "${tempOut}"`;

      exec(cmd, { timeout: 25000 }, (execErr) => {
        safeUnlink(tempIn);
        if (execErr) return resolve(inputBuffer);

        fs.readFile(tempOut, (readErr, outBuf) => {
          safeUnlink(tempOut);
          if (readErr || !outBuf) return resolve(inputBuffer);
          resolve(outBuf);
        });
      });
    });
  });
}

function getFastWaveform() {
  const bars = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    bars[i] = ((Math.random() * 65) | 0) + 15;
  }
  return bars;
}

async function resolveChannelJid(sock, channelInput) {
  let input = (channelInput || '').trim();
  if (input.endsWith('@newsletter')) return input;

  const match = input.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    const inviteCode = match[1].split('/')[0];
    if (typeof sock.newsletterMetadata === 'function') {
      try {
        const meta = await Promise.race([
          sock.newsletterMetadata('invite', inviteCode),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
        ]);
        if (meta?.id) return meta.id;
      } catch (_) {}
    }
    return `${inviteCode}@newsletter`;
  }
  return input;
}

// ── Chamindu Fast Stream Resolver ──
async function fetchYouTubeDownload(targetYoutubeUrl) {
  const enc = encodeURIComponent(targetYoutubeUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${enc}&api_key=${CHAMA_API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=128kbps&api_key=${CHAMA_API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const { data: res } = await axios.get(ep, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 12000
      });

      if (res) {
        const dl =
          res.data?.audio?.download_url ||
          res.data?.audio?.url ||
          res.data?.download_url ||
          res.data?.direct_url ||
          res.data?.url ||
          res.download_url ||
          res.direct_url;

        if (dl && typeof dl === 'string' && /^https?:\/\//i.test(dl)) {
          return {
            downloadUrl: dl,
            title: res.data?.title || res.title || '',
            thumbnail: res.data?.thumbnail || res.thumbnail || ''
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

  async execute({ sock, msg, from, args }) {
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

      // 1. API හරහා download url ලබා ගැනීම
      const ytData = await fetchYouTubeDownload(targetYoutubeUrl);

      if (!ytData?.downloadUrl) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ YouTube API එකෙන් download link එකක් ලබාගත නොහැකි විය.' }, { quoted: msg });
      }

      const finalTitle = ytData.title || searchedTitle;
      const finalThumb = ytData.thumbnail || searchedThumbnail;

      // 2. Audio & Thumbnail Buffers Parallel Download (High Speed)
      const [mediaRes, thumbRes] = await Promise.all([
        axios.get(ytData.downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 40000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }),
        finalThumb
          ? axios.get(finalThumb, { responseType: 'arraybuffer', timeout: 10000 }).catch(() => null)
          : Promise.resolve(null)
      ]);

      const mediaBuffer = Buffer.from(mediaRes.data);
      if (mediaBuffer.length < 5000) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ බාගත කළ ගොනුව දෝෂ සහිතයි.' }, { quoted: msg });
      }

      // 3. Post Image Card to Channel
      const songCardCaption =
`> *🎵⃝✨ H E S H A N   O F C   M U S I C* 

*❖ ᴛɪᴛʟᴇ :* ${finalTitle}

01:23 ───🔘──────── ${searchedDuration}
⇄     ◁   ❚❚   ▷     ↻

\`\`\`➥ Don't forget to enjoy the song and leave a reaction! 🥰🎶\`\`\`

> *🕊️ ʜᴇꜱʜᴀɴ ᴏꜰᴄ : ꜱᴏɴɢ ʜᴜʙ*`;

      if (thumbRes?.data) {
        await sock.sendMessage(targetChannelJid, {
          image: Buffer.from(thumbRes.data),
          caption: songCardCaption
        });
      } else {
        await sock.sendMessage(targetChannelJid, { text: songCardCaption });
      }

      // 4. Ultra-Fast Opus Voice Conversion
      const opusBuffer = await fastOpusConvert(mediaBuffer);

      await delay(1200);

      // 5. Post Voice Note (PTT) to Channel
      await sock.sendMessage(targetChannelJid, {
        audio: opusBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        waveform: getFastWaveform()
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
    }
  }
};
