import fs from "fs";
import path from "path";
import { downloadMediaMessage, generateWAMessageFromContent, proto } from "@whiskeysockets/baileys";

// In-Memory Fast Lookup Maps
global.autoSendSessions = global.autoSendSessions || new Map();
global.autoSendTimers = global.autoSendTimers || new Map();
global.autoSendEngineRunning = global.autoSendEngineRunning || false;
global.autoSendHookedSockets = global.autoSendHookedSockets || new WeakSet();

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "autosend_tasks.json");

function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

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
  } catch (_) {}
  return null;
}

// Deep Multi-Layer Text Extractor
function extractFullPostText(quotedMsg) {
  if (!quotedMsg) return "";

  const unwrap = quotedMsg.ephemeralMessage?.message || quotedMsg.viewOnceMessage?.message || quotedMsg;

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

function loadTasksFromFile() {
  try {
    if (fs.existsSync(LOCAL_STORAGE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((t) => {
          if (t.id) global.autoSendTimers.set(t.id, t);
        });
      }
    }
  } catch (_) {}
}

function saveTasksToFile() {
  try {
    const list = Array.from(global.autoSendTimers.values());
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(list, null, 2));
  } catch (_) {}
}

async function syncTaskToDB(task, isDelete = false) {
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db("whatsapp_multi_bots");
      const col = db.collection("autosend_channel_posts");
      if (isDelete) {
        await col.deleteOne({ id: task.id });
      } else {
        await col.updateOne({ id: task.id }, { $set: task }, { upsert: true });
      }
    }
  } catch (_) {}
  saveTasksToFile();
}

(async function initAutoSendStorage() {
  loadTasksFromFile();
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db("whatsapp_multi_bots");
      const tasks = await db.collection("autosend_channel_posts").find({}).toArray();
      tasks.forEach((t) => global.autoSendTimers.set(t.id, t));
    }
  } catch (_) {}
})();

// 🔥 100% NATIVE CHANNEL DISPATCH ENGINE
async function dispatchToChannel(sock, task) {
  try {
    // 1. Image සහිත Post එකක් නම්
    if (task.imageBufferBase64) {
      const imgBuffer = Buffer.from(task.imageBufferBase64, "base64");
      await sock.sendMessage(task.channelJid, {
        image: imgBuffer,
        caption: task.caption || ""
      });
      console.log(`[AUTOSEND DISPATCHED IMAGE]: Delivered to ${task.channelJid}`);
      return true;
    }

    // 2. දිගු Text / Formatted Post එකක් නම් (Plain text fallback සහිතව)
    if (task.caption) {
      try {
        await sock.sendMessage(task.channelJid, {
          text: task.caption
        });
      } catch (err) {
        // High-level fallback: Relay message using raw binary proto
        const rawContent = {
          extendedTextMessage: {
            text: task.caption
          }
        };
        const waMsg = generateWAMessageFromContent(task.channelJid, rawContent, {});
        await sock.relayMessage(task.channelJid, waMsg.message, { messageId: waMsg.key.id });
      }
      console.log(`[AUTOSEND DISPATCHED TEXT]: Delivered to ${task.channelJid}`);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`[AUTOSEND ERROR]: Could not publish to ${task.channelJid} ->`, err.message);
    return false;
  }
}

// Precision Loop
export function startAutoSendEngine(defaultSock) {
  if (global.autoSendEngineRunning) return;
  global.autoSendEngineRunning = true;

  setInterval(async () => {
    if (global.autoSendTimers.size === 0) return;

    const now = Date.now();

    for (const [id, task] of global.autoSendTimers.entries()) {
      if (now - task.lastSentTime >= task.intervalMs) {
        task.lastSentTime = now;
        syncTaskToDB(task);

        let targetSocket = null;
        const activeSockets = global.activeSockets || new Map();

        for (const [nodeId, s] of activeSockets.entries()) {
          const sPhone = getBotPhone(s);
          if (sPhone === task.senderBotPhone || String(nodeId).includes(task.senderBotPhone)) {
            targetSocket = s;
            break;
          }
        }

        if (!targetSocket) {
          targetSocket = defaultSock;
        }

        if (targetSocket) {
          await dispatchToChannel(targetSocket, task);
        }
      }
    }
  }, 10000);
}

