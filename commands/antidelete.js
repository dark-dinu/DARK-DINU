import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { cleanPhone, getSessionConfig, updateSessionConfig } from "../src/core/sessionManager.js";

// High-speed memory store
global.antiDeleteStore = global.antiDeleteStore || new Map();
global.antiDeleteHookedSockets = global.antiDeleteHookedSockets || new WeakSet();

const MAX_CACHE_SIZE = 2000;

function isBotOwner(sock, msg, from) {
  const botPhone = cleanPhone(sock.user?.id || "");
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = cleanPhone(senderJid);

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
      const isRevoke = protocol && (protocol.type === 0 || protocol.type === 14 || protocol.type === "REVOKE");

      if (isRevoke) {
        const deletedKey = protocol.key;
        if (!deletedKey?.id) continue;

        const botPhone = cleanPhone(sock.user?.id || "");
        
        // 🔴 FIX: .setting හරහා MongoDB/SessionManager එකෙන් state එක කියවීම
        const cfg = getSessionConfig(botPhone);
        if (!cfg || !cfg.antiDelete) continue;

        const cachedMsg = global.antiDeleteStore.get(deletedKey.id);
        if (!cachedMsg || !cachedMsg.message) continue;

        const isGroup = chatJid.endsWith("@g.us");
        const deleterJid = m.key.participant || deletedKey.participant || cachedMsg.key?.participant || chatJid;
        const deleterPhone = cleanPhone(deleterJid);
        const senderName = cachedMsg.pushName || m.pushName || `+${deleterPhone}`;

        const timeStr = new Date().toLocaleTimeString("en-US", {
          timeZone: "Asia/Colombo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        });

        const headerUI = 
`🌸 ｡ﾟ•┈୨ *CAUGHT YA DELETING!* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🐰 *Sender:* *${senderName}* (+${deleterPhone})
  🕒 *Time:* ${timeStr}
  💌 *Chat:* ${isGroup ? "Group Chat" : "Private DM"}
  🍬 *Note:* _Don't be shy, I caught your message! (˶˃ ᵕ ˂˶)_

━━━━━━━━━━━━━━━━━━━━━`;

        // Destination Handling (cfg.antiSendDest අනුව: 'me' නම් Bot Inbox එකට, 'from' නම් Current Chat එකට)
        const targetJid = cfg.antiSendDest === "me" ? `${botPhone}@s.whatsapp.net` : chatJid;
        const rawMsg = cachedMsg.message;

        // 1. Text Message Recovery
        const textContent =
          rawMsg.conversation ||
          rawMsg.extendedTextMessage?.text ||
          null;

        if (textContent) {
          await sock.sendMessage(targetJid, {
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
              await sock.sendMessage(targetJid, {
                image: mediaBuffer,
                caption: `${headerUI}${caption}\n\n💖 *© DARK-DINU MD*`
              }).catch(() => {});
            } else if (rawMsg.videoMessage) {
              const caption = rawMsg.videoMessage.caption ? `\n\n💭 *Caption:* _${rawMsg.videoMessage.caption}_` : "";
              await sock.sendMessage(targetJid, {
                video: mediaBuffer,
                caption: `${headerUI}${caption}\n\n💖 *© DARK-DINU MD*`
              }).catch(() => {});
            } else if (rawMsg.audioMessage) {
              await sock.sendMessage(targetJid, {
                text: `${headerUI}\n\n🎙️ *Deleted Audio Note:*`
              }).catch(() => {});
              await sock.sendMessage(targetJid, {
                audio: mediaBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
              }).catch(() => {});
            } else if (rawMsg.stickerMessage) {
              await sock.sendMessage(targetJid, {
                text: `${headerUI}\n\n🎨 *Deleted Cute Sticker:*`
              }).catch(() => {});
              await sock.sendMessage(targetJid, { sticker: mediaBuffer }).catch(() => {});
            }
          } catch (_) {}
        });
        continue;
      }

      // ==========================================
      // B. HIGH-SPEED MESSAGE CACHING
      // ==========================================
      if (m.key?.id && !m.key.fromMe) {
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
    const botPhone = cleanPhone(sock.user?.id || "");

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
      await updateSessionConfig(botPhone, "antiDelete", status);

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

    const cfg = getSessionConfig(botPhone);
    const currentStatus = cfg?.antiDelete ?? true;
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
