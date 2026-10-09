import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import axios from "axios";

export default {
  name: "vsticker",
  aliases: ["vs", "v2s", "gsticker", "attp", "ttp"],
  category: "sticker",
  description: "Convert Video/GIF to animated sticker or generate animated text stickers",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const full = (body || "").trim();
    const cmd = full.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();

    const packName = config?.STICKER_NAME || "DARK-DINU MD";
    const authorName = config?.STICKER_AUTHOR || "Heshan OFC";

    // ==========================================
    // 1. ATTP / TTP (ANIMATED TEXT STICKER)
    // ==========================================
    if (cmd === "attp" || cmd === "ttp") {
      const text = args.join(" ").trim();
      if (!text) {
        return await sock.sendMessage(
          from,
          { text: `✨ *කරුණාකර වචනයක් ලබා දෙන්න!*\n\n*භාවිතය:* \`${pref}attp Hello\`` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

      try {
        // High-speed reliable ATTP API endpoint
        const attpUrl = `https://api.giftedtech.web.id/api/maker/attp?apikey=gifted&text=${encodeURIComponent(text)}`;
        const res = await axios.get(attpUrl, { responseType: "arraybuffer", timeout: 12000 }).catch(() => null);

        let gifBuffer = res?.data;

        // Fallback endpoint if primary fails
        if (!gifBuffer) {
          const fallbackRes = await axios.get(
            `https://api-fix.onrender.com/api/maker/attp?text=${encodeURIComponent(text)}`,
            { responseType: "arraybuffer", timeout: 12000 }
          );
          gifBuffer = fallbackRes.data;
        }

        const sticker = new Sticker(gifBuffer, {
          pack: packName,
          author: authorName,
          type: StickerTypes.FULL,
          quality: 60
        });

        const stickerBuffer = await sticker.toBuffer();
        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

        return await sock.sendMessage(
          from,
          { sticker: stickerBuffer },
          { quoted: msg }
        );
      } catch (err) {
        console.error("[ATTP ERR]:", err.message);
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `❌ Text sticker සෑදීමේදී දෝෂයක් ආවා: ${err.message}` },
          { quoted: msg }
        );
      }
    }

    // ==========================================
    // 2. VIDEO / GIF TO STICKER (VSTICKER)
    // ==========================================
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedVideo = quoted?.videoMessage;
    const isDirectVideo = msg.message?.videoMessage;
    const targetVideo = isQuotedVideo || isDirectVideo;

    if (!targetVideo) {
      return await sock.sendMessage(
        from,
        {
          text: `🎥 *කරුණාකර තත්පර 10කට අඩු Video හෝ GIF එකකට reply කර \`${pref}vs\` හෝ \`${pref}vsticker\` ගසන්න!*`
        },
        { quoted: msg }
      );
    }

    // Duration check (Stickers need to be under 10s to avoid WhatsApp errors)
    const duration = targetVideo.seconds || 0;
    if (duration > 10) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ Video එක තත්පර 10කට වඩා අඩු විය යුතුය!" },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // Direct in-memory buffer download via Baileys native downloader
      const mediaMessageObj = isQuotedVideo ? { message: { videoMessage: quoted.videoMessage } } : msg;
      const mediaBuffer = await downloadMediaMessage(
        mediaMessageObj,
        "buffer",
        {},
        { logger: console }
      );

      const sticker = new Sticker(mediaBuffer, {
        pack: packName,
        author: authorName,
        type: StickerTypes.FULL,
        quality: 40 // Optimized quality for animated webp WhatsApp limits (under 1MB)
      });

      const stickerBuffer = await sticker.toBuffer();
      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await sock.sendMessage(
        from,
        { sticker: stickerBuffer },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[VSTICKER ERR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `❌ Video එක sticker එකක් බවට හැරවීමේදී දෝෂයක් ආවා: ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
