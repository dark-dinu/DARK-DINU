import { downloadMediaMessage } from "@whiskeysockets/baileys";

// Bot Session Settings & Memory Cache
global.statusSettings = global.statusSettings || new Map();
global.statusCache = global.statusCache || new Map();
global.statusHookedSockets = global.statusHookedSockets || new WeakSet();

function getBotPhone(sock) {
  const userJid = sock.user?.id || "";
  return userJid.split(":")[0].replace(/[^0-9]/g, "");
}

function getSettings(botPhone) {
  if (!global.statusSettings.has(botPhone)) {
    global.statusSettings.set(botPhone, {
      seen: true,
      react: true,
      emoji: "💚"
    });
  }
  return global.statusSettings.get(botPhone);
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

// Background Listener: Status Seen & React Automation
function attachStatusWatcher(sock) {
  if (!sock || global.statusHookedSockets.has(sock)) return;
  global.statusHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const m of messages) {
      if (!m?.message) continue;

      // Status Broadcast Messages පමණක් අල්ලා ගැනීම
      if (m.key.remoteJid === "status@broadcast") {
        const botPhone = getBotPhone(sock);
        const settings = getSettings(botPhone);

        // Status Message එක Cache කිරීම (Save/Send requests සඳහා)
        if (m.key.id) {
          global.statusCache.set(m.key.id, m);
          if (global.statusCache.size > 2000) {
            const first = global.statusCache.keys().next().value;
            global.statusCache.delete(first);
          }
        }

        // 1. Auto Seen (Read Receipt)
        if (settings.seen) {
          await sock.readMessages([m.key]).catch(() => {});
        }

        // 2. Auto React
        if (settings.react && settings.emoji) {
          const participant = m.key.participant || m.participant;
          if (participant) {
            await sock.sendMessage(
              "status@broadcast",
              {
                react: {
                  text: settings.emoji,
                  key: m.key
                }
              },
              { statusJidList: [participant] }
            ).catch(() => {});
          }
        }
      }
    }
  });
}

// Auto Hook to all active bots in cluster
setInterval(() => {
  if (global.activeSockets) {
    for (const [, s] of global.activeSockets.entries()) {
      attachStatusWatcher(s);
    }
  }
}, 2000);

