import { downloadMediaMessage } from "@whiskeysockets/baileys";

// Bot Session ID අනුව Settings Store කිරීම (Default: ON)
global.vvSettings = global.vvSettings || new Map();

// Helper: අදාළ Bot එකේ Phone Number එක ලබා ගැනීම
function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

// Helper: Owner ද යන්න පරීක්ෂාව
function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

  const devNumbers = ["94719845166", "15947733680169"];
  return msg.key.fromMe || senderPhone === botPhone || devNumbers.includes(senderPhone);
}

// View-Once Decrypt Engine
async function processViewOnce({ sock, msg, from }) {
  const botPhone = getBotPhone(sock);
  const isEnabled = global.vvSettings.get(botPhone) ?? true; // Default ON

  if (!isEnabled) return false;

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
      message: { ...viewOnce }
    };

    // 3. Download Buffer
    const buffer = await downloadMediaMessage(
      decryptPayload,
      "buffer",
      {},
      { logger: undefined, reuploadRequest: sock.updateMediaMessage }
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
  description: "Strict View-Once media extractor with per-bot ON/OFF toggle",

  async execute({ sock, msg, from, args }) {
    const subCmd = args[0]?.toLowerCase();
    const botPhone = getBotPhone(sock);

    // .vv on / .vv off Toggle Handling
    if (subCmd === "on" || subCmd === "off") {
      if (!isBotOwner(sock, msg, from)) {
        await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: "⛔ *ACCESS DENIED:* මෙම setting එක වෙනස් කළ හැක්කේ Bot Owner ට පමණි."
        }, { quoted: msg });
      }

      const status = subCmd === "on";
      global.vvSettings.set(botPhone, status);

      const statusText = status ? "✅ *සක්‍රීය කෙරිණි (ACTIVATED)*" : "🛑 *අක්‍රීය කෙරිණි (DISABLED)*";
      await sock.sendMessage(from, { react: { text: status ? "⚡" : "🔒", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `🕷️ *DARK-DINU ANTI-VIEWONCE SETTING* 🕷️\n\n🤖 *Bot Number:* +${botPhone}\n⚙️ *Status:* ${statusText}\n\n${status ? "දැන් View-Once සහ Emojis මඟින් auto-decrypt වේ." : "View-Once decryption මෙම බොට් සඳහා තාවකාලිකව නවතා ඇත."}`
      }, { quoted: msg });
    }

    // සාමාන්‍ය .vv command එක මගින් view-once download කිරීම
    await processViewOnce({ sock, msg, from });
  },

  // Emojis reply කළ විට ක්‍රියාත්මක වන කොටස
  async onReply({ sock, msg, from, body }) {
    const triggerEmojis = ["🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤", "👍"];
    const trimmed = body.trim();

    if (triggerEmojis.includes(trimmed)) {
      return await processViewOnce({ sock, msg, from });
    }

    return false;
  }
};
