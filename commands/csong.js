import axios from 'axios';
import yts from 'yt-search';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const DEFAULT_CHANNEL = 'https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T';
const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || 'chama_api_9c55e3c6d014abbdf65054f9046a920b';

function convertToAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .format('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

// 🔴 Fix: /827 වගේ post id තිබුණත් clean channel ID එකම ගන්නා function එක
async function resolveChannelJid(sock, channelInput) {
  let input = (channelInput || '').trim();
  if (input.endsWith('@newsletter')) return input;

  // regex එකෙන් / අග තියෙන post id කපා channel code එක පමණක් ගනී
  const match = input.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]{20,28})/i);
  const inviteCode = match ? match[1] : input.split('/').filter(Boolean).pop();

  if (inviteCode && typeof sock.newsletterMetadata === 'function') {
    try {
      const meta = await sock.newsletterMetadata('invite', inviteCode);
      if (meta?.id) return meta.id;
    } catch (e) {
      console.error('[NEWSLETTER META ERROR]:', e.message);
    }
  }

  return `${inviteCode}@newsletter`;
}

async function fetchYouTubeDownload(targetYoutubeUrl) {
  try {
    const directUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetYoutubeUrl)}&quality=128k&format=mp3&api_key=${CHAMA_API_KEY}`;
    const { data: res } = await axios.get(directUrl, { timeout: 35000 });
    const dl = res?.download_url || res?.data?.download_url || res?.result?.download_url || res?.data?.url;
    if (dl) {
      return { 
        downloadUrl: dl, 
        title: res?.title || res?.data?.title || '', 
        thumbnail: res?.thumbnail || res?.data?.thumbnail || '' 
      };
    }
  } catch (_) {}

  try {
    const videoUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetYoutubeUrl)}&quality=360p&format=mp4&api_key=${CHAMA_API_KEY}`;
    const { data: res2 } = await axios.get(videoUrl, { timeout: 35000 });
    const dl2 = res2?.download_url || res2?.data?.download_url || res2?.result?.download_url || res2?.data?.url;
    if (dl2) {
      return { 
        downloadUrl: dl2, 
        title: res2?.title || res2?.data?.title || '', 
        thumbnail: res2?.thumbnail || res2?.data?.thumbnail || '' 
      };
    }
  } catch (e) {
    console.error('[YT API ERROR]:', e.message);
  }

  return null;
}

export default {
  name: 'csong',
  aliases: ['channelsong', 'cs', 'cplay'],
  category: 'owner',
  description: 'Send YouTube song as card and audio file directly to a channel',

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || '.';
    const fullText = args.join(' ').trim();
    const quotedText = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
                       msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || '';

    const input = fullText || quotedText;

    if (!input) {
      sock.sendMessage(from, { react: { text: '🍭', key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { 
        text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL SONG SENDER* ୧┈•ﾟ｡ 🐾

🍭 *භාවිතා කරන ආකාරය:*
1️⃣ \`${pref}csong <Song Name>\`
2️⃣ \`${pref}csong <Channel Link>, <Song Name>\`

✨ *උදාහරණයක්:*
\`${pref}csong https://whatsapp.com/channel/0029VbBtXBMICVfnpV20wl27, ayida awe hineta mage\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      }, { quoted: msg });
    }

    let channelInput = DEFAULT_CHANNEL;
    let songQuery = input;

    if (input.includes(',')) {
      const parts = input.split(',');
      channelInput = parts[0].trim();
      songQuery = parts.slice(1).join(',').trim();
    }

    sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    const waitMsg = await sock.sendMessage(from, { 
      text: `⚡ *DARK-DINU CORE:* චැනල් එකට ගීතය සකසමින් පවතී...\n🎵 *Song:* \`${songQuery}\`` 
    }, { quoted: msg });

    const tempDir = os.tmpdir();
    const tempInputFile = path.join(tempDir, `raw_${Date.now()}.bin`);
    const tempOutputFile = path.join(tempDir, `audio_${Date.now()}.mp3`);

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
          return await sock.sendMessage(from, { text: '❌ YouTube හි අදාළ ගීතය සොයාගත නොහැකි විය.' }, { quoted: msg });
        }
        const video = searchResult.videos[0];
        targetYoutubeUrl = video.url;
        searchedTitle = video.title;
        searchedThumbnail = video.thumbnail;
        searchedDuration = video.timestamp || '03:45';
      }

      const ytData = await fetchYouTubeDownload(targetYoutubeUrl);

      if (!ytData?.downloadUrl) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ YouTube API Download Link එක ලබාගැනීමට නොහැකි විය.' }, { quoted: msg });
      }

      const finalTitle = ytData.title || searchedTitle;
      const finalThumbnail = ytData.thumbnail || searchedThumbnail || 'https://files.catbox.moe/k315x4.jpg';

      // 1. Send Song Poster/Card to Channel
      const songCardCaption = 
`> *🎵⃝✨ D A R K   D I N U   M U S I C*

*❖ ᴛɪᴛʟᴇ :* ${finalTitle}

01:23 ───🔘──────── ${searchedDuration}
⇄     ◁   ❚❚   ▷     ↻

\`\`\`➥ Enjoy the audio track & tap a reaction! 🥰🎶\`\`\`

> *👑 ᴅᴀʀᴋ-ᴅɪɴᴜ ᴄᴏʀᴇ • ꜱᴏɴɢ ʜᴜʙ*`;

      try {
        await sock.sendMessage(targetChannelJid, {
          image: { url: finalThumbnail },
          caption: songCardCaption
        });
      } catch (err) {
        console.error('[CARD POST FAILED]:', err.message);
      }

      // 2. Download Media Buffer
      const fileResponse = await axios({
        url: ytData.downloadUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': '*/*'
        }
      });

      fs.writeFileSync(tempInputFile, Buffer.from(fileResponse.data));

      // 3. Convert to Clean MP3
      await convertToAudio(tempInputFile, tempOutputFile);
      const audioBuffer = fs.readFileSync(tempOutputFile);

      // 4. Send Playable Audio to Channel (ptt: false - WhatsApp Channel Drop නොවීමට)
      await sock.sendMessage(targetChannelJid, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        fileName: `${finalTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.mp3`,
        ptt: false
      });

      sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});

      if (waitMsg?.key) {
        await sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

      await sock.sendMessage(from, { 
        text: 
`✨ *CHANNEL UPLOAD SUCCESSFUL!*
━━━━━━━━━━━━━━━━━━━━━
🎵 *Title:* \`${finalTitle}\`
📢 *Channel ID:* \`${targetChannelJid}\`

💖 *DARK-DINU MD*` 
      }, { quoted: msg });

    } catch (error) {
      console.error('[CSONG ERROR]:', error);
      sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ *Upload Failed:* ${error.message}` 
      }, { quoted: msg });
    } finally {
      try {
        if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
        if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
      } catch (_) {}
    }
  }
};
