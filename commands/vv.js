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

      if (!quoted) {
        return await sock.sendMessage(from, { 
          text: "⚠️ View-Once Photo, Video හෝ Voice note එකකට reply කර *.vv* ලෙස ලබාදෙන්න." 
        }, { quoted: msg });
      }

      // 1. Quoted Message එකෙන් View-Once කොටස Extract කිරීම
      let viewOnce = null;
      let mediaType = null;

      if (quoted.viewOnceMessageV2?.message) {
        viewOnce = quoted.viewOnceMessageV2.message;
      } else if (quoted.viewOnceMessage?.message) {
        viewOnce = quoted.viewOnceMessage.message;
      } else if (quoted.viewOnceMessageV2Extension?.message) {
        viewOnce = quoted.viewOnceMessageV2Extension.message;
      } else if (quoted.ephemeralMessage?.message?.viewOnceMessageV2?.message) {
        viewOnce = quoted.ephemeralMessage.message.viewOnceMessageV2.message;
      } else if (quoted.imageMessage?.viewOnce || quoted.videoMessage?.viewOnce || quoted.audioMessage?.viewOnce) {
        viewOnce = quoted;
      }

      if (!viewOnce) {
        return await sock.sendMessage(from, { 
          text: "⚠️ ඔබ reply කළ පණිවිඩය View-Once එකක් නොවේ හෝ එහි media keys WhatsApp සර්වර් එකෙන් ඉවත් කර ඇත." 
        }, { quoted: msg });
      }

      // Media Type හඳුනාගැනීම
      if (viewOnce.imageMessage) mediaType = "image";
      else if (viewOnce.videoMessage) mediaType = "video";
      else if (viewOnce.audioMessage) mediaType = "audio";

      if (!mediaType) {
        return await sock.sendMessage(from, { text: "⚠️ හඳුනාගත හැකි මාධ්‍යයක් (Media) නොමැත." }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 2. Full Decryption Wrapper සකස් කිරීම
      const decryptPayload = {
        key: {
          remoteJid: from,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant || from
        },
        message: {
          ...viewOnce
        }
      };

      // 3. Baileys Native Method එකෙන් Buffer එක බාගත කිරීම
      const buffer = await downloadMediaMessage(
        decryptPayload,
        "buffer",
        {},
        {
          logger: undefined,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        throw new Error("බාගත කළ Media Buffer එක හිස්ව ඇත (0 Bytes).");
      }

      const defaultCaption = "> *🔓 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐀𝐍𝐓𝐈-𝐕𝐈𝐄𝐖𝐎𝐍𝐂𝐄*";

      // 4. Decrypted Media එක Chat එකට යැවීම
      if (mediaType === "image") {
        const caption = viewOnce.imageMessage?.caption 
          ? `${viewOnce.imageMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;

        await sock.sendMessage(from, {
          image: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (mediaType === "video") {
        const caption = viewOnce.videoMessage?.caption 
          ? `${viewOnce.videoMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;

        await sock.sendMessage(from, {
          video: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (mediaType === "audio") {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: true
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[VV MAIN ERROR]:", err);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ *View-Once Extract අසාර්ථකයි:*\n\nහේතුව: ${err.message || "Decryption Keys Mismatch"}\n\n_සටහන: View-Once එක ඔබගේ දුරකථනයෙන් හෝ බොට්ගේ දුරකථනයෙන් 'Open' කර අවසන් නම් WhatsApp එකෙන් keys destroy කරන බැවින් මෙය decrypt කළ නොහැක._` 
      }, { quoted: msg });
    }
  }
};
