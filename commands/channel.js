import { delay } from "@whiskeysockets/baileys";

// Static Pre-allocated Emoji Lookup Pool (O(1) Memory Layout)
const CHANNEL_EMOJI_POOL = Object.freeze([
  "💖", "✨", "🌸", "🎀", "🍭", "🐾", "🍓", "🧁", "🌟", "🫧"
]);
const EMOJI_MASK = CHANNEL_EMOJI_POOL.length;
const DEFAULT_CHANNEL_JID = "120363421906774107@newsletter";

global.channelAutoReactActive = global.channelAutoReactActive || false;
global.channelListenerInitialized = global.channelListenerInitialized || false;

// Low-latency Newsletter Reaction Dispatcher
async function sendChannelReaction(sock, newsletterJid, msgKey, emoji) {
  try {
    const serverId = msgKey?.server_id || msgKey?.id;
    if (!serverId) return;

    // 1. Official Newsletter Method
    if (typeof sock.newsletterReactMessage === "function") {
      return await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
    }

    // 2. Direct Low-level Binary Query
    if (typeof sock.query === "function") {
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

    // 3. High-level Message Fallback
    await sock.sendMessage(newsletterJid, {
      react: { text: emoji, key: msgKey }
    });
  } catch (_) {}
}

export default {
  name: "channel",
  aliases: ["ch", "newsletter"],
  category: "owner",
  description: "Cute official channel auto-reaction & follower suite",

  async execute({ sock, msg, from, args, prefix, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const subCmd = args[0]?.toLowerCase().trim();
    const activeSockets = global.activeSockets;

    if (!activeSockets || activeSockets.size === 0) {
      sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🌸 *Oopsie!* No active bot cloud instances are connected right now, honey~" },
        { quoted: msg }
      );
    }

    // Setup high-speed non-blocking background listener once
    if (!global.channelListenerInitialized) {
      global.channelListenerInitialized = true;
      sock.ev.on("messages.upsert", ({ messages, type }) => {
        if (type !== "notify" || !global.channelAutoReactActive) return;

        const m = messages[0];
        if (m?.key?.remoteJid !== DEFAULT_CHANNEL_JID) return;

        // Concurrent Async Dispatch Across All Cluster Sockets
        setImmediate(() => {
          const sockets = Array.from(global.activeSockets.values());
          Promise.allSettled(
            sockets.map(async (s) => {
              const jitter = ((Math.random() * 800) | 0) + 200;
              await delay(jitter);
              const randIdx = ((Math.random() * EMOJI_MASK) | 0) % EMOJI_MASK;
              const emoji = CHANNEL_EMOJI_POOL[randIdx];
              return sendChannelReaction(s, DEFAULT_CHANNEL_JID, m.key, emoji);
            })
          ).catch(() => {});
        });
      });
    }

    // 1. Toggle Channel Auto-React (.channel react)
    if (subCmd === "react") {
      global.channelAutoReactActive = !global.channelAutoReactActive;
      const isActive = global.channelAutoReactActive;

      sock.sendMessage(from, { react: { text: isActive ? "💖" : "💤", key: msg.key } }).catch(() => {});

      const statusCard = 
`🎀 ｡ﾟ•┈୨ *CHANNEL AUTO-REACT* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  📢 *Target Channel:* Official Newsletter
  ⚡ *Status:* *${isActive ? "Active & Sparkly ✨" : "Resting Softly 💤"}*
  🤖 *Connected Bots:* \`${activeSockets.size} Sockets\`

━━━━━━━━━━━━━━━━━━━━━━
_${isActive ? "Every new post will instantly get sweet emoji reactions from all online nodes! (˶˃ ᵕ ˂˶)" : "Channel post reactions are now paused."}_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: statusCard }, { quoted: msg });
    }

    // 2. Parallel Channel Auto-Follow (.channel follow)
    if (subCmd === "follow" || subCmd === "join") {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      
      const sockets = Array.from(activeSockets.values());
      const total = sockets.length;

      // Parallel Non-Blocking Follow Wave
      const results = await Promise.allSettled(
        sockets.map(async (s) => {
          if (typeof s.newsletterFollow === "function") {
            return s.newsletterFollow(DEFAULT_CHANNEL_JID);
          }
        })
      );

      const followedCount = results.filter((r) => r.status === "fulfilled").length;

      sock.sendMessage(from, { react: { text: "🌸", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `✨ *Channel Followed!* Successfully synced *${followedCount}/${total}* bot instances to the official channel, darling! 🎀`
        },
        { quoted: msg }
      );
    }

    // Help & Control Panel
    sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL MANAGER* ୧┈•ﾟ｡ 🐾

  🍭 *Control Commands:*
  • *${pref}channel react*  — Toggle cluster auto-reactions ✨
  • *${pref}channel follow* — Follow newsletter across all nodes 💌

  ⚙️ *Auto-React:* ${global.channelAutoReactActive ? "🟢 ACTIVE" : "🔴 DISABLED"}
  🤖 *Cluster Nodes:* \`${activeSockets.size} Active\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
