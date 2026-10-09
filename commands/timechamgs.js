import fs from "fs";
import path from "path";
import { 
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto 
} from "@whiskeysockets/baileys";
import { cleanPhone, initializeSessionState, updateSessionDataList } from "../core/sessionManager.js";

// ==========================================
// ඔයාගේ Bot එකේ Logo එක තියෙන Path එක මෙතනට දෙන්න
// ==========================================
const LOCAL_LOGO_PATH = path.resolve("./logo.jpg"); // logo.jpg වෙන ෆෝල්ඩර් එකක නම් './assets/logo.jpg' වගේ දෙන්න

global.autoSendSessions = global.autoSendSessions || new Map();
global.autoSendRunnerActive = global.autoSendRunnerActive || false;
global.autoSendHookedSockets = global.autoSendHookedSockets || new WeakSet();

function extractChannelInviteCode(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z]+)/i);
  return match ? match[1] : input.trim();
}

async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const cleanInput = input.trim();
  if (cleanInput.endsWith("@newsletter")) return cleanInput;

  const code = extractChannelInviteCode(cleanInput);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      return meta?.id || null;
    }
  } catch (err) {
    console.error("[AUTOSEND] Resolve JID Error:", err.message);
  }
  return null;
}

function unwrapMessage(msg) {
  if (!msg) return null;
  return (
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg
  );
}

function extractFullPostText(quotedMsg) {
  const unwrap = unwrapMessage(quotedMsg);
  if (!unwrap) return "";

  return (
    unwrap.conversation ||
    unwrap.extendedTextMessage?.text ||
    unwrap.imageMessage?.caption ||
    unwrap.videoMessage?.caption ||
    unwrap.documentMessage?.caption ||
    unwrap.extendedTextMessage?.matchedText ||
    unwrap.extendedTextMessage?.description ||
    ""
  ).trim();
}

const INTERVAL_OPTIONS = Object.freeze({
  "0": { label: "Every 1 Minute ⚡ (Live Fast Test)", ms: 1 * 60 * 1000 },
  "00": { label: "Every 2 Minutes ⏱️ (Short Test)", ms: 2 * 60 * 1000 },
  "1": { label: "Every 30 Minutes ⏳ (Half Hour)", ms: 30 * 60 * 1000 },
  "2": { label: "Every 1 Hour ⏰", ms: 60 * 60 * 1000 },
  "3": { label: "Every 2 Hours 🕒", ms: 2 * 60 * 60 * 1000 },
  "4": { label: "Every 4 Hours 🌸", ms: 4 * 60 * 60 * 1000 },
  "5": { label: "Every 12 Hours 🌙 (Twice a Day)", ms: 12 * 60 * 60 * 1000 }
});

// Local Logo එක අරන් Channel එකට Direct Upload කරන Engine එක
async function dispatchToChannel(sock, task) {
  try {
    const isChannel = task.channelJid.endsWith("@newsletter");
    let imgBuffer = null;

    // 1. Local Logo file එක තියෙනවද බලලා buffer එක ගන්නවා
    if (fs.existsSync(LOCAL_LOGO_PATH)) {
      imgBuffer = fs.readFileSync(LOCAL_LOGO_PATH);
    } else if (task.imageBufferBase64) {
      imgBuffer = Buffer.from(task.imageBufferBase64, "base64");
    }

    // 2. Image එකත් එක්ක Caption එක යැවීම
    if (imgBuffer) {
      if (isChannel) {
        try {
          const media = await prepareWAMessageMedia(
            { image: imgBuffer },
            { 
              upload: sock.waUploadToServer,
              newsletter: true 
            }
          );

          const waMsg = generateWAMessageFromContent(
            task.channelJid,
            proto.Message.fromObject({
              imageMessage: {
                ...media.imageMessage,
                caption: task.caption || ""
              }
            }),
            {}
          );

          await sock.relayMessage(task.channelJid, waMsg.message, {
            messageId: waMsg.key.id
          });
          return true;
        } catch (e1) {
          console.error("[AUTOSEND LOCAL LOGO RELAY FAIL]:", e1.message);
        }

        // Fallback: newsletterSendMessage
        if (typeof sock.newsletterSendMessage === "function") {
          try {
            await sock.newsletterSendMessage(task.channelJid, {
              image: imgBuffer,
              caption: task.caption || ""
            });
            return true;
          } catch (e2) {
            console.error("[AUTOSEND LOCAL LOGO NATIVE FAIL]:", e2.message);
          }
        }
      }

      // Channel නොවන තැනකට හෝ Direct sendMessage fallback
      await sock.sendMessage(task.channelJid, {
        image: imgBuffer,
        caption: task.caption || ""
      });
      return true;
    }

    // 3. Image නැතිනම් Text පමණක් යැවීම
    if (task.caption) {
      if (isChannel && typeof sock.newsletterSendMessage === "function") {
        try {
          await sock.newsletterSendMessage(task.channelJid, { text: task.caption });
          return true;
        } catch (_) {}
      }

      const waMsg = generateWAMessageFromContent(
        task.channelJid,
        {
          extendedTextMessage: {
            text: task.caption
          }
        },
        {}
      );
      await sock.relayMessage(task.channelJid, waMsg.message, {
        messageId: waMsg.key.id
      });
      return true;
    }

    return false;
  } catch (err) {
    console.error(`[AUTOSEND DISPATCH CRITICAL ERROR]:`, err);
    return false;
  }
}

