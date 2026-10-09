import fs from "fs";
import path from "path";
import { delay } from "@whiskeysockets/baileys";
import { cleanPhone } from "../core/sessionManager.js";

// Static Pre-allocated Emoji Lookup Pool (O(1) Memory Layout)
const CHANNEL_EMOJI_POOL = Object.freeze([
  "💖", "✨", "🌸", "🎀", "🍭", "🐾", "🍓", "🧁", "🌟", "🫧"
]);
const EMOJI_MASK = CHANNEL_EMOJI_POOL.length;

// In-Memory Cluster Stores
global.activeChannelReacts = global.activeChannelReacts || new Set();
global.channelHookedSockets = global.channelHookedSockets || new WeakSet();
global.channelStoreInitialized = global.channelStoreInitialized || false;

const BACKUP_FILE = path.join(process.cwd(), "session_backups", "channel_reacts.json");

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

// 1. Dual-Storage Load (MongoDB -> Local Fallback)
async function initChannelStorage() {
  if (global.channelStoreInitialized) return;
  global.channelStoreInitialized = true;

  try {
    const db = getDbInstance();
    if (db) {
      const col = db.collection("channel_auto_reacts");
      const savedDocs = await col.find({}).toArray();
      for (const doc of savedDocs) {
        if (doc._id) global.activeChannelReacts.add(doc._id);
      }
    }
  } catch (err) {
    console.error("[CHANNEL DB LOAD ERR]:", err.message);
  }

  // Local JSON Backup Fallback
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const data = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((jid) => global.activeChannelReacts.add(jid));
      }
    }
  } catch (_) {}
}

// 2. Dual-Storage Sync (Write to DB & Local File)
async function syncChannelTarget(channelJid, isDelete = false) {
  try {
    const dir = path.dirname(BACKUP_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (isDelete) {
      global.activeChannelReacts.delete(channelJid);
    } else {
      global.activeChannelReacts.add(channelJid);
    }

    fs.writeFileSync(BACKUP_FILE, JSON.stringify(Array.from(global.activeChannelReacts), null, 2));

    const db = getDbInstance();
    if (db) {
      const col = db.collection("channel_auto_reacts");
      if (isDelete) {
        await col.deleteOne({ _id: channelJid });
      } else {
        await col.updateOne(
          { _id: channelJid },
          { $set: { jid: channelJid, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    }
  } catch (err) {
    console.error("[CHANNEL DB SYNC ERR]:", err.message);
  }
}

// Run storage init immediately
initChannelStorage();

// Fast Invite Code Extractor from URL
function extractInviteCode(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z]+)/i);
  return match ? match[1] : input.trim();
}

// Resolve Channel JID via Invite Code or Direct JID
async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const cleanInput = input.trim();
  if (cleanInput.endsWith("@newsletter")) return cleanInput;

  const code = extractInviteCode(cleanInput);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      return meta?.id || null;
    }
  } catch (_) {}
  return null;
}

// Low-latency Newsletter Reaction Dispatcher
async function sendChannelReaction(sock, newsletterJid, msgKey, emoji) {
  try {
    const serverId = msgKey?.server_id || msgKey?.id;
    if (!serverId) return;

    if (typeof sock.newsletterReactMessage === "function") {
      return await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
    }

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

    await sock.sendMessage(newsletterJid, {
      react: { text: emoji, key: msgKey }
    });
  } catch (_) {}
}

// Attach Background Multi-Cluster Listener
export function hookChannelListener(sock) {
  if (!sock || global.channelHookedSockets.has(sock)) return;
  global.channelHookedSockets.add(sock);

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify" || global.activeChannelReacts.size === 0) return;

    const m = messages[0];
    const remoteJid = m?.key?.remoteJid;
    if (!remoteJid || !global.activeChannelReacts.has(remoteJid)) return;

    setImmediate(() => {
      const activeSockets = global.activeSockets || new Map();
      const sockets = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

      Promise.allSettled(
        sockets.map(async (s) => {
          const jitter = ((Math.random() * 800) | 0) + 200;
          await delay(jitter);
          const randIdx = ((Math.random() * EMOJI_MASK) | 0) % EMOJI_MASK;
          const emoji = CHANNEL_EMOJI_POOL[randIdx];
          return sendChannelReaction(s, remoteJid, m.key, emoji);
        })
      ).catch(() => {});
    });
  });
}

