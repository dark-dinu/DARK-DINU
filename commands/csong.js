import axios from "axios";
import ytSearch from "yt-search";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send clean song card and voice note to any WhatsApp channel",

  async execute({ sock, msg, from, args }) {
    try {
      // 1. Processing Reaction
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const fullText = args ? (Array.isArray(args) ? args.join(" ") : args) : "";

      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(
          from,
          { text: "ℹ️ *භාවිතා කරන ආකාරය:*\n`.csong <channel_link>, <song_name>`\n\n_උදා: .csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, lelena_" },
          { quoted: msg }
        );
      }

      // Link එක සහ Song name එක වෙන් කර ගැනීම
      const commaIndex = fullText.indexOf(",");
      const rawChannelLink = fullText.slice(0, commaIndex).trim();
      const songQuery = fullText.slice(commaIndex + 1).trim();

      if (!rawChannelLink || !songQuery) {
        return await sock.sendMessage(
          from,
          { text: "⚠️ කරුණාකර Channel Link එක සහ Song Name එක කොමාවකින් වෙන් කර ඇතුළත් කරන්න." },
          { quoted: msg }
        );
      }

      let channelJid = "";

      // කෙලින්ම JID එකක් දුන්නොත්
      if (rawChannelLink.endsWith("@newsletter")) {
        channelJid = rawChannelLink;
      } else {
        // ලින්ක් එකේ අගට /430 හෝ වෙන මොනවා තිබ්බත් නියම 22-char invite code එක (0029V...) පමණක් හරියටම වෙන් කර ගැනීම
        const codeMatch = rawChannelLink.match(/channel\/([a-zA-Z0-9]{20,24})/i);
        
        if (!codeMatch || !codeMatch[1]) {
          return await sock.sendMessage(
            from,
            { text: "❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න." },
            { quoted: msg }
          );
        }

        const inviteCode = codeMatch[1];

        try {
          const metadata = await sock.newsletterMetadata("invite", inviteCode);
          if (!metadata?.id) throw new Error("Metadata ID not found");
          channelJid = metadata.id;
        } catch (err) {
          console.error("Newsletter Fetch Error:", err);
          return await sock.sendMessage(
            from,
            { text: "❌ Channel තොරතුරු ලබාගැනීමට නොහැකි විය!\n\nකාරුණිකව පරීක්ෂා කරන්න:\n1. Bot run වන WhatsApp අංකය අදාළ Channel එකේ *Admin* කෙනෙක්ද?\n2. Channel link එක නිවැරදිද?" },
            { quoted: msg }
          );
        }
      }

      // 2. YouTube Search
      const searchResult = await ytSearch(songQuery);
      const video = searchResult?.videos?.[0];

      if (!video) {
        return await sock.sendMessage(
          from,
          { text: "❌ අදාළ නමින් සින්දුවක් සොයා ගැනීමට නොහැකි විය." },
          { quoted: msg }
        );
      }

      const targetUrl = video.url;
      let title = video.title;
      let artist = video.author?.name || "Official Track";
      let duration = video.timestamp || "--:--";
      let thumbnail = video.thumbnail;

      // 3. Chamindu API එකෙන් Audio Download URL එක ලබා ගැනීම
      const apiKey = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
      const apiUrl = `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(targetUrl)}&api_key=${apiKey}`;

      const response = await axios.get(apiUrl, { timeout: 45000 });
      const apiData = response.data?.result || response.data?.data || response.data;

      const audioUrl = apiData?.download?.audio || 
                       apiData?.download_url || 
                       apiData?.audio?.url || 
                       apiData?.audio || 
                       apiData?.url ||
                       apiData?.download?.url;

      if (!audioUrl) {
        return await sock.sendMessage(
          from,
          { text: "❌ සින්දුවේ Audio එක Download කර ගැනීමට නොහැකි විය." },
          { quoted: msg }
        );
      }

      if (apiData?.title) title = apiData.title;
      if (apiData?.author?.name || apiData?.author) artist = apiData.author?.name || apiData.author;
      if (apiData?.duration) duration = apiData.duration;
      if (apiData?.thumbnail) thumbnail = apiData.thumbnail;

      // 4. Clean Minimalist Song Card (No box borders)
      const cleanCard = 
`🎶  *${title}*

🎤  *Artist* • ${artist}
⏱️  *Length* • ${duration}
📡  *Source* • YouTube

🎧  _Listen to the voice note below_`;

      // 5. පියවර 1: Poster Card එක Channel එකට යැවීම
      if (thumbnail) {
        await sock.sendMessage(channelJid, {
          image: { url: thumbnail },
          caption: cleanCard
        });
      } else {
        await sock.sendMessage(channelJid, { text: cleanCard });
      }

      // 6. පියවර 2: Audio Buffer එකක් විදියට Voice Note (PTT) එකක් කර Channel එකට යැවීම
      const audioBufferRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
      const audioBuffer = Buffer.from(audioBufferRes.data);

      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype: "audio/mp4",
        ptt: true
      });

      // User ට Success Reaction සහ Confirmation යැවීම
      sock.sendMessage(from, { react: { text: "✔️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `✅ *Uploaded to Channel!*\n\n🎵 *${title}*` },
        { quoted: msg }
      );

    } catch (error) {
      console.error("CSong Command Error:", error);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ දෝෂයක් සිදු විය: ${error?.response?.data?.message || error.message || error}` },
        { quoted: msg }
      );
    }
  }
};
