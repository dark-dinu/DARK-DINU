import axios from "axios";

// Google Direct Engine (Zero Pair Error / Full Sinhala Support)
async function googleTranslate(text, targetLang = "si", sourceLang = "auto") {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!data || !data[0]) throw new Error("Translation parse failed");

  const translatedText = data[0].map(item => item[0]).join("");
  const detectedLang = data[2] || sourceLang;

  return { translatedText, detectedLang };
}

export default {
  name: "translate",
  aliases: ["tr", "trans", "translete"],
  category: "utility",
  description: "Translate text to any language with auto detection",

  async execute({ sock, msg, from, args, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText =
        quoted?.conversation ||
        quoted?.extendedTextMessage?.text ||
        quoted?.imageMessage?.caption ||
        quoted?.videoMessage?.caption ||
        "";

      let sourceLang = "auto";
      let targetLang = "si"; // Default සිංහල
      let textToTranslate = "";

      if (args.length > 0) {
        const firstArg = args[0].toLowerCase().trim();

        // 1. .tr si,en <text> ආකාරය
        if (firstArg.includes(",")) {
          const parts = firstArg.split(",");
          sourceLang = parts[0].trim() || "auto";
          targetLang = parts[1].trim() || "si";
          textToTranslate = args.slice(1).join(" ").trim();
        } 
        // 2. .tr en <text> හෝ .tr si <text> ආකාරය
        else if (/^[a-z]{2,5}$/.test(firstArg)) {
          targetLang = firstArg;
          textToTranslate = args.slice(1).join(" ").trim();
        } 
        // 3. .tr <text> (කෙලින්ම පෙළ ලබා දුන් විට)
        else {
          textToTranslate = args.join(" ").trim();
        }
      }

      // Quoted text එකක් ඇත්නම් එය ලබා ගැනීම
      if (!textToTranslate && quotedText) {
        textToTranslate = quotedText;
      }

      if (!textToTranslate) {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතය:*\n\n• පණිවිඩයකට reply කර: \`${prefix}tr en\` (හෝ \`${prefix}tr si\`)\n• කෙලින්ම පරිවර්තනය: \`${prefix}tr en ලෝකය\`\n• භාෂා දෙකම දක්වා: \`${prefix}tr si,en ලෝකය\``
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const res = await googleTranslate(textToTranslate, targetLang, sourceLang);

      const resultCard = 
`╔══════════════════════╗
   🌐 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🌐
╚══════════════════════╝

┌─〔 🗣️ *TRANSLATION* 〕
├─▸ 📥 *From* : \`${res.detectedLang.toUpperCase()}\`
├─▸ 📤 *To*   : \`${targetLang.toUpperCase()}\`
└───────────────────────

📝 *Original:*
${textToTranslate}

✨ *Result:*
${res.translatedText}

> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(from, { text: resultCard }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[TRANSLATE ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ පරිවර්තනය අසාර්ථක විය: ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
