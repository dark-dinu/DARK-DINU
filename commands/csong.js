import axios from "axios";
import ytSearch from "yt-search";
import { delay } from "@whiskeysockets/baileys";

const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

global.channelJidCache = global.channelJidCache || new Map();

async function downloadBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": UA },
      timeout: 50000,
      maxContentLength: 40 * 1024 * 1024
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error("[BUFFER ERROR]:", e.message);
    return null;
  }
}

async function searchYouTube(query) {
  try {
    const res = await ytSearch(query);
    if (!res?.videos?.length) return null;

    const video = res.videos[0];
    return {
      videoId: video.videoId,
      url: video.url,
      title: video.title || "Channel Song",
      duration: video.timestamp || "3:30",
      thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
    };
  } catch {
    return null;
  }
}

async function getAudioDownloadUrl(videoUrl) {
  const enc = encodeURIComponent(videoUrl);
  const endpoints = [
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=320kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/mp3?url=${enc}&quality=128kbps&api_key=${API_KEY}`,
    `https://api.chamindu.site/api/v1/youtube/download?url=${enc}&quality=128kbps&format=mp3&api_key=${API_KEY}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, { headers: { "User-Agent": UA }, timeout: 15000 });
      const data = res.data;
      if (data) {
        const link =
          data.data?.download_url ||
          data.data?.direct_url ||
          data.data?.url ||
          data.download_url ||
          data.direct_url ||
          data.result?.download_url ||
          data.url;
        if (typeof link === "string" && /^https?:\/\//i.test(link)) return link;
      }
    } catch (_) {}
  }
  return null;
}

export default {
  name: "csong",
  aliases: ["channelsong", "cvoice", "cplay"],
  category: "channel",
  description: "Post song card & audio directly to WhatsApp Channel",

  async execute({ sock, msg, from, args, config }) {
    const botName = config?.BOT_NAME || "DARK-DINU MD";
    const fullText = (args || []).join(" ").trim();
    const react = (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {});

    if (!fullText) {
      return await sock.sendMessage(
        from,
        {
          text: `⚠️ *භාවිතය:*\n*.csong <channel_link> , <song_name>*\n\n*උදාහරණ:*\n.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V , sadawathiye`
        },
        { quoted: msg }
      );
    }

    const linkMatch = fullText.match(/https?:\/\/(?:www\.)?whatsapp\.com\/channel\/[a-zA-Z0-9_\-\/]+/i);
    let channelLink = "";
    let songName = "";

    if (linkMatch) {
      channelLink = linkMatch[0];
      songName = fullText.replace(channelLink, "").replace(/^[\s,]+|[\s,]+$/g, "").trim();
    } else {
      return await sock.sendMessage(
        from,
        { text: "⚠️ කරුණාකර Channel Link එක සහ සින්දුවේ නම කොමාවකින් (,) වෙන් කර ලබාදෙන්න!" },
        { quoted: msg }
      );
    }

    if (!songName) {
      return await sock.sendMessage(from, { text: "⚠️ කරුණාකර සින්දුවේ නම ලබාදෙන්න!" }, { quoted: msg });
    }

    let inviteCode = channelLink.split("whatsapp.com/channel/")[1]?.split(/[\/?#]/)[0]?.trim();
    if (!inviteCode) {
      return await sock.sendMessage(from, { text: "❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න!" }, { quoted: msg });
    }

    react("⏳");

    try {
      // 1. Channel Metadata සහ Real JID Resolve කරගැනීම
      let channelJid = null;
      let channelMeta = null;

      try {
        channelMeta = await Promise.race([
          sock.newsletterMetadata("invite", inviteCode),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
        ]);
        channelJid = channelMeta?.id;
      } catch (e) {
        console.error("[META FETCH FAILED]:", e.message);
      }

      if (!channelJid) {
        react("❌");
        return await sock.sendMessage(
          from,
          { text: "❌ Channel එක සොයාගත නොහැකි විය. Invite Link එක නිවැරදි දැයි බලන්න." },
          { quoted: msg }
        );
      }

      // Check Real Role of the Current Connected Bot Node
      const botRole = channelMeta?.viewer_metadata?.role || "UNKNOWN";
      if (botRole !== "ADMIN" && botRole !== "OWNER") {
        react("❌");
        const botPhone = (sock.user?.id || "").split(":")[0];
        return await sock.sendMessage(
          from,
          { 
            text: `⚠️ *අවසර නැත (Permission Denied):*\n\nමෙම Command එක ක්‍රියාත්මක කරන Bot Number එක: *+${botPhone}*\nමෙම අංකයට අදාළ Channel එකේ තනතුර: *${botRole}*\n\n👉 කරුණාකර *+${botPhone}* අංකය Channel එකට Add කර *ADMIN* ලබාදෙන්න.` 
          },
          { quoted: msg }
        );
      }

      // 2. YouTube Search
      const video = await searchYouTube(songName);
      if (!video) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ සින්දුව සොයාගත නොහැකි විය." }, { quoted: msg });
      }

      // 3. Audio Download Link එක ලබා ගැනීම
      const audioUrl = await getAudioDownloadUrl(video.url);
      if (!audioUrl) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Chamindu API එකෙන් Audio link එකක් නොලැබුණි." }, { quoted: msg });
      }

      // 4. Download Media
      const [rawAudioBuffer, imgBuffer] = await Promise.all([
        downloadBuffer(audioUrl),
        downloadBuffer(video.thumbnail)
      ]);

      if (!rawAudioBuffer || rawAudioBuffer.length < 5000) {
        react("❌");
        return await sock.sendMessage(from, { text: "❌ Audio file එක download කරගැනීම අසාර්ථක විය." }, { quoted: msg });
      }

      const cardCaption = 
`🥰⃝🎶 *“ ${video.title} ”*

0:00 ◁◁  II  ▷▷ ${video.duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

| ☘️ *${botName}*`;

      // 5. Channel Post Execution with Verification
      // A. Send Thumbnail Card
      const postCard = await sock.sendMessage(channelJid, {
        image: imgBuffer,
        caption: cardCaption
      });

      if (!postCard) {
        throw new Error("WhatsApp Server rejected the channel image post.");
      }

      await delay(2000);

      // B. Send Audio Document
      const cleanFileName = `${video.title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "song"}.mp3`;
      const postAudio = await sock.sendMessage(channelJid, {
        document: rawAudioBuffer,
        mimetype: "audio/mpeg",
        fileName: cleanFileName
      });

      if (!postAudio) {
        throw new Error("WhatsApp Server rejected the channel audio post.");
      }

      react("✅");
      return await sock.sendMessage(
        from,
        {
          text: `✅ *"${video.title}"*\nChannel එකට සාර්ථකව Post කරන ලදී! 🎶✨`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[CSONG FATAL ERROR]:", err);
      react("❌");
      return await sock.sendMessage(
        from,
        { text: `❌ Glitch: ${err.message || "Failed to post to channel"}` },
        { quoted: msg }
      );
    }
  }
};
