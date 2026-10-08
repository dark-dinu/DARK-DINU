import fs from "fs";
import path from "path";

// Global In-Memory Stores
global.scheduledTimers = global.scheduledTimers || new Map();
global.schedulerEngineRunning = global.schedulerEngineRunning || false;

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "scheduled_tasks.json");

// Sub-nanosecond Phone Cleaner
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

function loadTasksFromFile() {
  try {
    if (fs.existsSync(LOCAL_STORAGE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((task) => {
          if (task.id) global.scheduledTimers.set(task.id, task);
        });
      }
    }
  } catch (_) {}
}

function saveTasksToFile() {
  try {
    const list = Array.from(global.scheduledTimers.values());
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(list, null, 2));
  } catch (_) {}
}

async function syncTaskToDB(task, isDelete = false) {
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db("whatsapp_multi_bots");
      const col = db.collection("scheduled_messages");
      if (isDelete) {
        await col.deleteOne({ id: task.id });
      } else {
        await col.updateOne({ id: task.id }, { $set: task }, { upsert: true });
      }
    }
  } catch (_) {}
  saveTasksToFile();
}

(async function initSchedulerStorage() {
  loadTasksFromFile();
  try {
    const client = global.mongoClient || global.sharedMongoClient;
    if (client) {
      const db = client.db("whatsapp_multi_bots");
      const tasks = await db.collection("scheduled_messages").find({}).toArray();
      tasks.forEach((t) => global.scheduledTimers.set(t.id, t));
    }
  } catch (_) {}
})();

function formatTargetJid(input = "") {
  let cleaned = input.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  return `${cleaned}@s.whatsapp.net`;
}

// ⏰ 24/7 Precision Scheduler Engine (Strict Node Matching)
export function startGlobalSchedulerEngine(defaultSock) {
  if (global.schedulerEngineRunning) return;
  global.schedulerEngineRunning = true;

  setInterval(async () => {
    if (global.scheduledTimers.size === 0) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Colombo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const todayDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

    for (const [id, task] of global.scheduledTimers.entries()) {
      if (task.time === timeStr) {
        if (task.lastExecutedDate === todayDate) continue;

        task.lastExecutedDate = todayDate;
        syncTaskToDB(task);

        // කමාන්ඩ් එක දැමූ අදාළ බොට්ගේ Socket එක පමණක් සොයා ගැනීම
        let targetSocket = null;
        const activeSockets = global.activeSockets || new Map();

        for (const [nodeId, s] of activeSockets.entries()) {
          const sPhone = getBotPhone(s);
          if (sPhone === task.senderBotPhone || String(nodeId).includes(task.senderBotPhone)) {
            targetSocket = s;
            break;
          }
        }

        // Pool එකේ නැත්නම් කමාන්ඩ් එක run කළ instance එක fallback කරගනී
        if (!targetSocket && getBotPhone(defaultSock) === task.senderBotPhone) {
          targetSocket = defaultSock;
        }

        if (targetSocket) {
          try {
            await targetSocket.sendMessage(task.targetJid, {
              text: task.message
            });
            console.log(`[SCHEDULE SENT via +${task.senderBotPhone}]: -> ${task.targetJid} at${timeStr}`);
          } catch (err) {
            console.error(`[SCHEDULE SEND FAILED]:`, err.message);
          }
        }
      }
    }
  }, 25000);
}

