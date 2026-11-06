import { cleanPhone, getSessionConfig, updateSessionData } from "../core/sessionManager.js";

export default {
  name: "anticall",
  aliases: ["nocall", "blockcall", "callblock"],
  category: "owner",
  description: "Auto reject WhatsApp calls & prevent bot lag",

  async execute({ sock, msg, from, args, prefix, isOwner }) {
    const pref = prefix || ".";
    const botPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig ? getSessionConfig(botPhone) : {};

    // Owner validation
    if (!isOwner && !msg.key.fromMe) {
      return await sock.sendMessage(
        from,
        { text: "⛔ *ප්‍රවේශය නොමැත:* මෙම විධානය Owner සඳහා පමණි." },
        { quoted: msg }
      );
    }

    const option = args[0]?.toLowerCase();

    // Default status & help text
    if (!option || !["on", "off", "status"].includes(option)) {
      sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
      
      const currentStatus = Boolean(cfg.anticall);
      return await sock.sendMessage(
        from,
        {
          text: 
`*ANTI-CALL SHIELD* 🛡️

• Status: ${currentStatus ? "🟢 *Active*" : "🔴 *Disabled*"}
• Node: \`+${botPhone}\`

*භාවිතය:*
› \`${pref}anticall on\` — සක්‍රීය කරන්න
› \`${pref}anticall off\` — අක්‍රීය කරන්න
› \`${pref}anticall status\` — තත්ත්වය බලන්න

> _ඇමතුම් ලැබුණු සැණින් ස්වයංක්‍රීයව reject කරනු ලැබේ._`
        },
        { quoted: msg }
      );
    }

    // Status query
    if (option === "status") {
      const currentStatus = Boolean(cfg.anticall);
      return await sock.sendMessage(
        from,
        {
          text: `🛡️ *Anti-Call Shield:* ${currentStatus ? "🟢 *Active*" : "🔴 *Disabled*"}`
        },
        { quoted: msg }
      );
    }

    const isEnable = option === "on";

    // Update in-memory state
    cfg.anticall = isEnable;
    cfg.antiCall = isEnable;

    // Persist to MongoDB/Local backup
    if (typeof updateSessionData === "function") {
      await updateSessionData(botPhone, "anticall", isEnable);
    }

    sock.sendMessage(from, { react: { text: isEnable ? "🟢" : "🔴", key: msg.key } }).catch(() => {});

    await sock.sendMessage(
      from,
      {
        text: 
`*ANTI-CALL UPDATED* 🛡️

• Status: ${isEnable ? "🟢 *Active*" : "🔴 *Disabled*"}
• Action: ${isEnable ? "_ඇමතුම් ස්වයංක්‍රීයව ප්‍රතික්ෂේප කෙරේ._" : "_ඇමතුම් සාමාන්‍ය පරිදි ලැබෙනු ඇත._"}
• Persistence: _Saved to Cloud_`
      },
      { quoted: msg }
    );
  }
};
