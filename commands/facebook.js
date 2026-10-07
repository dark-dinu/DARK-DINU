import axios from "axios";

// Active download sessions store
global.fbSessions = global.fbSessions || new Map();
global.fbHookedSockets = global.fbHookedSockets || new WeakSet();

// Fast Reply Interceptor (Index.js වෙනස් නොකර 1, 2, 3 අල්ලා ගනී)
function attachFbReplyEngine(sock) {
  if (!sock || global.fbHookedSockets.has(sock)) return;
  global.fbHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const contextInfo = 
      m.message.extendedTextMessage?.contextInfo ||
      m.message.imageMessage?.contextInfo ||
      m.message.videoMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.fbSessions.has(quotedId)) return;

    const session = global.fbSessions.get(quotedId);
    if (session.from !== from) return;

    const choice = (
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      ""
    ).trim();

    if (!["1", "2", "3"].includes(choice)) return;

    // React non-blocking
    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      if (choice === "1") {
        const targetUrl = session.hd || session.sd;
        if (!targetUrl) throw new Error("HD Video නොමැත.");

        await sock.sendMessage(
          from,
          {
            video: { url: targetUrl },
            caption: `🎬 *${session.title}* [HD]\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
          },
          { quoted: m }
        );
      } else if (choice === "2") {
        const targetUrl = session.sd || session.hd;
        if (!targetUrl) throw new Error("SD Video නොමැත.");

        await sock.sendMessage(
          from,
          {
            video: { url: targetUrl },
            caption: `🎬 *${session.title}* [SD]\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
          },
          { quoted: m }
        );
      } else if (choice === "3") {
        const targetUrl = session.audio || session.sd || session.hd;
        if (!targetUrl) throw new Error("Audio stream නොමැත.");

        await sock.sendMessage(
          from,
          {
            audio: { url: targetUrl },
            mimetype: "audio/mp4",
            ptt: false
          },
          { quoted: m }
        );
      }

      sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
      global.fbSessions.delete(quotedId);
    } catch (err) {
      sock.sendMessage(from, { react: { text: "❌", key: m.key } }).catch(() => {});
      sock.sendMessage(from, { text: `❌ බාගත කිරීම අසාර්ථක විය: ${err.message}` }, { quoted: m }).catch(() => {});
    }
  });
}

// Cluster Watcher (Zero overhead)
if (!global.fbWatcherStarted) {
  global.fbWatcherStarted = true;
  setInterval(() => {
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        attachFbReplyEngine(s);
      }
    }
  }, 20000);
}

export default {
  name: "facebook",
  aliases: ["fb", "fbdl"],
  category: "download",
  description: "Download Facebook videos in HD, SD or Audio",

  async execute({ sock, msg, from, args, config }) {
    attachFbReplyEngine(sock);
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

      // Instant Non-blocking Reaction
      sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      const apiUrl = `https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(rawUrl)}&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`;
      const response = await axios.get(apiUrl, { timeout: 15000 });
      const res = response.data;

      const data = res?.data || res?.result || {};
      const title = data.title || "Facebook Video";
      const thumb = data.thumbnail || data.thumb || "https://files.catbox.moe/k315x4.jpg";
      const hdUrl = data.hd || data.video_hd || data.downloads?.hd || null;
      const sdUrl = data.sd || data.video_sd || data.downloads?.sd || data.url || null;
      const audioUrl = data.audio || data.downloads?.audio || null;

      if (!hdUrl && !sdUrl) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ මෙම වීඩියෝව ලබා ගැනීමට නොහැකි විය. (Private හෝ Restricted විය හැක)" },
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

      let sentMsg;
      try {
        sentMsg = await sock.sendMessage(
          from,
          { image: { url: thumb }, caption: cardUI },
          { quoted: msg }
        );
      } catch (_) {
        // Thumbnail fail වුණොත් Text එක හෝ ultra fast deliver වේ
        sentMsg = await sock.sendMessage(
          from,
          { text: cardUI },
          { quoted: msg }
        );
      }

      if (sentMsg?.key?.id) {
        global.fbSessions.set(sentMsg.key.id, {
          from,
          title,
          hd: hdUrl,
          sd: sdUrl,
          audio: audioUrl
        });

        // Safe auto-prune
        setTimeout(() => {
          global.fbSessions?.delete(sentMsg.key.id);
        }, 4 * 60 * 1000);
      }

      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[FB CMD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ Facebook බාගත කිරීම අසාර්ථක විය: ${err.message || "Network Error"}` },
        { quoted: msg }
      );
    }
  }
};
