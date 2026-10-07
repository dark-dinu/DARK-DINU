import { downloadContentFromMessage } from "@whiskeysockets/baileys";

// Stream එක Buffer එකක් කර ගැනීම
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

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
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) return;

      // Unpack View-Once wrappers (V1, V2, Extensions සහ Raw)
      let targetMsg = quoted;
      if (targetMsg?.viewOnceMessageV2?.message) {
        targetMsg = targetMsg.viewOnceMessageV2.message;
      } else if (targetMsg?.viewOnceMessage?.message) {
        targetMsg = targetMsg.viewOnceMessage.message;
      } else if (targetMsg?.viewOnceMessageV2Extension?.message) {
        targetMsg = targetMsg.viewOnceMessageV2Extension.message;
      }

      let mediaObj = null;
      let mediaType = null;

      if (targetMsg?.imageMessage) {
        mediaObj = targetMsg.imageMessage;
        mediaType = "image";
      } else if (targetMsg?.videoMessage) {
        mediaObj = targetMsg.videoMessage;
        mediaType = "video";
      } else if (targetMsg?.audioMessage) {
        mediaObj = targetMsg.audioMessage;
        mediaType = "audio";
      }

      if (!mediaObj || !mediaType) return;

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Download Stream via Baileys Direct Method
      const stream = await downloadContentFromMessage(mediaObj, mediaType);
      const buffer = await streamToBuffer(stream);

      if (!buffer || buffer.length === 0) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: "❌ Media එක decrypt කරගත නොහැකි විය." }, { quoted: msg });
      }

      const defaultCaption = "> *🔓 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐀𝐍𝐓𝐈-𝐕𝐈𝐄𝐖𝐎𝐍𝐂𝐄*";

      if (mediaType === "image") {
        const caption = mediaObj.caption ? `${mediaObj.caption}\n\n${defaultCaption}` : defaultCaption;
        await sock.sendMessage(from, {
          image: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (mediaType === "video") {
        const caption = mediaObj.caption ? `${mediaObj.caption}\n\n${defaultCaption}` : defaultCaption;
        await sock.sendMessage(from, {
          video: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (mediaType === "audio") {
        // Voice Note එක සාමාන්‍ය Audio සහ Voice (PTT) දෙකටම support වෙන safe format එකකින් යැවීම
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: true
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});

    } catch (e) {
      console.error("[VV ERROR]:", e);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ Decryption Error: ${e.message}` }, { quoted: msg });
    }
  }
};
