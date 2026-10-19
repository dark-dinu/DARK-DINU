import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

// Multi-Engine Cloud Uploader
async function uploadMedia(buffer, filename, mimeType) {
  // Method 1: Catbox.moe
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, {
      filename: filename,
      contentType: mimeType
    });

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: {
        ...form.getHeaders(),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (typeof res.data === "string" && res.data.startsWith("http")) {
      return res.data.trim();
    }
  } catch (_) {}

  // Method 2: Litterbox (Temporary Catbox Mirror)
  try {
    const form2 = new FormData();
    form2.append("reqtype", "fileupload");
    form2.append("time", "72h");
    form2.append("fileToUpload", buffer, {
      filename: filename,
      contentType: mimeType
    });

    const res2 = await axios.post("https://litterbox.catbox.moe/resources/internals/api.php", form2, {
      headers: form2.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (typeof res2.data === "string" && res2.data.startsWith("http")) {
      return res2.data.trim();
    }
  } catch (_) {}

  // Method 3: Tmpfiles.org (Instant Direct Download Link)
  try {
    const form3 = new FormData();
    form3.append("file", buffer, {
      filename: filename,
      contentType: mimeType
    });

    const res3 = await axios.post("https://tmpfiles.org/api/v1/upload", form3, {
      headers: form3.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const rawUrl = res3.data?.data?.url;
    if (rawUrl) {
      return rawUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
  } catch (_) {}

  throw new Error("සියලුම Cloud upload engines කාර්යබහුලයි. මඳ වේලාවකින් නැවත උත්සාහ කරන්න.");
}

export default {
  name: "url",
  aliases: ["tourl", "geturl", "upload", "catbox"],
  category: "utility",
  description: "Convert Image, Video, Audio, Voice note, Sticker, or Document into direct URL",

  async execute({ sock, msg, from }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetMessage = quoted || msg.message;

      // Extract from View-Once wrappers
      if (targetMessage?.viewOnceMessageV2?.message) {
        targetMessage = targetMessage.viewOnceMessageV2.message;
      } else if (targetMessage?.viewOnceMessage?.message) {
        targetMessage = targetMessage.viewOnceMessage.message;
      } else if (targetMessage?.viewOnceMessageV2Extension?.message) {
        targetMessage = targetMessage.viewOnceMessageV2Extension.message;
      }

      let fileExt = ".bin";
      let mediaLabel = "DOCUMENT";
      let mimeType = "application/octet-stream";
      let hasMedia = false;

      if (targetMessage?.imageMessage) {
        hasMedia = true;
        fileExt = ".jpg";
        mediaLabel = "IMAGE";
        mimeType = targetMessage.imageMessage.mimetype || "image/jpeg";
      } else if (targetMessage?.videoMessage) {
        hasMedia = true;
        fileExt = ".mp4";
        mediaLabel = "VIDEO";
        mimeType = targetMessage.videoMessage.mimetype || "video/mp4";
      } else if (targetMessage?.audioMessage) {
        hasMedia = true;
        const isPtt = Boolean(targetMessage.audioMessage.ptt);
        fileExt = isPtt ? ".ogg" : ".mp3";
        mediaLabel = isPtt ? "VOICE NOTE" : "AUDIO";
        mimeType = targetMessage.audioMessage.mimetype || "audio/ogg; codecs=opus";
      } else if (targetMessage?.stickerMessage) {
        hasMedia = true;
        fileExt = ".webp";
        mediaLabel = "STICKER";
        mimeType = targetMessage.stickerMessage.mimetype || "image/webp";
      } else if (targetMessage?.documentMessage) {
        hasMedia = true;
        const docName = targetMessage.documentMessage.fileName || "file";
        const parts = docName.split(".");
        fileExt = parts.length > 1 ? `.${parts.pop()}` : ".bin";
        mediaLabel = "DOCUMENT";
        mimeType = targetMessage.documentMessage.mimetype || "application/octet-stream";
      }

      if (!hasMedia) {
        return await sock.sendMessage(
          from,
          {
            text: "⚠️ *භාවිතා කරන ආකාරය:*\n\nImage, Video, Audio, Sticker හෝ Document එකකට reply කර *.url* හෝ *.catbox* ලෙස send කරන්න."
          },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Safe Baileys Buffer Downloader
      const downloadTarget = quoted ? { message: quoted } : msg;
      const buffer = await downloadMediaMessage(
        downloadTarget,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      ).catch(() => null);

      if (!buffer || buffer.length === 0) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ Media එක download කර ගැනීමට නොහැකි විය. Media එක නැවත forward කර try කරන්න." },
          { quoted: msg }
        );
      }

      const filename = `dark_dinu_${Date.now()}${fileExt}`;
      const mediaUrl = await uploadMedia(buffer, filename, mimeType);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      const resultText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🔗 *DIRECT URL ENGINE* 〕
├─▸ 📁 *Type* : ${mediaLabel}
├─▸ 📦 *Size* : ${sizeMB} MB
├─▸ 🌐 *Link* :
│   ${mediaUrl}
└───────────────────────

> 🔗 https://heshan.devofc.top/`;

      await sock.sendMessage(from, { text: resultText }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "🔗", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[URL ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ URL එක සෑදීම අසාර්ථක විය: ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