// Interactive Choice Listener
export function hookAutoSendReplyEngine(sock) {
  if (!sock || global.autoSendHookedSockets.has(sock)) return;
  global.autoSendHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message) return;

    const from = m.key.remoteJid;
    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const quotedId = rawMsg?.extendedTextMessage?.contextInfo?.stanzaId;

    if (!quotedId || !global.autoSendSessions.has(quotedId)) return;

    const session = global.autoSendSessions.get(quotedId);
    if (session.from !== from) return;

    const choice = (
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      ""
    ).trim();

    if (!INTERVAL_OPTIONS[choice]) return;

    global.autoSendSessions.delete(quotedId);
    const chosen = INTERVAL_OPTIONS[choice];

    sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

    const taskId = `${session.senderBotPhone}_${session.channelJid}`;
    const newTask = {
      id: taskId,
      senderBotPhone: session.senderBotPhone,
      channelJid: session.channelJid,
      caption: session.caption,
      imageBufferBase64: session.imageBufferBase64,
      intervalMs: chosen.ms,
      intervalLabel: chosen.label,
      lastSentTime: Date.now()
    };

    global.autoSendTimers.set(taskId, newTask);
    await syncTaskToDB(newTask);

    // 🚀 Instant Post Try & Result Check
    const isSent = await dispatchToChannel(sock, newTask);

    if (isSent) {
      sock.sendMessage(from, { react: { text: "💖", key: m.key } }).catch(() => {});
    } else {
      sock.sendMessage(from, { react: { text: "⚠️", key: m.key } }).catch(() => {});
    }

    const resultNotice = isSent 
      ? "🟢 *Success:* පළමු Post එක මේ දැන්ම Channel එකට සාර්ථකව Post කළා! ✨"
      : "⚠️ *Notice:* පළමු Post එක යැවීමට නොහැකි විය. (කරුණාකර මෙම Bot අංකය අදාළ Channel එකේ Admin කෙනෙක් දැයි පරීක්ෂා කරන්න!)";

    const successCard = 
