import { cleanPhone, getSessionConfig } from "../core/sessionManager.js";
import { askLunaAi } from "../../commands/ai.js";

export async function handleAiAutoChat({ sock, msg, from, body, isChannel, isGroup }) {
  // Channel posts හෝ හිස් පණිවිඩ bypass කිරීම
  if (isChannel || !body || body.startsWith(".") || body.startsWith("!")) return false;

  const botPhone = cleanPhone(sock.user?.id || "");
  const cfg = getSessionConfig ? getSessionConfig(botPhone) : {};

  // Auto AI ON කර නැත්නම් ක්‍රියාත්මක නොවේ
  if (!cfg.autoAi) return false;

  // Bot විසින්ම යවන පණිවිඩ නොසලකා හැරීම
  if (msg.key.fromMe) return false;

  try {
    // Typing indicator එක දැමීම (මනුස්සයෙක් Type කරනවා වගේ පෙන්වීමට)
    await sock.sendPresenceUpdate("composing", from);

    const aiReply = await askLunaAi(body, from, sock);

    await sock.sendMessage(
      from,
      { text: aiReply },
      { quoted: msg }
    );

    await sock.sendPresenceUpdate("paused", from);
    return true;
  } catch (err) {
    console.error("[AUTO AI ERROR]:", err.message);
    return false;
  }
}
