import { cleanPhone, getSessionConfig, updateSessionData } from "../core/sessionManager.js";

export default {
  name: "anticall",
  aliases: ["nocall", "blockcall"],
  category: "owner",
  description: "Auto reject WhatsApp calls & prevent bot lag",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const botPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig ? getSessionConfig(botPhone) : {};

    const option = args[0]?.toLowerCase();

    if (!option || !["on", "off", "status"].includes(option)) {
      sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`╔═════════════════════════════╗
   🛡️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐀 𝐍 𝐓 𝐈 - 𝐂 𝐀 𝐋 𝐋
╚═════════════════════════════╝

> ⚡ *වත්මන් තත්ත්වය:* \`${cfg.anticall ? "🟢 ACTIVATED" : "🔴 DISABLED"}\`

💡 *භාවිතා කරන ආකාරය:*
├ 🟢 \`${pref}anticall on\`  ➔ ඇමතුම් ප්‍රතික්ෂේප කිරීම සක්‍රීය කරන්න
├ 🔴 \`${pref}anticall off\` ➔ අක්‍රීය කරන්න
╰ 📊 \`${pref}anticall status\` ➔ තත්ත්වය පරීක්ෂා කරන්න

⚠️ _Anti-Call සක්‍රීය කළ විට බොට් වෙත ලැබෙන WhatsApp Voice/Video Calls ක්ෂණිකව Reject වේ._

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    if (option === "status") {
      return await sock.sendMessage(
        from,
        { text: `🛡️ *Anti-Call Status:* \`${cfg.anticall ? "🟢 ACTIVATED" : "🔴 DISABLED"}\`` },
        { quoted: msg }
      );
    }

    const isEnable = option === "on";
    cfg.anticall = isEnable;

    if (typeof updateSessionData === "function") {
      await updateSessionData(botPhone, "anticall", isEnable);
    }

    sock.sendMessage(from, { react: { text: isEnable ? "✅" : "❌", key: msg.key } }).catch(() => {});

    await sock.sendMessage(
      from,
      {
        text: `🛡️ *ANTI-CALL SETTING UPDATED!*\n\nතත්ත්වය: \`${isEnable ? "🟢 ACTIVATED (Calls will be rejected)" : "🔴 DISABLED"}\`\n🤖 Node: \`+${botPhone}\``
      },
      { quoted: msg }
    );
  }
};
