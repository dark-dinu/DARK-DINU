import axios from "axios";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send song card and PTT voice note directly to a WhatsApp Channel",

  async execute({ sock, msg, from, text }) {
    const botName = "ʜᴇꜱʜᴀɴ ᴏꜰᴄ";
    const API_KEY = process.env.CHAMINDU_API_KEY || "chama_api_ec9848130d1aea209f08fb85e0b4720f";

    // Input එක comma (,) එකෙන් වෙන් කර ගැනීම
    const input = (text || "").split(",");
    const channelInput = input[0]?.trim();
    const songName = input.slice(1).join(",").trim();

    if (!channelInput || !songName) {
      return await sock.sendMessage(
        from,
        {
          text: `❗ *වැරදි ආකෘතියකි! කරුණාකර පහත පරිදි ලබාදෙන්න:*\n\n*.csong <Channel Link>, <Song Name>*\n\n> *උදා:* \`.csong https://whatsapp.com/channel/0029VaXXXXX, Manike Mage Hithe\``
        },
        { quoted: msg }
      );
    }

    // Reaction එකක් දැමීම
    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // 1. Channel Link එකෙන් Channel JID එක සොයා ගැනීම
      let channelJid = channelInput;

      if (channelInput.includes("whatsapp.com/channel/")) {
        const inviteCode = channelInput.split("whatsapp.com/channel/")[1]?.split("/")[0]?.trim();
        // Baileys newsletter metadata fetch method
        const metadata = await sock.newsletterMetadata("invite", inviteCode);
        channelJid = metadata.id; // e.g. 120363xxxxxx@newsletter
      }

      if (!channelJid.endsWith("@newsletter")) {
        return await sock.sendMessage(
          from,
          { text: "❌ *Channel Link එක නිවැරදි නැත හෝ Channel JID එක ලබාගත නොහැක.*" },
          { quoted: msg }
        );
      }

      // 2. Chamindu API එකෙන් Song එක ලබා ගැනීම
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

      // 3. Clean UI Card Caption එක
      const captionText = 
`🥰⃝🎶 *“ ${title} ”*

0:00 ◁◁  II  ▷▷ ${duration}

Use Headphones For Best Experience.... 🧚‍♀️🎵

☘️ *${botName}*`;

      // 4. Channel එකට Image Card එක යැවීම
      await sock.sendMessage(channelJid, {
        image: { url: thumbnail },
        caption: captionText
      });

      // 5. Channel එකට Voice Note (PTT) එක යැවීම
      await sock.sendMessage(channelJid, {
        audio: { url: audioUrl },
        mimetype: "audio/mp4",
        ptt: true
      });

      // User වෙත සාර්ථක බව දැනුම් දීම
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
