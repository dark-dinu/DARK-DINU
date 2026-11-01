import axios from "axios";
import yts from "yt-search";

const API_KEY = "chama_api_9c55e3c6d014abbdf65054f9046a920b";

function isYouTubeUrl(input = "") {
  return /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i.test(input);
}

function extractInviteCode(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z_-]+)/i);
  return match ? match[1] : input.trim();
}

async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const clean = input.trim();
  if (clean.endsWith("@newsletter")) return clean;

  const code = extractInviteCode(clean);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) return meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
    }
  } catch (_) {}
  return null;
}

export default {
  name: "csong",
  aliases: ["cplay", "channelplay", "channelsong", "cvoice"],
  category: "channel",
  description: "Post playable streaming tracks cleanly to WhatsApp Channels",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";
    const fullText = args.join(" ").trim();
    const isChannelChat = from.endsWith("@newsletter");

    let targetChannel = isChannelChat ? from : null;
    let songQuery = fullText;

    if (!isChannelChat) {
      if (fullText.includes("|")) {
        const parts = fullText.split("|");
        targetChannel = await resolveChannelJid(sock, parts[0].trim());
        songQuery = parts.slice(1).join("|").trim();
      } else {
        const firstArg = args[0] || "";
        if (firstArg.includes("whatsapp.com/channel/") || firstArg.endsWith("@newsletter")) {
          targetChannel = await resolveChannelJid(sock, firstArg);
          songQuery = args.slice(1).join(" ").trim();
        }
      }
    }

    if (!songQuery || (!targetChannel && !isChannelChat)) {
      sock.sendMessage(from, { react: { text: "🎵", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: 
`╔═════════════════════════════╗
   🎧 𝐂 𝐇 𝐀 𝐍 𝐍 𝐄 𝐋  𝐒 𝐎 𝐍 𝐆
╚═════════════════════════════╝

💡 *භාවිතා කරන ආකාරය:*
• \`${pref}csong <channel_link> | <song_name>\`
• \`${pref}csong <channel_link> <song_name>\`

✨ *උදාහරණයක්:*
• \`${pref}csong https://whatsapp.com/channel/xxxx | Lelena\`

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let targetUrl = songQuery;
      let title = "Audio Track";
      let duration = "03:15";

      // 1. YouTube Search
      const search = await yts(songQuery);
      const firstResult = search?.videos?.[0];

      if (firstResult) {
        targetUrl = firstResult.url;
        title = firstResult.title || title;
        duration = firstResult.timestamp || duration;
      } else if (!isYouTubeUrl(songQuery)) {
        throw new Error("ගීතය සොයාගත නොහැකි විය.");
      }

      // 2. Chamindu API වෙතින් Direct Stream Link එක ගැනීම
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(targetUrl)}&quality=320kbps&api_key=${API_KEY}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });
      const dlData = res.data;

      const directAudioUrl = 
        dlData?.download_url || 
        dlData?.data?.download_url || 
        dlData?.result?.download_url || 
        dlData?.url || 
        dlData?.data?.url ||
        targetUrl;

      // 3. Channel Post Format (Zero Socket Drop)
      const channelPost = 
`🎶 ｡ﾟ•┈୨ *DARK-DINU MUSIC STREAM* ୧┈•ﾟ｡ 🎧
━━━━━━━━━━━━━━━━━━━━━

🎵 *Title:* ${title}
⏱️ *Duration:* ${duration}
⚡ *Quality:* 320kbps Cloud Audio

🎧 *Direct Audio Link (Listen/Download):*
${directAudioUrl}

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      // 4. WhatsApp Channel එකට කෙලින්ම Dispatch කිරීම
      await sock.sendMessage(targetChannel, {
        text: channelPost
      });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      if (!isChannelChat) {
        await sock.sendMessage(
          from,
          { text: `✅ *සාර්ථකයි!* \`${title}\` පණිවිඩය චැනල් එකට Post විය.` },
          { quoted: msg }
        );
      }

    } catch (err) {
      console.error("[CSONG FAIL]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ *අසාර්ථකයි:* ${err.message}` },
        { quoted: msg }
      );
    }
  }
};
