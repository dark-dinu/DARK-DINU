import axios from 'axios';
import yts from 'yt-search';
import { delay } from '@whiskeysockets/baileys';

// Default Channel Link
const DEFAULT_CHANNEL = 'https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V';

// Active Chamindu API Key
const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || 'chama_api_9c55e3c6d014abbdf65054f9046a920b';

// Fast Channel JID Resolver (ලින්ක් එකේ අගට /430 ආවත් Clean Invite Code එක ගනී)
async function resolveChannelJid(sock, channelInput) {
  let link = (channelInput || '').trim();
  if (link.endsWith('@newsletter')) return link;

  const match = link.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    const inviteCode = match[1];
    try {
      const meta = await Promise.race([
        sock.newsletterMetadata('invite', inviteCode),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000))
      ]);
      if (meta?.id) return meta.id;
    } catch (_) {}
    return `${inviteCode}@newsletter`;
  }
  return link;
}

// Chamindu API Stream Resolver
async function fetchAudioData(targetUrl) {
  const enc = encodeURIComponent(targetUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${enc}&api_key=${CHAMA_API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=128kbps&api_key=${CHAMA_API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${CHAMA_API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const { data: res } = await axios.get(ep, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
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
          res.result?.url;

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
  category: 'channel',
  description: 'Send song card and playable audio player to WhatsApp Channel',

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
          text: `⚠️ *භාවිතය:*\n.csong <Song Name>\n\n*වෙනත් චැනල් එකකට නම්:*\n.csong <Channel Link> , <Song Name>`
        },
        { quoted: msg }
      );
    }

    let channelLink = DEFAULT_CHANNEL;
    let songQuery = input;

    if (input.includes(',')) {
      const parts = input.split(',');
      channelLink = parts[0].trim();
      songQuery = parts.slice(1).join(',').trim();
    }

    sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    try {
      // 1. Channel JID හරියටම Clean කර ගැනීම
      const targetChannelJid = await resolveChannelJid(sock, channelLink);

      let targetYoutubeUrl = songQuery;
      let searchedTitle = songQuery;
      let searchedThumbnail = '';
      let searchedDuration = '04:11';

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
        searchedDuration = video.timestamp || '04:11';
      }

      // 2. Chamindu API එකෙන් Download URL ගැනීම
      const ytData = await fetchAudioData(targetYoutubeUrl);

      if (!ytData?.downloadUrl) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ YouTube API එකෙන් Audio Stream Link එකක් ලබාගත නොහැකි විය.' }, { quoted: msg });
      }

      const finalTitle = ytData.title || searchedTitle;
      const finalThumb = ytData.thumbnail || searchedThumbnail;

      // 3. Thumbnail Image Buffer සහ Audio Stream එක බාගත කිරීම
      const [thumbRes, fileResponse] = await Promise.all([
        finalThumb
          ? axios.get(finalThumb, { responseType: 'arraybuffer', timeout: 10000 }).catch(() => null)
          : Promise.resolve(null),
        axios.get(ytData.downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 45000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
      ]);

      const mediaBuffer = Buffer.from(fileResponse.data);
      if (mediaBuffer.length < 5000) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ බාගත කළ Audio file එක දෝෂ සහිතයි.' }, { quoted: msg });
      }

      // 4. Send Song Card Image to Channel (Screenshot එකේ තියෙන Format එකම)
      const songCardCaption = 
`│  ✨ H E S H A N   O F C   M U S I C

❖ ᴛɪᴛʟᴇ : ${finalTitle}

01:23 ───🔘──────── ${searchedDuration}
⇄     ◁   ❚❚   ▷     ↻

➥ Don't forget to enjoy the song and leave a reaction! 🥰🎶

│  🕊️ ʜᴇꜱʜᴀɴ ᴏꜰᴄ : ꜱᴏɴɢ ʜᴜʙ`;

      if (thumbRes?.data) {
        await sock.sendMessage(targetChannelJid, {
          image: Buffer.from(thumbRes.data),
          caption: songCardCaption
        });
      } else {
        await sock.sendMessage(targetChannelJid, { text: songCardCaption });
      }

      // Delay to avoid WhatsApp Newsletter rate-limit
      await delay(2000);

      // 5. Send Playable Audio Player to Channel (PTT = false, Channels වල 100% වැඩ කරන ක්‍රමය)
      await sock.sendMessage(targetChannelJid, {
        audio: mediaBuffer,
        mimetype: 'audio/mp4',
        ptt: false
      });

      sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `✅ *"${finalTitle}"*\nChannel එකට Song Card එක සහ Audio Player එක සාර්ථකව Post කරන ලදී! 🎶✨` },
        { quoted: msg }
      );

    } catch (error) {
      console.error('[CSONG ERROR]:', error);
      sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ දෝෂයක් සිදුවිය: ${error.message}` }, { quoted: msg });
    }
  }
};