export default {
  name: "settime",
  aliases: ["time", "deltime", "automsg", "scheduletime"],
  category: "utility",
  description: "Schedule daily recurring messages strictly from your own bot instance",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    startGlobalSchedulerEngine(sock);
    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const currentBotPhone = getBotPhone(sock);

    // 1. LIST COMMAND: .time list හෝ .listtime
    if (fullBody.toLowerCase().includes("list") && (fullBody.includes("time") || fullBody.includes("schedule"))) {
      // මෙම බොට් විසින් සකසන ලද ටයිමර් පමණක් ෆිල්ටර් කිරීම
      const myTasks = Array.from(global.scheduledTimers.values()).filter(
        (t) => t.senderBotPhone === currentBotPhone
      );

      if (myTasks.length === 0) {
        sock.sendMessage(from, { react: { text: "💤", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *No active scheduled messages found for this bot instance!* Add one using `.settime` darling~" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *YOUR SCHEDULED MESSAGES* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━
🤖 *Sender Instance:* \`+${currentBotPhone}\`\n\n`;

      let index = 1;
      for (const t of myTasks) {
        const phone = t.targetJid.split("@")[0];
        listText += `  🌸 *${index}. Target:* \`+${phone}\`\n`;
        listText += `     ⏰ *Time:* \`${t.time}\` (Asia/Colombo)\n`;
        listText += `     💬 *Message:* "${t.message}"\n\n`;
        index++;
      }

      listText += `━━━━━━━━━━━━━━━━━━━━━\n_To cancel: \`${pref}deltime <number>\`_\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      sock.sendMessage(from, { react: { text: "📋", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // 2. DELETE COMMAND: .deltime <phone>
    if (fullBody.toLowerCase().startsWith(`${pref}deltime`) || fullBody.toLowerCase().startsWith(`${pref}del time`)) {
      const rawParams = fullBody.replace(new RegExp(`^\\${pref}(del\\s*time|deltime)`, "i"), "").trim();

      if (!rawParams) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *Usage:* \`${pref}deltime <phone_number>\`\n*Example:* \`${pref}deltime 94719845166\`` },
          { quoted: msg }
        );
      }

      const targetPhone = rawParams.split(",")[0].replace(/[^0-9]/g, "");
      let removedCount = 0;

      for (const [id, t] of global.scheduledTimers.entries()) {
        const taskPhone = t.targetJid.split("@")[0];
        if ((taskPhone === targetPhone || id.includes(targetPhone)) && t.senderBotPhone === currentBotPhone) {
          global.scheduledTimers.delete(id);
          await syncTaskToDB({ id }, true);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Removed:* Cleared *${removedCount}* timer(s) from node \`+${currentBotPhone}\` softly!` },
          { quoted: msg }
        );
      } else {
        return await sock.sendMessage(
          from,
          { text: `🌸 *No timers found* for \`+${targetPhone}\` under your bot instance!` },
          { quoted: msg }
        );
      }
    }

    // 3. SET COMMAND: .settime <number>,<msg>,<HH:mm>
    const content = fullBody.replace(new RegExp(`^\\${pref}(set\\s*time|settime|time)`, "i"), "").trim();
    const parts = content.split(",");

    if (parts.length < 3) {
      sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 ｡ﾟ•┈୨ *SET TIMER GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Command:*
  \`${pref}settime <number>,<message>,<HH:mm>\`

  ✨ *Example:*
  \`${pref}settime 94719845166,නිදියගන්නේ නැද්ද බන්. 😁,23:28\`

  ⏰ *Note:* Time must be in 24-hour format (\`HH:mm\`).

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    const inputPhone = parts[0].trim();
    const timePart = parts[parts.length - 1].trim();
    const messagePart = parts.slice(1, parts.length - 1).join(",").trim();

    const targetJid = formatTargetJid(inputPhone);
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!targetJid || !timeRegex.test(timePart) || !messagePart) {
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🌸 *Oopsie!* Invalid format. Please check the phone number and 24-hour time (\`HH:mm\`)." },
        { quoted: msg }
      );
    }

    // Node-bound Unique Task ID
    const taskId = `${currentBotPhone}_${inputPhone.replace(/[^0-9]/g, "")}_${timePart.replace(":", "")}`;
    const newTask = {
      id: taskId,
      senderBotPhone: currentBotPhone, // කමාන්ඩ් එක දැමූ ඔබගේ බොට්ගේ අංකය
      targetJid,
      message: messagePart,
      time: timePart,
      createdBy: from,
      createdAt: new Date().toISOString(),
      lastExecutedDate: ""
    };

    global.scheduledTimers.set(taskId, newTask);
    await syncTaskToDB(newTask);

    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    const successCard = 
`🎀 ｡ﾟ•┈୨ *TIMER SCHEDULED SOFTLY* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🤖 *Sending Node:* \`+${currentBotPhone}\` (Your Bot Only)
  📱 *Delivering To:* \`+${inputPhone.replace(/[^0-9]/g, "")}\`
  ⏰ *Daily Time:* \`${timePart}\` (Asia/Colombo)
  💌 *Message:* "${messagePart}"
  🔄 *Repeat:* Everyday Daily

━━━━━━━━━━━━━━━━━━━━━
_This message will strictly be sent from your own bot instance at the exact minute! (˶˃ ᵕ ˂˶)_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    return await sock.sendMessage(from, { text: successCard }, { quoted: msg });
  }
};
