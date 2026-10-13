import fs from "fs";
import path from "path";
import { delay } from "@whiskeysockets/baileys";

// Static Pre-allocated Emoji Lookup Pool (O(1) Access)
const CHANNEL_EMOJI_POOL = Object.freeze([
  "🎶", "✨", "🌸", "✨", "🎵", "🐾", "🍓", "😘", "🌟", "😍", "🔥", "🖤"
]);
const EMOJI_MASK = CHANNEL_EMOJI_POOL.length;

// Memory Cluster & Cache Stores
global.activeChannelReacts = global.activeChannelReacts || new Set();
global.channelHookedSockets = global.channelHookedSockets || new WeakSet();
global.channelStoreInitialized = global.channelStoreInitialized || false;
const jidCache = new Map();

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
        if (doc._id) global.activeChannelReacts.add(String(doc._id));
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
        data.forEach((jid) => global.activeChannelReacts.add(String(jid)));
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

initChannelStorage();

// Fast Invite Code Extractor
function extractInviteCode(input = "") {
  const match = input.match(/(?:whatsapp\.com\/channel\/)([0-9A-Za-z]+)/i);
  return match ? match[1] : input.trim();
}

// Resolve Channel JID via Cache or Invite Code
async function resolveChannelJid(sock, input) {
  if (!input) return null;
  const cleanInput = input.trim();
  if (cleanInput.endsWith("@newsletter")) return cleanInput;
  if (jidCache.has(cleanInput)) return jidCache.get(cleanInput);

  const code = extractInviteCode(cleanInput);
  try {
    if (typeof sock.newsletterMetadata === "function") {
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) {
        jidCache.set(cleanInput, meta.id);
        return meta.id;
      }
    }
  } catch (_) {}
  return null;
}

// 🛑 Ultra-Fast Newsletter Native Reaction Dispatcher
async function sendChannelReaction(sock, newsletterJid, msgKey, emoji) {
  try {
    const serverId = msgKey?.server_id || msgKey?.id;
    if (!serverId) return;

    if (typeof sock.newsletterReactMessage === "function") {
      return await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
    }

    // Direct Binary Protocol Query (100% Reliable for Baileys)
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

    // Fallback standard react
    await sock.sendMessage(newsletterJid, {
      react: { text: emoji, key: msgKey }
    });
  } catch (_) {}
}

// 🛑 Background Multi-Cluster Listener (Event-Loop Safe)
export function hookChannelListener(sock) {
  if (!sock || global.channelHookedSockets.has(sock)) return;
  global.channelHookedSockets.add(sock);

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify" || !messages || !messages[0]) return;
    if (global.activeChannelReacts.size === 0) return;

    const m = messages[0];
    const remoteJid = m?.key?.remoteJid;
    if (!remoteJid || !remoteJid.endsWith("@newsletter")) return;
    if (!global.activeChannelReacts.has(remoteJid)) return;

    // Run in parallel microtask without freezing command router
    queueMicrotask(async () => {
      const activeSockets = global.activeSockets || new Map();
      const sockets = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

      for (const s of sockets) {
        const jitter = Math.floor(Math.random() * 300) + 150; // Ultra low latency (150-450ms)
        await delay(jitter);
        const randIdx = Math.floor(Math.random() * EMOJI_MASK);
        const emoji = CHANNEL_EMOJI_POOL[randIdx];
        sendChannelReaction(s, remoteJid, m.key, emoji).catch(() => {});
      }
    });
  });
}

export default {
  name: "channel",
  aliases: ["cfollow", "ch", "newsletter"],
  category: "owner",
  description: "High-speed multi-cluster channel auto-reaction & follower engine",

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

    // 1. Direct Command: .cfollow <channel link>
    if (cmdTrigger === "cfollow" || (cmdTrigger === "channel" && args[0]?.toLowerCase() === "follow")) {
      const targetLink = cmdTrigger === "cfollow" ? args.join(" ").trim() : args.slice(1).join(" ").trim();

      if (!targetLink) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *භාවිතය:* \`${pref}cfollow <channel_link>\`\n*උදාහරණ:* \`${pref}cfollow https://whatsapp.com/channel/xxxxxx\`` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "⚠️ *Channel එක හඳුනාගත නොහැකි විය!* කරුණාකර link එක පරීක්ෂා කරන්න." },
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
      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: `✨ *Channel Followed!* සාර්ථකව online botsලා *${followedCount}/${socketsList.length}* ක්ම \`${targetJid}\` වෙත follow කරවන ලදී! 🎀`
        },
        { quoted: msg }
      );
    }

    // 2. Command: .del channel react <channel link>
    const lowerBody = fullBody.toLowerCase();
    if (lowerBody.includes("del channel react") || (cmdTrigger === "del" && args[0]?.toLowerCase() === "channel")) {
      const targetLink = args.slice(2).join(" ").trim() || args[args.length - 1];

      if (!targetLink) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *භාවිතය:* \`${pref}del channel react <channel_link>\`` },
          { quoted: msg }
        );
      }

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid || !global.activeChannelReacts.has(targetJid)) {
        sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "⚠️ *මෙම Channel එක දැනට auto-reactions ලැයිස්තුවේ සක්‍රීයව නොමැත!*" },
          { quoted: msg }
        );
      }

      await syncChannelTarget(targetJid, true);
      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🧹 *ඉවත් කරන ලදී:* \`${targetJid}\` සඳහා Channel auto-reactions ස්ථිරවම අක්‍රීය කරන ලදී.` },
        { quoted: msg }
      );
    }

    // 3. Command: .channel react <channel link>
    if (args[0]?.toLowerCase() === "react") {
      const targetLink = args.slice(1).join(" ").trim();

      if (!targetLink) {
        return await sock.sendMessage(
          from,
          { text: `🌸 *භාවිතය:* \`${pref}channel react <channel_link>\`` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "⚠️ *Channel එක හඳුනාගත නොහැකි විය!* කරුණාකර link එක නිවැරදිදැයි බලන්න." },
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
  🍭 *Reaction Mode:* Instant Multi-Cluster React

━━━━━━━━━━━━━━━━━━━━━━
_මෙම channel එකේ වැටෙන ඕනෑම post එකකට තත්පරයෙන් සියලුම active botsලා auto react කරනු ඇත!_

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

  🍭 *විධානයන්:*
  • *${pref}cfollow <channel_link>* — සියලුම botsලා එකවර channel එක follow කරයි ✨
  • *${pref}channel react <channel_link>* — Channel posts වලට auto-reaction සක්‍රීය කරයි 💖
  • *${pref}del channel react <channel_link>* — Auto-reactions අක්‍රීය කරයි 🛑

  📊 *Active Reaction Channels:* ${global.activeChannelReacts.size}
  🤖 *Active Cloud Nodes:* \`${socketsList.length} Online\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
