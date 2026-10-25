import axios from 'axios';
import yts from 'yt-search';
import { delay } from '@whiskeysockets/baileys';

// Default WhatsApp Channel Link
const DEFAULT_CHANNEL = 'https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T';

// Chamindu Active API Key
const CHAMA_API_KEY = process.env.CHAMINDU_API_KEY || 'chama_api_9c55e3c6d014abbdf65054f9046a920b';

// Fast Channel JID Resolver
async function resolveChannelJid(sock, channelInput) {
  let link = (channelInput || '').trim();
  if (link.endsWith('@newsletter')) return link;

  const match = link.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    const inviteCode = match[1].split('/')[0];
    try {
      const meta = await Promise.race([
        sock.newsletterMetadata('invite', inviteCode),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000))
      ]);
      if (meta?.id) return meta.id;
    } catch (_) {}
    return `${inviteCode}@newsletter`;
  }
  return link;
}

// Chamindu Stream Resolver
async function getDownloadLink(youtubeUrl) {
  const enc = encodeURIComponent(youtubeUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${enc}&api_key=${CHAMA_API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=128kbps&api_key=${CHAMA_API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const dl =
        res.data?.data?.audio?.download_url ||
        res.data?.data?.audio?.url ||
        res.data?.data?.download_url ||
        res.data?.data?.direct_url ||
        res.data?.download_url ||
        res.data?.direct_url;

      if (dl && typeof dl === 'string' && /^https?:\/\//i.test(dl)) {
        return {
          downloadUrl: dl,
          title: res.data?.data?.title || res.data?.title || '',
          thumbnail: res.data?.data?.thumbnail || res.data?.thumbnail || ''
        };
      }
    } catch (_) {}
  }
  return null;
}

export default {
  name: 'csong',
  aliases: ['cplay', 'channelsong'],
  category: 'channel',
  description: 'Send song card and playable audio directly to WhatsApp Channel',

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
          text: `⚠️ *භාවිතය:*\n.csong <Song Name>\n\n*වෙනත් චැනල් එකකට නම්:*\n.csong <Channel Link>, <Song Name>`
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

    // Reaction
    sock.sendMessage(from, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    try {
      // 1. Channel JID එක ලබා ගැනීම
      const channelJid = await resolveChannelJid(sock, channelLink);

      // 2. YouTube Search
      let videoUrl = songQuery;
      let title = songQuery;
      let thumbnail = '';
      let duration = '03:45';

      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(songQuery);

      if (!isUrl) {
        const search = await yts(songQuery);
        if (!search?.videos?.length) {
          sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, { text: '❌ සින්දුව YouTube හි සොයාගත නොහැකි විය.' }, { quoted: msg });
        }
        const vid = search.videos[0];
        videoUrl = vid.url;
        title = vid.title;
        thumbnail = vid.thumbnail;
        duration = vid.timestamp || '03:45';
      }

      // 3. API එකෙන් Download URL එක ලබා ගැනීම
      const apiResult = await getDownloadLink(videoUrl);
      if (!apiResult?.downloadUrl) {
        sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: '❌ Audio download link එකක් ලබාගත නොහැකි විය.' }, { quoted: msg });
      }

      const finalTitle = apiResult.title || title;
      const finalThumb = apiResult.thumbnail || thumbnail;

      // 4. Channel Image Card එක Post කිරීම
      const songCaption = 
`> *🎵⃝✨ H E S H A N   O F C   M U S I C* 

*❖ ᴛɪᴛʟᴇ :* ${finalTitle}

01:23 ───🔘──────── ${duration}
⇄     ◁   ❚❚   ▷     ↻

\`\`\`➥ Don't forget to enjoy the song and leave a reaction! 🥰🎶\`\`\`

> *🕊️ ʜᴇꜱʜᴀɴ ᴏꜰᴄ : ꜱᴏɴɢ ʜᴜʙ*`;

      if (finalThumb) {
        await sock.sendMessage(channelJid, {
          image: { url: finalThumb },
          caption: songCaption
        });
      } else {
        await sock.sendMessage(channelJid, { text: songCaption });
      }

      await delay(1500);

      // 5. Channel එකට Audio එක යැවීම (Playable Audio Stream)
      // FFmpeg නැති නිසා RAM එක 512MB ඉක්මවා freeze වෙන්නේ නෑ
      await sock.sendMessage(channelJid, {
        audio: { url: apiResult.downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${finalTitle.replace(/[^a-zA-Z0-9 ]/g, '')}.mp3`
      });

      // 6. සාර්ථක බව දැනුම් දීම
      sock.sendMessage(from, { react: { text: '✔️', key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `✅ *"${finalTitle}"*\nChannel එකට Song Card එක සහ Audio එක සාර්ථකව Post කරන ලදී! 🎶✨` },
        { quoted: msg }
      );

    } catch (err) {
      console.error('[CSONG ERROR]:', err.message);
      sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `❌ දෝෂයක් සිදුවිය: ${err.message || 'Failed to dispatch'}` },
        { quoted: msg }
      );
    }
  }
};
