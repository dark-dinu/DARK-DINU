// Truth Questions (ඇත්ත ප්‍රශ්න)
const truthQuestions = [
  "ඔයාගේ ජීවිතේ කාටවත් නොකියපු ලොකුම රහස මොකක්ද?",
  "ඔයා කවදාහරි හොඳම යාළුවෙක්ට ලොකු බොරුවක් කරලා අහු නොවී බේරිලා තියෙනවද?",
  "මේ Chat එකේ ඉන්න කෙනෙක්ට ඔයාගේ හිතේ crush එකක් තිබිලා තියෙනවද?",
  "ඔයා කරපු ලැජ්ජා සහගතම වැඩේ මොකක්ද?",
  "ඔයාගේ අන්තිමට බලපු Search History එකේ තිබ්බ දේ කියන්න පුළුවන්ද?",
  "ඔයා ආදරය කරපු පළවෙනි කෙනා කවුද?",
  "ඔයා කවදාහරි කෙනෙක්ගේ පෙනුම දැකලා බොරුවට වර්ණනා කරලා තියෙනවද?",
  "ඔයාට අතීතයට යන්න පුළුවන් නම් වෙනස් කරන එකම දේ මොකක්ද?",
  "කවදාහරි exam එකකදි කොපි කරලා අහුවෙලා තියෙනවද?",
  "ඔයාට ලැබුණු නරකම තෑග්ග මොකක්ද?",
  "තනියම ඉද්දි කරපු අමුතුම/පිස්සු වැඩක් කියන්න?",
  "ඔයා කවදාහරි අනුන්ගේ WhatsApp චැට් හොරෙන් කියවලා තියෙනවද?"
];

// Dare Challenges (අභියෝග)
const dareActions = [
  "මේ chat එකේ ඉන්න කෙනෙක්ගේ නමක් දාලා Voice Note එකකින් ආදර ප්‍රකාශයක් කරන්න.",
  "දැන්ම ගිහින් push-ups 10ක් ගහලා ආයෙ මැසේජ් එකක් දාන්න.",
  "විනාඩි 1ක් තිස්සේ සතෙක්ගේ (බල්ලෙක් හෝ පූසෙක්) හඬ අනුකරණය කර Voice Note එකක් එවන්න.",
  "ඔයාගේ Phone එකේ තියෙන කැතම selfie එකක් මෙතනට එවන්න.",
  "දැන් තියෙන WhatsApp Status එකට 'මම අද ඉඳන් ආදරේ හොයනවා' කියලා දාලා විනාඩි 5ක් තියන්න.",
  "මේ group එකේ ඉන්න Admin කෙනෙක්ට අමුතුම බොරුවක් කියලා Voice Note එකක් දාන්න.",
  "සිංදුවක එක පදයක් විතරක් අමුතුම විදිහට කෑගහලා කියන Voice Note එකක් දාන්න.",
  "Phone එක අතහරින්නෙ නැතුව විනාඩි 2ක් එකතැන පනින්න.",
  "ඔයා ළඟම තියෙන අමුතුම භාණ්ඩයක් photo එකක් ගහලා මෙතනට එවන්න.",
  "මේ චැට් එකේ ඉන්න ඕනෑම කෙනෙක්ට විහිළු call එකක් ගන්න."
];

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default {
  name: "truth",
  aliases: ["dare", "verite", "action", "td"],
  category: "fun",
  description: "Truth or Dare fun game",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const full = (body || "").trim();
    const cmd = full.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();

    // Mention කළ අය ලබා ගැනීම
    const rawMsg = msg.message?.extendedTextMessage || msg.message;
    const mentioned = rawMsg?.contextInfo?.mentionedJid || [];
    const targetUser = mentioned.length > 0 ? mentioned[0] : null;

    // Dare විධානය ක්‍රියාත්මක වීම (.dare හෝ .action)
    if (cmd === "dare" || cmd === "action") {
      sock.sendMessage(from, { react: { text: "🔥", key: msg.key } }).catch(() => {});
      const challenge = getRandom(dareActions);

      if (targetUser) {
        return await sock.sendMessage(
          from,
          {
            text: `🔥 *DARE CHALLENGE FOR @${targetUser.split("@")[0]} :*\n\n👉 ${challenge}\n\n_අභියෝගය සම්පූර්ණ කර චැට් එකට සාක්ෂියක් එවන්න!_ 😉`,
            mentions: [targetUser]
          },
          { quoted: msg }
        );
      }

      return await sock.sendMessage(
        from,
        {
          text: `🔥 *DARE CHALLENGE :*\n\n👉 ${challenge}\n\n_අභියෝගය සම්පූර්ණ කර චැට් එකට සාක්ෂියක් එවන්න!_ 😉`
        },
        { quoted: msg }
      );
    }

    // Truth විධානය ක්‍රියාත්මක වීම (.truth හෝ .verite)
    sock.sendMessage(from, { react: { text: "🕵️‍♂️", key: msg.key } }).catch(() => {});
    const question = getRandom(truthQuestions);

    if (targetUser) {
      return await sock.sendMessage(
        from,
        {
          text: `🎭 *TRUTH QUESTION FOR @${targetUser.split("@")[0]} :*\n\n👉 ${question}\n\n_ඇත්තම විතරක් කියන්න ඕනෙ හොඳද!_ 🤫`,
          mentions: [targetUser]
        },
        { quoted: msg }
      );
    }

    return await sock.sendMessage(
      from,
      {
        text: `🎭 *TRUTH QUESTION :*\n\n👉 ${question}\n\n_ඇත්තම විතරක් කියන්න ඕනෙ හොඳද!_ 🤫`
      },
      { quoted: msg }
    );
  }
};