// Status Media Sender Helper
async function deliverStatusMedia(sock, msg, from, targetStatusMsg) {
  try {
    await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const statusObj = targetStatusMsg.message;
    const isImage = Boolean(statusObj.imageMessage);
    const isVideo = Boolean(statusObj.videoMessage);
    const isAudio = Boolean(statusObj.audioMessage);

    const defaultCaption = "> *🕷️ 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐒𝐓𝐀𝐓𝐔𝐒 𝐒𝐀𝐕𝐄𝐑 🐦‍🔥*";

    if (isImage || isVideo || isAudio) {
      const buffer = await downloadMediaMessage(
        targetStatusMsg,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer || buffer.length === 0) throw new Error("Media buffer empty");

      if (isImage) {
        const cap = statusObj.imageMessage.caption 
          ? `${statusObj.imageMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;
        await sock.sendMessage(from, { image: buffer, caption: cap }, { quoted: msg });
      } else if (isVideo) {
        const cap = statusObj.videoMessage.caption 
          ? `${statusObj.videoMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;
        await sock.sendMessage(from, { video: buffer, caption: cap }, { quoted: msg });
      } else if (isAudio) {
        await sock.sendMessage(from, { audio: buffer, mimetype: "audio/mp4", ptt: false }, { quoted: msg });
      }
    } else {
      // Text Status
      const textStatus = statusObj.conversation || statusObj.extendedTextMessage?.text || "";
      await sock.sendMessage(from, {
        text: `📝 *STATUS TEXT:*\n\n${textStatus}\n\n${defaultCaption}`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
    return true;
  } catch (err) {
    console.error("[STATUS DELIVER ERROR]:", err.message);
    await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
    return false;
  }
}

export default {
  name: "status",
  aliases: ["setreact", "statussave", "ssave"],
  category: "utility",
  description: "Status automation controls and interactive status saver",

  async execute({ sock, msg, from, args, body, config }) {
    attachStatusWatcher(sock);

    const prefix = config?.PREFIX || ".";
    const botPhone = getBotPhone(sock);
    const settings = getSettings(botPhone);

    const firstWord = body.trim().slice(prefix.length).split(/ +/)[0].toLowerCase();

    // 1. .setreact <emoji> Handler
    if (firstWord === "setreact") {
      if (!isBotOwner(sock, msg, from)) {
        return await sock.sendMessage(from, { text: "⛔ මෙය වෙනස් කළ හැක්කේ Bot Owner හට පමණි." }, { quoted: msg });
      }

      const newEmoji = args[0]?.trim();
      if (!newEmoji) {
        return await sock.sendMessage(from, { text: `⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න.\n*උදා:* \`${prefix}setreact 🥺\`` }, { quoted: msg });
      }

      settings.emoji = newEmoji;
      global.statusSettings.set(botPhone, settings);

      await sock.sendMessage(from, { react: { text: newEmoji, key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, {
        text: `✅ *Status React Emoji යාවත්කාලීන විය:*\nනව Emoji: ${newEmoji}`
      }, { quoted: msg });
    }

    // 2. .status seen on/off හෝ .status react on/off Handler
    const actionType = args[0]?.toLowerCase();
    const actionState = args[1]?.toLowerCase();

    if (["seen", "react"].includes(actionType) && ["on", "off"].includes(actionState)) {
      if (!isBotOwner(sock, msg, from)) {
        return await sock.sendMessage(from, { text: "⛔ මෙය වෙනස් කළ හැක්කේ Bot Owner හට පමණි." }, { quoted: msg });
      }

      const isTurnOn = actionState === "on";
      if (actionType === "seen") settings.seen = isTurnOn;
      if (actionType === "react") settings.react = isTurnOn;

      global.statusSettings.set(botPhone, settings);

      const label = actionType === "seen" ? "Auto Seen" : "Auto React";
      const icon = isTurnOn ? "🟢" : "🔴";

      return await sock.sendMessage(from, {
        text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 ⚙️ *STATUS SETTINGS* 〕
├─▸ 🤖 *Bot Node* : +${botPhone}
├─▸ 🎯 *Feature*  : ${label}
├─▸ ⚡ *Status*   : ${icon} ${actionState.toUpperCase()}
├─▸ 🎭 *Emoji*    : ${settings.emoji}
└───────────────────────`
      }, { quoted: msg });
    }

    // 3. Status එකකට Reply කර .status හෝ .statussave ලෙස ගැසූ විට
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

    if (quoted) {
      const cached = global.statusCache.get(quotedId) || {
        key: { remoteJid: "status@broadcast", id: quotedId },
        message: quoted
      };
      return await deliverStatusMedia(sock, msg, from, cached);
    }

    // Default Status Dashboard
    return await sock.sendMessage(from, {
      text: `╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📺 *STATUS AUTOMATION* 〕
├─▸ 👁️ *Auto Seen*  : ${settings.seen ? "🟢 ON" : "🔴 OFF"}
├─▸ 💖 *Auto React* : ${settings.react ? "🟢 ON" : "🔴 OFF"}
├─▸ 🎭 *React Emoji*: ${settings.emoji}
└───────────────────────

📌 *පාලනය කිරීමට:*
• \`${prefix}status seen on\` / \`off\`
• \`${prefix}status react on\` / \`off\`
• \`${prefix}setreact 🥺\`

📥 *Status එකක් ලබාගැනීමට:*
Status එකකට Reply කර *එවන්න*, *send*, *දාපන්*, *oni* ලෙස යවන්න.`
    }, { quoted: msg });
  },

  // 4. Interactive Reply Saver (Index.js වෙනස් නොකර ක්‍රියාත්මක වේ)
  async onReply({ sock, msg, from, body, quotedStanzaId }) {
    const rawWord = body.trim().toLowerCase();

    // ඉල්ලීම් වචන ලැයිස්තුව
    const triggerWords = [
      "oni", "ඔනි", "ඕනි", "one", 
      "ewanna", "එවන්න", "ewapan", "එවපන්", "ewahan", "එවහන්",
      "dapan", "දාපන්", "danna", "දාන්න",
      "send", "sendme", "save", "saveme"
    ];

    if (!triggerWords.includes(rawWord)) return false;

    // Cache එකෙන් හෝ contextInfo එකෙන් අදාළ status එක සොයා ගැනීම
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = global.statusCache.get(quotedStanzaId) || (quotedMsg ? {
      key: { remoteJid: "status@broadcast", id: quotedStanzaId },
      message: quotedMsg
    } : null);

    if (!target) return false;

    return await deliverStatusMedia(sock, msg, from, target);
  }
};