export function startAutoSendDaemon(sock) {
  if (global.autoSendRunnerActive) return;
  global.autoSendRunnerActive = true;

  setInterval(async () => {
    if (!global.sessionStatePool || global.sessionStatePool.size === 0) return;

    const now = Date.now();

    for (const [botPhone, sessionState] of global.sessionStatePool.entries()) {
      const posts = sessionState.channelPosts || [];
      let updated = false;

      for (const task of posts) {
        if (now - (task.lastSentTime || 0) >= task.intervalMs) {
          task.lastSentTime = now;
          updated = true;

          const activeSockets = global.activeSockets || new Map();
          let targetSocket = null;

          for (const [, s] of activeSockets.entries()) {
            if (cleanPhone(s.user?.id || "") === botPhone) {
              targetSocket = s;
              break;
            }
          }
          if (!targetSocket && cleanPhone(sock.user?.id || "") === botPhone) {
            targetSocket = sock;
          }

          if (targetSocket) {
            await dispatchToChannel(targetSocket, task);
          }
        }
      }

      if (updated) {
        await updateSessionDataList(botPhone, "channelPosts", posts);
      }
    }
  }, 10000);
}

export function hookAutoSendReplyEngine(sock) {
  if (!sock || global.autoSendHookedSockets.has(sock)) return;
  global.autoSendHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    const rawMsg = unwrapMessage(m.message);
    const quotedId = rawMsg?.extendedTextMessage?.contextInfo?.stanzaId;

    if (!quotedId || !global.autoSendSessions.has(quotedId)) return;
    const sessionData = global.autoSendSessions.get(quotedId);
    if (sessionData.from !== from) return;

    const choice = (rawMsg.conversation || rawMsg.extendedTextMessage?.text || "").trim();
    if (!INTERVAL_OPTIONS[choice]) return;

    global.autoSendSessions.delete(quotedId);
    const chosen = INTERVAL_OPTIONS[choice];

    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    const botPhone = sessionData.senderBotPhone;
    const session = await initializeSessionState(botPhone);
    const posts = session.channelPosts || [];

    const newTask = {
      id: `${botPhone}_${sessionData.channelJid}`,
      channelJid: sessionData.channelJid,
      caption: sessionData.caption,
      intervalMs: chosen.ms,
      intervalLabel: chosen.label,
      lastSentTime: Date.now()
    };

    // පළමු delivery එක push කිරීම
    const isSent = await dispatchToChannel(sock, newTask);

    const existingIdx = posts.findIndex((p) => p.channelJid === sessionData.channelJid);
    if (existingIdx !== -1) {
      posts[existingIdx] = newTask;
    } else {
      posts.push(newTask);
    }

    await updateSessionDataList(botPhone, "channelPosts", posts);

    sock.sendMessage(from, { react: { text: isSent ? "💖" : "⚠️", key: m.key } }).catch(() => {});

    const successCard = 
`🎀 ｡ﾟ•┈୨ *POST AUTO-SCHEDULER ACTIVATED* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📢 *Target Channel:* \`${sessionData.channelJid}\`
  ⏳ *Interval:* ${chosen.label}
  🤖 *Session Node:* \`+${botPhone}\`
  🚀 *Initial Post:* ${isSent ? "🟢 Dispatched Right Now!" : "⚠️ Dispatch Failed! (Check Console Log)"}
  🖼️ *Attachment:* 🟢 Bot Logo + Text Post

━━━━━━━━━━━━━━━━━━━━━
_The schedule is strictly locked to this bot session and MongoDB! (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: successCard }, { quoted: m });
  });
}

export default {
  name: "autosend",
  aliases: ["delautosend", "listautosend"],
  category: "owner",
  description: "Schedule massive posts or images to channels recurringly per session",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    startAutoSendDaemon(sock);
    hookAutoSendReplyEngine(sock);

    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const cleanCmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const botPhone = cleanPhone(sock.user?.id || "");
    const session = await initializeSessionState(botPhone);
    const posts = session.channelPosts || [];

    if (cleanCmd === "listautosend") {
      if (posts.length === 0) {
        return await sock.sendMessage(from, { text: "🌸 *No active scheduled channel posts found for this session!*" }, { quoted: msg });
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *YOUR ACTIVE AUTO-POSTS* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━
🤖 *Session Node:* \`+${botPhone}\`\n\n`;

      posts.forEach((t, i) => {
        listText += `  🌸 *${i + 1}. Channel:* \`${t.channelJid}\`\n     ⏳ *Repeat:* ${t.intervalLabel}\n     💬 *Preview:* "${(t.caption || "").slice(0, 35)}..."\n\n`;
      });

      listText += `━━━━━━━━━━━━━━━━━━━━━\n_To cancel: \`${pref}delautosend <channel_link>\`_\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;
      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    if (cleanCmd === "delautosend") {
      const targetInput = args.join(" ").trim();
      const channelJid = await resolveChannelJid(sock, targetInput);
      const searchKey = channelJid || targetInput;

      const filtered = posts.filter((p) => p.channelJid !== searchKey && !p.id.includes(searchKey));
      const removed = posts.length - filtered.length;

      if (removed > 0) {
        await updateSessionDataList(botPhone, "channelPosts", filtered);
        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: `🧹 *Removed:* Cleared auto-publish task from session \`+${botPhone}\`!` }, { quoted: msg });
      } else {
        return await sock.sendMessage(from, { text: "🌸 *No auto-post found for this channel under your session!*" }, { quoted: msg });
      }
    }

    const targetChannelLink = args[0]?.trim();
    if (!targetChannelLink) {
      return await sock.sendMessage(from, { text: `🌸 *Usage:* Reply to text post with \`${pref}autosend <channel_link>\`` }, { quoted: msg });
    }

    const unwrapRoot = unwrapMessage(msg.message);
    const contextInfo = unwrapRoot?.extendedTextMessage?.contextInfo || unwrapRoot?.imageMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
      return await sock.sendMessage(from, { text: "🌸 *Please reply to the text/post you want to schedule!*" }, { quoted: msg });
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
    const targetChannelJid = await resolveChannelJid(sock, targetChannelLink);

    if (!targetChannelJid) {
      return await sock.sendMessage(from, { text: "🌸 *Could not resolve channel JID!* Make sure the invite link is valid." }, { quoted: msg });
    }

    const captionText = extractFullPostText(quotedMsg);

    const hasLogo = fs.existsSync(LOCAL_LOGO_PATH);

    const menuCard = 
