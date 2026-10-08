import axios from "axios";
import FormData from "form-data";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

// Stream to Buffer helper function
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Multi-Host Uploader (Catbox -> Tmpfiles Fallback)
async function uploadToCloud(buffer, filename, mimeType) {
  // 1. Try Catbox Moe
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, { filename, contentType: mimeType });

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (typeof res.data === "string" && res.data.startsWith("http")) {
      return res.data.trim();
    }
  } catch (_) {}

  // 2. Fallback: tmpfiles.org
  try {
    const formFallback = new FormData();
    formFallback.append("file", buffer, { filename, contentType: mimeType });

    const resFallback = await axios.post("https://tmpfiles.org/api/v1/upload", formFallback, {
      headers: formFallback.getHeaders(),
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const fileUrl = resFallback.data?.data?.url;
    if (fileUrl) {
      // Direct download link conversion
      return fileUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
  } catch (err) {
    throw new Error("සියලුම upload hosts unreachable. නැවත උත්සාහ කරන්න.");
  }

  throw new Error("Upload response invalid.");
}

export default {
  name: "url",
  aliases: ["tourl", "geturl", "upload", "catbox"],
  category: "utility",
  description: "Convert Image, Video, Audio, Voice note, Sticker, or Document into a direct URL",

  async execute({ sock, msg, from }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetMessage = quoted || msg.message;

      // View-Once unpack
      if (targetMessage?.viewOnceMessageV2?.message) {
        targetMessage = targetMessage.viewOnceMessageV2.message;
      } else if (targetMessage?.viewOnceMessage?.message) {
        targetMessage = targetMessage.viewOnceMessage.message;
      }

      let mediaType = null;
      let mediaNode = null;
      let fileExt = ".bin";
      let mediaLabel = "DOCUMENT";
      let mimeType = "application/octet-stream";

      if (targetMessage?.imageMessage) {
        mediaType = "image";
        mediaNode = targetMessage.imageMessage;
        fileExt = ".jpg";
        mediaLabel = "IMAGE";
        mimeType = mediaNode.mimetype || "image/jpeg";
      } else if (targetMessage?.videoMessage) {
        mediaType = "video";
        mediaNode = targetMessage.videoMessage;
        fileExt = ".mp4";
        mediaLabel = "VIDEO";
        mimeType = mediaNode.mimetype || "video/mp4";
      } else if (targetMessage?.audioMessage) {
        mediaType = "audio";
        mediaNode = targetMessage.audioMessage;
        const isPtt = Boolean(mediaNode.ptt);
        fileExt = isPtt ? ".opus" : ".mp3";
        mediaLabel = isPtt ? "VOICE NOTE" : "AUDIO";
        mimeType = mediaNode.mimetype || "audio/ogg; codecs=opus";
      } else if (targetMessage?.stickerMessage) {
        mediaType = "sticker";
        mediaNode = targetMessage.stickerMessage;
        fileExt = ".webp";
        mediaLabel = "STICKER";
        mimeType = mediaNode.mimetype || "image/webp";
      } else if (targetMessage?.documentMessage) {
        mediaType = "document";
        mediaNode = targetMessage.documentMessage;
        const docName = mediaNode.fileName || "file";
        const parts = docName.split(".");
        fileExt = parts.length > 1 ? `.${parts.pop()}` : ".bin";
        mediaLabel = "DOCUMENT";
        mimeType = mediaNode.mimetype || "application/octet-stream";
      } else {
        return await sock.sendMessage(
          from,
          {
            text: "⚠️ *භාවිතා කරන ආකාරය:*\n\nImage, Video, Audio, Sticker හෝ Document එකකට reply කර *.url* ලෙස send කරන්න."
          },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Direct Stream Download via Baileys core
      const stream = await downloadContentFromMessage(mediaNode, mediaType);
      const buffer = await streamToBuffer(stream);

      if (!buffer || buffer.length === 0) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ Media එක download කර ගැනීමට නොහැකි විය." },
          { quoted: msg }
        );
      }

      const filename = `dark_dinu_${Date.now()}${fileExt}`;
      const mediaUrl = await uploadToCloud(buffer, filename, mimeType);
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
