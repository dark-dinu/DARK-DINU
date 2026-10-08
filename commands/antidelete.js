import { downloadMediaMessage } from "@whiskeysockets/baileys";

// Lightweight Cache (Memory safe - 2,000 max)
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

// Background Listener Engine
function attachAntiDeleteEngine(sock) {
  if (!sock || global.antiDeleteHookedSockets.has(sock)) return;
  global.antiDeleteHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages }) => {
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
        
        // Sender Name / PushName detect
        const senderName = cachedMsg.pushName || m.pushName || `+${deleterPhone}`;

        // Live Time (Asia/Colombo)
        const timeStr = new Date().toLocaleTimeString("en-GB", {
          timeZone: "Asia/Colombo",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        });

        // Clean Single-Line Aesthetic UI
        const headerUI = 
`🍓 ༆⃝⃤ *Oops! Someone Deleted A Message~* 🫧 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 👤 *ꜱᴇɴᴅᴇʀ* : *${senderName}* (+${deleterPhone})
┊◈ 🕐 *ᴛɪᴍᴇ*   : ${timeStr}
┊◈ 💬 *ᴄʜᴀᴛ*   : ${isGroup ? "Group Chat" : "Private (DM)"}
┊◈ ✨ *ɴᴏᴛᴇ*   : _Don't worry, I saved it for you!_ 💕
────────────────────`;

        const rawMsg = cachedMsg.message;

        // 1. Text Message Recovery
        const textContent =
          rawMsg.conversation ||
          rawMsg.extendedTextMessage?.text ||
          null;

        if (textContent) {
          sock.sendMessage(chatJid, {
            text: `${headerUI}\n\n📝 *ᴅᴇʟᴇᴛᴇᴅ ᴍᴇꜱꜱᴀɢᴇ :*\n> ${textContent}\n\n🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍 | 📍 https://heshan.devofc.top/`
          }).catch(() => {});
          continue;
        }

        // 2. Media Message Recovery
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
                const caption = rawMsg.imageMessage.caption ? `\n\n💬 *ᴄᴀᴘᴛɪᴏɴ :* _${rawMsg.imageMessage.caption}_` : "";
                await sock.sendMessage(chatJid, {
                  image: mediaBuffer,
                  caption: `${headerUI}${caption}\n\n🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍 | 📍 https://heshan.devofc.top/`
                }).catch(() => {});
              } else if (rawMsg.videoMessage) {
                const caption = rawMsg.videoMessage.caption ? `\n\n💬 *ᴄᴀᴘᴛɪᴏɴ :* _${rawMsg.videoMessage.caption}_` : "";
                await sock.sendMessage(chatJid, {
                  video: mediaBuffer,
                  caption: `${headerUI}${caption}\n\n🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍 | 📍 https://heshan.devofc.top/`
                }).catch(() => {});
              } else if (rawMsg.audioMessage) {
                await sock.sendMessage(chatJid, {
                  text: `${headerUI}\n\n🔊 *ᴅᴇʟᴇᴛᴇᴅ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ :*\n🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍`
                }).catch(() => {});
                await sock.sendMessage(chatJid, {
                  audio: mediaBuffer,
                  mimetype: "audio/ogg; codecs=opus",
                  ptt: true
                }).catch(() => {});
              } else if (rawMsg.stickerMessage) {
                await sock.sendMessage(chatJid, {
                  text: `${headerUI}\n\n🎭 *ᴅᴇʟᴇᴛᴇᴅ ꜱᴛɪᴄᴋᴇʀ :*\n🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍`
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

        // Memory cleanup
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

// Background Monitor Hook
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
        { text: "⛔ *Access Denied:* මෙම setting එක වෙනස් කළ හැක්කේ Bot Owner ට පමණි." },
        { quoted: msg }
      );
    }

    if (subCmd === "on" || subCmd === "off") {
      const status = subCmd === "on";
      global.antiDeleteSettings.set(botPhone, status);

      const statusText = status ? "Active & Guarding 🛡️✨" : "Disabled 🔒";
      sock.sendMessage(from, { react: { text: status ? "🍓" : "🔒", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: 
`🍓 ༆⃝⃤ *DARK-DINU ANTI-DELETE ENGINE* 🎀 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 📱 *ʙᴏᴛ ɴᴏᴅᴇ* : +${botPhone}
┊◈ ⚙️ *ꜱᴛᴀᴛᴜꜱ*   : *${statusText}*
┊◈ 🌐 *ᴄᴏᴠᴇʀᴀɢᴇ* : Group & Private (DM)
────────────────────
_${status ? "මැකූ ඕනෑම පණිවිඩයක් දැන් ක්ෂණිකව recover කරනු ඇත." : "Anti-Delete පහසුකම අක්‍රීය කර ඇත."}_

🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍 | 📍 https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    const currentStatus = global.antiDeleteSettings.get(botPhone) ?? true;
    return await sock.sendMessage(
      from,
      {
        text: `🍓 *ANTI-DELETE SETUP*\n\n• *.antidelete on* - සක්‍රීය කිරීමට\n• *.antidelete off* - අක්‍රීය කිරීමට\n\n> ⚙️ *Current Status :* ${currentStatus ? "🟢 ON" : "🔴 OFF"}\n📍 https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
