import axios from "axios";

export default {
  name: "instagram",
  aliases: ["insta", "ig", "igdl", "reel"],
  category: "download",
  description: "Download Instagram Reels, Videos, and Photos",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    try {
      const url = args[0]?.trim();

      if (!url) {
        return await reply(
          `⚠️ *කරුණාකර Instagram Link එකක් ලබාදෙන්න!*\n\n*භාවිතය:* \`${pref}insta <link>\`\n*උදා:* \`${pref}insta https://www.instagram.com/reel/xxxxxx/\``
        );
      }

      if (!url.includes("instagram.com")) {
        return await reply("❌ කරුණාකර නිවැරදි Instagram Link එකක් ඇතුළත් කරන්න.");
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      let mediaList = [];
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(url)}&api_key=${apiKey}`;

      // 1. Primary Engine: Chamindu API
      try {
        const res = await axios.get(apiUrl, { timeout: 20000 });
        const resData = res.data;

        if (resData?.data?.status === "inaccessible_or_private" || resData?.message?.includes("Could not resolve")) {
          sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await reply("❌ මෙම Post එක Private ගිණුමක එකක් හෝ ලබාගත නොහැකි Link එකකි. Public Post එකක Link එකක් ලබාදෙන්න.");
        }

        const mediaData = resData?.data || resData?.result || resData;
        if (Array.isArray(mediaData)) {
          mediaList = mediaData;
        } else if (Array.isArray(mediaData?.downloads)) {
          mediaList = mediaData.downloads;
        } else if (Array.isArray(mediaData?.media)) {
          mediaList = mediaData.media;
        } else if (typeof mediaData === "object" && mediaData !== null) {
          mediaList = [mediaData];
        }
      } catch (_) {}

      // 2. Backup Engine: BK9 Fallback
      if (!mediaList.length) {
        try {
          const bkRes = await axios.get(`https://bk9.fun/download/instagram?url=${encodeURIComponent(url)}`, { timeout: 15000 });
          if (bkRes.data?.BK9?.length) {
            mediaList = bkRes.data.BK9;
          }
        } catch (_) {}
      }

      const caption = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📸 *INSTAGRAM DOWNLOADER* 〕
├─▸ ⚡ *Status*  : High Quality Fetched
├─▸ 🎯 *Engine*  : Ultra Stream Relay
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      let sentMedia = false;

      for (const item of mediaList) {
        const downloadUrl = item.url || item.download_url || item.link || (typeof item === "string" ? item : null);
        const isVideo = item.type === "video" || item.type === "mp4" || (downloadUrl && downloadUrl.includes(".mp4"));

        if (downloadUrl && typeof downloadUrl === "string" && downloadUrl.startsWith("http")) {
          // Direct buffer pipe with timeout to prevent silent drop
          const mediaRes = await axios.get(downloadUrl, {
            responseType: "arraybuffer",
            timeout: 25000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          const mediaBuffer = Buffer.from(mediaRes.data);

          if (isVideo) {
            await sock.sendMessage(from, {
              video: mediaBuffer,
              caption: caption,
              mimetype: "video/mp4"
            }, { quoted: msg });
          } else {
            await sock.sendMessage(from, {
              image: mediaBuffer,
              caption: caption
            }, { quoted: msg });
          }
          sentMedia = true;
          break;
        }
      }

      if (!sentMedia) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply("❌ මෙම Link එකෙන් Media එක බාගත කිරීමට නොහැකි විය.");
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[INSTAGRAM ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Instagram බාගත කිරීම අසාර්ථක විය: ${err.message || "Network Error"}`);
    }
  }
};
