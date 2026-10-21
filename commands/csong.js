import axios from "axios";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send song card and PTT voice note directly to a WhatsApp Channel",

  async execute({ sock, msg, from, text, args }) {
    const botName = "ʜᴇꜱʜᴀɴ ᴏꜰᴄ";
    const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";

    // Command එකට පසු ඇති සම්පූර්ණ text එක ලබා ගැනීම
    let fullText = text || (args && args.join(" ")) || "";

    // Command නම සමග ඇලී පැමිණ ඇත්නම් එය ඉවත් කිරීම
    if (fullText.startsWith(".csong")) {
      fullText = fullText.replace(/^\.csong\s*/i, "");
    }

    // Comma (,) මගින් හෝ space මගින් link එක සහ song name එක වෙන් කර ගැනීම
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
          text: `❗ *වැරදි ආකෘතියකි! කරුණාකර පහත පරිදි ලබාදෙන්න:*\n\n*.csong <Channel Link>, <Song Name>*\n\n> *උදා:* \`.csong https://whatsapp.com/channel/0029Vb9GVpd0wajsDAReUJ2k, lelena\``
        },
        { quoted: msg }
      );
    }

    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      let channelJid = channelInput;

      // WhatsApp Channel link එකෙන් invite code එක ගෙන JID එක ලබා ගැනීම
      if (channelInput.includes("whatsapp.com/channel/")) {
        const inviteCode = channelInput.split("whatsapp.com/channel/")[1]?.split("/")[0]?.split("?")[0]?.trim();
        const metadata = await sock.newsletterMetadata("invite", inviteCode);
        channelJid = metadata.id;
      }

      if (!channelJid.endsWith("@newsletter")) {
        return await sock.sendMessage(
          from,
          { text: "❌ *Channel Link එක නිවැරදි නැත හෝ Channel JID එක ලබාගත නොහැක.*" },
          { quoted: msg }
        );
      }

      // Chamindu API එකෙන් Song එක ලබා ගැනීම
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

      // Channel එකට Image Card එක යැවීම
      await sock.sendMessage(channelJid, {
        image: { url: thumbnail },
        caption: captionText
      });

      // Channel එකට Voice Note (PTT) එක යැවීම
      await sock.sendMessage(channelJid, {
        audio: { url: audioUrl },
        mimetype: "audio/mp4",
        ptt: true
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
        { text: "❌ *දෝෂයක් සිදුවිය! Bot හට අදාළ Channel එකේ Admin බලතල තිබේදැයි සහ Link එක නිවැරදිදැයි පරීක්ෂා කරන්න.*" },
        { quoted: msg }
      );
    }
  }
};
