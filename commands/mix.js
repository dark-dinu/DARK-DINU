import axios from "axios";

// Helper function to extract any emojis reliably
function extractEmojis(str = "") {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return str.match(emojiRegex) || [];
}

export default {
  name: "mix",
  aliases: ["emojimix", "emix"],
  category: "converter",
  description: "Mix two emojis into a custom sticker using Google Emoji Kitchen",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join("").trim();

    // 1. Extract emojis from any delimiter format: +, ,, ., space, or direct
    const emojis = extractEmojis(fullText);

    if (emojis.length < 2) {
      sock.sendMessage(from, { react: { text: "🎨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`╔═════════════════════════════╗
   🎨 𝐄 𝐌 𝐎 𝐉 𝐈  𝐊 𝐈 𝐓 𝐂 𝐇 𝐄 𝐍
╚═════════════════════════════╝

💡 *Usage:*
├ \`${pref}mix <emoji1>+<emoji2>\`
├ \`${pref}mix <emoji1>,<emoji2>\`
├ \`${pref}mix <emoji1>.<emoji2>\`
╰ \`${pref}mix <emoji1><emoji2>\`

✨ *Examples:*
├ \`${pref}mix 😂+😭\`
├ \`${pref}mix 😂,😭\`
├ \`${pref}mix 😂.😭\`
╰ \`${pref}mix 😭😂\`

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    const emoji1 = emojis[0];
    const emoji2 = emojis[1];

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // High-availability Emoji Mix API endpoint (Auto WebP Converter)
      const apiUrl = `https://api.giftedtech.web.id/api/tools/emojimix?apikey=gifted&emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`;

      const res = await axios.get(apiUrl, { timeout: 20000 }).catch(() => null);
      let stickerUrl = res?.data?.result;

      // Fallback Engine 1
      if (!stickerUrl) {
        const fallback1 = `https://api.vreden.my.id/api/emojimix?emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`;
        const fbRes1 = await axios.get(fallback1, { timeout: 15000 }).catch(() => null);
        stickerUrl = fbRes1?.data?.result || fbRes1?.data?.data?.url;
      }

      // Fallback Engine 2
      if (!stickerUrl) {
        const fallback2 = `https://api.ryzendesu.vip/api/maker/emojimix?emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`;
        const fbRes2 = await axios.get(fallback2, { timeout: 15000 }).catch(() => null);
        stickerUrl = fbRes2?.data?.result || fbRes2?.data?.url;
      }

      if (!stickerUrl) {
        throw new Error(`Google Kitchen does not support combining (${emoji1} + ${emoji2})`);
      }

      // Send direct sticker payload
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
          text: `⚠️ *Emoji Kitchen Error:* Failed to combine ${emoji1} and ${emoji2}. Please try another emoji pair!`
        },
        { quoted: msg }
      );
    }
  }
};
