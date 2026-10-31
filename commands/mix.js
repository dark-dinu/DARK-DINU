import axios from "axios";

// Emoji split කරගන්නා Helper function එක
function extractEmojis(str) {
  // Unicode emojis split කිරීම
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return str.match(emojiRegex) || [];
}

export default {
  name: "mix",
  aliases: ["emojimix", "emix"],
  category: "converter",
  description: "Mix two emojis into a custom sticker using Emoji Kitchen",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join("").trim();

    // 1. Emoji Extract කරගැනීම (😂+😭 හෝ 😂 😭 ආදී ඕනෑම ආකාරයකින්)
    const emojis = extractEmojis(fullText);

    if (emojis.length < 2) {
      sock.sendMessage(from, { react: { text: "🎨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`🎀 ｡ﾟ•┈୨ *EMOJI KITCHEN MIXER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

🍭 *භාවිතා කරන ආකාරය:*
• \`${pref}mix <emoji1>+<emoji2>\`
• \`${pref}mix <emoji1> <emoji2>\`

✨ *උදාහරණ:*
• \`${pref}mix 😂+😭\`
• \`${pref}mix 🥺+❤️\`
• \`${pref}mix 🐱+🚀\`

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    const emoji1 = emojis[0];
    const emoji2 = emojis[1];

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // 2. High-speed Google Emoji Kitchen API Endpoint
      const apiUrl = `https://tenor.googleapis.com/v2/featured?key=LIVDSRZULELA&q=${encodeURIComponent(emoji1 + "_" + emoji2)}`;
      
      // Direct reliable Emoji Kitchen CDN generator
      const mixUrl = `https://api.vreden.my.id/api/emojimix?emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`;

      const res = await axios.get(mixUrl, { timeout: 15000 }).catch(() => null);
      let stickerUrl = res?.data?.result || res?.data?.data?.url;

      // Fallback API Engine (පළමු එක fail වුවහොත්)
      if (!stickerUrl) {
        const fallbackUrl = `https://api.botcahx.eu.org/api/maker/emojimix?emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}&apikey=Admin`;
        const fbRes = await axios.get(fallbackUrl, { timeout: 15000 }).catch(() => null);
        stickerUrl = fbRes?.data?.result;
      }

      if (!stickerUrl) {
        // Direct Tenor/Google Kitchen WebP CDN fallback
        stickerUrl = `https://raw.githubusercontent.com/googlefonts/emoji-metadata/main/images/extracted/${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}.png`;
      }

      // 3. Sticker එකක් විදියට WhatsApp වෙත Direct Send කිරීම
      await sock.sendMessage(
        from,
        {
          sticker: { url: stickerUrl }
        },
        { quoted: msg }
      );

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[EMOJI MIX ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          text: `🌸 *කනගාටුයි!* මෙම ඉමෝජි දෙක (${emoji1} + ${emoji2}) එකතු කිරීමට Google Kitchen සහාය නොදක්වයි. වෙනත් ඉමෝජි දෙකක් උත්සාහ කරන්න.`
        },
        { quoted: msg }
      );
    }
  }
};
