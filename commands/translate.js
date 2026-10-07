import axios from "axios";

// Helper: Multi-engine Translation
async function fetchTranslation(text, sourceLang, targetLang) {
  // Engine 1: MyMemory API (ඉතාම වේගවත් සහ 100% stable)
  try {
    const pair = `${sourceLang === "auto" ? "autodetect" : sourceLang}\vert{}${targetLang}`;
    const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;
    const res = await axios.get(myMemoryUrl, { timeout: 12000 });
    const trans = res.data?.responseData?.translatedText;
    if (trans && !trans.includes("MYMEMORY WARNING")) {
      return {
        translatedText: trans,
        detectedLang: sourceLang === "auto" ? (res.data?.matches?.[0]?.["created-by"] || "Auto") : sourceLang
      };
    }
  } catch (_) {}

  // Engine 2: Google Web Client (Fallback)
  try {
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const { data } = await axios.get(googleUrl, { 
      timeout: 12000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (data && data[0]) {
      const translatedText = data[0].map((chunk) => chunk[0]).join("");
      const detectedLang = data[2] || sourceLang;
      return { translatedText, detectedLang };
    }
  } catch (_) {}

  throw new Error("Translation engines are currently busy. Please try again.");
}

export default {
  name: "translate",
  aliases: ["tr", "trans", "translete"],
  category: "utility",
  description: "Translate text or replied messages to any language",

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
      let targetLang = "si"; // Default: සිංහල
      let textToTranslate = "";

      if (args.length > 0) {
        const firstArg = args[0].toLowerCase().trim();

        // .translate si,en වැනි comma format එකක් ආ විට
        if (firstArg.includes(",")) {
          const parts = firstArg.split(",");
          sourceLang = parts[0].trim() || "auto";
          targetLang = parts[1].trim() || "si";
          textToTranslate = args.slice(1).join(" ").trim();
        } else if (/^[a-z]{2,5}$/.test(firstArg)) {
          // .translate en වැනි direct single lang code එකක් ආ විට
          targetLang = firstArg;
          textToTranslate = args.slice(1).join(" ").trim();
        } else {
          // කෙලින්ම text එකක් ලබා දුන් විට
          textToTranslate = args.join(" ").trim();
        }
      }

      // Quoted message එකක් තිබේ නම් එය ලබා ගැනීම
      if (!textToTranslate && quotedText) {
        textToTranslate = quotedText;
      }

      if (!textToTranslate) {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතය:*\n\n• පණිවිඩයකට reply කර: \`${prefix}tr si\`\n• භාෂා දෙකක් නියම කර: \`${prefix}tr en,si Good morning\`\n• කෙලින්ම පරිවර්තනයට: \`${prefix}tr si How are you?\``
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const result = await fetchTranslation(textToTranslate, sourceLang, targetLang);

      const resultCard = 
`╔══════════════════════╗
   🌐 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🌐
╚══════════════════════╝

┌─〔 🗣️ *TRANSLATION* 〕
├─▸ 📥 *From* : \`${result.detectedLang.toUpperCase()}\`
├─▸ 📤 *To*   : \`${targetLang.toUpperCase()}\`
└───────────────────────

📝 *Original:*
${textToTranslate}

✨ *Result:*
${result.translatedText}

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
