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
  name: "set",
  aliases: ["setbot", "configbot"],
  category: "owner",
  description: "Unified instance configuration (name, logo, alive)",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    try {
      const rawUser = sock.user?.id || "";
      const botNumber = rawUser.split(":")[0]?.replace(/[^0-9]/g, "");

      if (!botNumber) {
        return await reply("❌ Bot instance number එක හඳුනාගත නොහැක.");
      }

      const database = await getDB();
      const settingsCol = database.collection("bot_custom_settings");

      const target = args[0]?.toLowerCase(); // 'bot'
      const action = args[1]?.toLowerCase(); // 'name' | 'logo' | 'alive'
      const value = args.slice(2).join(" ").trim();

      // 1. SET BOT NAME (.set bot name <text>)
      if (target === "bot" && action === "name") {
        if (!value) {
          return await reply(`⚠️ *නව නමක් ලබාදෙන්න!*\n\n*උදා:* \`${pref}set bot name DARK-DINU V2\``);
        }

        sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        await settingsCol.updateOne(
          { botNumber },
          { $set: { botName: value, updatedAt: new Date() } },
          { upsert: true }
        );

        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await reply(
`╔══════════════════════╗
   ⚡ 𝐁𝐎𝐓 𝐍𝐀𝐌𝐄 𝐔𝐏𝐃𝐀𝐓𝐄𝐃 ⚡
╚══════════════════════╝

👤 *Bot Number :* +${botNumber}
🏷️ *New Name   :* ${value}

> ✅ MongoDB හි සාර්ථකව Save විය. Restart වුවද වෙනස් නොවේ!`
        );
      }

      // 2. SET BOT LOGO (.set bot logo <url> හෝ Image Reply)
      if (target === "bot" && action === "logo") {
        let logoUrl = value;

        if (!logoUrl) {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const isQuotedImage = quoted?.imageMessage;

          if (!isQuotedImage) {
            return await reply(
              `⚠️ *Image එකක direct link එකක් දෙන්න හෝ photo එකකට reply කර command එක ගසන්න!*\n\n*උදා:* \`${pref}set bot logo https://i.ibb.co/xxxxxx.jpg\``
            );
          }
          return await reply("⚠️ Direct image URL එකක් ලබාදෙන්න (උදා: ibb.co හෝ Catbox direct link එකක්).");
        }

        if (!logoUrl.startsWith("http")) {
          return await reply("❌ කරුණාකර නිවැරදි Direct Image URL එකක් (https://...) ලබාදෙන්න.");
        }

        sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        await settingsCol.updateOne(
          { botNumber },
          { $set: { botLogo: logoUrl, updatedAt: new Date() } },
          { upsert: true }
        );

        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await reply(
`╔══════════════════════╗
   🖼️ 𝐁𝐎𝐓 𝐋𝐎𝐆𝐎 𝐔𝐏𝐃𝐀𝐓𝐄𝐃 🖼️
╚══════════════════════╝

👤 *Bot Number :* +${botNumber}
🔗 *Logo URL   :* ${logoUrl}

> ✅ MongoDB හි සාර්ථකව Save විය. Restart වුවද වෙනස් නොවේ!`
        );
      }

      // 3. SET BOT ALIVE (.set bot alive <text>)
      if (target === "bot" && action === "alive") {
        if (!value) {
          return await reply(`⚠️ *Alive text එකක් ලබාදෙන්න!*\n\n*උදා:* \`${pref}set bot alive Dark-Dinu MD online and kicking!\``);
        }

        sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        await settingsCol.updateOne(
          { botNumber },
          { $set: { aliveMessage: value, updatedAt: new Date() } },
          { upsert: true }
        );

        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await reply(
`╔══════════════════════╗
   ⚡ 𝐀𝐋𝐈𝐕𝐄 𝐔𝐏𝐃𝐀𝐓𝐄𝐃 ⚡
╚══════════════════════╝

👤 *Bot Number :* +${botNumber}
📝 *Alive Text  :* ${value}

> ✅ MongoDB හි සාර්ථකව Save විය. Restart වුවද වෙනස් නොවේ!`
        );
      }

      // DEFAULT HELP & CURRENT SETTINGS VIEW
      const current = await settingsCol.findOne({ botNumber });
      const currentName = current?.botName || CONFIG.BOT_NAME || "DARK-DINU MD";
      const currentLogo = current?.botLogo || "Default Logo";
      const currentAlive = current?.aliveMessage || "Default Alive Message";

      return await reply(
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 ⚙️ *INSTANCE CONFIG* 〕
├─▸ 📱 *Number* : +${botNumber}
├─▸ 🏷️ *Name*   : ${currentName}
├─▸ 🖼️ *Logo*   : ${currentLogo}
├─▸ 💬 *Alive*  : ${currentAlive}
└───────────────────────

┌─〔 🛠️ *USAGE COMMANDS* 〕
├ ✏️ \`${pref}set bot name <usr name>\`
├ 🖼️ \`${pref}set bot logo <usr logo>\`
├ 💬 \`${pref}set bot alive <usr alive>\`
└───────────────────────

> 🔗 https://heshan.devofc.top/`
      );

    } catch (err) {
      console.error("[SET COMMAND ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply(`❌ Settings update කිරීම අසාර්ථක විය: ${err.message}`);
    }
  }
};
