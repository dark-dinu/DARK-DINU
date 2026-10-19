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
  "🎶", "✨", "🌸", "🎵", "🐾", "🍓", "😘", "🌟", "😍", "🔥", "🖤", "💖"
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
        const fullJid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        jidCache.set(cleanInput, fullJid);
        return fullJid;
      }
    }
  } catch (_) {}
  return null;
}

// 1. Dual-Storage Load & Auto-Add Target Channels
async function initChannelStorage(sock) {
  if (global.channelStoreInitialized && !sock) return;
  global.channelStoreInitialized = true;

  // Local JSON Backup Fallback
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const data = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach((jid) => global.activeChannelReacts.add(String(jid)));
      }
    }
  } catch (_) {}

  // Database Load
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

  // target channels 5 auto-resolve කරලා active list එකට දාගැනීම
  if (sock) {
    for (const link of PERMANENT_CHANNELS) {
      try {
        const jid = await resolveChannelJid(sock, link);
        if (jid) global.activeChannelReacts.add(jid);
      } catch (_) {}
    }
  }
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

// Ultra-Fast Newsletter Native Reaction Dispatcher
async function sendChannelReaction(sock, newsletterJid, msgKey, emoji) {
  try {
    const serverId = msgKey?.server_id || msgKey?.id;
    if (!serverId) return;

    if (typeof sock.newsletterReactMessage === "function") {
      return await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
    }

    // Direct Binary Protocol Query (100% Baileys Reliable)
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

// Multi-Cluster Background Listener
export function hookChannelListener(sock) {
  if (!sock || global.channelHookedSockets.has(sock)) return;
  global.channelHookedSockets.add(sock);

  sock.ev.on("messages.upsert", ({ messages }) => {
    if (!messages || !messages[0]) return;
    if (global.activeChannelReacts.size === 0) return;

    const m = messages[0];
    const remoteJid = m?.key?.remoteJid;
    if (!remoteJid || !remoteJid.endsWith("@newsletter")) return;
    if (!global.activeChannelReacts.has(remoteJid)) return;

    queueMicrotask(async () => {
      const activeSockets = global.activeSockets || new Map();
      const sockets = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

      for (const s of sockets) {
        const jitter = Math.floor(Math.random() * 250) + 150;
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
    await initChannelStorage(sock);
    hookChannelListener(sock);
    if (global.activeSockets) {
      for (const [, s] of global.activeSockets.entries()) {
        hookChannelListener(s);
      }
    }

    const pref = prefix || config?.PREFIX || ".";
    const fullBody = (body || "").trim();
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
          { text: `🌸 *භාවිතය:* \`${pref}cfollow <channel_link>\`` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = await resolveChannelJid(sock, targetLink);
      if (!targetJid) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "⚠️ *Channel එක හඳුනාගත නොහැකි විය!*" },
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
          text: `✨ *Channel Followed!* online botsලා *${followedCount}/${socketsList.length}* ක් \`${targetJid}\` වෙත follow කරන ලදී!`
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
        return await sock.sendMessage(
          from,
          { text: "⚠️ *මෙම Channel එක auto-reactions ලැයිස්තුවේ නොමැත!*" },
          { quoted: msg }
        );
      }

      await syncChannelTarget(targetJid, true);
      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🧹 *ඉවත් කරන ලදී:* \`${targetJid}\` auto-react අක්‍රීය කරන ලදී.` },
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
          { text: "⚠️ *Channel එක හඳුනාගත නොහැකි විය!*" },
          { quoted: msg }
        );
      }

      await syncChannelTarget(targetJid, false);
      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(
        from,
        {
          text: `🎀 *Auto-React Activated:*\n📢 Channel: \`${targetJid}\`\n🤖 Bots: \`${socketsList.length} Sockets\``
        },
        { quoted: msg }
      );
    }

    // Default Status Panel
    sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *CHANNEL CONTROLS* ୧┈•ﾟ｡ 🐾

  🍭 *Commands:*
  • *${pref}cfollow <link>* — සියලු botsලා follow කරයි
  • *${pref}channel react <link>* — Auto-react සක්‍රීය කරයි
  • *${pref}del channel react <link>* — Auto-react අක්‍රීය කරයි

  📊 *Monitored Channels:* ${global.activeChannelReacts.size}
  🤖 *Active Nodes:* \`${socketsList.length} Online\`

💖 *DARK-DINU MD*`
      },
      { quoted: msg }
    );
  }
};
