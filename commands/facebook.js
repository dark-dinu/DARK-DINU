import axios from "axios";

// Static High-Speed In-Memory Hash Map (O(1) Access)
global.fbSessions = global.fbSessions || new Map();
global.fbHookedSockets = global.fbHookedSockets || new WeakSet();

// Non-blocking fast reply listener
export function attachFbReplyEngine(sock) {
  if (!sock || global.fbHookedSockets.has(sock)) return;
  global.fbHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const contextInfo =
      rawMsg.extendedTextMessage?.contextInfo ||
      rawMsg.imageMessage?.contextInfo ||
      rawMsg.videoMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.fbSessions.has(quotedId)) return;

    const session = global.fbSessions.get(quotedId);
    if (session.from !== from) return;

    const choice = (
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      ""
    ).trim();

    if (choice !== "1" && choice !== "2" && choice !== "3") return;

    // Instant cute reaction
    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    try {
      if (choice === "1") {
        const targetUrl = session.hd || session.sd;
        if (!targetUrl) throw new Error("HD video stream unavailable");

        await sock.sendMessage(
          from,
          {
            video: { url: targetUrl },
            caption: `🎬 *${session.title}* [HD]\n\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: m }
        );
      } else if (choice === "2") {
        const targetUrl = session.sd || session.hd;
        if (!targetUrl) throw new Error("SD video stream unavailable");

        await sock.sendMessage(
          from,
          {
            video: { url: targetUrl },
            caption: `🎬 *${session.title}* [SD]\n\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: m }
        );
      } else if (choice === "3") {
        const targetUrl = session.audio || session.sd || session.hd;
        if (!targetUrl) throw new Error("Audio stream unavailable");

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

      sock.sendMessage(from, { react: { text: "💖", key: m.key } }).catch(() => {});
      global.fbSessions.delete(quotedId);
    } catch (err) {
      sock.sendMessage(from, { react: { text: "⚠️", key: m.key } }).catch(() => {});
      sock.sendMessage(
        from,
        { text: `🌸 *Oopsie!* Failed to deliver file: ${err.message || "Network glitch"}` },
        { quoted: m }
      ).catch(() => {});
    }
  });
}

export default {
  name: "facebook",
  aliases: ["fb", "fbdl"],
  category: "download",
  description: "Download Facebook reels & videos in HD, SD or Audio",

  async execute({ sock, msg, from, args, config }) {
    attachFbReplyEngine(sock);
    const prefix = config?.PREFIX || ".";

    try {
      const rawUrl = args.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));

      if (!rawUrl || (!rawUrl.includes("facebook.com") && !rawUrl.includes("fb.watch"))) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *FACEBOOK DOWNLOADER* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${prefix}fb <facebook_video_url>\`

  ✨ *Example:*
  \`${prefix}fb https://fb.watch/xxxxxx/\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      // Microsecond Reaction
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
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *Could not fetch this video!* It might be private or restricted, honey~" },
          { quoted: msg }
        );
      }

      // Cute Interactive Card UI
      const cardUI = 
`🎀 ｡ﾟ•┈୨ *FACEBOOK DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🎬 *Title:* ${title.slice(0, 40)}...
  🌐 *Source:* Facebook Public Reel/Post

━━━━━━━━━━━━━━━━━━━━━
🍬 *Reply with your preferred choice:*

  🌸 *1* ➔ High Definition [HD] ${hdUrl ? "🟢" : "🔴"}
  🍰 *2* ➔ Standard Quality [SD] ${sdUrl ? "🟢" : "🔴"}
  🎧 *3* ➔ Audio (MP3/M4A) ${(audioUrl || sdUrl) ? "🟢" : "🔴"}

━━━━━━━━━━━━━━━━━━━━━
_Reply with 1, 2 or 3 to download softly~ (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      let sentMsg;
      try {
        sentMsg = await sock.sendMessage(
          from,
          { image: { url: thumb }, caption: cardUI },
          { quoted: msg }
        );
      } catch (_) {
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

        // 3-Minute Safe O(1) TTL Auto-Prune
        setTimeout(() => {
          global.fbSessions.delete(sentMsg.key.id);
        }, 180000);
      }

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[FB CMD ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Network timeout"}` },
        { quoted: msg }
      );
    }
  }
};
