import axios from "axios";

// Active download sessions store
if (!global.fbSessions) global.fbSessions = new Map();

export default {
  name: "facebook",
  aliases: ["fb", "fbdl"],
  category: "download",
  description: "Download Facebook videos in HD, SD or Audio",

  async execute({ sock, msg, from, args, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      const rawUrl = args.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));

      if (!rawUrl || (!rawUrl.includes("facebook.com") && !rawUrl.includes("fb.watch"))) {
        return await sock.sendMessage(
          from,
          { 
            text: `⚠️ *කරුණාකර නිවැරදි Facebook Link එකක් ලබාදෙන්න!*\n\n*භාවිතය:* \`${prefix}fb <link>\`\n*උදා:* \`${prefix}fb https://fb.watch/xxxxxx/\`` 
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      const apiUrl = `https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(rawUrl)}&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`;
      const response = await axios.get(apiUrl, { timeout: 25000 });
      const res = response.data;

      const data = res?.data || res?.result || {};
      const title = data.title || "Facebook Video";
      const thumb = data.thumbnail || data.thumb || "https://files.catbox.moe/k315x4.jpg";
      const hdUrl = data.hd || data.video_hd || data.downloads?.hd || null;
      const sdUrl = data.sd || data.video_sd || data.downloads?.sd || data.url || null;
      const audioUrl = data.audio || data.downloads?.audio || null;

      if (!hdUrl && !sdUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ මෙම වීඩියෝව ලබා ගැනීමට නොහැකි විය. (Private හෝ Restricted Post එකක් විය හැක)" },
          { quoted: msg }
        );
      }

      const cardUI = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎬 *FACEBOOK DOWNLOADER* 〕
├─▸ 📌 *Title:* ${title.slice(0, 45)}...
├─▸ 🌐 *Platform:* Facebook Video
└───────────────────────

*බාගත කිරීමට අදාළ අංකය Reply කරන්න:*

┌─▸ 1️⃣ *HD Video* ${hdUrl ? "🟢" : "🔴"}
├─▸ 2️⃣ *SD Video* ${sdUrl ? "🟢" : "🔴"}
└─▸ 3️⃣ *Audio (MP3)* ${(audioUrl || sdUrl) ? "🟢" : "🔴"}

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      const sentMsg = await sock.sendMessage(
        from,
        {
          image: { url: thumb },
          caption: cardUI
        },
        { quoted: msg }
      );

      // Store in memory map
      if (sentMsg?.key?.id) {
        global.fbSessions.set(sentMsg.key.id, {
          from,
          title,
          hd: hdUrl,
          sd: sdUrl,
          audio: audioUrl
        });

        // Clear memory after 5 minutes
        setTimeout(() => {
          if (global.fbSessions) global.fbSessions.delete(sentMsg.key.id);
        }, 5 * 60 * 1000);
      }

      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[FB CMD ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ Facebook බාගත කිරීම අසාර්ථක විය: ${err.message || "Network Error"}` },
        { quoted: msg }
      );
    }
  },

  // Auto Universal Reply Handler for index.js
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    if (!global.fbSessions?.has(quotedStanzaId)) return false;

    const session = global.fbSessions.get(quotedStanzaId);
    if (session.from !== from) return false;

    const choice = body.trim();
    if (!["1", "2", "3"].includes(choice)) return false;

    try {
      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      if (choice === "1") {
        const targetUrl = session.hd || session.sd;
        if (!targetUrl) throw new Error("HD Video link is unavailable.");

        await sock.sendMessage(
          from,
          {
            video: { url: targetUrl },
            caption: `🎬 *${session.title}* [HD]\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
          },
          { quoted: msg }
        );
      } else if (choice === "2") {
        const targetUrl = session.sd || session.hd;
        if (!targetUrl) throw new Error("SD Video link is unavailable.");

        await sock.sendMessage(
          from,
          {
            video: { url: targetUrl },
            caption: `🎬 *${session.title}* [SD]\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
          },
          { quoted: msg }
        );
      } else if (choice === "3") {
        const targetUrl = session.audio || session.sd || session.hd;
        if (!targetUrl) throw new Error("Audio stream is unavailable.");

        await sock.sendMessage(
          from,
          {
            audio: { url: targetUrl },
            mimetype: "audio/mp4",
            ptt: false
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      global.fbSessions.delete(quotedStanzaId);
      return true;
    } catch (err) {
      console.error("[FB DOWNLOAD REPLY ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ බාගත කර ගැනීමට නොහැකි විය: ${err.message}` },
        { quoted: msg }
      );
      return true;
    }
  }
};
