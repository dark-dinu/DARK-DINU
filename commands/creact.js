import { delay } from "@whiskeysockets/baileys";

// Static Master Developer Pool (O(1) Memory Set)
const DEV_SET = new Set(["94719845166", "15947733680169"]);

// Global High-Speed In-Memory Channel JID Cache
global.channelJidCache = global.channelJidCache || new Map();

// Sub-nanosecond phone extraction helper
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

export default {
  name: "creact",
  aliases: ["cr", "channelreact"],
  category: "owner",
  description: "Cute turbo-speed channel post reaction dispatcher",

  async execute({ sock, msg, from, args, prefix }) {
    const pref = prefix || ".";

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
      const firstComma = fullText.indexOf(",");

      if (!fullText || firstComma === -1) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *C-REACT GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Cute Usage:*
  \`${pref}creact <post_link>,<emoji1>,<emoji2>...\`

  ✨ *Example:*
  \`${pref}creact https://whatsapp.com/channel/0029VbBTkLI9Gv7bxPWEmg3D/2513,💖,🌸,✨\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      const postLink = fullText.slice(0, firstComma).trim();
      const rawEmojis = fullText.slice(firstComma + 1).split(",").map((e) => e.trim()).filter(Boolean);

      if (rawEmojis.length === 0) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Please include at least one cute emoji, darling!* ✨" },
          { quoted: msg }
        );
      }

      // Fast Link Extraction
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Invalid channel link!* Please share the exact post link with the post ID at the end sweetheart~" },
          { quoted: msg }
        );
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 3. O(1) Channel JID Cache Lookup
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
          { text: "🌸 *Oops!* Unable to resolve channel ID softly." },
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

      const previewCard = 
`🎀 ｡ﾟ•┈୨ *C-REACT TURBO ENGINE* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  📢 *Target JID:* \`${channelJid}\`
  🎯 *Post ID:* \`${postId}\`
  🤖 *Active Cluster Nodes:* \`${botPool.length} Sockets\`
  ✨ *Reaction Wave:* ${rawEmojis.join(" ")}

━━━━━━━━━━━━━━━━━━━━━
_Sending reaction wave across all active nodes now softly~ (˶˃ ᵕ ˂˶)_`;

      await sock.sendMessage(from, { text: previewCard }, { quoted: msg });

      // 5. Staggered Sub-Second Concurrent Worker
      setImmediate(async () => {
        let successCount = 0;
        let failCount = 0;
        const emojiPoolLen = rawEmojis.length;

        const tasks = botPool.map((currentBot, index) => {
          return new Promise((resolve) => {
            const selectedEmoji = rawEmojis[index % emojiPoolLen];

            // 250ms gentle staggered offset to prevent rate limiting
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

  🎯 *Target Post:* \`${postId}\`
  ✨ *Reactions Delivered:* ${successCount}
  ⚠️ *Missed / Skipped:* ${failCount}

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      });

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
