import fs from "fs";
import path from "path";

// In-Memory Fast Lookup Maps
global.channelAutoTimers = global.channelAutoTimers || new Map();
global.channelAutoEngineRunning = global.channelAutoEngineRunning || false;

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "channel_auto_tasks.json");

// Phone number extractor
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

// Extract Invite Code from Channel Link
function extractChannelInviteCode(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z]+)/i);
  return match ? match[1] : input.trim();
}

// Resolve Channel JID (@newsletter)
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

// Parse Interval String (e.g. 5m, 30m, 1h, 2h) to Milliseconds
function parseIntervalToMs(intervalStr = "") {
  const match = intervalStr.trim().toLowerCase().match(/^(\d+)(m|h)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "m") {
    if (value < 1) return null; // අවම විනාඩි 1
    return value * 60 * 1000;
  }
  if (unit === "h") {
    if (value < 1) return null;
    return value * 60 * 60 * 1000;
  }
  return null;
}

// Persistent Storage Handlers
function loadTasksFromFile() {
  try {
    if (fs.existsSync(LOCAL_STORAGE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((t) => {
          if (t.id) global.channelAutoTimers.set(t.id, t);
        });
      }
    }
  } catch (_) {}
}

function saveTasksToFile() {
  try {
    const list = Array.from(global.channelAutoTimers.values());
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(list, null, 2));
  } catch (_) {}
}

async function syncTaskToDB(task, isDelete = false) {
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db("whatsapp_multi_bots");
      const col = db.collection("channel_auto_broadcasts");
      if (isDelete) {
        await col.deleteOne({ id: task.id });
      } else {
        await col.updateOne({ id: task.id }, { $set: task }, { upsert: true });
      }
    }
  } catch (_) {}
  saveTasksToFile();
}

(async function initChannelAutoStorage() {
  loadTasksFromFile();
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db("whatsapp_multi_bots");
      const tasks = await db.collection("channel_auto_broadcasts").find({}).toArray();
      tasks.forEach((t) => global.channelAutoTimers.set(t.id, t));
    }
  } catch (_) {}
})();

// ⏰ High-Precision Interval Runner (Checks every 30 seconds)
export function startChannelIntervalEngine(defaultSock) {
  if (global.channelAutoEngineRunning) return;
  global.channelAutoEngineRunning = true;

  setInterval(async () => {
    if (global.channelAutoTimers.size === 0) return;

    const now = Date.now();

    for (const [id, task] of global.channelAutoTimers.entries()) {
      if (now - task.lastSentTime >= task.intervalMs) {
        task.lastSentTime = now;
        syncTaskToDB(task);

        // කමාන්ඩ් එක දැමූ අදාළ බොට්ගෙන් පමණක් යැවීම
        let targetSocket = null;
        const activeSockets = global.activeSockets || new Map();

        for (const [nodeId, s] of activeSockets.entries()) {
          const sPhone = getBotPhone(s);
          if (sPhone === task.senderBotPhone || String(nodeId).includes(task.senderBotPhone)) {
            targetSocket = s;
            break;
          }
        }

        if (!targetSocket && getBotPhone(defaultSock) === task.senderBotPhone) {
          targetSocket = defaultSock;
        }

        if (targetSocket) {
          try {
            await targetSocket.sendMessage(task.channelJid, {
              text: task.message
            });
            console.log(`[CHANNEL AUTO POST]: Delivered to ${task.channelJid} every${task.intervalStr}`);
          } catch (err) {
            console.error(`[CHANNEL AUTO ERROR]:`, err.message);
          }
        }
      }
    }
  }, 30000);
}

