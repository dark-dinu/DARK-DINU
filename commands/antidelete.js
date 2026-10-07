import { downloadMediaMessage } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";

// 1. Message Storage & Status Cache
global.antiDeleteStore = global.antiDeleteStore || new NodeCache({ stdTTL: 7200, checkperiod: 120 }); // පැය 2ක්
global.antiDeleteSettings = global.antiDeleteSettings || new Map();
global.hookedSockets = global.hookedSockets || new WeakSet();

// Helper: Bot Phone Number එක ලබා ගැනීම
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

// 2. Anti-Delete Engine එක Socket එකට Hook කිරීම (Index.js වෙනස් නොකර)
function attachAntiDeleteEngine(sock) {
  if (!sock || global.hookedSockets.has(sock)) return;
  global.hookedSockets.add(sock);

  // A. පැමිණෙන සියලු පණිවිඩ Cache එකට දැමීම
  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (m?.key?.id && m.message && m.key.remoteJid !== "status@broadcast") {
        global.antiDeleteStore.set(m.key.id, m);
      }
    }
  });

  // B. Delete (Revoke) වූ පණිවිඩ හඳුනාගෙන යැවීම
  sock.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      const isRevoke =
        update.update?.messageStubType === 68 ||
        update.update?.message?.protocolMessage?.type === 0 ||
        update.update?.message?.protocolMessage?.type === "REVOKE";

      if (!isRevoke) continue;

      const deletedKey = update.key || {
        remoteJid: update.update?.message?.protocolMessage?.key?.remoteJid,
        id: update.update?.message?.protocolMessage?.key?.id,
        participant: update.update?.message?.protocolMessage?.key?.participant
      };

      const targetId = deletedKey.id;
      const targetChat = deletedKey.remoteJid;
      if (!targetId || !targetChat) continue;

      // Bot Settings පරීක්ෂාව
      const botPhone = getBotPhone(sock);
      const isAntiDeleteOn = global.antiDeleteSettings.get(botPhone) ?? true;
      if (!isAntiDeleteOn) continue;

      // Cache එකෙන් පණිවිඩය ලබාගැනීම
      const cachedMsg = global.antiDeleteStore.get(targetId);
      if (!cachedMsg || !cachedMsg.message) continue;

      const isGroup = targetChat.endsWith("@g.us");
      const deleterJid = deletedKey.participant || cachedMsg.key?.participant || targetChat;
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
        await sock.sendMessage(targetChat, {
          text: `${headerUI}\n\n💬 *Deleted Text:*\n> ${textContent}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 🛡️*`
        }).catch(() => {});
        continue;
      }

      // 2. Media Message Recover (Image / Video / Voice / Audio / Sticker)
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
            await sock.sendMessage(targetChat, {
              image: mediaBuffer,
              caption: `${headerUI}${caption}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 🛡️*`
            }).catch(() => {});

          } else if (rawMsg.videoMessage) {
            const caption = rawMsg.videoMessage.caption ? `\n\n📝 *Caption:* ${rawMsg.videoMessage.caption}` : "";
            await sock.sendMessage(targetChat, {
              video: mediaBuffer,
              caption: `${headerUI}${caption}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄 🛡️*`
            }).catch(() => {});

          } else if (rawMsg.audioMessage) {
            await sock.sendMessage(targetChat, {
              text: `${headerUI}\n\n🔊 *Deleted Voice Note Below:*`
            }).catch(() => {});
            await sock.sendMessage(targetChat, {
              audio: mediaBuffer,
              mimetype: "audio/ogg; codecs=opus",
              ptt: true
            }).catch(() => {});

          } else if (rawMsg.stickerMessage) {
            await sock.sendMessage(targetChat, {
              text: `${headerUI}\n\n🎭 *Deleted Sticker Below:*`
            }).catch(() => {});
            await sock.sendMessage(targetChat, { sticker: mediaBuffer }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[Anti-Delete Media Decrypt Error]:", err.message);
      }
    }
  });
}

// 3. Background Watcher: Active Sockets සියල්ල auto-hook කිරීම
setInterval(() => {
  if (global.activeSockets) {
    for (const [, s] of global.activeSockets.entries()) {
      attachAntiDeleteEngine(s);
    }
  }
}, 3000);

// 4. Command Export
export default {
  name: "antidelete",
  aliases: ["antidel"],
  category: "utility",
  description: "Toggle Anti-Delete monitor for Group and Inbox chats",

  async execute({ sock, msg, from, args }) {
    // Current socket එක hook වී නොමැති නම් වහාම hook කිරීම
    attachAntiDeleteEngine(sock);

    const subCmd = args[0]?.toLowerCase();
    const botPhone = getBotPhone(sock);

    if (!isBotOwner(sock, msg, from)) {
      await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
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
      await sock.sendMessage(from, { react: { text: status ? "🛡️" : "🔒", key: msg.key } }).catch(() => {});

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
