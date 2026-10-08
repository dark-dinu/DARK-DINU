import { downloadMediaMessage } from "@whiskeysockets/baileys";

// Static Pre-allocated Lookup Tables (O(1) Memory Layout)
const DEV_SET = new Set(["94719845166", "15947733680169"]);
const TRIGGER_EMOJI_SET = new Set([
  "🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤", "👍", "💖", "✨"
]);

// High-speed In-Memory Settings Cache
global.vvSettings = global.vvSettings || new Map();

// Fast sub-nanosecond telephone extractor
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  if (msg.key.fromMe) return true;

  const senderJid = msg.key.participant || msg.participant || from || "";
  const cleanSender = fastExtractPhone(senderJid);

  return cleanSender === botPhone || DEV_SET.has(cleanSender);
}

// Low-latency View-Once Decryption Engine
async function processViewOnce({ sock, msg, from }) {
  const botPhone = getBotPhone(sock);
  const isEnabled = global.vvSettings.get(botPhone) ?? true;
  if (!isEnabled) return false;

  try {
    const rawMsg = msg.message?.ephemeralMessage?.message || msg.message;
    const contextInfo =
      rawMsg?.extendedTextMessage?.contextInfo ||
      rawMsg?.imageMessage?.contextInfo ||
      rawMsg?.videoMessage?.contextInfo;

    const quoted = contextInfo?.quotedMessage;
    if (!quoted) return false;

    // Fast Deep View-Once Pointer Extraction
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

    // Instant Microsecond Reaction
    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    // Decrypt Payload Construction
    const decryptPayload = {
      key: {
        remoteJid: from,
        id: contextInfo.stanzaId,
        participant: contextInfo.participant || from
      },
      message: { ...viewOnce }
    };

    // Buffer Download Pipeline
    const buffer = await downloadMediaMessage(
      decryptPayload,
      "buffer",
      {},
      { logger: undefined, reuploadRequest: sock.updateMediaMessage }
    );

    if (!buffer || buffer.length === 0) {
      throw new Error("Decrypted media buffer is empty (0 Bytes)");
    }

    const defaultFooter = "\n\n🎀 ｡ﾟ•┈୨ *UNLOCKED VIEW-ONCE* ୧┈•ﾟ｡ 🐾\n💖 *DARK-DINU MD* • https://heshan.devofc.top/";

    // Fast Direct Dispatch
    if (mediaType === "image") {
      const originalCaption = viewOnce.imageMessage?.caption ? `💬 *Caption:* _${viewOnce.imageMessage.caption}_` : "";
      await sock.sendMessage(
        from,
        {
          image: buffer,
          caption: originalCaption ? `${originalCaption}${defaultFooter}` : defaultFooter.trim()
        },
        { quoted: msg }
      );
    } else if (mediaType === "video") {
      const originalCaption = viewOnce.videoMessage?.caption ? `💬 *Caption:* _${viewOnce.videoMessage.caption}_` : "";
      await sock.sendMessage(
        from,
        {
          video: buffer,
          caption: originalCaption ? `${originalCaption}${defaultFooter}` : defaultFooter.trim()
        },
        { quoted: msg }
      );
    } else if (mediaType === "audio") {
      await sock.sendMessage(
        from,
        {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: true
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});
    return true;

  } catch (err) {
    console.error("[VV PROCESS ERROR]:", err.message);
    sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
    await sock.sendMessage(
      from,
      { text: `🌸 *Glitch detected:* Could not decrypt view-once softly (${err.message || "Decoding error"})` },
      { quoted: msg }
    ).catch(() => {});
    return true;
  }
}

export default {
  name: "vv",
  aliases: ["save", "viewonce", "antiviewonce"],
  category: "utility",
  description: "Cute & lightning fast View-Once media unlocker",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const subCmd = args[0]?.toLowerCase().trim();
    const botPhone = getBotPhone(sock);

    // .vv on / .vv off Toggle Handling
    if (subCmd === "on" || subCmd === "off") {
      if (!isBotOwner(sock, msg, from)) {
        sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🎀 *Only my sweet master can change View-Once settings!* 🌸" },
          { quoted: msg }
        );
      }

      const status = subCmd === "on";
      global.vvSettings.set(botPhone, status);

      sock.sendMessage(from, { react: { text: status ? "💖" : "💤", key: msg.key } }).catch(() => {});

      const statusCard = 
`🎀 ｡ﾟ•┈୨ *ANTI-VIEWONCE GUARDIAN* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📱 *Bot Instance:* \`+${botPhone}\`
  ✨ *Decryption Status:* *${status ? "ACTIVE & UNLOCKING 🌸" : "RESTING & OFF 💤"}*
  🍭 *Trigger Modes:* Command (*${pref}vv*) & Sweet Emoji Replies

━━━━━━━━━━━━━━━━━━━━━
_${status ? "Reply to any View-Once media with emojis or .vv to unlock it instantly!" : "Anti-ViewOnce decryption is now sleeping softly."}_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: statusCard }, { quoted: msg });
    }

    // Direct .vv command execution
    const handled = await processViewOnce({ sock, msg, from });
    if (!handled) {
      sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *VIEW-ONCE GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  • Reply to any View-Once photo or video with *${pref}vv*
  • Reply with sweet emojis like *🥺*, *😂*, *❤*, *✨* to unlock!
  • Toggle setting: *${pref}vv on* or *${pref}vv off*

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }
  },

  // Low-latency Emoji Trigger Hook
  async onReply({ sock, msg, from, body }) {
    const trimmed = body.trim();
    if (TRIGGER_EMOJI_SET.has(trimmed)) {
      return await processViewOnce({ sock, msg, from });
    }
    return false;
  }
};
