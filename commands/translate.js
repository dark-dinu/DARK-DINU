import axios from "axios";

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

      let targetLang = "si"; // Default: සිංහල
      let textToTranslate = "";

      // 1. Language code සහ Text එක වෙන් කර ගැනීම
      if (args.length > 0) {
        const firstArg = args[0].toLowerCase().trim();

        // .translate si,en වැනි comma formats ඇති විට target lang එක ගැනීම
        if (firstArg.includes(",")) {
          const parts = firstArg.split(",");
          targetLang = parts[parts.length - 1].trim(); // අන්තිම භාෂාවට හරවයි
          textToTranslate = args.slice(1).join(" ").trim();
        } else if (firstArg.length === 2 || firstArg.length === 5) {
          // .translate si hello වැනි format
          targetLang = firstArg;
          textToTranslate = args.slice(1).join(" ").trim();
        } else {
          // භාෂාවක් නොදී කෙලින්ම text එකක් දුන්නොත් default සිංහල (si) වලට පරිවර්තනය කරයි
          textToTranslate = args.join(" ").trim();
        }
      }

      // 2. Reply කර ඇති මැසේජ් එකක් ඇත්නම් එය ලබා ගැනීම
      if (!textToTranslate && quotedText) {
        textToTranslate = quotedText;
      }

      if (!textToTranslate) {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතය:*\n\n1. මැසේජ් එකකට reply කර: \`${prefix}tr si\` (හෝ \`${prefix}tr en\`)\n2. කෙලින්ම text එක ලියා: \`${prefix}tr si how are you\`\n\n📌 *පොදු Language Codes:*\n• \`si\` - Sinhala\n• \`en\` - English\n• \`ta\` - Tamil\n• \`hi\` - Hindi\n• \`ja\` - Japanese\n• \`ko\` - Korean\n• \`ar\` - Arabic\n• \`ru\` - Russian`
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Google Translate Public Endpoint
      const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(textToTranslate)}`;

      const { data } = await axios.get(apiUrl, { timeout: 15000 });

      if (!data || !data[0]) {
        throw new Error("පරිවර්තනය අසාර්ථක විය.");
      }

      // Multi-sentence text එක සම්පූර්ණයෙන්ම එකතු කර ගැනීම
      const translatedText = data[0].map((item) => item[0]).join("");
      const detectedLang = data[2] || "auto";

      const resultCard = 
`╔══════════════════════╗
   🌐 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🌐
╚══════════════════════╝

┌─〔 🗣️ *TRANSLATION* 〕
├─▸ 📥 *From* : \`${detectedLang.toUpperCase()}\`
├─▸ 📤 *To*   : \`${targetLang.toUpperCase()}\`
└───────────────────────

📝 *Original:*
${textToTranslate}

✨ *Result:*
${translatedText}

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
