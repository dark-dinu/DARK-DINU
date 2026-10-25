const axios = require('axios');
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Active Chamindu API Key
const CHAMA_API_KEY = 'chama_api_9c55e3c6d014abbdf65054f9046a920b';

// Developer & Owner Numbers
const DEVELOPER_NUMBER = '94719845166';

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
  let input = channelInput.trim();
  if (input.endsWith('@newsletter')) return input;

  // ලින්ක් එක අගට /430 වැනි අමතර කොටස් තිබුණත් invite code එක පමණක් නිවැරදිව වෙන් කර ගැනීම
  const match = input.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9]{20,28})/i);
  if (match && match[1]) {
    const inviteCode = match[1];
    if (typeof sock.newsletterMetadata === 'function') {
      try {
        const meta = await sock.newsletterMetadata('invite', inviteCode);
        if (meta?.id) return meta.id;
      } catch (e) {
        console.error('Newsletter meta error:', e);
      }
    }
    return `${inviteCode}@newsletter`;
  }
  return input;
}

async function fetchYouTubeDownload(targetYoutubeUrl) {
  try {
    const directUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetYoutubeUrl)}&quality=128k&format=mp3&api_key=${CHAMA_API_KEY}`;
    const { data: res } = await axios.get(directUrl, { timeout: 45000 });
    const dl = res?.download_url || res?.data?.download_url || res?.result?.download_url;
    if (dl) {
      return { 
        downloadUrl: dl, 
        title: res?.title || res?.data?.title || '', 
        thumbnail: res?.thumbnail || res?.data?.thumbnail || '' 
      };
    }
  } catch (err) {
    console.warn('Direct MP3 fetch failed, trying MP4 format...');
  }

  try {
    const videoUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetYoutubeUrl)}&quality=360p&format=mp4&api_key=${CHAMA_API_KEY}`;
    const { data: res2 } = await axios.get(videoUrl, { timeout: 45000 });
    const dl2 = res2?.download_url || res2?.data?.download_url || res2?.result?.download_url;
    if (dl2) {
      return { 
        downloadUrl: dl2, 
        title: res2?.title || res2?.data?.title || '', 
        thumbnail: res2?.thumbnail || res2?.data?.thumbnail || '' 
      };
    }
  } catch (e) {
    console.error('YouTube API Error:', e.message);
  }

  return null;
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cs'],
  desc: 'Send YouTube song as card and playable voice note to a channel',
  category: 'music',
  run: async ({ sock, msg, jid, args, isOwner }) => {
    // 1. Developer & Owner Verification
    const sender = msg.key.participant || msg.key.remoteJid || '';
    const cleanSender = sender.replace(/[^0-9]/g, '');
    const isDev = cleanSender.includes(DEVELOPER_NUMBER);

    if (!isDev && !isOwner) {
      return await sock.sendMessage(jid, { 
        text: '❌ *Access Denied:* මෙම command එක භාවිතා කළ හැක්කේ Bot Owner සහ Developer ට පමණි.' 
      }, { quoted: msg });
    }

    const fullText = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    // 2. Strict usage check: .csong channel link, song name
    if (!fullText.includes(',')) {
      return await sock.sendMessage(jid, { 
        text: `⚠️ *භාවිතා කරන ආකාරය:*\n\n\`.csong <Channel Link>, <Song Name>\`\n\n_උදා: .csong https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T, lelena_` 
      }, { quoted: msg });
    }

    const commaIndex = fullText.indexOf(',');
    const channelInput = fullText.slice(0, commaIndex).trim();
    const songQuery = fullText.slice(commaIndex + 1).trim();

    if (!channelInput || !songQuery) {
      return await sock.sendMessage(jid, { 
        text: '❌ කරුණාකර Channel Link එක සහ Song Name එක කොමාවකින් වෙන් කර ඇතුළත් කරන්න.' 
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { text: '⏳ Processing song card & voice note for channel...' }, { quoted: msg });

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
          return await sock.sendMessage(jid, { text: '❌ YouTube හි අදාළ සින්දුව සොයාගත නොහැකි විය.' }, { quoted: msg });
        }
        const video = searchResult.videos[0];
        targetYoutubeUrl = video.url;
        searchedTitle = video.title;
        searchedThumbnail = video.thumbnail;
        searchedDuration = video.timestamp || '03:45';
      }

      const ytData = await fetchYouTubeDownload(targetYoutubeUrl);

      if (!ytData?.downloadUrl) {
        return await sock.sendMessage(jid, { text: '❌ YouTube Download Link එක ලබා ගැනීමට නොහැකි විය.' }, { quoted: msg });
      }

      const finalTitle = ytData.title || searchedTitle;
      const finalThumbnail = ytData.thumbnail || searchedThumbnail;

      // 1. Song Card Image එක Channel එකට යැවීම
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
        return await sock.sendMessage(jid, { text: '❌ බාගත වූ audio file එක අසම්පූර්ණයි. නැවත උත්සාහ කරන්න.' }, { quoted: msg });
      }

      fs.writeFileSync(tempInputFile, mediaBuffer);

      // 3. Convert to WhatsApp Opus PTT
      await convertToOpus(tempInputFile, tempOutputFile);
      const audioSeconds = await getDuration(tempOutputFile);

      // 4. Waveform Bars සැකසීම
      const dummyWaveform = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        dummyWaveform[i] = Math.floor(Math.random() * 80) + 20;
      }

      const opusBuffer = fs.readFileSync(tempOutputFile);

      // 5. Playable Voice Note (PTT) එක Channel එකට යැවීම
      await sock.sendMessage(targetChannelJid, {
        audio: opusBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        seconds: audioSeconds,
        waveform: dummyWaveform
      });

      await sock.sendMessage(jid, { 
        text: `✅ *සාර්ථකයි!* Song Card එක සහ Voice Note එක Channel එකට Upload කරන ලදී.` 
      }, { quoted: msg });

    } catch (error) {
      console.error('Csong Error:', error);
      await sock.sendMessage(jid, { text: `❌ දෝෂයක් සිදු විය: ${error.message}` }, { quoted: msg });
    } finally {
      if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
      if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
    }
  }
};