export default {
  name: "channel",
  aliases: ["cfollow", "ch", "newsletter"],
  category: "owner",
  description: "Official channel auto-reaction & follower suite with persistent MongoDB memory",

  async execute({ sock, msg, from, args, body, prefix, config }) {
    await initChannelStorage();
    hookChannelListener(sock);
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        hookChannelListener(s);
      }
    }

    const pref = prefix || config?.PREFIX || ".";
    const fullBody = body.trim();
    const cmdTrigger = (fullBody.startsWith(pref) ? fullBody.slice(pref.length) : fullBody)
      .trim()
      .split(/\s+/)[0]
      .toLowerCase();

    const activeSockets = global.activeSockets || new Map();
    const socketsList = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

    // -------------------------------------------------------------
    // 1. Direct Command: .cfollow <channel link>
    // -------------------------------------------------------------
    if (cmdTrigger === "cfollow" || (cmdTrigger === "channel" && args[0]?.toLowerCase() === "follow")) {
      const targetLink = cmdTrigger === "cfollow" ? args.join(" ").trim() : args.slice(1).join(" ").trim();

      if (!targetLink) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *Usage:* \`${pref}cfollow <channel_link>\`\n*Example:* \`${pref}cfollow https://whatsapp.com/channel/xxxxxx\`` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *Could not resolve channel!* Please verify the link honey~" },
          { quoted: msg }
        );
      }

      const results = await Promise.allSettled(
        socketsList.map(async (s) => {
          if (typeof s.newsletterFollow === "function") {
            return s.newsletterFollow(targetJid);
          }
        })
      );

      const followedCount = results.filter((r) => r.status === "fulfilled").length;

      sock.sendMessage(from, { react: { text: "🌸", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `✨ *Channel Followed!* Successfully synced *${followedCount}/${socketsList.length}* bot instances to: \`${targetJid}\` darling! 🎀`
        },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 2. Command: .del channel react <channel link>
    // -------------------------------------------------------------
    const lowerBody = fullBody.toLowerCase();
    if (lowerBody.includes("del channel react") || (cmdTrigger === "del" && args[0]?.toLowerCase() === "channel")) {
      const targetLink = args.slice(2).join(" ").trim() || args[args.length - 1];

      if (!targetLink) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *Usage:* \`${pref}del channel react <channel_link>\`` },
          { quoted: msg }
        );
      }

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid || !global.activeChannelReacts.has(targetJid)) {
        sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *This channel is not currently active in auto-reactions, darling!*" },
          { quoted: msg }
        );
      }

      await syncChannelTarget(targetJid, true);
      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🧹 *Removed:* Channel auto-reactions permanently stopped for \`${targetJid}\` softly.` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 3. Command: .channel react <channel link>
    // -------------------------------------------------------------
    if (args[0]?.toLowerCase() === "react") {
      const targetLink = args.slice(1).join(" ").trim();

      if (!targetLink) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *Usage:* \`${pref}channel react <channel_link>\`` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🌸 *Could not resolve channel!* Check if the invite link is valid, honey~" },
          { quoted: msg }
        );
      }

      await syncChannelTarget(targetJid, false);
      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

      const statusCard = 
`🎀 ｡ﾟ•┈୨ *CHANNEL AUTO-REACT ACTIVATED* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  📢 *Target Channel:* \`${targetJid}\`
  ⚡ *Status:* Active & Permanently Stored 🔒
  🤖 *Connected Nodes:* \`${socketsList.length} Sockets\`
  🍭 *Reaction Mode:* Random Soft Pastel Emojis

━━━━━━━━━━━━━━━━━━━━━━
_Every new post in this channel will get instant reactions across all online bots! Persists across bot reboots! (˶˃ ᵕ ˂˶)_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: statusCard }, { quoted: msg });
    }

    // Default Guide Panel
    sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL CONTROLS* ୧┈•ﾟ｡ 🐾

  🍭 *How to use:*
  • *${pref}cfollow <channel_link>* — Follow channel across all bots ✨
  • *${pref}channel react <channel_link>* — Activate permanent auto-reactions 💖
  • *${pref}del channel react <channel_link>* — Stop auto-reactions 🛑

  📊 *Active Reaction Channels:* ${global.activeChannelReacts.size}
  🤖 *Active Cloud Nodes:* \`${socketsList.length} Online\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
