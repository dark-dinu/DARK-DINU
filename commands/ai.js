import axios from "axios";
import { cleanPhone, getSessionConfig, updateSessionData } from "../core/sessionManager.js";

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

export default {
  name: "ai",
  aliases: ["gpt", "bot", "chat", "luna"],
  category: "ai",
  description: "Smart Human-like AI Chatbot powered by GPT-6 Luna",

  async execute({ sock, msg, from, args, prefix, isOwner }) {
    const pref = prefix || ".";
    const botPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig ? getSessionConfig(botPhone) : {};
    const subCmd = args[0]?.toLowerCase();

    // 1. AI Auto Toggle (.ai on / .ai off)
    if (subCmd === "on" || subCmd === "off") {
      const isEnable = subCmd === "on";
      cfg.autoAi = isEnable;

      if (typeof updateSessionData === "function") {
        await updateSessionData(botPhone, "autoAi", isEnable);
      }

      sock.sendMessage(from, { react: { text: isEnable ? "🟢" : "🔴", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: 
`*DARK-DINU AI CHAT ENGINE* 🧠

• Status: ${isEnable ? "🟢 *Active*" : "🔴 *Disabled*"}
• Engine: _GPT-6 Luna (Chamindu API)_
• Mode: ${isEnable ? "_සාමාන්‍ය මැසේජ් වලටද AI පිළිතුරු ලබා දෙනු ඇත._" : "_Auto AI අක්‍රීයයි. `.ai <ප්‍රශ්නය>` ලෙස භාවිතා කළ හැක._"}`
        },
        { quoted: msg }
      );
    }

    // 2. Direct Query (.ai <ප්‍රශ්නය>)
    const userPrompt = args.join(" ").trim();
    if (!userPrompt) {
      sock.sendMessage(from, { react: { text: "💬", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`*DARK-DINU AI ASSISTANT* 🧠

*භාවිතය:*
› \`${pref}ai <ඔබේ ප්‍රශ්නය>\`
› \`${pref}ai on\` — Auto AI ක්‍රියාත්මක කරන්න
› \`${pref}ai off\` — Auto AI අක්‍රීය කරන්න`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    try {
      const response = await askLunaAi(userPrompt);
      await sock.sendMessage(from, { text: response }, { quoted: msg });
    } catch (err) {
      console.error("[AI ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ *AI සේවාව ක්‍රියාත්මක වීමේ දෝෂයක්:* ${err.message}` },
        { quoted: msg }
      );
    }
  }
};

/**
 * Luna AI Core Query Function
 */
export async function askLunaAi(promptText) {
  const lower = promptText.toLowerCase();

  // Developer / Owner පිළිබඳ විමසීම් සෘජුව ලබාදීම
  const devTriggers = ["developer", "dev", "owner", "හදපු කෙනා", "owner number", "ඔයා කවුද", "creator", "අයිතිකාරයා", "හැදුවේ කවුද"];
  if (devTriggers.some(t => lower.includes(t))) {
    return `👑 *DARK-DINU BOT DEVELOPER DETAILS*

• *නම:* Dinidu Heshan Samaranayaka (Heshan)
• *ගම:* ඇඹිලිපිටිය (Embilipitiya, Sri Lanka)
• *වයස:* අවුරුදු 18
• *වෘත්තිය:* Full-Stack Software Developer & AI Creator
• *Brand:* DARK DINU | HESHAN OFC
• *දුරකථන අංකය:* 0719845166 (wa.me/94719845166)

_ඕනෑම Bot Development හෝ Programming අවශ්‍යතාවයක් සඳහා Developer ව සම්බන්ධ කරගන්න!_`;
  }

  const systemPrompt = 
`You are DARK-DINU AI, an intelligent, friendly and witty Sri Lankan AI peer created by Dinidu Heshan Samaranayaka from Embilipitiya (Phone: 0719845166). 
Speak naturally in Sinhala or English depending on user language.
Respond directly to this query: ${promptText}`;

  const apiUrl = `https://api.chamindu.site/api/v1/ai/duckai/chat?prompt=${encodeURIComponent(systemPrompt)}&model=gpt-6-luna&api_key=${API_KEY}`;
  
  const res = await axios.get(apiUrl, { timeout: 30000 });
  const data = res.data;

  // විවිධ response keys safe විදියට extract කිරීම
  const reply = 
    data?.result || 
    data?.response || 
    data?.data?.result || 
    data?.data?.response || 
    data?.message || 
    (typeof data === "string" ? data : null);

  if (!reply) {
    throw new Error("API එකෙන් ප්‍රතිචාරයක් නොලැබුණි.");
  }

  return String(reply).trim();
}
