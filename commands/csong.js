import axios from "axios";
import ytSearch from "yt-search";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send clean song card and voice note to WhatsApp channel",

  async execute({ sock, msg, from, args }) {
    try {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const fullText = args ? (Array.isArray(args) ? args.join(" ") : args) : "";

      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(
          from,
          { text: "ℹ️ *භාවිතය:* `.csong channel_link_or_jid, song_name`\n\n_උදා: .csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, lelena_" },
          { quoted: msg }
        );
      }

      const [rawTarget, ...songQueryParts] = fullText.split(",");
      const targetInput = rawTarget.trim();
      const songQuery = songQueryParts.join(",").trim();

      if (!targetInput || !songQuery) {
        return await sock.sendMessage(
          from,
          { text: "⚠️ Channel එක සහ Song Name එක කොමාවකින් වෙන් කර ඇතුළත් කරන්න." },
          { quoted: msg }
        );
      }

      let channelJid = "";

      // කෙලින්ම Newsletter JID එකක් දුන්නොත්
      if (targetInput.endsWith("@newsletter")) {
        channelJid = targetInput;
      } else {
        // Link එකකින් Invite Code එක පමණක් හරියටම ගැනීම (/430 හෝ වෙන මොනවා තිබ්බත්)
        const match = targetInput.match(/channel\/([a-zA-Z0-9]{20,28})/i);
        if (!match || !match[1]) {
          return await sock.sendMessage(
            from,
            { text: "❌ වලංගු WhatsApp Channel Link එකක් ලබාදෙන්න." },
            { quoted: msg }
          );
        }

        const inviteCode = match[1];

        try {
          const metadata = await sock.newsletterMetadata("invite", inviteCode);
          channelJid = metadata.id;
        } catch (err) {
          console.error("Newsletter Fetch Error:", err);
          return await sock.sendMessage(
            from,
            { text: `❌ Channel එක හඳුනාගත නොහැකි විය!\n\nකාරුණිකව පරීක්ෂා කරන්න:\n1. Bot run වන අංකය එම චැනල් එකේ *Admin* කෙනෙක්ද?\n2. ලින්ක් එක වෙනුවට චැනල් එකේ *JID* (උදා: \`120363xxxxxxxx@newsletter\`) එක ලබා දී උත්සාහ කරන්න.` },
            { quoted: msg }
          );
        }
      }

      // YouTube සෙවීම
      let targetUrl = songQuery;
      let title = songQuery;
      let artist = "Official Track";
      let duration = "--:--";
      let thumbnail = "";

      const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(songQuery);

      if (!isUrl) {
        const searchResult = await ytSearch(songQuery);
        const video = searchResult?.videos?.[0];

        if (!video) {
          return await sock.sendMessage(
            from,
            { text: "❌ අදාළ නමින් සින්දුවක් සොයා ගැනීමට නොහැකි විය." },
            { quoted: msg }
          );
        }

        targetUrl = video.url;
        title = video.title;
        artist = video.author?.name || "Official Track";
        duration = video.timestamp || "--:--";
        thumbnail = video.thumbnail;
      }

      // Chamindu API
      const apiKey = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
      const apiUrl = `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(targetUrl)}&api_key=${apiKey}`;

      const response = await axios.get(apiUrl, { timeout: 40000 });
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

      // Clean Minimalist Song Card
      const cleanCard = 
`🎶  *${title}*

🎤  *Artist* • ${artist}
⏱️  *Length* • ${duration}
📡  *Source* • YouTube

🎧  _Listen to the voice note below_`;

      // 1. Poster Card
      if (thumbnail) {
        await sock.sendMessage(channelJid, {
          image: { url: thumbnail },
          caption: cleanCard
        });
      } else {
        await sock.sendMessage(channelJid, { text: cleanCard });
      }

      // 2. Audio to PTT Voice Note
      const audioBufferRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
      const audioBuffer = Buffer.from(audioBufferRes.data);

      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype: "audio/mp4",
        ptt: true
      });

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
