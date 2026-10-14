import yts from "yt-search";
import axios from "axios";
import { delay } from "@whiskeysockets/baileys";

// Global In-Memory Newsletter JID Cache
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
  \`${pref}csong https://whatsapp.com/channel/0029VaXXXXX , kuweniye\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      const channelLink = fullText.slice(0, firstComma).trim();
      const songName = fullText.slice(firstComma + 1).trim();

      const inviteMatch = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/);
      const inviteCode = inviteMatch ? inviteMatch[1] : null;

      if (!inviteCode || !songName) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Oopsie!* Please provide a valid channel link and a song title sweetheart~ ✨" },
          { quoted: msg }
        );
      }

      // Microsecond React
      sock.sendMessage(from, { react: { text: "🎶", key: msg.key } }).catch(() => {});

      // 1. Channel JID Extraction & Validation
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
          return await sock.sendMessage(
            from,
            { text: `🌸 *Could not access channel metadata:* ${e.message}` },
            { quoted: msg }
          );
        }
      }

      if (!channelJid) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Channel not found!* Make sure the invite link is active, honey~" },
          { quoted: msg }
        );
      }

      // Safe JID Format ensuring @newsletter domain
      if (!channelJid.includes("@newsletter")) {
        channelJid = `${channelJid}@newsletter`;
      }

      // Role Verification
      if (channelMeta) {
        const role = channelMeta.viewer_metadata?.role || "GUEST";
        if (role !== "ADMIN" && role !== "OWNER") {
          return await sock.sendMessage(
            from,
            {
              text: `🎀 *Admin Required:* I am not an admin in this channel darling! (Status: \`${role}\`). Please promote my number to post softly~`
            },
            { quoted: msg }
          );
        }
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

      // 3. Audio Stream Resolution
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
          { text: "🌸 *Oops!* YouTube Downloader API is currently unreachable. Please provide an updated API key or endpoint!" },
          { quoted: msg }
        );
      }

      // 4. Parallel Download Image & Raw Audio Stream
      const [audioRes, imgRes] = await Promise.all([
        axios.get(audioDownloadUrl, { responseType: "arraybuffer", timeout: 45000 }),
        axios.get(video.thumbnail, { responseType: "arraybuffer", timeout: 12000 })
      ]);

      const rawAudioBuffer = Buffer.from(audioRes.data);
      const imgBuffer = Buffer.from(imgRes.data);

      // Cute Pastel Channel Caption
      const cardCaption = 
`🎀 ｡ﾟ•┈୨ *NOW PLAYING* ୧┈•ﾟ｡ 🐾

  🎵 *Track:* ${video.title}
  ⏳ *Duration:* ${video.timestamp || "3:30"}
  🎧 *Format:* High-Quality Audio Stream

  ◁◁   ❚❚   ▷▷  0:00 ───●─ ${video.timestamp || "3:30"}

━━━━━━━━━━━━━━━━━━━━━
🎧 _Plug in your headphones for sweet acoustic vibes~_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 5. Send Card to Channel
      await sock.sendMessage(channelJid, {
        image: imgBuffer,
        caption: cardCaption
      });

      // Stagger delay between image and audio
      await delay(1500);

      // 6. Send Clean Standard Audio to Channel (Channels accept audio/mpeg seamlessly)
      await sock.sendMessage(channelJid, {
        audio: rawAudioBuffer,
        mimetype: "audio/mp4",
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
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to post song softly"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
