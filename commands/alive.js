import { MongoClient } from "mongodb";
import CONFIG from "../config.js";

let mongoClient = null;
let db = null;

async function getDB() {
  if (db) return db;
  mongoClient = new MongoClient(CONFIG.MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db(CONFIG.DB_NAME);
  return db;
}

export default {
  name: "alive",
  aliases: ["bot", "live", "status"],
  category: "general",
  description: "Cute compact Kitty Kawaii alive card",

  async execute({ sock, msg, from, config }) {
    try {
      // Cute soft strawberry reaction
      sock.sendMessage(from, { react: { text: "🍓", key: msg.key } }).catch(() => {});

      const rawUser = sock.user?.id || "";
      const botNum = rawUser.split(":")[0]?.replace(/[^0-9]/g, "");

      const database = await getDB();
      const custom = await database.collection("bot_custom_settings").findOne({ botNumber: botNum });

      const botName = custom?.botName || config?.BOT_NAME || "DARK-DINU";
      const botLogo = custom?.botLogo || config?.BOT_LOGO || "https://files.catbox.moe/o8k8v7.jpg";

      // Custom message (User .set bot alive මඟින් දැමූ එකක් ඇත්නම් එය, නැතිනම් default sweet message එක)
      const aliveMsg = custom?.aliveMessage || "Ready for your sweet commands~ ✨";

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

      const fixedFooterLink = "https://heshan.devofc.top/";

      // Kitty Kawaii Compact Layout
      const cuteAliveCard = 
`🍓⃝⃘̉̉̉̉̉̉🐾 *Purring Online, Sweetie~* 🎀 🐾🍓⃝⃘̉̉̉̉̉̉
┊ ˚୨୧⋆｡˚ 🍰

> 🌷 *ᴍᴏᴏᴅ :* 100% Sugar & Hugs (ฅ^•ﻌ•^ฅ)
> ⏳ *ᴜᴘᴛɪᴍᴇ :* ${runtimeStr}
> 💬 *ᴍꜱɢ :* _${aliveMsg}_

🍰 *© ${botName.toUpperCase()} 𝐎ꜰᴄ* 🤍 | 💞 ${fixedFooterLink}`;

      if (botLogo && botLogo.startsWith("http")) {
        await sock.sendMessage(
          from,
          {
            image: { url: botLogo },
            caption: cuteAliveCard
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(from, { text: cuteAliveCard }, { quoted: msg });
      }
    } catch (err) {
      console.error("[ALIVE ERROR]:", err.message);
      await sock.sendMessage(from, { text: "❌ Failed to show alive status." }, { quoted: msg }).catch(() => {});
    }
  }
};
