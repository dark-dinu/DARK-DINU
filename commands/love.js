import { delay } from "@whiskeysockets/baileys";

// Emoji Animations දත්ත එකතුව
const emojiAnimations = {
  lol: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂"],
  sad: ["🥺", "🥹", "😢", "😥", "😓", "😞", "😭"],
  happy: ["🤭", "🤗", "🤪", "😜", "😁", "🫣"],
  hate: ["😏", "👎", "😒", "😠", "😤", "😡", "🤬"],
  night: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌑", "🌚"],
  nigth: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘", "🌑", "🌚"],
  warning: ["⚫", "🟤", "🟣", "🟢", "🟡", "🟠", "🔴", "📛", "⚠️"],
  heart: ["❤️", "🩷", "🧡", "💛", "💚", "💙", "🩵", "💜", "🤎", "🖤"],
  love: [
    "🤍",
    "🤍 ➔ 💖",
    "💖 ➔ 💕",
    "💕 ➔ 💓",
    "💓 ➔ 💗",
    "💗 ➔ 💘",
    "💘 ➔ 💝",
    "💝 ➔ 💍✨",
    "🥺👉👈 *I Love You So Much Honey...* 🌸❤️"
  ]
};

export default {
  name: "love",
  aliases: ["adare", "lol", "sad", "happy", "hate", "night", "nigth", "warning", "heart"],
  category: "fun",
  description: "Romantic love quotes with name & live emoji editing animations",

  async execute({ sock, msg, from, args, command }) {
    // 1. User ගහපු Text එකෙන් Command එක හරියටම කඩා ගැනීම (index.js එකෙන් command pass නොවුණත් auto අල්ලයි)
    const rawText = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      ""
    ).trim();

    const usedPrefix = rawText.match(/^[./!#]/)?.[0] || "";
    const firstWord = rawText.slice(usedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    
    // Command එක resolve කර ගැනීම
    const cmd = (command || firstWord || "love").toLowerCase();
    const inputText = (args || []).join(" ").trim();

    // ── 2. .love හෝ .adare සමග නමක් දුන්නොත් (.love Nethu) Romantic Card එක යැවීම ──
    if ((cmd === "love" || cmd === "adare") && inputText) {
      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

      const nameQuotes = [
        `මගේ මුළු ලෝකෙම ලස්සන වුණේ ඔයා මගේ ජීවිතේට ආපු දවසේ ඉඳන් *${inputText}*... ඔයා තමයි මට ලැබුණු වටිනාම වස්තුව! 🥺💍`,
        `කෝටි ගාණක් මිනිස්සු ඉන්න මේ ලෝකේ මගේ ඇස් දෙක හැමදාම හොයන්නේ ඔයාව විතරයි මගේ *${inputText}*... ගොඩාක් ආදරෙයි පැටියෝ! 🌸💖`,
        `ඔයාගේ එක හිනාවකින් මගේ දවසම සතුටින් පිරෙනවා *${inputText}*... මගේ හුස්ම තියෙනකල්ම මම ඔයාව රැකගන්නවා මැණික. 🧸🤍`,
        `හැමදාම රෑට හඳ දිහා බලද්දි මට මතක් වෙන්නේ ඔයාගේ ආදරණීය මූණ *${inputText}*... You are my today and all of my tomorrows! 🧚‍♀️✨`,
        `වචන වලට පෙරළන්න බැරි තරම් ලොකු ආදරයක් මගේ හිතේ ඔයා වෙනුවෙන් තියෙනවා *${inputText}*... හැම භවයකදීම මට ඔයාවම ඕන! 🔒❤️`
      ];

      const selectedQuote = nameQuotes[Math.floor(Math.random() * nameQuotes.length)];
      const compatibilityScore = Math.floor(Math.random() * 6) + 95;

      const loveCard = 
`🌸 ｡ﾟ•┈୨ *MY HEART BELONGS TO YOU* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👑 *To My Princess:* *${inputText}* 💍
  📊 *Love Compatibility:* \`${compatibilityScore}%\` 💖

━━━━━━━━━━━━━━━━━━━━━

“ ${selectedQuote} ”

━━━━━━━━━━━━━━━━━━━━━
  🤍 *Status:* Deeply In Love With You
  🔒 *My Promise:* Forever and Always by your side
  ✨ *Soulmate:* You & Me together
━━━━━━━━━━━━━━━━━━━━━
> *🧸⃟💖 Always Yours, With Endless Love*`;

      const coupleImages = [
        "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=700",
        "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=700",
        "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=700",
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=700"
      ];
      const randomImage = coupleImages[Math.floor(Math.random() * coupleImages.length)];

      return await sock.sendMessage(
        from,
        {
          image: { url: randomImage },
          caption: loveCard
        },
        { quoted: msg }
      );
    }

    // ── 3. නමක් නැති විට හෝ අනිත් Commands (.lol, .sad, .night...) වලදී අදාළ Animation එක යැවීම ──
    const frames = emojiAnimations[cmd] || emojiAnimations.love;

    try {
      const sentMsg = await sock.sendMessage(
        from,
        { text: frames[0] },
        { quoted: msg }
      );

      if (!sentMsg?.key) return;

      for (let i = 1; i < frames.length; i++) {
        await delay(500);
        await sock.sendMessage(from, {
          text: frames[i],
          edit: sentMsg.key
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[EMOJI ANIMATION ERROR]:", err.message);
    }
  }
};