export default {
  name: "autoch",
  aliases: ["delautoch", "listautoch", "chmsg"],
  category: "owner",
  description: "Schedule recurring interval messages to WhatsApp Channels softly",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    startChannelIntervalEngine(sock);
    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const cleanCmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const currentBotPhone = getBotPhone(sock);

    // -------------------------------------------------------------
    // 1. LIST COMMAND: .listautoch
    // -------------------------------------------------------------
    if (cleanCmd === "listautoch" || fullBody.toLowerCase().includes("listautoch")) {
      const myTasks = Array.from(global.channelAutoTimers.values()).filter(
        (t) => t.senderBotPhone === currentBotPhone
      );

      if (myTasks.length === 0) {
        sock.sendMessage(from, { react: { text: "💤", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *No active channel auto-posts found!* Set one softly using `.autoch` darling~" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *ACTIVE CHANNEL RECURRING POSTS* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━
🤖 *Sender Node:* \`+${currentBotPhone}\`\n\n`;

      let index = 1;
      for (const t of myTasks) {
        listText += `  🌸 *${index}. Channel:* \`${t.channelJid}\`\n`;
        listText += `     ⏳ *Interval:* Every \`${t.intervalStr}\`\n`;
        listText += `     💬 *Post Body:* "${t.message}"\n\n`;
        index++;
      }

      listText += `━━━━━━━━━━━━━━━━━━━━━\n_To cancel: \`${pref}delautoch <channel_link_or_jid>\`_\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      sock.sendMessage(from, { react: { text: "📋", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // -------------------------------------------------------------
    // 2. DELETE COMMAND: .delautoch <channel_link_or_jid>
    // -------------------------------------------------------------
    if (cleanCmd === "delautoch" || fullBody.toLowerCase().startsWith(`${pref}delautoch`)) {
      const targetInput = args.join(" ").trim();

      if (!targetInput) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *Usage:* \`${pref}delautoch <channel_link_or_jid>\`\n*Example:* \`${pref}delautoch https://whatsapp.com/channel/xxxxxx\`` },
          { quoted: msg }
        );
      }

      const channelJid = await resolveChannelJid(sock, targetInput);
      const searchKey = channelJid || targetInput;
      let removedCount = 0;

      for (const [id, t] of global.channelAutoTimers.entries()) {
        if ((t.channelJid === searchKey || id.includes(searchKey)) && t.senderBotPhone === currentBotPhone) {
          global.channelAutoTimers.delete(id);
          await syncTaskToDB({ id }, true);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Removed:* Cleared *${removedCount}* auto-post task(s) for channel softly!` },
          { quoted: msg }
        );
      } else {
        return await sock.sendMessage(
          from,
          { text: "🌸 *No active recurring tasks found for this channel, darling!*" },
          { quoted: msg }
        );
      }
    }

    // -------------------------------------------------------------
    // 3. SET COMMAND: .autoch <link>,<message>,<interval>
    // -------------------------------------------------------------
    const rawParams = fullBody.replace(new RegExp(`^\\${pref}(autoch|chmsg)`, "i"), "").trim();
    const parts = rawParams.split(",");

    if (parts.length < 3) {
      sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL AUTO-POST GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}autoch <channel_link>,<message>,<interval>\`

  ✨ *Examples:*
  • \`${pref}autoch https://whatsapp.com/channel/xxx,Join our WhatsApp Group 💖,30m\`
  • \`${pref}autoch https://whatsapp.com/channel/xxx,New Daily Updates! 🌸,1h\`
  • \`${pref}autoch https://whatsapp.com/channel/xxx,Active Status Reminder ✨,5m\`

  ⏳ *Interval Units:*
  • \`5m\`  ➔ Every 5 Minutes
  • \`30m\` ➔ Every 30 Minutes (Half Hour)
  • \`1h\`  ➔ Every 1 Hour
  • \`2h\`  ➔ Every 2 Hours

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    const channelInput = parts[0].trim();
    const intervalInput = parts[parts.length - 1].trim();
    const messagePart = parts.slice(1, parts.length - 1).join(",").trim();

    const intervalMs = parseIntervalToMs(intervalInput);
    if (!intervalMs) {
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🌸 *Invalid interval!* Please use formats like `5m`, `30m`, `1h`, `2h` darling~" },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const targetChannelJid = await resolveChannelJid(sock, channelInput);
    if (!targetChannelJid) {
      sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🌸 *Could not resolve channel!* Make sure the link or JID is valid, sweetie~" },
        { quoted: msg }
      );
    }

    const taskId = `${currentBotPhone}_${targetChannelJid}_${intervalInput}`;
    const newTask = {
      id: taskId,
      senderBotPhone: currentBotPhone,
      channelJid: targetChannelJid,
      message: messagePart,
      intervalStr: intervalInput,
      intervalMs,
      lastSentTime: Date.now() // Set to now so it triggers after the interval
    };

    global.channelAutoTimers.set(taskId, newTask);
    await syncTaskToDB(newTask);

    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    const successCard = 
`🎀 ｡ﾟ•┈୨ *CHANNEL AUTO-POST SCHEDULED* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🤖 *Posting Node:* \`+${currentBotPhone}\` (Your Instance)
  📢 *Channel JID:* \`${targetChannelJid}\`
  ⏳ *Repeat Interval:* Every \`${intervalInput}\`
  💌 *Message Body:* "${messagePart}"

━━━━━━━━━━━━━━━━━━━━━
_This post will softly & automatically be published to your channel every ${intervalInput}! (˶˃ ᵕ ˂˶)_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    return await sock.sendMessage(from, { text: successCard }, { quoted: msg });
  }
};
