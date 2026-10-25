import axios from "axios";
import ytSearch from "yt-search";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send clean song card and voice note to a WhatsApp channel using Chamindu API",

  async execute({ sock, msg, from, args }) {
    try {
      // 1. Initial reaction
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const fullText = args ? (Array.isArray(args) ? args.join(" ") : args) : "";

      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(
          from,
          { text: "ℹ️ *භාවිතය:* `.csong channel_link, song_name`\n\n_උදා: .csong https://whatsapp.com/channel/xxx, Manike Mage Hithe_" },
          { quoted: msg }
        );
      }

      const [rawChannelLink, ...songQueryParts] = fullText.split(",");
      const channelLink = rawChannelLink.trim();
      const songQuery = songQueryParts.join(",").trim();

      if (!channelLink || !songQuery) {
        return await sock.sendMessage(
          from,
          { text: "⚠️ Channel Link එක සහ Song Name එක කොමාවකින් වෙන් කර ඇතුළත් කරන්න." },
          { quoted: msg }
        );
      }

      // 2. WhatsApp Channel Invite code එකෙන් Newsletter JID එක ගැනීම
      const inviteCodeMatch = channelLink.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)/i);
      if (!inviteCodeMatch || !inviteCodeMatch[1]) {
        return await sock.sendMessage(
          from,
          { text: "❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න." },
          { quoted: msg }
        );
      }

      const inviteCode = inviteCodeMatch[1];
      let channelJid;

      try {
        const metadata = await sock.newsletterMetadata("invite", inviteCode);
        channelJid = metadata.id;
      } catch (err) {
        return await sock.sendMessage(
          from,
          { text: "❌ Channel එකේ තොරතුරු ලබාගත නොහැකි විය. Bot එම Channel එකේ Admin කෙනෙක් බව තහවුරු කරගන්න." },
          { quoted: msg }
        );
      }

      // 3. YouTube URL එකක් හෝ Song Name එකක්දැයි පරීක්ෂා කර Video URL එක ලබා ගැනීම
      let targetUrl = songQuery;
      let searchThumbnail = "";
      let searchDuration = "";

      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(songQuery);

      if (!isUrl) {
        const searchResult = await ytSearch(songQuery);
        const video = searchResult?.videos?.[0];

        if (!video) {
          return await sock.sendMessage(
            from,
            { text: "❌ අදාළ නමින් සින්දුවක් සොයා ගැනීමට නොහැකි විය." },
            { quoted: msg }
          );
        }

        targetUrl = video.url;
        searchThumbnail = video.thumbnail;
        searchDuration = video.timestamp;
      }

      // 4. Chamindu API එක Call කිරීම
      const apiKey = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
      const apiUrl = `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(targetUrl)}&api_key=${apiKey}`;

      const response = await axios.get(apiUrl, { timeout: 35000 });
      const apiData = response.data?.result || response.data?.data || response.data;

      // API Response එකෙන් audio download URL එක වෙන් කර ගැනීම
      const audioUrl = apiData?.download?.audio || 
                       apiData?.download_url || 
                       apiData?.audio?.url || 
                       apiData?.audio || 
                       apiData?.url;

      if (!audioUrl) {
        return await sock.sendMessage(
          from,
          { text: "❌ සින්දුවේ Audio Download Link එක ලබා ගැනීමට නොහැකි විය." },
          { quoted: msg }
        );
      }

      const title = apiData?.title || songQuery;
      const artist = apiData?.author?.name || apiData?.author || apiData?.channel || "Official Track";
      const duration = apiData?.duration || searchDuration || "--:--";
      const thumbnail = apiData?.thumbnail || searchThumbnail;

      // Clean & Modern Minimalist Card (No Borders)
      const cleanCard = 
`🎶  *${title}*

🎤  *Artist* • ${artist}
⏱️  *Length* • ${duration}
📡  *Source* • YouTube

🎧  _Listen to the voice note below_`;

      // 5. පියවර 1: Song Card (Poster) එක Channel එකට යැවීම
      if (thumbnail) {
        await sock.sendMessage(channelJid, {
          image: { url: thumbnail },
          caption: cleanCard
        });
      } else {
        await sock.sendMessage(channelJid, { text: cleanCard });
      }

      // 6. පියවර 2: Audio එක PTT Voice Note එකක් ලෙස Channel එකට යැවීම
      await sock.sendMessage(channelJid, {
        audio: { url: audioUrl },
        mimetype: "audio/mp4",
        ptt: true
      });

      // User ට Success Reaction සහ Confirm Message යැවීම
      sock.sendMessage(from, { react: { text: "✔️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `✅ *Uploaded to Channel!*\n\n🎵 *${title}*` },
        { quoted: msg }
      );

    } catch (error) {
      console.error("CSong Chamindu API Error:", error);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ දෝෂයක් සිදු විය: ${error?.response?.data?.message || error.message || error}` },
        { quoted: msg }
      );
    }
  }
};
