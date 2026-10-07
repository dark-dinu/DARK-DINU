import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "vv",
  aliases: [
    "save", 
    "viewonce", 
    "antiviewonce",
    "🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤", "👍"
  ],
  category: "utility",
  description: "Strict View-Once media extractor",

  async execute({ sock, msg, from }) {
    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      if (!quoted) return;

      // 🛑 සාමාන්‍ය Text Message එකක් නම් වහාම නවත්වයි
      if (
        quoted.conversation || 
        (quoted.extendedTextMessage && !quoted.viewOnceMessageV2 && !quoted.viewOnceMessage && !quoted.viewOnceMessageV2Extension)
      ) {
        return;
      }

      // 🛑 Strictly verify if it is an actual View-Once message
      let viewOnce = null;
      let isStrictViewOnce = false;

      if (quoted.viewOnceMessageV2?.message) {
        viewOnce = quoted.viewOnceMessageV2.message;
        isStrictViewOnce = true;
      } else if (quoted.viewOnceMessage?.message) {
        viewOnce = quoted.viewOnceMessage.message;
        isStrictViewOnce = true;
      } else if (quoted.viewOnceMessageV2Extension?.message) {
        viewOnce = quoted.viewOnceMessageV2Extension.message;
        isStrictViewOnce = true;
      } else if (
        quoted.imageMessage?.viewOnce || 
        quoted.videoMessage?.viewOnce || 
        quoted.audioMessage?.viewOnce
      ) {
        viewOnce = quoted;
        isStrictViewOnce = true;
      }

      // Normal Message එකක් නම් silent return
      if (!isStrictViewOnce || !viewOnce) {
        return;
      }

      const isImage = Boolean(viewOnce.imageMessage);
      const isVideo = Boolean(viewOnce.videoMessage);
      const isAudio = Boolean(viewOnce.audioMessage);

      if (!isImage && !isVideo && !isAudio) return;

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Decryption Payload with Context Keys
      const targetPayload = {
        key: {
          remoteJid: from,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant
        },
        message: viewOnce
      };

      // Download buffer via native Baileys downloader
      const buffer = await downloadMediaMessage(
        targetPayload, 
        "buffer", 
        {},
        {
          logger: undefined,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) return;

      const defaultCaption = "> *🔓 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐀𝐍𝐓𝐈-𝐕𝐈𝐄𝐖𝐎𝐍𝐂𝐄*";

      if (isImage) {
        const caption = viewOnce.imageMessage?.caption 
          ? `${viewOnce.imageMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;

        await sock.sendMessage(from, {
          image: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (isVideo) {
        const caption = viewOnce.videoMessage?.caption 
          ? `${viewOnce.videoMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;

        await sock.sendMessage(from, {
          video: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (isAudio) {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});

    } catch (e) {
      console.error("[VV ERROR]:", e.message);
    }
  }
};
