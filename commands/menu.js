import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import CONFIG from "../config.js";

// Active Sessions Store
global.menuTracker = global.menuTracker || new Map();

// MongoDB Singleton Connection
let mongoClient = null;
let db = null;

async function getDB() {
  if (db) return db;
  mongoClient = new MongoClient(CONFIG.MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db(CONFIG.DB_NAME);
  return db;
}

// Banner Image Resolver (MongoDB Custom Logo -> Local File -> Default URL)
async function getMenuBanner(botNumber) {
  try {
    const database = await getDB();
    const custom = await database.collection("bot_custom_settings").findOne({ botNumber });
    if (custom?.botLogo && custom.botLogo.startsWith("http")) {
      return { url: custom.botLogo };
    }
  } catch (_) {}

  try {
    const rootPath = path.join(process.cwd(), "logo.jpg");
    if (fs.existsSync(rootPath)) return fs.readFileSync(rootPath);

    const assetPath = path.join(process.cwd(), "assets", "logo.jpg");
    if (fs.existsSync(assetPath)) return fs.readFileSync(assetPath);
  } catch (_) {}

  return { url: CONFIG.BOT_LOGO || "https://files.catbox.moe/k315x4.jpg" };
}

export default {
  name: "menu",
  aliases: ["help", "list", "panel", "m"],
  category: "general",
  description: "Cyber Card Themed Interactive Category Menu",

  async execute({ sock, msg, from, config, activeBotsCount, commands }) {
    try {
      sock.sendMessage(from, { react: { text: "📜", key: msg.key } }).catch(() => {});

      const rawUser = sock.user?.id || "";
      const botNum = rawUser.split(":")[0]?.replace(/[^0-9]/g, "");

      // Retrieve Custom Bot Name
      let botDisplayName = config?.BOT_NAME || "DARK-DINU MD";
      try {
        const database = await getDB();
        const custom = await database.collection("bot_custom_settings").findOne({ botNumber: botNum });
        if (custom?.botName) botDisplayName = custom.botName;
      } catch (_) {}

      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const pref = config?.PREFIX || ".";
      const ownerName = "DINIDU HESHAN";
      const fixedLink = "https://heshan.devofc.top/";
      const totalCmds = commands?.size || 0;

      // Ultra-White Bold Highlighted Main Menu UI
      const mainText = 
`┏━━━━━━━━━━━━━━━━━━━━━━┓
┃  🕷️ *${botDisplayName.toUpperCase()}* 🕷️
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌──『 *SYSTEM STATUS* 』
├─▸ 👤 *Dev*     : *${ownerName}*
├─▸ ⚡ *Prefix*  : *[ ${pref} ]*
├─▸ 🌐 *Nodes*   : *${activeBotsCount || 1} Online*
├─▸ ⏳ *Uptime*  : *${hours}h ${mins}m ${secs}s*
├─▸ 📦 *Modules* : *${totalCmds} Loaded*
└───────────────────────

┌──『 *COMMAND PANELS* 』
├─▸ *[ 𝟏 ]* ❯ *ɢᴇɴᴇʀᴀʟ & ɪɴғᴏ*
├─▸ *[ 𝟐 ]* ❯ *ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ*
├─▸ *[ 𝟑 ]* ❯ *sᴛᴇᴀʟᴛʜ & ᴜᴛɪʟɪᴛʏ*
├─▸ *[ 𝟒 ]* ❯ *sʏsᴛᴇᴍ & ᴏᴡɴᴇʀ*
├─▸ *[ 𝟓 ]* ❯ *ғᴜʟʟ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ*
└───────────────────────

> 💬 *Reply with number (1-5) to access*

📍 *${fixedLink}*`;

      const bannerData = await getMenuBanner(botNum);

      const sentMsg = await sock.sendMessage(from, {
        image: bannerData,
        caption: mainText
      }, { quoted: msg });

      // Session Tracking (5 Minutes Validity)
      const menuId = sentMsg?.key?.id;
      if (menuId) {
        global.menuTracker.set(menuId, {
          chat: from,
          pref: pref,
          botName: botDisplayName,
          banner: bannerData,
          fixedLink: fixedLink,
          time: Date.now()
        });

        setTimeout(() => {
          if (global.menuTracker) global.menuTracker.delete(menuId);
        }, 5 * 60 * 1000);
      }

      // Socket-specific One-time Listener Hook
      if (!sock.isMenuHooked) {
        sock.isMenuHooked = true;

        sock.ev.on("messages.upsert", async (mUpdate) => {
          try {
            if (!mUpdate.messages || mUpdate.type !== "notify") return;

            for (const inMsg of mUpdate.messages) {
              if (!inMsg.message) continue;

              const targetQuotedId = inMsg.message?.extendedTextMessage?.contextInfo?.stanzaId;
              if (!targetQuotedId || !global.menuTracker.has(targetQuotedId)) continue;

              const currentChat = inMsg.key.remoteJid;
              const sessionData = global.menuTracker.get(targetQuotedId);

              if (sessionData.chat !== currentChat) continue;

              const replyChoice = (
                inMsg.message?.conversation ||
                inMsg.message?.extendedTextMessage?.text ||
                ""
              ).trim();

              const p = sessionData.pref;
              const bName = sessionData.botName;
              const link = sessionData.fixedLink;
              let subText = "";
              let reactIcon = "";

              if (replyChoice === "1") {
                reactIcon = "⚡";
                subText = 
`┏━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚡ *ɢᴇɴᴇʀᴀʟ & ɪɴғᴏ* ⚡
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌──『 *MODULE LIST* 』
├─▸ 📌 *${p}ping*    : *Check bot latency & response*
├─▸ 📌 *${p}menu*    : *Display system dashboard*
├─▸ 📌 *${p}alive*   : *Server & connection health*
├─▸ 📌 *${p}status*  : *Cluster nodes & uptime metrics*
└───────────────────────

> *${bName} ✨*
📍 *${link}*`;
              } else if (replyChoice === "2") {
                reactIcon = "📥";
                subText = 
`┏━━━━━━━━━━━━━━━━━━━━━━┓
┃  📥 *ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ* 📥
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌──『 *MODULE LIST* 』
├─▸ 📌 *${p}song*    : *YouTube MP3 / Document / Voice*
├─▸ 📌 *${p}video*   : *YouTube Multi-Quality MP4*
├─▸ 📌 *${p}fb*      : *Facebook HD / SD / MP3*
├─▸ 📌 *${p}tiktok*  : *TikTok HD / SD / Audio*
├─▸ 📌 *${p}insta*   : *Instagram Reels & Photos*
├─▸ 📌 *${p}vv*      : *Unlock ViewOnce media*
└───────────────────────

> *${bName} ✨*
📍 *${link}*`;
              } else if (replyChoice === "3") {
                reactIcon = "👁️";
                subText = 
`┏━━━━━━━━━━━━━━━━━━━━━━┓
┃  👁️ *sᴛᴇᴀʟᴛʜ & ᴜᴛɪʟɪᴛʏ* 👁️
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌──『 *MODULE LIST* 』
├─▸ 📌 *${p}vv*      : *Decrypt ViewOnce photos & videos*
├─▸ 📌 *${p}jid*     : *Retrieve user & chat JID*
├─▸ 📌 *${p}url*     : *Convert media into cloud link*
├─▸ 📌 *${p}tourl*   : *Upload media to direct URL*
├─▸ 📌 *${p}dreact*  : *Developer auto-reaction toggle*
└───────────────────────

> *${bName} ✨*
📍 *${link}*`;
              } else if (replyChoice === "4") {
                reactIcon = "💻";
                subText = 
`┏━━━━━━━━━━━━━━━━━━━━━━┓
┃  💻 *sʏsᴛᴇᴍ & ᴏᴡɴᴇʀ* 💻
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌──『 *MODULE LIST* 』
├─▸ 📌 *${p}set*     : *Configure custom bot name/logo/alive*
├─▸ 📌 *${p}system*  : *Host RAM, CPU & instance health*
├─▸ 📌 *${p}bots*    : *Connected active bot nodes count*
├─▸ 📌 *${p}channel* : *Channel auto follow & multi-react*
├─▸ 📌 *${p}restart* : *Reboot current session container*
└───────────────────────

> *${bName} ✨*
📍 *${link}*`;
              } else if (replyChoice === "5") {
                reactIcon = "📜";
                subText = 
`┏━━━━━━━━━━━━━━━━━━━━━━┓
┃  📜 *ғᴜʟʟ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ* 📜
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌──『 *INDEX LIST* 』
├─▸ *${p}ping • ${p}menu • ${p}alive • ${p}status*
├─▸ *${p}song • ${p}video • ${p}fb • ${p}tiktok • ${p}insta*
├─▸ *${p}vv • ${p}jid • ${p}url • ${p}tourl • ${p}dreact*
├─▸ *${p}set • ${p}system • ${p}bots • ${p}channel • ${p}restart*
└───────────────────────

> *${bName} ✨*
📍 *${link}*`;
              }

              if (subText) {
                sock.sendMessage(currentChat, { react: { text: reactIcon, key: inMsg.key } }).catch(() => {});
                await sock.sendMessage(currentChat, {
                  image: sessionData.banner,
                  caption: subText
                }, { quoted: inMsg });
              }
            }
          } catch (listenerError) {
            console.error("[MENU LISTENER ERROR]:", listenerError.message);
          }
        });
      }
    } catch (err) {
      console.error("[MENU EXECUTION ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ Menu Error: ${err.message}` }, { quoted: msg });
    }
  }
};
