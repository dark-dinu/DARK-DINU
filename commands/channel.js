import fs from "fs";
import path from "path";
import { delay } from "@whiskeysockets/baileys";

// ඔයාගේ ස්ථිර Channels 5
const PERMANENT_CHANNELS = [
  "https://whatsapp.com/channel/0029VbBtXBMICVfnpV20wI27/755",
  "https://whatsapp.com/channel/0029VbBTkLI9Gv7bXpWEmg3D/2617",
  "https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T/723",
  "https://whatsapp.com/channel/0029VbDQtWMLI8YVtVBnFt1A/154",
  "https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/412"
];

// Reaction Emojis
const CHANNEL_EMOJI_POOL = Object.freeze([
  "💖", "🔥", "🌸", "✨", "⚡", "❤️", "👍", "🐾"
]);

// Global Cache Stores
global.activeChannelReacts = global.activeChannelReacts || new Set();
global.hookedAutoReactSockets = global.hookedAutoReactSockets || new WeakSet();

// Fast Invite Code Extractor
function extractInviteCode(input = "") {
  const match = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z]+)/i);
  return match ? match[1] : input.trim();
}

// Extract Channel JID
async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const cleanInput = input.trim();
  if (cleanInput.endsWith("@newsletter")) return cleanInput;

  const code = extractInviteCode(cleanInput);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) {
        return meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
      }
    }
  } catch (e) {
    console.error(`[AUTO-REACT] Metadata resolve error (${code}):`, e.message);
  }
  return null;
}

// 🛑 Reliable Channel Reaction Dispatcher
async function sendChannelReaction(sock, newsletterJid, serverId, emoji) {
  if (!serverId || !newsletterJid) return;

  const cleanServerId = String(serverId).replace(/[^0-9]/g, "");
  if (!cleanServerId) return;

  try {
    // 1. First choice: Baileys built-in helper
    if (typeof sock.newsletterReactMessage === "function") {
      return await sock.newsletterReactMessage(newsletterJid, cleanServerId, emoji);
    }

    // 2. Direct Query (Ultra stable across Baileys versions)
    if (typeof sock.query === "function") {
      return await sock.query({
        tag: "message",
        attrs: {
          to: newsletterJid,
          type: "reaction",
          server_id: cleanServerId,
          id: sock.generateMessageTag ? sock.generateMessageTag() : `${Date.now()}`
        },
        content: [
          {
            tag: "reaction",
            attrs: { code: emoji }
          }
        ]
      });
    }
  } catch (err) {
    console.error(`[AUTO-REACT SEND ERR] JID: ${newsletterJid} \vert{} ID:${cleanServerId}:`, err.message);
  }
}

// 🛑 Multi-Cluster Background Hook
export function attachAutoReactListener(sock) {
  if (!sock || global.hookedAutoReactSockets.has(sock)) return;
  global.hookedAutoReactSockets.add(sock);

  console.log("[AUTO-REACT ENGINE] Attaching listener to socket instance...");

  // Channel 5 resolve කරලා auto-follow කරගැනීම (Must-do for receiving upserts)
  (async () => {
    for (const link of PERMANENT_CHANNELS) {
      try {
        const jid = await resolveChannelJid(sock, link);
        if (jid) {
          global.activeChannelReacts.add(jid);
          // Follow the channel automatically if not followed
          if (typeof sock.newsletterFollow === "function") {
            await sock.newsletterFollow(jid).catch(() => {});
          }
          console.log(`[AUTO-REACT] Active & Followed: ${jid}`);
        }
      } catch (_) {}
    }
  })();

  // Catch channel posts in real-time
  sock.ev.on("messages.upsert", async (upsert) => {
    const { messages } = upsert;
    if (!messages || messages.length === 0) return;

    for (const m of messages) {
      const remoteJid = m.key?.remoteJid || "";

      // Channel messages only
      if (!remoteJid.endsWith("@newsletter")) continue;
      if (!global.activeChannelReacts.has(remoteJid)) continue;

      // Extract Newsletter Server ID from various Baileys structures
      const serverId =
        m.newsletterServerId ||
        m.key?.server_id ||
        m.message?.messageContextInfo?.deviceListMetadata?.senderKeyHash ||
        (m.key?.id && /^\d+$/.test(m.key.id) ? m.key.id : null);

      if (!serverId) {
        console.log(`[AUTO-REACT] Skipped: No numeric serverId found for post in ${remoteJid}`);
        continue;
      }

      console.log(`[AUTO-REACT] New post in ${remoteJid} (ServerID:${serverId})! Triggering bots...`);

      const activeSockets = global.activeSockets || new Map();
      const botPool = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

      botPool.forEach((currentBot, index) => {
        const emoji = CHANNEL_EMOJI_POOL[Math.floor(Math.random() * CHANNEL_EMOJI_POOL.length)];

        setTimeout(async () => {
          await sendChannelReaction(currentBot, remoteJid, serverId, emoji);
        }, index * 250);
      });
    }
  });
}

export default {
  name: "channel",
  aliases: ["cfollow", "ch", "newsletter"],
  category: "owner",
  description: "Channel auto-reaction & follower engine",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";

    // Command එක ගැහුව ගමන් සියලු active sockets වලට attach කරනවා
    attachAutoReactListener(sock);
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        attachAutoReactListener(s);
      }
    }

    // Force follow channels manually via command
    if (args[0]?.toLowerCase() === "fix" || args[0]?.toLowerCase() === "follow") {
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      let count = 0;
      for (const link of PERMANENT_CHANNELS) {
        const jid = await resolveChannelJid(sock, link);
        if (jid) {
          global.activeChannelReacts.add(jid);
          if (typeof sock.newsletterFollow === "function") {
            await sock.newsletterFollow(jid).catch(() => {});
          }
          count++;
        }
      }
      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *Auto-React Engine Activated & Synchronized!*\n📢 Monitored & Followed Channels: *${count}/5*` },
        { quoted: msg }
      );
    }

    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *AUTO REACT STATUS* ୧┈•ﾟ｡ 🐾

📢 *Registered Channels:* ${global.activeChannelReacts.size}
🤖 *Active Sockets:* ${global.activeSockets ? global.activeSockets.size : 1}

💡 *Note:* ඔයාගේ බොට් නම්බර් වලින් අනිවාර්යයෙන්ම ඒ චැනල් 5 follow කරලා තියෙන්න ඕනේ. Follow කරන්න:
\`${pref}channel fix\``
      },
      { quoted: msg }
    );
  }
};
