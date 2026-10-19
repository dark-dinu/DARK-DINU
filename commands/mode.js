import { cleanPhone, getSessionConfig, updateSessionConfig } from "../src/core/sessionManager.js";

const DEV_NUMBERS = new Set(["94719845166", "15947733680169"]);

function isAuthorized(sock, msg, from) {
  const botPhone = cleanPhone(sock.user?.id || "");
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = cleanPhone(senderJid);
  return msg.key.fromMe || senderPhone === botPhone || DEV_NUMBERS.has(senderPhone);
}

export default {
  name: "mode",
  aliases: ["worktype", "botmode", "setmode"],
  category: "owner",
  description: "Change Bot Work Type (Public / Private / Group / Inbox)",

  async execute({ sock, msg, from, args, prefix }) {
    if (!isAuthorized(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔒 *මෙම සැකසුම වෙනස් කිරීමට අවසර නැත! (Owner Only)*" },
        { quoted: msg }
      );
    }

    const botPhone = cleanPhone(sock.user?.id || "");
    const targetMode = args[0]?.toLowerCase()?.trim();
    const validModes = ["public", "private", "group", "inbox"];

    if (validModes.includes(targetMode)) {
      await updateSessionConfig(botPhone, "mode", targetMode);
      sock.sendMessage(from, { react: { text: "🎯", key: msg.key } }).catch(() => {});

      const modeNames = {
        public: "🌐 PUBLIC (Everyone can use commands)",
        private: "🔒 PRIVATE (Only Bot Owner can use commands)",
        group: "👥 GROUP ONLY (Commands disabled in Private DM)",
        inbox: "💬 INBOX ONLY (Commands disabled in Groups)"
      };

      return await sock.sendMessage(
        from,
        {
          text: 
`🎯 *BOT WORK TYPE UPDATED!*
━━━━━━━━━━━━━━━━━━━━━
📌 *Current Mode:* \`${modeNames[targetMode]}\`
📱 *Instance:* +${botPhone}

✨ _සියලුම commands දැන් මෙම mode එකට අනුව ක්‍රියාත්මක වේ._
💖 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    const cfg = getSessionConfig(botPhone);
    const curr = cfg?.mode ? cfg.mode.toUpperCase() : "PUBLIC";
    const p = prefix || ".";

    return await sock.sendMessage(
      from,
      {
        text: 
`⚙️ *BOT WORK TYPE SETTINGS*
━━━━━━━━━━━━━━━━━━━━━
📌 *Current Active Mode:* \`${curr}\`

💡 *භාවිතා කරන ආකාරය:*
• *${p}mode public*   — ඕනෑම කෙනෙකුට Commands පාවිච්චි කල හැක.
• *${p}mode private*  — Owner ට පමණක් Commands පාවිච්චි කල හැක.
• *${p}mode group*    — Groups වල පමණක් Commands වැඩ කරයි.
• *${p}mode inbox*    — Inbox වල පමණක් Commands වැඩ කරයි.

👑 *DARK-DINU Cloud* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
