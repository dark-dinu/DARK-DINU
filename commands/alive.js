export default {
  name: "alive",
  aliases: ["bot", "live", "status"],
  category: "general",
  description: "Play cute intro audio voice note followed by permanent alive card",

  async execute({ sock, msg, from }) {
    // 🍓 Cute Reaction
    sock.sendMessage(from, { react: { text: "🍓", key: msg.key } }).catch(() => {});

    try {
      // 1. Send Intro Voice Note (PTT) Instantly
      const introAudioUrl = "https://files.catbox.moe/37unrg.ogg";
      await sock.sendMessage(
        from,
        {
          audio: { url: introAudioUrl },
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        },
        { quoted: msg }
      ).catch(() => {});

      // Fixed Bot Info (No DB Overrides)
      const botName = "DARK-DINU";
      const botLogo = "https://telegra.ph/file/2a2a075031b23aa24b744.jpg";
      const aliveMsg = "Ready for your sweet commands~ ✨";
      const fixedFooterLink = "https://heshan.devofc.top/";

      // Compact Runtime Calculation (e.g. 1h 24m 12s)
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      const runtimeParts = [];
      if (hours > 0) runtimeParts.push(`${hours}h`);
      if (minutes > 0 || hours > 0) runtimeParts.push(`${minutes}m`);
      runtimeParts.push(`${seconds}s`);
      const runtimeStr = runtimeParts.join(" ");

      // Kitty Kawaii Compact Permanent Layout
      const cuteAliveCard = 
`🍓⃝⃘̉̉̉̉̉̉🐾 *Purring Online, Sweetie~* 🎀 🐾🍓⃝⃘̉̉̉̉̉̉
┊ ˚୨୧⋆｡˚ 🍰

> 🌷 *ᴍᴏᴏᴅ :* 100% Sugar & Hugs (ฅ^•ﻌ•^ฅ)
> ⏳ *ᴜᴘᴛɪᴍᴇ :* ${runtimeStr}
> 💬 *ᴍꜱɢ :* _${aliveMsg}_

🍰 *© ${botName} 𝐎ꜰᴄ* 🤍 | 📍 ${fixedFooterLink}`;

      // 2. Send Alive Card (Image with fallback to text)
      try {
        await sock.sendMessage(
          from,
          {
            image: { url: botLogo },
            caption: cuteAliveCard
          },
          { quoted: msg }
        );
      } catch (_) {
        await sock.sendMessage(from, { text: cuteAliveCard }, { quoted: msg });
      }

    } catch (err) {
      console.error("[ALIVE ERROR]:", err);
      await sock.sendMessage(
        from,
        {
          text: `🍓 *DARK-DINU MD IS ONLINE* ✨\n\n> ⏳ *Uptime :* Online & Cozy\n📍 https://heshan.devofc.top/`
        },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
