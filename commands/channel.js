import { delay } from "@whiskeysockets/baileys";

global.channelAutoReactActive = global.channelAutoReactActive || false;
global.channelListenerInitialized = global.channelListenerInitialized || false;

// Helper: Newsletter එකට React යැවීමේ නිවැරදි Protocol Function එක
async function sendChannelReaction(sock, newsletterJid, msgKey, emoji) {
  try {
    // 1. Baileys official newsletterReactMessage method එක තිබේ නම්
    if (typeof sock.newsletterReactMessage === "function") {
      const serverId = msgKey?.server_id || msgKey?.id;
      return await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
    }

    // 2. Direct Query Fallback (Newsletter Relay)
    if (typeof sock.query === "function") {
      const serverId = msgKey?.server_id || msgKey?.id;
      return await sock.query({
        tag: "message",
        attrs: {
          to: newsletterJid,
          type: "reaction",
          server_id: String(serverId)
        },
        content: [{
          tag: "reaction",
          attrs: { code: emoji }
        }]
      });
    }

    // 3. Fallback Standard Relay
    await sock.sendMessage(newsletterJid, {
      react: {
        text: emoji,
        key: msgKey
      }
    });
  } catch (err) {
    throw err;
  }
}

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

    // Background Listener Setup (Channel Updates අල්ලන කොටස)
    if (!global.channelListenerInitialized) {
      for (const [, activeSock] of activeSockets.entries()) {
        activeSock.ev.on("messages.upsert", async ({ messages, type }) => {
          if (!global.channelAutoReactActive) return;

          for (const m of messages) {
            const chatJid = m.key?.remoteJid;
            if (chatJid !== CHANNEL_JID) continue;

            console.log(`[+] New Post Detected on Channel: ${m.key?.id}`);

            // Active වෙලා ඉන්න හැම බොටාගෙන්ම Reaction එක Dispatch කිරීම
            for (const [id, s] of global.activeSockets.entries()) {
              try {
                const randomDelay = Math.floor(Math.random() * 2000) + 1000;
                await delay(randomDelay);

                const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
                
                await sendChannelReaction(s, CHANNEL_JID, m.key, randomEmoji);
                console.log(`[✓] Bot [${id}] reacted with ${randomEmoji} to channel post.`);
              } catch (err) {
                console.error(`[Auto-React Error - ${id}]:`, err.message);
              }
            }
          }
        });
        break;
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
