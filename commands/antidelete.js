import { downloadMediaMessage } from "@whiskeysockets/baileys";

// Lightweight Cache (Memory පිරීම වැළැක්වීමට 2,000කට සීමා කර ඇත)
global.antiDeleteStore = global.antiDeleteStore || new Map();
global.antiDeleteSettings = global.antiDeleteSettings || new Map();
global.antiDeleteHookedSockets = global.antiDeleteHookedSockets || new WeakSet();

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

// Background Listener Engine (Zero Loop Lag)
function attachAntiDeleteEngine(sock) {
  if (!sock || global.antiDeleteHookedSockets.has(sock)) return;
  global.antiDeleteHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // Background execution to prevent event-loop delays
    for (const m of messages) {
      if (!m?.message) continue;

      const chatJid = m.key.remoteJid;
      if (!chatJid || chatJid === "status@broadcast") continue;

      // ==========================================
      // A. REVOKE (DELETE FOR EVERYONE) DETECTOR
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

        const timeStr = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour12: true });

        const headerUI = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🗑️ *DELETED MESSAGE DETECTED* 〕
├─▸ 👤 *Deleted By* : +${deleterPhone}
├─▸ 🌐 *Chat Type*  : ${isGroup ? "Group Chat" : "Private (DM)"}
├─▸ ⏰ *Time*       : ${timeStr}
└───────────────────────`;

        const rawMsg = cachedMsg.message;

        // 1. Text Message Recover
        const textContent =
          rawMsg.conversation ||
          rawMsg.extendedTextMessage?.text ||
          null;

        if (textContent) {
          sock.sendMessage(chatJid, {
            text: `${headerUI}\n\n💬 *Deleted Text:*\n> ${textContent}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 🛡️*`
          }).catch(() => {});
          continue;
        }

        // 2. Media Message Recover (Async Non-blocking)
        (async () => {
          try {
            const mediaBuffer = await downloadMediaMessage(
              cachedMsg,
              "buffer",
              {},
              { reuploadRequest: sock.updateMediaMessage }
            );

            if (mediaBuffer && mediaBuffer.length > 0) {
              if (rawMsg.imageMessage) {
                const caption = rawMsg.imageMessage.caption ? `\n\n📝 *Caption:* ${rawMsg.imageMessage.caption}` : "";
                await sock.sendMessage(chatJid, {
                  image: mediaBuffer,
                  caption: `${headerUI}${caption}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 🛡️*`
                }).catch(() => {});
              } else if (rawMsg.videoMessage) {
                const caption = rawMsg.videoMessage.caption ? `\n\n📝 *Caption:* ${rawMsg.videoMessage.caption}` : "";
                await sock.sendMessage(chatJid, {
                  video: mediaBuffer,
                  caption: `${headerUI}${caption}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 🛡️*`
                }).catch(() => {});
              } else if (rawMsg.audioMessage) {
                await sock.sendMessage(chatJid, {
                  text: `${headerUI}\n\n🔊 *Deleted Voice Note Below:*`
                }).catch(() => {});
                await sock.sendMessage(chatJid, {
                  audio: mediaBuffer,
                  mimetype: "audio/ogg; codecs=opus",
                  ptt: true
                }).catch(() => {});
              } else if (rawMsg.stickerMessage) {
                await sock.sendMessage(chatJid, {
                  text: `${headerUI}\n\n🎭 *Deleted Sticker Below:*`
                }).catch(() => {});
                await sock.sendMessage(chatJid, { sticker: mediaBuffer }).catch(() => {});
              }
            }
          } catch (_) {}
        })();
        continue;
      }

      // ==========================================
      // B. FAST MESSAGE CACHING
      // ==========================================
      if (m.key?.id && !m.key.fromMe) {
        global.antiDeleteStore.set(m.key.id, m);

        // Memory cleanup (පැරණි 500ක් එකවර අයින් කර RAM එක Free තබයි)
        if (global.antiDeleteStore.size > 2000) {
          const keys = Array.from(global.antiDeleteStore.keys());
          for (let i = 0; i < 500; i++) {
            global.antiDeleteStore.delete(keys[i]);
          }
        }
      }
    }
  });
}

// Background Monitor: තත්පර 20කට වරක් පමණක් සැහැල්ලුවෙන් Check වේ
if (!global.antiDeleteIntervalStarted) {
  global.antiDeleteIntervalStarted = true;
  setInterval(() => {
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        attachAntiDeleteEngine(s);
      }
    }
  }, 20000);
}

export default {
  name: "antidelete",
  aliases: ["antidel"],
  category: "utility",
  description: "Toggle Anti-Delete monitor for Group and Inbox chats",

  async execute({ sock, msg, from, args }) {
    attachAntiDeleteEngine(sock);

    const subCmd = args[0]?.toLowerCase();
    const botPhone = getBotPhone(sock);

    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "⛔ *ACCESS DENIED:* මෙම setting එක වෙනස් කළ හැක්කේ Bot Owner ට පමණි." },
        { quoted: msg }
      );
    }

    if (subCmd === "on" || subCmd === "off") {
      const status = subCmd === "on";
      global.antiDeleteSettings.set(botPhone, status);

      const statusText = status ? "✅ *සක්‍රීය කෙරිණි (ACTIVATED)*" : "🛑 *අක්‍රීය කෙරිණි (DISABLED)*";
      sock.sendMessage(from, { react: { text: status ? "🛡️" : "🔒", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🛡️ *ANTI-DELETE ENGINE* 〕
├─▸ 🤖 *Bot Node* : +${botPhone}
├─▸ ⚙️ *Status*   : ${statusText}
├─▸ 🌐 *Coverage* : Group & Private (DM)
└───────────────────────

${status ? "දැන් මැකූ ඕනෑම Text, Voice හෝ Media පණිවිඩයක් ක්ෂණිකව නැවත එවනු ඇත." : "Anti-Delete පහසුකම මෙම බොට් සඳහා තාවකාලිකව නවතා ඇත."}`
        },
        { quoted: msg }
      );
    }

    const currentStatus = global.antiDeleteSettings.get(botPhone) ?? true;
    return await sock.sendMessage(
      from,
      {
        text: `⚠️ *භාවිතය:*\n• .antidelete on - සක්‍රීය කිරීමට\n• .antidelete off - අක්‍රීය කිරීමට\n\n*Current Status:* ${currentStatus ? "🟢 ON" : "🔴 OFF"}`
      },
      { quoted: msg }
    );
  }
};
