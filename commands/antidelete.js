import { downloadMediaMessage } from "@whiskeysockets/baileys";

// High-speed memory store with safe max capacity
global.antiDeleteStore = global.antiDeleteStore || new Map();
global.antiDeleteSettings = global.antiDeleteSettings || new Map();
global.antiDeleteHookedSockets = global.antiDeleteHookedSockets || new WeakSet();

const MAX_CACHE_SIZE = 1500;

function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

  const devNumbers = ["94719845166", "15947733680169"];
  return msg.key.fromMe || senderPhone === botPhone || devNumbers.includes(senderPhone);
}

// Ultra-fast background delete catcher
export function attachAntiDeleteEngine(sock) {
  if (!sock || global.antiDeleteHookedSockets.has(sock)) return;
  global.antiDeleteHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      if (!m?.message) continue;

      const chatJid = m.key.remoteJid;
      if (!chatJid || chatJid === "status@broadcast") continue;

      // ==========================================
      // A. REVOKE (DELETED MESSAGE) DETECTOR
      // ==========================================
      const protocol = m.message.protocolMessage;
      if (protocol && (protocol.type === 0 || protocol.type === "REVOKE")) {
        const deletedKey = protocol.key;
        if (!deletedKey?.id) continue;

        const botPhone = getBotPhone(sock);
        const isEnabled = global.antiDeleteSettings.get(botPhone) ?? true;
        if (!isEnabled) continue;

        const cachedMsg = global.antiDeleteStore.get(deletedKey.id);
        if (!cachedMsg || !cachedMsg.message) continue;

        const isGroup = chatJid.endsWith("@g.us");
        const deleterJid = m.key.participant || deletedKey.participant || cachedMsg.key?.participant || chatJid;
        const deleterPhone = String(deleterJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
        const senderName = cachedMsg.pushName || m.pushName || `+${deleterPhone}`;

        const timeStr = new Date().toLocaleTimeString("en-US", {
          timeZone: "Asia/Colombo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        });

        // Cute Aesthetic UI Header
        const headerUI = 
`🌸 ｡ﾟ•┈୨ *CAUGHT YA DELETING!* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🐰 *Sender:* *${senderName}* (+${deleterPhone})
  🕒 *Time:* ${timeStr}
  💌 *Chat:* ${isGroup ? "Group Chat" : "Private DM"}
  🍬 *Note:* _Don't be shy, I caught your message! (˶˃ ᵕ ˂˶)_

━━━━━━━━━━━━━━━━━━━━━`;

        const rawMsg = cachedMsg.message;

        // 1. Text Message Recovery
        const textContent =
          rawMsg.conversation ||
          rawMsg.extendedTextMessage?.text ||
          null;

        if (textContent) {
          sock.sendMessage(chatJid, {
            text: `${headerUI}\n\n📝 *Deleted Message:*\n> ${textContent}\n\n💖 *© DARK-DINU MD* • https://heshan.devofc.top/`
          }).catch(() => {});
          continue;
        }

        // 2. Fast Media Message Recovery
        setImmediate(async () => {
          try {
            const mediaBuffer = await downloadMediaMessage(
              cachedMsg,
              "buffer",
              {},
              { reuploadRequest: sock.updateMediaMessage }
            );

            if (!mediaBuffer || mediaBuffer.length === 0) return;

            if (rawMsg.imageMessage) {
              const caption = rawMsg.imageMessage.caption ? `\n\n💭 *Caption:* _${rawMsg.imageMessage.caption}_` : "";
              await sock.sendMessage(chatJid, {
                image: mediaBuffer,
                caption: `${headerUI}${caption}\n\n💖 *© DARK-DINU MD*`
              }).catch(() => {});
            } else if (rawMsg.videoMessage) {
              const caption = rawMsg.videoMessage.caption ? `\n\n💭 *Caption:* _${rawMsg.videoMessage.caption}_` : "";
              await sock.sendMessage(chatJid, {
                video: mediaBuffer,
                caption: `${headerUI}${caption}\n\n💖 *© DARK-DINU MD*`
              }).catch(() => {});
            } else if (rawMsg.audioMessage) {
              await sock.sendMessage(chatJid, {
                text: `${headerUI}\n\n🎙️ *Deleted Audio Note:*`
              }).catch(() => {});
              await sock.sendMessage(chatJid, {
                audio: mediaBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
              }).catch(() => {});
            } else if (rawMsg.stickerMessage) {
              await sock.sendMessage(chatJid, {
                text: `${headerUI}\n\n🎨 *Deleted Cute Sticker:*`
              }).catch(() => {});
              await sock.sendMessage(chatJid, { sticker: mediaBuffer }).catch(() => {});
            }
          } catch (_) {}
        });
        continue;
      }

      // ==========================================
      // B. HIGH-SPEED MESSAGE CACHING
      // ==========================================
      if (m.key?.id && !m.key.fromMe) {
        // Zero-lag FIFO Eviction
        if (global.antiDeleteStore.size >= MAX_CACHE_SIZE) {
          const oldestKey = global.antiDeleteStore.keys().next().value;
          global.antiDeleteStore.delete(oldestKey);
        }
        global.antiDeleteStore.set(m.key.id, m);
      }
    }
  });
}

export default {
  name: "antidelete",
  aliases: ["antidel"],
  category: "utility",
  description: "Toggle cute Anti-Delete protector for chats",

  async execute({ sock, msg, from, args, prefix }) {
    attachAntiDeleteEngine(sock);

    const subCmd = args[0]?.toLowerCase();
    const botPhone = getBotPhone(sock);

    // Cute Owner Guard
    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Uh-oh!* Only my master/owner can touch this setting sweetheart~ 🌸" },
        { quoted: msg }
      );
    }

    if (subCmd === "on" || subCmd === "off") {
      const status = subCmd === "on";
      global.antiDeleteSettings.set(botPhone, status);

      sock.sendMessage(from, { react: { text: status ? "💖" : "💤", key: msg.key } }).catch(() => {});

      const statusCard = 
`🎀 ｡ﾟ•┈୨ *ANTI-DELETE GUARDIAN* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📱 *Bot Instance:* +${botPhone}
  🛡️ *Protection Status:* *${status ? "Activated & Watching 🌸✨" : "Turned Off & Sleeping 💤"}*
  💌 *Coverage:* Group Chats & Direct Messages

━━━━━━━━━━━━━━━━━━━━━
_${status ? "I'll save and show any deleted messages for you right away!" : "Anti-delete guardian is now resting softly."}_

💖 *© DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: statusCard }, { quoted: msg });
    }

    const currentStatus = global.antiDeleteSettings.get(botPhone) ?? true;
    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *ANTI-DELETE SETTINGS* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  • *${prefix}antidelete on*  — Turn protection on ✨
  • *${prefix}antidelete off* — Turn protection off 💤

  ⚙️ *Current State:* ${currentStatus ? "🟢 ACTIVE & PROTECTED" : "🔴 DISABLED"}
  
💖 *DARK-DINU Cloud* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
