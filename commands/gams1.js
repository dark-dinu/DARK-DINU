import { cmd } from "../command.js";

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

// Truth Command
cmd({
  pattern: "truth",
  alias: ["aththa"],
  desc: "Ask a random truth question.",
  category: "fun",
  react: "🕵️‍♂️"
}, async (sock, msg, m, { reply }) => {
  try {
    const rawMsg = msg.message?.extendedTextMessage || msg.message?.conversation;
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const question = getRandom(truthQuestions);

    if (mentioned.length > 0) {
      const target = mentioned[0];
      return await sock.sendMessage(m.from, {
        text: `🎭 *TRUTH QUESTION FOR @${target.split("@")[0]}:*\n\n👉 ${question}`,
        mentions: [target]
      }, { quoted: msg });
    }

    await reply(`🎭 *TRUTH QUESTION:*\n\n👉 ${question}`);
  } catch (err) {
    reply("⚠️ දෝෂයක් සිදු විය.");
  }
});

// Dare Command
cmd({
  pattern: "dare",
  alias: ["abhiyoga"],
  desc: "Give a random dare challenge.",
  category: "fun",
  react: "🔥"
}, async (sock, msg, m, { reply }) => {
  try {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const challenge = getRandom(dareActions);

    if (mentioned.length > 0) {
      const target = mentioned[0];
      return await sock.sendMessage(m.from, {
        text: `🔥 *DARE CHALLENGE FOR @${target.split("@")[0]}:*\n\n👉 ${challenge}`,
        mentions: [target]
      }, { quoted: msg });
    }

    await reply(`🔥 *DARE CHALLENGE:*\n\n👉 ${challenge}`);
  } catch (err) {
    reply("⚠️ දෝෂයක් සිදු විය.");
  }
});
