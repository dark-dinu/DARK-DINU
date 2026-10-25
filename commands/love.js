import { delay } from "@whiskeysockets/baileys";

export default {
  name: "love",
  aliases: ["heart", "adare"],
  category: "fun",
  description: "Romantic love quotes with name & cute emoji animation",

  async execute({ sock, msg, from, args }) {
    // 1. Instant Reaction
    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    const inputName = (args || []).join(" ").trim();

    // ── CASE 1: නමක් නැතුව නිකන්ම .love ගැහුවොත් (Emoji Animation Edit) ──
    if (!inputName) {
      const animFrames = [
        "🤍",
        "🤍 ➔ 💖",
        "💖 ➔ 💕",
        "💕 ➔ 💓",
        "💓 ➔ 💗",
        "💗 ➔ 💘",
        "💘 ➔ 💝",
        "💝 ➔ 💍✨",
        "🥺👉👈 *I Love You So Much Honey...* 🌸❤️"
      ];

      // මුල් message එක යැවීම
      const sentMsg = await sock.sendMessage(
        from,
        { text: animFrames[0] },
        { quoted: msg }
      );

      // පියවරෙන් පියවර Emoji edit වීම
      if (sentMsg?.key) {
        for (let i = 1; i < animFrames.length; i++) {
          await delay(700);
          await sock.sendMessage(from, {
            text: animFrames[i],
            edit: sentMsg.key
          }).catch(() => {});
        }
      }
      return;
    }

    // ── CASE 2: නම දුන්නම (.love Nethu) ලස්සන Personalized Card එකක් යැවීම ──
    const nameQuotes = [
      `මගේ මුළු ලෝකෙම ලස්සන වුණේ ඔයා මගේ ජීවිතේට ආපු දවසේ ඉඳන් *${inputName}*... ඔයා තමයි මට ලැබුණු වටිනාම වස්තුව! 🥺💍`,
      `කෝටි ගාණක් මිනිස්සු ඉන්න මේ ලෝකේ මගේ ඇස් දෙක හැමදාම හොයන්නේ ඔයාව විතරයි මගේ *${inputName}*... ගොඩාක් ආදරෙයි පැටියෝ! 🌸💖`,
      `ඔයාගේ එක හිනාවකින් මගේ දවසම සතුටින් පිරෙනවා *${inputName}*... මගේ හුස්ම තියෙනකල්ම මම ඔයාව රැකගන්නවා මැණික. 🧸🤍`,
      `හැමදාම රෑට හඳ දිහා බලද්දි මට මතක් වෙන්නේ ඔයාගේ ආදරණීය මූණ *${inputName}*... You are my today and all of my tomorrows! 🧚‍♀️✨`,
      `වචන වලට පෙරළන්න බැරි තරම් ලොකු ආදරයක් මගේ හිතේ ඔයා වෙනුවෙන් තියෙනවා *${inputName}*... හැම භවයකදීම මට ඔයාවම ඕන! 🔒❤️`
    ];

    const selectedQuote = nameQuotes[Math.floor(Math.random() * nameQuotes.length)];
    const compatibilityScore = Math.floor(Math.random() * 6) + 95; // 95% - 100%

    const loveCard = 
`🌸 ｡ﾟ•┈୨ *MY HEART BELONGS TO YOU* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👑 *To My Princess:* *${inputName}* 💍
  📊 *Love Compatibility:* \`${compatibilityScore}%\` 💖

━━━━━━━━━━━━━━━━━━━━━

“ ${selectedQuote} ”

━━━━━━━━━━━━━━━━━━━━━
  🤍 *Status:* Deeply In Love With You
  🔒 *My Promise:* Forever and Always by your side
  ✨ *Soulmate:* You & Me together
━━━━━━━━━━━━━━━━━━━━━
> *🧸⃟💖 Always Yours, With Endless Love*`;

    // Aesthetic Couple Images
    const coupleImages = [
      "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=700",
      "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=700",
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=700",
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=700"
    ];
    const randomImage = coupleImages[Math.floor(Math.random() * coupleImages.length)];

    await sock.sendMessage(
      from,
      {
        image: { url: randomImage },
        caption: loveCard
      },
      { quoted: msg }
    );
  }
};
