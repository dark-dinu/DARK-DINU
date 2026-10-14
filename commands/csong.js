import yts from "yt-search";
import axios from "axios";
import { delay } from "@whiskeysockets/baileys";

global.channelJidCache = global.channelJidCache || new Map();

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "channel",
  description: "Post song card & crisp audio to WhatsApp Channel",

  async execute({ sock, msg, from, args, config }) {
    const pref = config?.PREFIX || ".";

    try {
      const fullText = args.join(" ").trim();
      const firstComma = fullText.indexOf(",");

      if (!fullText || firstComma === -1) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL SONG GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}csong <channel_link> , <song_name>\`

  ✨ *Example:*
  \`${pref}csong https://whatsapp.com/channel/0029VbTXBMICVfnpV20wI27 , kuweniye\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      let channelLink = fullText.slice(0, firstComma).trim();
      const songName = fullText.slice(firstComma + 1).trim();

      // ලින්ක් එකේ අගට /755 වගේ post IDs තිබ්බොත් ඒවා clear කර invite code එක පමණක් ගැනීම
      const inviteMatch = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/);
      let inviteCode = inviteMatch ? inviteMatch[1] : null;
      if (inviteCode && inviteCode.includes("/")) {
        inviteCode = inviteCode.split("/")[0];
      }

      if (!inviteCode || !songName) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Oops!* Please provide a valid channel link and a song title sweetheart~ ✨" },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 1. Channel JID හරියටම Resolve කරගැනීම
      let channelJid = global.channelJidCache.get(inviteCode);
      let channelMeta = null;

      if (!channelJid) {
        try {
          channelMeta = await Promise.race([
            sock.newsletterMetadata("invite", inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
          ]);
          channelJid = channelMeta?.id;
          if (channelJid) global.channelJidCache.set(inviteCode, channelJid);
        } catch (e) {
          console.error("[CSONG META ERR]:", e.message);
        }
      }

      if (!channelJid) {
        channelJid = `${inviteCode}@newsletter`;
      }

      if (!channelJid.includes("@newsletter")) {
        channelJid = `${channelJid}@newsletter`;
      }

      // 2. YouTube Search
      const search = await yts(songName);
      const video = search?.videos?.[0];
      if (!video) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *No tracks found* for "${songName}", try another query darling!` },
          { quoted: msg }
        );
      }

      // 3. Audio Download API
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      let audioDownloadUrl = null;

      try {
        const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(video.url)}&quality=128kbps&format=mp3&api_key=${apiKey}`;
        const res = await axios.get(apiUrl, { timeout: 15000 });
        audioDownloadUrl = res.data?.data?.direct_url || res.data?.data?.download_url || res.data?.direct_url || res.data?.download_url;
      } catch (_) {}

      if (!audioDownloadUrl) {
        try {
          const fallbackApi = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(video.url)}&quality=360p&format=mp4&api_key=${apiKey}`;
          const res2 = await axios.get(fallbackApi, { timeout: 15000 });
          audioDownloadUrl = res2.data?.data?.direct_url || res2.data?.data?.download_url || res2.data?.direct_url;
        } catch (_) {}
      }

      if (!audioDownloadUrl) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Oops!* Audio download API is currently busy. Please try again shortly." },
          { quoted: msg }
        );
      }

      // 4. Download Audio & Thumbnail Buffers
      const [audioRes, imgRes] = await Promise.all([
        axios.get(audioDownloadUrl, { responseType: "arraybuffer", timeout: 45000 }),
        axios.get(video.thumbnail, { responseType: "arraybuffer", timeout: 15000 })
      ]);

      const rawAudioBuffer = Buffer.from(audioRes.data);
      const imgBuffer = Buffer.from(imgRes.data);

      const cardCaption = 
`🎀 ｡ﾟ•┈୨ *NOW PLAYING* ୧┈•ﾟ｡ 🐾

  🎵 *Track:* ${video.title}
  ⏳ *Duration:* ${video.timestamp || "3:30"}
  🎧 *Format:* High-Definition Audio

  ◁◁   ❚❚   ▷▷  0:00 ───●─ ${video.timestamp || "3:30"}

━━━━━━━━━━━━━━━━━━━━━
🎧 _Plug in your headphones for sweet acoustic vibes~_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 5. Send Image to Channel
      await sock.sendMessage(channelJid, {
        image: imgBuffer,
        caption: cardCaption
      });

      await delay(2000);

      // 6. Send Clean Audio Stream (audio/mpeg direct compatible with Newsletters)
      await sock.sendMessage(channelJid, {
        audio: rawAudioBuffer,
        mimetype: "audio/mpeg",
        fileName: `${video.title.replace(/[^a-zA-Z0-9 ]/g, "")}.mp3`
      });

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `✨ *Delivered!* Successfully posted *"${video.title}"* to the channel sweetly~ 🌸🎙️`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[CSONG ERROR]:", err);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to post to channel"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
