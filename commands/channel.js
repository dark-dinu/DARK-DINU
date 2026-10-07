import { delay } from "@whiskeysockets/baileys";

// Global Auto-React Listener Controller
global.channelAutoReactActive = global.channelAutoReactActive || false;
global.channelListenerInitialized = global.channelListenerInitialized || false;

export default {
  name: "channel",
  aliases: ["ch", "newsletter"],
  category: "owner",
  description: "Official channel auto follow and continuous auto-react watcher",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const CHANNEL_JID = "120363421906774107@newsletter";
    const EMOJIS = ["🐦‍🔥", "🕷️", "⚡", "🌚", "🌟", "🖤", "🚀", "👑"];
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    const subCmd = args[0]?.toLowerCase();
    const activeSockets = global.activeSockets;

    if (!activeSockets || activeSockets.size === 0) {
      return await reply("❌ Cloud එකේ කිසිදු active bot instance එකක් හමු නොවීය.");
    }

    // Background Listener Setup (Channel එකට වැටෙන අලුත් post අල්ලන්න)
    if (!global.channelListenerInitialized) {
      for (const [, activeSock] of activeSockets.entries()) {
        activeSock.ev.on("messages.upsert", async ({ messages, type }) => {
          if (type !== "notify" || !global.channelAutoReactActive) return;

          const m = messages[0];
          if (!m?.message || m.key.remoteJid !== CHANNEL_JID) return;

          // චැනල් එකට අලුත් Post එකක් ආ විට සියලුම බොට්ලාගෙන් React යැවීම
          for (const [id, s] of global.activeSockets.entries()) {
            try {
              const randomDelay = Math.floor(Math.random() * 2000) + 800;
              await delay(randomDelay);

              const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
              await s.sendMessage(CHANNEL_JID, {
                react: {
                  text: randomEmoji,
                  key: m.key
                }
              });
              console.log(`[✓] Auto-reacted: Bot [${id}] -> ${randomEmoji}`);
            } catch (err) {
              console.error(`[Auto-React Error - ${id}]:`, err.message);
            }
          }
        });
        break; // එක Listener එකක් ප්‍රමාණවත්ය
      }
      global.channelListenerInitialized = true;
    }

    // 1. AUTO-REACT TOGGLE (.channel react)
    if (subCmd === "react") {
      global.channelAutoReactActive = !global.channelAutoReactActive;

      sock.sendMessage(from, { 
        react: { text: global.channelAutoReactActive ? "🔥" : "⏸️", key: msg.key } 
      }).catch(() => {});

      if (global.channelAutoReactActive) {
        return await reply(
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

✅ *CHANNEL AUTO-REACT: ACTIVATED!* ⚡

> දැන් චැනල් එකට දාන *හැම අලුත් Post එකකටම* Active බොට්ලා (${activeSockets.size}) මගින් ස්වයංක්‍රීයව Emojis වලින් React වෙනවා!

🛑 *නැවැත්වීමට:* \`${pref}channel react\` නැවත ගසන්න.`
        );
      } else {
        return await reply("⏸️ *CHANNEL AUTO-REACT: DEACTIVATED!* (දැන් පෝස්ට් වලට auto-react වැටෙන්නේ නැත)");
      }
    }

    // 2. AUTO-FOLLOW ACTION (.channel follow)
    if (subCmd === "follow" || subCmd === "join") {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      await reply(`📢 Active බොට්ලා *${activeSockets.size}* මගින් චැනල් එක follow කිරීම ආරම්භ කළා...`);

      let followedCount = 0;
      for (const [id, activeSock] of activeSockets.entries()) {
        try {
          if (typeof activeSock.newsletterFollow === "function") {
            await delay(1000);
            await activeSock.newsletterFollow(CHANNEL_JID);
            followedCount++;
          }
        } catch (err) {
          console.error(`[Follow Failed - ${id}]:`, err.message);
        }
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await reply(`✅ බොට්ලා *${followedCount}/${activeSockets.size}* දෙනෙක් සාර්ථකව චැනල් එක follow කළා!`);
    }

    // DEFAULT MENU
    return await reply(
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📢 *CHANNEL AUTOMATION* 〕
├─▸ ⚡ *Auto-React (On/Off):*
│   \`${pref}channel react\`
│   _(චැනල් එකට දාන හැම පෝස්ට් එකකටම Active botsලාගෙන් react වැටේ)_
│
├─▸ 🔗 *Auto-Follow Channel:*
│   \`${pref}channel follow\`
│   _(සියලුම බොට්ලාගෙන් චැනල් එක Follow වේ)_
└───────────────────────

> Status: *Auto-React is ${global.channelAutoReactActive ? "ON 🟢" : "OFF 🔴"}*`
    );
  }
};