`🎀 ｡ﾟ•┈୨ *CHOOSE AUTO-POST INTERVAL* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📢 *Target Channel:* \`${targetChannelJid}\`
  📝 *Content Captured:* \`${captionText.length} Characters\`
  🖼️ *Attachment:* ${hasLogo ? "Local Bot Logo + Text Caption ✨" : "Text Only (Logo not found) 📝"}

━━━━━━━━━━━━━━━━━━━━━
🍬 *Reply to this message with interval number:*

  ⚡ *0*  ➔ Every 1 Minute (Fast Test)
  ⏱️ *00* ➔ Every 2 Minutes (Short Test)
  🌸 *1*  ➔ Every 30 Minutes
  ⏰ *2*  ➔ Every 1 Hour
  🕒 *3*  ➔ Every 2 Hours
  🌟 *4*  ➔ Every 4 Hours
  🌙 *5*  ➔ Every 12 Hours

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    const sent = await sock.sendMessage(from, { text: menuCard }, { quoted: msg });
    if (sent?.key?.id) {
      global.autoSendSessions.set(sent.key.id, {
        from,
        senderBotPhone: botPhone,
        channelJid: targetChannelJid,
        caption: captionText
      });
      setTimeout(() => global.autoSendSessions.delete(sent.key.id), 300000);
    }
  }
};
