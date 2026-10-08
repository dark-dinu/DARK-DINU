import fs from "fs";
import path from "path";

// In-Memory Fast Lookup Maps
global.scheduledTimers = global.scheduledTimers || new Map();
global.schedulerEngineRunning = global.schedulerEngineRunning || false;

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "scheduled_tasks.json");

// Local File Helper (Fallback if MongoDB is not connected)
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

// MongoDB & Cache Sync
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

// Load all saved tasks at startup
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

// Clean phone number to WhatsApp JID
function formatTargetJid(input = "") {
  let cleaned = input.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  return `${cleaned}@s.whatsapp.net`;
}

// ⏰ High-Accuracy Cron Interval Runner (Runs every 20-30 seconds)
export function startGlobalSchedulerEngine(sock) {
  if (global.schedulerEngineRunning) return;
  global.schedulerEngineRunning = true;

  setInterval(async () => {
    if (global.scheduledTimers.size === 0) return;

    // Get exact Colombo Time in HH:mm format
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
        // Prevent duplicate execution within the same minute
        if (task.lastExecutedDate === todayDate) continue;

        task.lastExecutedDate = todayDate;
        syncTaskToDB(task);

        // Active socket finder
        const activeSockets = global.activeSockets || new Map();
        const activeSock = activeSockets.size > 0 ? Array.from(activeSockets.values())[0] : sock;

        if (activeSock) {
          try {
            await activeSock.sendMessage(task.targetJid, {
              text: task.message
            });
            console.log(`[SCHEDULE SENT]: Successfully delivered to ${task.targetJid} at${timeStr}`);
          } catch (err) {
            console.error(`[SCHEDULE SEND FAILED]:`, err.message);
          }
        }
      }
    }
  }, 25000);
}

export default {
  name: "time",
  aliases: ["settime", "deltime", "scheduletime", "automsg"],
  category: "utility",
  description: "Schedule sweet automatic daily recurring messages to loved ones",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    startGlobalSchedulerEngine(sock);
    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const cleanCmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();

    // -------------------------------------------------------------
    // 1. LIST COMMAND: .list time
    // -------------------------------------------------------------
    if (fullBody.toLowerCase().includes("list time") || (cleanCmd === "time" && args[0]?.toLowerCase() === "list")) {
      if (global.scheduledTimers.size === 0) {
        sock.sendMessage(from, { react: { text: "💤", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *No active timers found!* Add one softly using `.set time` darling~" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *ACTIVE SCHEDULED TIMERS* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━\n\n`;

      let index = 1;
      for (const [, t] of global.scheduledTimers.entries()) {
        const phone = t.targetJid.split("@")[0];
        listText += `  🌸 *${index}. Target:* \`+${phone}\`\n`;
        listText += `     ⏰ *Daily Time:* \`${t.time}\` (SL Time)\n`;
        listText += `     💬 *Message:* "${t.message}"\n`;
        listText += `     🆔 *ID:* \`${t.id}\`\n\n`;
        index++;
      }

      listText += `━━━━━━━━━━━━━━━━━━━━━\n_To cancel: \`${pref}del time <number>\`_\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      sock.sendMessage(from, { react: { text: "📋", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // -------------------------------------------------------------
    // 2. DELETE COMMAND: .del time <number> OR .del time <number>,<msg>,<time>
    // -------------------------------------------------------------
    if (cleanCmd === "deltime" || fullBody.toLowerCase().startsWith(`${pref}del time`)) {
      const rawParams = fullBody.replace(new RegExp(`^\\${pref}(del\\s+time|deltime)`, "i"), "").trim();

      if (!rawParams) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *Usage:* \`${pref}del time <phone_number>\`\n*Example:* \`${pref}del time 94719845166\`` },
          { quoted: msg }
        );
      }

      let removedCount = 0;
      const targetPhone = rawParams.split(",")[0].replace(/[^0-9]/g, "");

      for (const [id, t] of global.scheduledTimers.entries()) {
        const taskPhone = t.targetJid.split("@")[0];
        if (taskPhone === targetPhone || id === rawParams) {
          global.scheduledTimers.delete(id);
          await syncTaskToDB({ id }, true);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Removed:* Successfully deleted *${removedCount}* scheduled timer(s) for \`+${targetPhone}\`!` },
          { quoted: msg }
        );
      } else {
        sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *No scheduled timers found* for \`+${targetPhone}\`, darling!` },
          { quoted: msg }
        );
      }
    }

    // -------------------------------------------------------------
    // 3. SET COMMAND: .set time <phone>,<message>,<HH:mm>
    // -------------------------------------------------------------
    if (cleanCmd === "settime" || fullBody.toLowerCase().startsWith(`${pref}set time`)) {
      const rawParams = fullBody.replace(new RegExp(`^\\${pref}(set\\s+time|settime)`, "i"), "").trim();
      const parts = rawParams.split(",");

      if (parts.length < 3) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *SET TIMER GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${pref}set time <number>,<message>,<HH:mm>\`

  ✨ *Examples:*
  • \`${pref}set time 94719845166,Good Morning 🥰💞,06:00\`
  • \`${pref}set time 94719845166,Good Night Sweet Dreams 🌙,23:30\`

  ⏰ *Note:* Time must be in 24-hour format (\`06:00\`, \`23:30\`).

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

      const taskId = `${inputPhone.replace(/[^0-9]/g, "")}_${timePart.replace(":", "")}`;
      const newTask = {
        id: taskId,
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

  📱 *Target:* \`+${inputPhone.replace(/[^0-9]/g, "")}\`
  ⏰ *Daily Time:* \`${timePart}\` (Asia/Colombo)
  💌 *Message:* "${messagePart}"
  🔄 *Repeat:* Everyday Daily

━━━━━━━━━━━━━━━━━━━━━
_The bot node will automatically deliver this sweet message everyday at the exact minute! (˶˃ ᵕ ˂˶)_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: successCard }, { quoted: msg });
    }

    // Default Guide Panel
    sock.sendMessage(from, { react: { text: "⏰", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *SCHEDULE CONTROLS* ୧┈•ﾟ｡ 🐾

  🍭 *Available Commands:*
  • *${pref}set time <number>,<msg>,<HH:mm>* — Set daily auto-message 💌
  • *${pref}del time <number>* — Remove scheduled message 🗑️
  • *${pref}list time* — View all active timers 📋

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
