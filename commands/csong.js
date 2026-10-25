import axios from "axios";
import ytSearch from "yt-search";

export default {
  name: "csong",
  aliases: ["channelsong", "cplay"],
  category: "download",
  description: "Send song card and voice note to WhatsApp channel",

  async execute({ sock, msg, from, args }) {
    try {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const fullText = args ? (Array.isArray(args) ? args.join(" ") : args) : "";

      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(
          from,
          { text: "ℹ️ *භාවිතය:* `.csong channel_link, song_name`\n\n_උදා: .csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, lelena_" },
          { quoted: msg }
        );
      }

      const commaIndex = fullText.indexOf(",");
      const rawTarget = fullText.slice(0, commaIndex).trim();
      const songQuery = fullText.slice(commaIndex + 1).trim();

      let channelJid = "";

      // 1. කෙලින්ම JID එකක් දැම්මොත්
      if (rawTarget.endsWith("@newsletter")) {
        channelJid = rawTarget;
      } else {
        // 2. Link එකෙන් Invite code එක පමණක් Clean කර ගැනීම
        const cleanCode = rawTarget
          .replace(/https?:\/\/(www\.)?whatsapp\.com\/channel\//i, "")
          .split("/")[0]
          .split("?")[0]
          .trim();

        if (!cleanCode || cleanCode.length < 15) {
          return await sock.sendMessage(
            from,
            { text: "❌ වලංගු WhatsApp Channel Link එකක් ඇතුළත් කරන්න." },
            { quoted: msg }
          );
        }

        try {
          // Baileys official newsletter fetch
          const res = await sock.newsletterMetadata("invite", cleanCode);
          channelJid = res?.id;
        } catch (e) {
          // Alternative fallback: JID එක generate කර බැලීම
          console.error("Invite metadata error:", e);
        }

        // Invite API එක block වුණොත් Web preview එකෙන් metadata සොයාගැනීම (Bypass)
        if (!channelJid) {
          try {
            const pageRes = await axios.get(`https://whatsapp.com/channel/${cleanCode}`, {
              headers: { "User-Agent": "Mozilla/5.0" }
            });
            const jidMatch = pageRes.data.match(/newsletter_jid&quot;:&quot;(120363[0-9]+@newsletter)&quot;/i) ||
                             pageRes.data.match(/"(120363[0-9]+@newsletter)"/i);
            if (jidMatch && jidMatch[1]) {
              channelJid = jidMatch[1];
            }
          } catch (scrapeErr) {
            console.error("Scrape fallback failed:", scrapeErr);
          }
        }
      }

      if (!channelJid) {
        return await sock.sendMessage(
          from,
          { text: "❌ Channel එක සොයාගත නොහැකි විය. කරුණාකර Bot එම Channel එකේ Admin කෙනෙක් බව තහවුරු කරගන්න." },
          { quoted: msg }
        );
      }

      // 3. YouTube සෙවීම
      const searchResult = await ytSearch(songQuery);
      const video = searchResult?.videos?.[0];

      if (!video) {
        return await sock.sendMessage(
          from,
          { text: "❌ අදාළ නමින් සින්දුවක් හමු නොවීය." },
          { quoted: msg }
        );
      }

      // 4. Chamindu API එකෙන් Download URL ගැනීම
      const apiKey = "chama_api_9c55e3c6d014abbdf65054f9046a920b";
      const apiUrl = `https://api.chamindu.site/api/v1/media/youtubetoolkit/info?url=${encodeURIComponent(video.url)}&api_key=${apiKey}`;

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
          { text: "❌ සින්දුවේ Audio එක ලබා ගැනීමට නොහැකි විය." },
          { quoted: msg }
        );
      }

      const title = apiData?.title || video.title;
      const artist = apiData?.author?.name || video.author?.name || "Official Track";
      const duration = apiData?.duration || video.timestamp || "--:--";
      const thumbnail = apiData?.thumbnail || video.thumbnail;

      // 5. Clean Card එක Channel එකට යැවීම
      const cleanCard = 
`🎶  *${title}*

🎤  *Artist* • ${artist}
⏱️  *Length* • ${duration}
📡  *Source* • YouTube

🎧  _Listen to the voice note below_`;

      if (thumbnail) {
        await sock.sendMessage(channelJid, {
          image: { url: thumbnail },
          caption: cleanCard
        });
      } else {
        await sock.sendMessage(channelJid, { text: cleanCard });
      }

      // 6. Voice Note එක (PTT) Channel එකට යැවීම
      const audioRes = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60000 });
      const audioBuffer = Buffer.from(audioRes.data);

      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype: "audio/mp4",
        ptt: true
      });

      sock.sendMessage(from, { react: { text: "✔️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `✅ *Channel එකට සාර්ථකව Upload කරන ලදී!*\n\n🎵 *${title}*` },
        { quoted: msg }
      );

    } catch (error) {
      console.error("CSong Error:", error);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `⚠️ Error එකක් ආවා: ${error?.response?.data?.message || error.message || error}` },
        { quoted: msg }
      );
    }
  }
};
