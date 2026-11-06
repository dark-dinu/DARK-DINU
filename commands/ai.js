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

    // 1. AI Auto-Reply Toggle (Owner Only)
    if (subCmd === "on" || subCmd === "off") {
      if (!isOwner && !msg.key.fromMe) {
        return await sock.sendMessage(
          from,
          { text: "⛔ *ප්‍රවේශය නොමැත:* මෙම සැකසුම වෙනස් කළ හැක්කේ Bot Developer / Owner හට පමණි." },
          { quoted: msg }
        );
      }

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
• Mode: ${isEnable ? "_දැන් ලැබෙන පණිවිඩ වලට AI ස්වයංක්‍රීයව පිළිතුරු සපයනු ඇත._" : "_ස්වයංක්‍රීය AI පිළිතුරු අක්‍රීය කරන ලදී._"}`
        },
        { quoted: msg }
      );
    }

    // 2. Direct Question Mode (.ai <ප්‍රශ්නය>)
    const userPrompt = args.join(" ").trim();
    if (!userPrompt) {
      sock.sendMessage(from, { react: { text: "💬", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`*DARK-DINU AI ASSISTANT* 🧠

*භාවිතය:*
› \`${pref}ai <ඔබට අවශ්‍ය ඕනෑම දෙයක් අසන්න>\`
› \`${pref}ai on\` — ස්වයංක්‍රීය AI පිළිතුරු සක්‍රීය කරන්න
› \`${pref}ai off\` — අක්‍රීය කරන්න

_උදාහරණ:_ \`${pref}ai ඔයාගෙ developer කවුද?\``
        },
        { quoted: msg }
      );
    }

    // Reaction එකක් දමා Processing පෙන්වීම
    sock.sendMessage(from, { react: { text: "💭", key: msg.key } }).catch(() => {});

    try {
      const response = await askLunaAi(userPrompt, from, sock);
      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

      await sock.sendMessage(from, { text: response }, { quoted: msg });
    } catch (err) {
      console.error("[AI CMD ERROR]:", err.message);
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
 * Luna AI Core Query Function with Developer Persona Injection
 */
export async function askLunaAi(promptText, from, sock) {
  const lower = promptText.toLowerCase();

  // Developer / Owner පිළිබඳ විමසීම් සෘජුව හඳුනාගැනීම
  const devTriggers = ["developer", "dev", "owner", "හදපු කෙනා", "owner number", "ඔයා කවුද", "creator", "අයිතිකාරයා", "හැදුවේ කවුද"];
  const isDevQuestion = devTriggers.some(t => lower.includes(t));

  if (isDevQuestion) {
    return `👑 *DARK-DINU BOT DEVELOPER DETAILS*

• *නම:* Dinidu Heshan Samaranayaka (Heshan)
• *ගම:* ඇඹිලිපිටිය (Embilipitiya, Sri Lanka)
• *වයස:* අවුරුදු 18
• *වෘත්තිය:* Full-Stack Software Developer & AI Creator
• *Brand:* DARK DINU | HESHAN OFC
• *දුරකථන අංකය:* 0719845166 (WhatsApp: wa.me/94719845166)

_ඕනෑම තාක්ෂණික සහයෝගයක් හෝ Bot Development අවශ්‍යතාවයක් සඳහා Developer ව සම්බන්ධ කරගන්න!_`;
  }

  // System Persona Injection (ස්වභාවික මිනිසෙකු මෙන් පිළිතුරු දීමට)
  const systemPrompt = 
`You are DARK-DINU AI, an authentic, highly intelligent, friendly and helpful Sri Lankan AI assistant built by Dinidu Heshan Samaranayaka (Heshan) from Embilipitiya. 
You speak fluently in Sinhala and English (or Singlish when appropriate). 
Never sound robotic; talk naturally like a smart and witty human peer.
Developer info: Dinidu Heshan (0719845166), Embilipitiya. 
Answer the following user question clearly and accurately: ${promptText}`;

  const apiUrl = `https://api.chamindu.site/api/v1/ai/duckai/chat?prompt=${encodeURIComponent(systemPrompt)}&model=gpt-6-luna&api_key=${API_KEY}`;
  
  const res = await axios.get(apiUrl, { timeout: 35000 });
  const data = res.data;

  const replyText = 
    data?.response || 
    data?.result || 
    data?.data?.response || 
    data?.message || 
    (typeof data === "string" ? data : null);

  if (!replyText) {
    throw new Error("AI එකෙන් ප්‍රතිචාරයක් නොලැබුණි.");
  }

  return replyText.trim();
}
