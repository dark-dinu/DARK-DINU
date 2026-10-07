import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "url",
  aliases: ["tourl", "geturl", "upload", "catbox"],
  category: "utility",
  description: "Convert Image, Video, Audio, Voice note, Sticker, or Document into a direct URL",

  async execute({ sock, msg, from }) {
    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      // Extract raw target message
      let targetMessage = quoted || msg.message;
      let targetRaw = quoted
        ? {
            key: {
              remoteJid: from,
              id: contextInfo.stanzaId,
              participant: contextInfo.participant
            },
            message: quoted
          }
        : msg;

      // Unpack View-Once if wrapped
      if (targetMessage?.viewOnceMessageV2?.message) {
        targetMessage = targetMessage.viewOnceMessageV2.message;
        targetRaw.message = targetMessage;
      } else if (targetMessage?.viewOnceMessage?.message) {
        targetMessage = targetMessage.viewOnceMessage.message;
        targetRaw.message = targetMessage;
      }

      // Media Type, Extension & Mime Detection
      let fileExt = "";
      let mediaLabel = "";
      let mimeType = "application/octet-stream";

      if (targetMessage?.imageMessage) {
        fileExt = ".jpg";
        mediaLabel = "IMAGE";
        mimeType = targetMessage.imageMessage.mimetype || "image/jpeg";
      } else if (targetMessage?.videoMessage) {
        fileExt = ".mp4";
        mediaLabel = "VIDEO";
        mimeType = targetMessage.videoMessage.mimetype || "video/mp4";
      } else if (targetMessage?.audioMessage) {
        const isPtt = Boolean(targetMessage.audioMessage.ptt);
        fileExt = isPtt ? ".opus" : ".mp3";
        mediaLabel = isPtt ? "VOICE NOTE (PTT)" : "AUDIO";
        mimeType = targetMessage.audioMessage.mimetype || "audio/ogg; codecs=opus";
      } else if (targetMessage?.stickerMessage) {
        fileExt = ".webp";
        mediaLabel = "STICKER";
        mimeType = targetMessage.stickerMessage.mimetype || "image/webp";
      } else if (targetMessage?.documentMessage) {
        const docName = targetMessage.documentMessage.fileName || "file";
        const parts = docName.split(".");
        fileExt = parts.length > 1 ? `.${parts.pop()}` : ".bin";
        mediaLabel = "DOCUMENT";
        mimeType = targetMessage.documentMessage.mimetype || "application/octet-stream";
      } else {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතා කරන ආකාරය:*\n\nImage, Video, Voice note, Audio, Sticker හෝ Document එකකට reply කර *.url* හෝ *.tourl* ලෙස send කරන්න.`
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Download Buffer via Baileys Native Method
      const buffer = await downloadMediaMessage(
        targetRaw,
        "buffer",
        {},
        {
          logger: undefined,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ Media එක download කර ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න." },
          { quoted: msg }
        );
      }

      // Build Multi-Part Form Data
      const filename = `dark_dinu_${Date.now()}${fileExt}`;
      const form = new FormData();
      form.append("reqtype", "fileupload");
      form.append("fileToUpload", buffer, {
        filename,
        contentType: mimeType
      });

      // Upload to Catbox MOE
      const response = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 90000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const mediaUrl = typeof response.data === "string" ? response.data.trim() : null;

      if (!mediaUrl || !mediaUrl.startsWith("http")) {
        throw new Error("Host API returned an invalid URL response.");
      }

      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const resultText = 
`⚡ *DARK-DINU URL ENGINE* ⚡

🔗 *Direct URL:* 
${mediaUrl}

📁 *Type:* ${mediaLabel}
📦 *Size:* ${sizeMB} MB
🖤 *Status:* PERMANENT LINK`;

      await sock.sendMessage(from, { text: resultText }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "🔗", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("[URL CMD ERROR]:", err);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          text: `❌ URL එක සෑදීමට නොහැකි විය: ${err.message || "Network Error"}`
        },
        { quoted: msg }
      );
    }
  }
};
