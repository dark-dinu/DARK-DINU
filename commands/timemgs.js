import { cleanPhone, initializeSessionState, updateSessionDataList } from "../core/sessionManager.js";

global.schedulerRunnerActive = global.schedulerRunnerActive || false;

function formatTargetJid(input = "") {
  let cleaned = input.replace(/[^0-9]/g, "");
  return cleaned ? `${cleaned}@s.whatsapp.net` : null;
}

export function startSchedulerDaemon(sock) {
  if (global.schedulerRunnerActive) return;
  global.schedulerRunnerActive = true;

  setInterval(async () => {
    if (global.sessionStatePool.size === 0) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Colombo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const todayDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

    // Loop through individual session memory pools
    for (const [botPhone, sessionState] of global.sessionStatePool.entries()) {
      const timers = sessionState.timers || [];
      let updated = false;

      for (const t of timers) {
        if (t.time === timeStr && t.lastExecutedDate !== todayDate) {
          t.lastExecutedDate = todayDate;
          updated = true;

          // Find exact matching socket
          const activeSockets = global.activeSockets || new Map();
          let targetSocket = null;

          for (const [, s] of activeSockets.entries()) {
            if (cleanPhone(s.user?.id || "") === botPhone) {
              targetSocket = s;
              break;
            }
          }
          if (!targetSocket && cleanPhone(sock.user?.id || "") === botPhone) targetSocket = sock;

          if (targetSocket) {
            try {
              await targetSocket.sendMessage(t.targetJid, { text: t.message });
              console.log(`[SCHEDULE SENT via +${botPhone}]: ->${t.targetJid}`);
            } catch (e) {
              console.error(`[SCHEDULE SEND FAILED]:`, e.message);
            }
          }
        }
      }

      if (updated) {
        await updateSessionDataList(botPhone, "timers", timers);
      }
    }
  }, 25000);
}

export default {
  name: "settime",
  aliases: ["time", "deltime", "scheduletime"],
  category: "utility",
  description: "Schedule daily recurring messages strictly from your own bot instance",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    startSchedulerDaemon(sock);

    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const botPhone = cleanPhone(sock.user?.id || "");
    const session = await initializeSessionState(botPhone);
    const timers = session.timers || [];

    // 1. LIST COMMAND
    if (fullBody.toLowerCase().includes("list") && fullBody.includes("time")) {
      if (timers.length === 0) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *No active timers found for this bot instance!* Add one using `.settime` darling~" },
          { quoted: msg }
        );
      }

      let listText = 
`🎀 ｡ﾟ•┈୨ *YOUR ACTIVE SCHEDULED TIMERS* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━
🤖 *Session Node:* \`+${botPhone}\`\n\n`;

      timers.forEach((t, i) => {
        const phone = t.targetJid.split("@")[0];
        listText += `  🌸 *${i + 1}. Target:* \`+${phone}\`\n     ⏰ *Time:* \`${t.time}\` (Asia/Colombo)\n     💬 *Message:* "${t.message}"\n\n`;
      });

      listText += `━━━━━━━━━━━━━━━━━━━━━\n_To cancel: \`${pref}deltime <number>\`_\n💖 *DARK-DINU MD* • https://heshan.devofc.top/`;
      return await sock.sendMessage(from, { text: listText }, { quoted: msg });
    }

    // 2. DELETE COMMAND
    if (fullBody.toLowerCase().startsWith(`${pref}deltime`) || fullBody.toLowerCase().startsWith(`${pref}del time`)) {
      const rawParams = fullBody.replace(new RegExp(`^\\${pref}(del\\s*time|deltime)`, "i"), "").trim();
      const targetPhone = rawParams.split(",")[0].replace(/[^0-9]/g, "");

      const filtered = timers.filter((t) => !t.targetJid.includes(targetPhone));
      const removedCount = timers.length - filtered.length;

      if (removedCount > 0) {
        await updateSessionDataList(botPhone, "timers", filtered);
        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Removed:* Cleared *${removedCount}* timer(s) from node \`+${botPhone}\` softly!` },
          { quoted: msg }
        );
      } else {
        return await sock.sendMessage(from, { text: `🌸 *No timers found for* \`+${targetPhone}\`!` }, { quoted: msg });
      }
    }

    // 3. SET COMMAND
    const content = fullBody.replace(new RegExp(`^\\${pref}(set\\s*time|settime|time)`, "i"), "").trim();
    const parts = content.split(",");

    if (parts.length < 3) {
      return await sock.sendMessage(
        from,
        { text: `🌸 *Usage:* \`${pref}settime <number>,<message>,<HH:mm>\`\n*Example:* \`${pref}settime 94719845166,Good Morning 🥰,06:00\`` },
        { quoted: msg }
      );
    }

    const inputPhone = parts[0].trim();
    const timePart = parts[parts.length - 1].trim();
    const messagePart = parts.slice(1, parts.length - 1).join(",").trim();

    const targetJid = formatTargetJid(inputPhone);
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!targetJid || !timeRegex.test(timePart) || !messagePart) {
      return await sock.sendMessage(from, { text: "🌸 *Invalid format!* Please check the phone number and 24h time (`HH:mm`)." }, { quoted: msg });
    }

    const newTask = {
      id: `${botPhone}_${inputPhone.replace(/[^0-9]/g, "")}_${timePart.replace(":", "")}`,
      targetJid,
      message: messagePart,
      time: timePart,
      createdAt: new Date().toISOString(),
      lastExecutedDate: ""
    };

    timers.push(newTask);
    await updateSessionDataList(botPhone, "timers", timers);

    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🎀 ｡ﾟ•┈୨ *TIMER SCHEDULED SOFTLY* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🤖 *Sending Node:* \`+${botPhone}\` (Locked Session)
  📱 *Delivering To:* \`+${inputPhone.replace(/[^0-9]/g, "")}\`
  ⏰ *Daily Time:* \`${timePart}\` (Asia/Colombo)
  💌 *Message:* "${messagePart}"

━━━━━━━━━━━━━━━━━━━━━
_This message will strictly dispatch from your session node every day! (˶˃ ᵕ ˂˶)_
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
