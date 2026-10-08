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

// 100% Dedicated Catbox Moe Uploader
async function uploadToCatbox(buffer, filename, mimeType) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", buffer, {
    filename,
    contentType: mimeType
  });

  const response = await axios.post("https://catbox.moe/user/api.php", form, {
    headers: {
      ...form.getHeaders(),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    timeout: 60000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });

  const mediaUrl = typeof response.data === "string" ? response.data.trim() : null;

  if (!mediaUrl || !mediaUrl.startsWith("http")) {
    throw new Error(response.data || "Catbox upload failed.");
  }

  return mediaUrl;
}

export default {
  name: "url",
  aliases: ["tourl", "geturl", "upload", "catbox"],
  category: "utility",
  description: "Convert Image, Video, Audio, Voice note, Sticker, or Document into a permanent Catbox URL",

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
            text: "⚠️ *භාවිතා කරන ආකාරය:*\n\nImage, Video, Audio, Sticker හෝ Document එකකට reply කර *.url* හෝ *.catbox* ලෙස send කරන්න."
          },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Direct Stream Download
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
      const mediaUrl = await uploadToCatbox(buffer, filename, mimeType);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      const resultText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🐱 *CATBOX URL ENGINE* 〕
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
        { text: `❌ Catbox URL එක සෑදීම අසාර්ථක විය: ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