`🎀 ｡ﾟ•┈୨ *POST AUTO-SCHEDULER ACTIVATED* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📢 *Target Channel:* \`${session.channelJid}\`
  ⏳ *Interval:* ${chosen.label}
  📝 *Content Captured:* \`${session.caption.length} Characters\`
  🖼️ *Attachment:* ${session.imageBufferBase64 ? "🟢 Image + Text Post" : "📝 Text Post"}

━━━━━━━━━━━━━━━━━━━━━
${resultNotice}
_Next posts will automatically continue every ${chosen.label}! (˶˃ ᵕ ˂˶)_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: successCard }, { quoted: m });
  });
}

export default {
  name: "autosend",
  aliases: ["delautosend", "listautosend"],
  category: "owner",
  description: "Schedule massive posts or images to channels recurringly",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    startAutoSendEngine(sock);
    hookAutoSendReplyEngine(sock);

    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const cleanCmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const currentBotPhone = getBotPhone(sock);

    // 1. LIST COMMAND
    if (cleanCmd === "listautosend") {
      const myTasks = Array.from(global.autoSendTimers.values()).filter(
        (t) => t.senderBotPhone === currentBotPhone
      );

      if (myTasks.length === 0) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *No active scheduled posts found!* Reply to a post with `.autosend <link>` darling~" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *YOUR ACTIVE AUTO-POSTS* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let index = 1;
      for (const t of myTasks) {
        listText += `  🌸 *${index}. Channel:* \`${t.channelJid}\`\n`;
        listText += `     ⏳ *Repeat:* ${t.intervalLabel}\n`;
        listText += `     🖼️ *Media:* ${t.imageBufferBase64 ? "Image Attached" : "Text"}\n`;
        listText += `     💬 *Preview:* "${(t.caption || "").slice(0, 40)}..."\n\n`;
        index++;
      }

      listText += `━━━━━━━━━━━━━━━━━━━━━\n_To cancel: \`${pref}delautosend <channel_link>\`_\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // 2. DELETE COMMAND
    if (cleanCmd === "delautosend") {
      const targetInput = args.join(" ").trim();
      const channelJid = await resolveChannelJid(sock, targetInput);
      const searchKey = channelJid || targetInput;

      let removed = 0;
      for (const [id, t] of global.autoSendTimers.entries()) {
        if ((t.channelJid === searchKey || id.includes(searchKey)) && t.senderBotPhone === currentBotPhone) {
          global.autoSendTimers.delete(id);
          await syncTaskToDB({ id }, true);
          removed++;
        }
      }

      if (removed > 0) {
        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Removed:* Successfully cancelled auto-publish for this channel softly!` },
          { quoted: msg }
        );
      } else {
        return await sock.sendMessage(
          from,
          { text: "🌸 *No auto-post found for this channel!*" },
          { quoted: msg }
        );
      }
    }

    // 3. MAIN COMMAND: .autosend <channel_link>
    const targetChannelLink = args[0]?.trim();
    if (!targetChannelLink) {
      sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *AUTOSEND POST GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  1. Forward or send your post (Image with caption, or long text).
  2. Reply to that message with:
     \`${pref}autosend <channel_link>\`
  3. Choose the recurring interval from the sweet menu!

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🌸 *Oopsie!* Please reply to the post/image you want to auto-schedule honey~" },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const targetChannelJid = await resolveChannelJid(sock, targetChannelLink);
    if (!targetChannelJid) {
      sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🌸 *Could not resolve channel!* Make sure the invite link is valid, sweetie~" },
        { quoted: msg }
      );
    }

    // Extract Text Content
    const captionText = extractFullPostText(quotedMsg);

    let imageBase64 = null;
    const targetImgObj = quotedMsg.imageMessage || quotedMsg.ephemeralMessage?.message?.imageMessage;
    if (targetImgObj) {
      try {
        const imgBuffer = await downloadMediaMessage(
          { key: { id: contextInfo.stanzaId, remoteJid: from }, message: quotedMsg },
          "buffer",
          {}
        );
        if (imgBuffer && imgBuffer.length > 0) {
          imageBase64 = imgBuffer.toString("base64");
        }
      } catch (e) {
        console.error("[IMAGE DOWNLOAD ERR]:", e.message);
      }
    }

    const menuCard = 
`🎀 ｡ﾟ•┈୨ *CHOOSE AUTO-POST INTERVAL* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📢 *Target Channel:* \`${targetChannelJid}\`
  📝 *Text Size:* \`${captionText.length} Characters Captured\`
  🖼️ *Attachment:* ${imageBase64 ? "Image + Caption Attached ✨" : "Full Text Only 📝"}
  💬 *Preview:* "${captionText.slice(0, 50)}..."

━━━━━━━━━━━━━━━━━━━━━
🍬 *Reply with your preferred time interval:*

  ⚡ *0*  ➔ Every 1 Minute (Live Fast Test) 🚀
  ⏱️ *00* ➔ Every 2 Minutes (Short Test)
  🌸 *1*  ➔ Every 30 Minutes (Half Hour)
  ⏰ *2*  ➔ Every 1 Hour (60 Minutes)
  🕒 *3*  ➔ Every 2 Hours
  🌟 *4*  ➔ Every 4 Hours
  🌙 *5*  ➔ Every 12 Hours (Twice Daily)

━━━━━━━━━━━━━━━━━━━━━
_Reply with 0, 00, 1, 2, 3, 4 or 5 to start publishing softly~ (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    const sentMsg = await sock.sendMessage(from, { text: menuCard }, { quoted: msg });

    if (sentMsg?.key?.id) {
      global.autoSendSessions.set(sentMsg.key.id, {
        from,
        senderBotPhone: currentBotPhone,
        channelJid: targetChannelJid,
        caption: captionText,
        imageBufferBase64: imageBase64
      });

      setTimeout(() => {
        global.autoSendSessions.delete(sentMsg.key.id);
      }, 300000);
    }

    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
  }
};
