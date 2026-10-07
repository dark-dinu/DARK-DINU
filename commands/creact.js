import { delay } from "@whiskeysockets/baileys";

export default {
  name: "creact",
  aliases: ["cr"],
  category: "owner",
  description: "Official Protocol Channel Post Reactor for all active bots",

  async execute({ sock, msg, from, args }) {
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
        await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "*⛔ ACCESS DENIED ⛔*\n\nමෙම Command එක භාවිතා කළ හැක්කේ Bot Owner හෝ Developer ට පමණි." },
          { quoted: msg }
        );
      }

      // 2. Argument Parsing
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතය:*\n.creact <post_link>,<emoji1>,<emoji2>...\n\n*උදාහරණ:*\n.creact https://whatsapp.com/channel/0029VbBTkLI9Gv7bxPWEmg3D/2513,🖤,😚,✨`
          },
          { quoted: msg }
        );
      }

      const parts = fullText.split(",").map((p) => p.trim()).filter(Boolean);
      const postLink = parts[0];
      const emojis = parts.slice(1);

      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ කරුණාකර අවම වශයෙන් එක emoji එකක්වත් ලබා දෙන්න." }, { quoted: msg });
      }

      // Link Parsing
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await sock.sendMessage(
          from,
          { text: "❌ වැරදි Channel Link එකක්! Share Link එකම ලබා දෙන්න (අගට post ID එක සහිතව)." },
          { quoted: msg }
        );
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Channel metadata ලබා ගැනීම (Timeout සහිතව)
      let channelJid = null;
      try {
        const metadata = await Promise.race([
          sock.newsletterMetadata("invite", channelCode),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Metadata fetch timeout")), 10000))
        ]);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(from, { text: `❌ Channel එක සොයාගත නොහැකි විය: ${e.message}` }, { quoted: msg });
      }

      // Active bots ලබා ගැනීම
      let botList = [];
      if (global.activeSockets && global.activeSockets.size > 0) {
        botList = Array.from(global.activeSockets.values());
      } else {
        botList = [sock];
      }

      await sock.sendMessage(
        from,
        {
          text: `⚡ *C-REACT ENGINE STARTED*\n\n📢 *Target:* ${channelJid}\n🎯 *Server Post ID:* ${postId}\n🤖 *Active Nodes:* ${botList.length}\n✨ *Emojis:* ${emojis.join(" ")}\n\n_Reactions යැවීම ආරම්භ විය..._`
        },
        { quoted: msg }
      );

      // Background Worker
      (async () => {
        let success = 0;
        let fail = 0;

        for (let i = 0; i < botList.length; i++) {
          const currentBot = botList[i];
          const selectedEmoji = emojis[i % emojis.length];

          try {
            // Channel Reaction binary node query with timeout guard
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
              new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
            ]);
            success++;
          } catch (err) {
            console.error(`[C-REACT ERR - Node ${i + 1}]:`, err.message);
            fail++;
          }

          // Anti-ban delay
          await delay(2500);
        }

        await sock.sendMessage(from, {
          text: `✅ *C-REACT අවසන්!*\n\n🎯 *Post ID:* ${postId}\n🔥 *සාර්ථකයි:* ${success}\n⚠️ *අසාර්ථකයි:* ${fail}`
        }).catch(() => {});
      })();

    } catch (err) {
      console.error("[C-REACT MAIN ERROR]:", err);
      await sock.sendMessage(from, { text: `❌ C-React දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
