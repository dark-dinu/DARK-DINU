// Unicode codepoint එක hex string බවට පත් කිරීම (උදා: 😂 -> 1f602)
function toCodePoint(emoji) {
  return Array.from(emoji)
    .map(c => c.codePointAt(0).toString(16))
    .filter(c => c !== "fe0f") // variation selector අයින් කිරීම
    .join("-");
}

// Emojis extract කරගන්නා function එක
function extractEmojis(str = "") {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return str.match(emojiRegex) || [];
}

export default {
  name: "mix",
  aliases: ["emojimix", "emix"],
  category: "converter",
  description: "Mix two emojis into a custom sticker directly via Google Kitchen CDN (No API)",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join("").trim();

    // ඕනෑම format එකකින් (😂+😭, 😂,😭, 😂.😭, 😂😭) emojis extract කිරීම
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
      const c1 = toCodePoint(emoji1);
      const c2 = toCodePoint(emoji2);

      // Google Static Kitchen CDN URLs (Combination 1 සහ Combination 2)
      const primaryUrl = `https://raw.githubusercontent.com/googlefonts/emoji-metadata/main/images/extracted/u${c1}_u${c2}.png`;
      const reverseUrl = `https://raw.githubusercontent.com/googlefonts/emoji-metadata/main/images/extracted/u${c2}_u${c1}.png`;

      // Google Direct Static Media Storage Fallback
      const gStaticUrl = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${c1}/u${c1}_u${c2}.png`;

      // Stickers යැවීමට URL එක තෝරාගැනීම
      let finalMediaUrl = primaryUrl;

      // Direct WhatsApp Sticker Payload
      await sock.sendMessage(
        from,
        {
          sticker: { url: finalMediaUrl }
        },
        { quoted: msg }
      ).catch(async () => {
        // Reverse order එකෙන් උත්සාහ කිරීම (u{c2}_u{c1})
        await sock.sendMessage(
          from,
          {
            sticker: { url: reverseUrl }
          },
          { quoted: msg }
        );
      });

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[NO-API EMOJI MIX ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          text: `⚠️ *Emoji Kitchen Error:* Google Kitchen does not support combining ${emoji1} and ${emoji2}. Please try another emoji pair!`
        },
        { quoted: msg }
      );
    }
  }
};
