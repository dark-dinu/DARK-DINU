import axios from "axios";
import FormData from "form-data";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

// Stream to Buffer Helper
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// 100% Reliable Multi-Engine Direct Uploader
async function uploadMedia(buffer, filename, mimeType) {
  // Method 1: Catbox Moe (with Full Spoof Headers)
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*"
      },
      timeout: 25000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (typeof res.data === "string" && res.data.startsWith("http")) {
      return res.data.trim();
    }
  } catch (_) {
    // Catbox cloudflare block වුණොත් පහත Fallback එකට මාරු වේ
  }

  // Method 2: Quax / File.io Cloud Mirror (No IP Blocks)
  try {
    const form2 = new FormData();
    form2.append("files[]", buffer, {
      filename: filename,
      contentType: mimeType
    });

    const res2 = await axios.post("https://qu.ax/upload.php", form2, {
      headers: form2.getHeaders(),
      timeout: 25000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (res2.data?.success && res2.data.files?.[0]?.url) {
      return res2.data.files[0].url;
    }
  } catch (_) {}

  // Method 3: Tmpfiles fallback (Direct Stream)
  try {
    const form3 = new FormData();
    form3.append("file", buffer, {
      filename: filename,
      contentType: mimeType
    });

    const res3 = await axios.post("https://tmpfiles.org/api/v1/upload", form3, {
      headers: form3.getHeaders(),
      timeout: 25000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const url = res3.data?.data?.url;
    if (url) {
      return url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
  } catch (err) {
    throw new Error("Cloud upload servers are currently unreachable. Please retry.");
  }

  throw new Error("Unable to parse uploaded URL.");
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

      // Download buffer
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
