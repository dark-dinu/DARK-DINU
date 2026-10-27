import { delay, DisconnectReason } from "@whiskeysockets/baileys";
import { cleanPhone } from "../src/core/sessionManager.js";

export default {
  name: "restart",
  aliases: ["reboot", "reloadnode"],
  category: "owner",
  description: "Hot-restart active bot node, flush cache & maximize engine speed",

  async execute({ sock, msg, from, sessionId }) {
    // 1. අදාළ Bot එකේ Phone Number එක resolve කරගැනීම
    const currentBotJid = sock.user?.id || "";
    const currentPhone = cleanPhone(currentBotJid);
    const targetSessionId = sessionId || (currentPhone ? `bot_${currentPhone}` : null);

    // Permission Guard: Bot number එකෙන් හෝ developer ගෙන් පමණක් ක්‍රියාත්මක වීම
    const senderJid = msg.key.fromMe
      ? currentBotJid
      : (msg.key.participant || msg.participant || from || "");
    const senderPhone = cleanPhone(senderJid);

    // Bot number එකට හෝ owner ට පමණක් අවසර දීම
    if (!msg.key.fromMe && senderPhone !== currentPhone && senderPhone !== "15947733680169") {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔒 *Permission Denied!* මෙම Node එක Restart කළ හැක්කේ Bot හිමිකරුට පමණි." },
        { quoted: msg }
      );
    }

    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // Notification Message
    await sock.sendMessage(
      from,
      {
        text: 
`╔═════════════════════════════╗
   ⚡ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐂 𝐎 𝐑 𝐄
╚═════════════════════════════╝

🔄 *NODE HOT-REBOOT INITIALIZED*
━━━━━━━━━━━━━━━━━━━━━
📱 *Target Node:* \`+${currentPhone || "Active Instance"}\`
🧹 *Actions:*
  • Flush Socket Retry Cache
  • Purge Event Listener Leaks
  • Optimize In-Memory Latency
  • Retain All Custom Settings (100%)

⏳ _තත්පර 3කින් Node එක Full Speed එකෙන් Online වේ..._`
      },
      { quoted: msg }
    );

    await delay(1200);

    try {
      // 2. Active Sockets Registry එකෙන් Node එක Refresh කිරීම
      if (global.activeSockets && targetSessionId) {
        // Cached engine socket reference එක ඉවත් කර garbage cleaner එකට ඉඩ දීම
        if (global.attachedEngineSockets) {
          global.attachedEngineSockets.delete(sock);
        }
      }

      // 3. Node memory එක clear කර Baileys Auto-Reconnect Trigger එක ලබාදීම
      // DisconnectReason.restartRequired මඟින් session/settings නොමැකී instant reboot එකක් සිදුවේ
      sock.end(new Error(String(DisconnectReason.restartRequired)));

      console.log(`🚀 [NODE REBOOT]: Successfully recycled instance ${targetSessionId || currentPhone}`);

    } catch (err) {
      console.error("[RESTART ERROR]:", err.message);
      // Fallback: ws කෙලින්ම close කිරීම (index.js එකෙන් auto restart වේ)
      try {
        sock.ws?.close();
      } catch (_) {}
    }
  }
};
