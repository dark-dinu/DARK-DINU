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
  aliases: ["bot", "status"],
  category: "general",
  description: "Display bot alive status card with custom settings and web link",

  async execute({ sock, msg, from, config }) {
    try {
      sock.sendMessage(from, { react: { text: "🐦‍🔥", key: msg.key } }).catch(() => {});

      const rawUser = sock.user?.id || "";
      const botNum = rawUser.split(":")[0]?.replace(/[^0-9]/g, "");

      const database = await getDB();
      const custom = await database.collection("bot_custom_settings").findOne({ botNumber: botNum });

      const botName = custom?.botName || config?.BOT_NAME || "DARK-DINU MD";
      const botLogo = custom?.botLogo || config?.BOT_LOGO || "https://files.catbox.moe/o8k8v7.jpg";
      
      // වෙනම alive text එකක් නැත්නම් වැටෙන Default Alive Message එක
      const aliveMsg = custom?.aliveMessage || 
`Hey! I'm online and running at full speed.
Ready to serve your commands with zero-lag cloud automation.`;

      const fixedFooterLink = "https://heshan.devofc.top/";

      const aliveCard = 
`╔══════════════════════╗
   🕷️ ${botName.toUpperCase()} 🕷️
╚══════════════════════╝

┌─〔 🟢 *STATUS: OPERATIONAL* 〕
├─▸ 📱 *Instance* : +${botNum}
├─▸ 🛰️ *Engine*   : Multi-Device Node v3.0
├─▸ 💬 *Status*   :
│   _${aliveMsg}_
└───────────────────────

> 🔗 ${fixedFooterLink}`;

      if (botLogo.startsWith("http")) {
        await sock.sendMessage(
          from,
          {
            image: { url: botLogo },
            caption: aliveCard
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(from, { text: aliveCard }, { quoted: msg });
      }
    } catch (err) {
      console.error("[ALIVE ERROR]:", err.message);
      await sock.sendMessage(from, { text: "❌ Failed to fetch alive status." }, { quoted: msg }).catch(() => {});
    }
  }
};
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
  aliases: ["bot", "status"],
  category: "general",
  description: "Display bot alive status card with custom settings and web link",

  async execute({ sock, msg, from, config }) {
    try {
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const rawUser = sock.user?.id || "";
      const botNum = rawUser.split(":")[0]?.replace(/[^0-9]/g, "");

      const database = await getDB();
      const custom = await database.collection("bot_custom_settings").findOne({ botNumber: botNum });

      const botName = custom?.botName || config?.BOT_NAME || "DARK-DINU MD";
      const botLogo = custom?.botLogo || config?.BOT_LOGO || "https://files.catbox.moe/o8k8v7.jpg";
      
      // වෙනම alive text එකක් නැත්නම් වැටෙන Default Alive Message එක
      const aliveMsg = custom?.aliveMessage || 
`Hey! I'm online and running at full speed.
Ready to serve your commands with zero-lag cloud automation.`;

      const fixedFooterLink = "https://heshan.devofc.top/";

      const aliveCard = 
`╔══════════════════════╗
   🕷️ ${botName.toUpperCase()} 🕷️
╚══════════════════════╝

┌─〔 🟢 *STATUS: OPERATIONAL* 〕
├─▸ 📱 *Instance* : +${botNum}
├─▸ 🛰️ *Engine*   : Multi-Device Node v3.0
├─▸ 💬 *Status*   :
│   _${aliveMsg}_
└───────────────────────

> 🔗 ${fixedFooterLink}`;

      if (botLogo.startsWith("http")) {
        await sock.sendMessage(
          from,
          {
            image: { url: botLogo },
            caption: aliveCard
          },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(from, { text: aliveCard }, { quoted: msg });
      }
    } catch (err) {
      console.error("[ALIVE ERROR]:", err.message);
      await sock.sendMessage(from, { text: "❌ Failed to fetch alive status." }, { quoted: msg }).catch(() => {});
    }
  }
};
