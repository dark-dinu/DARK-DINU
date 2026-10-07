import { downloadMediaMessage } from "@whiskeysockets/baileys";

// View-Once එකක් Decrypt කර chat එකට යවන පොදු Function එක
async function processViewOnce({ sock, msg, from }) {
  try {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;

    if (!quoted) return false;

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

    // View-Once එකක් නොවේ නම් නවතින්න
    if (!viewOnce) return false;

    if (viewOnce.imageMessage) mediaType = "image";
    else if (viewOnce.videoMessage) mediaType = "video";
    else if (viewOnce.audioMessage) mediaType = "audio";

    if (!mediaType) return false;

    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    // 2. Full Decryption Wrapper
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

    // 3. Download Buffer via Baileys Native Method
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

    const defaultCaption = "> *🔓 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍U 𝐀𝐍𝐓𝐈-𝐕𝐈𝐄𝐖𝐎𝐍𝐂𝐄*";

    // 4. Send Decrypted Media
    if (mediaType === "image") {
      const caption = viewOnce.imageMessage?.caption 
        ? `${viewOnce.imageMessage.caption}\n\n${defaultCaption}` 
        : defaultCaption;

      await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg });

    } else if (mediaType === "video") {
      const caption = viewOnce.videoMessage?.caption 
        ? `${viewOnce.videoMessage.caption}\n\n${defaultCaption}` 
        : defaultCaption;

      await sock.sendMessage(from, { video: buffer, caption }, { quoted: msg });

    } else if (mediaType === "audio") {
      await sock.sendMessage(from, {
        audio: buffer,
        mimetype: "audio/mp4",
        ptt: true
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});
    return true;

  } catch (err) {
    console.error("[VV PROCESS ERROR]:", err.message);
    await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
    await sock.sendMessage(from, { 
      text: `❌ *View-Once Extract අසාර්ථකයි:*\n\n${err.message || "Decryption Error"}` 
    }, { quoted: msg });
    return true;
  }
}

export default {
  name: "vv",
  aliases: ["save", "viewonce", "antiviewonce"],
  category: "utility",
  description: "Strict View-Once media extractor",

  // 1. Prefix සහිතව ගහන Command එක (.vv)
  async execute({ sock, msg, from }) {
    await processViewOnce({ sock, msg, from });
  },

  // 2. Prefix නැතුව නිකන්ම Emoji එකක් Reply කළ විට (index.js වෙනස් නොකර ක්‍රියාත්මක වන කොටස)
  async onReply({ sock, msg, from, body }) {
    const triggerEmojis = ["🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤", "👍"];
    const trimmed = body.trim();

    // Reply එක මේ Emoji වලින් එකක් නම් පමණක් run වේ
    if (triggerEmojis.includes(trimmed)) {
      return await processViewOnce({ sock, msg, from });
    }

    return false;
  }
};
