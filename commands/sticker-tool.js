import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import axios from "axios";

// Helper: Stream එක Buffer එකක් කර ගැනීම
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

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

    // 1. ATTP (ANIMATED TEXT STICKER)
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
        const attpUrl = `https://api.giftedtech.web.id/api/maker/attp?apikey=gifted&text=${encodeURIComponent(text)}`;
        const res = await axios.get(attpUrl, { responseType: "arraybuffer", timeout: 12000 }).catch(() => null);

        let gifBuffer = res?.data;

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
          quality: 50
        });

        const stickerBuffer = await sticker.toBuffer();
        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

        return await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
      } catch (err) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: `❌ Text sticker සෑදීමේදී දෝෂයක් ආවා: ${err.message}` }, { quoted: msg });
      }
    }

    // 2. VIDEO / GIF TO STICKER (.vs / .vsticker)
    const rawMsg = msg.message?.ephemeralMessage?.message || msg.message;
    const quotedMsg = rawMsg?.extendedTextMessage?.contextInfo?.quotedMessage;
    const targetMsg = quotedMsg || rawMsg;

    // Detect video or gif inside targets (handling ephemeral & viewOnce wrappers)
    const videoObj =
      targetMsg?.videoMessage ||
      targetMsg?.viewOnceMessageV2?.message?.videoMessage ||
      targetMsg?.viewOnceMessage?.message?.videoMessage;

    if (!videoObj) {
      return await sock.sendMessage(
        from,
        {
          text: `🎥 *කරුණාකර තත්පර 1-9 අතර කුඩා Video හෝ GIF එකකට Reply කර \`${pref}vs\` ගසන්න!*`
        },
        { quoted: msg }
      );
    }

    if (videoObj.seconds > 10) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ Video එක තත්පර 10කට වඩා අඩු විය යුතුය! (WhatsApp Animated Sticker සීමාව)" },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // Baileys native media stream download
      const stream = await downloadContentFromMessage(videoObj, "video");
      const videoBuffer = await streamToBuffer(stream);

      if (!videoBuffer || videoBuffer.length === 0) {
        throw new Error("Video stream download failed.");
      }

      // Convert using wa-sticker-formatter
      const sticker = new Sticker(videoBuffer, {
        pack: packName,
        author: authorName,
        type: StickerTypes.FULL,
        quality: 30, // Optimized to strictly keep under WhatsApp's 1MB payload limit
        background: "transparent"
      });

      const stickerBuffer = await sticker.toBuffer();

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });

    } catch (err) {
      console.error("[VSTICKER ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `❌ Sticker එක හැදීමේදී දෝෂයක් ආවා: ${err.message}\n_කරුණාකර තත්පර 3-5 ක කුඩා Video හෝ GIF එකක් උත්සාහ කරන්න._` },
        { quoted: msg }
      );
    }
  }
};
