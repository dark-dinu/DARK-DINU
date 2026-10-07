import axios from "axios";

// 100% Working Engine for Cloud Servers & Sri Lankan IPs
async function translateText(text, targetLang = "si", sourceLang = "auto") {
  // Method 1: Google Web Client API (Direct Query)
  try {
    const res = await axios({
      method: "GET",
      url: "https://translate.googleapis.com/translate_a/single",
      params: {
        client: "gtx",
        sl: sourceLang,
        tl: targetLang,
        hl: targetLang,
        dt: ["t", "bd"],
        dj: "1",
        source: "icon",
        q: text
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Android; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
        "Accept": "application/json"
      },
      timeout: 10000
    });

    if (res.data?.sentences && Array.isArray(res.data.sentences)) {
      const translated = res.data.sentences
        .map((s) => s.trans || "")
        .join("")
        .trim();
      const detected = res.data.src || sourceLang;
      if (translated) return { translatedText: translated, detectedLang: detected };
    }
  } catch (_) {}

  // Method 2: Google Translation Public RPC Fallback
  try {
    const rpcUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sourceLang}&tl=${targetLang}&q=${encodeURIComponent(text)}`;
    const rpcRes = await axios.get(rpcUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 10000
    });

    if (Array.isArray(rpcRes.data) && rpcRes.data[0]) {
      const translated = Array.isArray(rpcRes.data[0]) ? rpcRes.data[0].join("") : rpcRes.data[0];
      return { translatedText: translated, detectedLang: sourceLang };
    }
  } catch (_) {}

  throw new Error("Translation server unreachable. Please try again.");
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
      let targetLang = "si"; // Default: සිංහල
      let textToTranslate = "";

      if (args.length > 0) {
        const firstArg = args[0].toLowerCase().trim();

        // 1. .tr si,en <text>
        if (firstArg.includes(",")) {
          const parts = firstArg.split(",");
          sourceLang = parts[0].trim() || "auto";
          targetLang = parts[1].trim() || "si";
          textToTranslate = args.slice(1).join(" ").trim();
        } 
        // 2. .tr en <text> හෝ .tr si <text>
        else if (/^[a-z]{2,5}$/.test(firstArg)) {
          targetLang = firstArg;
          textToTranslate = args.slice(1).join(" ").trim();
        } 
        // 3. .tr <text> (කෙලින්ම සිංහලට)
        else {
          textToTranslate = args.join(" ").trim();
        }
      }

      // Quoted text එකක් ඇත්නම් එය තෝරා ගැනීම
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

      const res = await translateText(textToTranslate, targetLang, sourceLang);

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
