import axios from "axios";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send song card and audio directly to a WhatsApp Channel",

  async execute({ sock, msg, from, text, args }) {
    const botName = "ʜᴇꜱʜᴀɴ ᴏꜰᴄ";
    const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";

    let fullText = text || (args && args.join(" ")) || "";
    if (fullText.startsWith(".csong")) {
      fullText = fullText.replace(/^\.csong\s*/i, "");
    }

    // Link එක සහ Song එක නිවැරදිව වෙන් කර ගැනීම
    let channelInput = "";
    let songName = "";

    if (fullText.includes(",")) {
      const parts = fullText.split(",");
      channelInput = parts[0]?.trim();
      songName = parts.slice(1).join(",").trim();
    } else {
      const parts = fullText.trim().split(/\s+/);
      channelInput = parts[0]?.trim();
      songName = parts.slice(1).join(" ").trim();
    }

    if (!channelInput || !songName) {
      return await sock.sendMessage(
        from,
        {
          text: `❗ *කරුණාකර නිවැරදිව Link එක සහ සින්දුවේ නම ලබාදෙන්න:*\n\n> *.csong <Channel Link>, <Song Name>*\n\n*උදා:* \`.csong https://whatsapp.com/channel/0029Vb9GVpd0wajsDAReUJ2k, lelena\``
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let channelJid = channelInput;

      // Channel Invite Link එකෙන් Code එක පමණක් නිවැරදිව වෙන් කිරීම
      if (channelInput.includes("whatsapp.com/channel/")) {
        const rawCode = channelInput.split("whatsapp.com/channel/")[1] || "";
        const inviteCode = rawCode.split(/[?/, ]/)[0].trim();

        const metadata = await sock.newsletterMetadata("invite", inviteCode);
        channelJid = metadata.id;
      }

      if (!channelJid || !channelJid.endsWith("@newsletter")) {
        return await sock.sendMessage(
          from,
          { text: "❌ *Channel එක සොයාගත නොහැක. Link එක නිවැරදිදැයි බලන්න.*" },
          { quoted: msg }
        );
      }

      // Song details ලබා ගැනීම
      const res = await axios.get(`https://api.chamindu.xyz/api/v1/download/ytmp3`, {
        params: {
          q: songName,
          apiKey: API_KEY
        }
      });

      const result = res.data?.result || res.data?.data || res.data;
      const title = result.title || songName;
      const duration = result.timestamp || result.duration || "03:45";
      const thumbnail = result.thumbnail || result.image || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600";
      const audioUrl = result.download?.url || result.download_url || result.dl_url || result.url;

      if (!audioUrl) {
        throw new Error("Audio URL not found in API response");
      }

      const captionText = 
`🥰⃝🎶 *“ ${title} ”*

0:00 ◁◁  II  ▷▷ ${duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

☘️ *${botName}*`;

      // 1. Channel එකට Image Card එක යැවීම
      await sock.sendMessage(channelJid, {
        image: { url: thumbnail },
        caption: captionText
      });

      // 2. Channel එකට Audio එක යැවීම (Channels සඳහා ptt වෙනුවට standard audio ක්‍රියා කරයි)
      await sock.sendMessage(channelJid, {
        audio: { url: audioUrl },
        mimetype: "audio/mp4",
        fileName: `${title}.mp3`
      });

      await sock.sendMessage(
        from,
        { text: `✅ *සින්දුව සාර්ථකව Channel එකට යවන ලදී!*\n\n🎵 *Song:* ${title}` },
        { quoted: msg }
      );

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("csong error:", error);
      await sock.sendMessage(
        from,
        { text: "❌ *දෝෂයක් සිදුවිය! Bot අදාළ Channel එකේ Admin ද යන්න සහ API එක ක්‍රියාත්මක දැයි පරීක්ෂා කරන්න.*" },
        { quoted: msg }
      );
    }
  }
};
