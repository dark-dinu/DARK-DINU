// Pre-allocated Static Developer Lookup Set (O(1) Access)
const DEV_SET = new Set(["94719845166", "15947733680169"]);

// Fast phone cleaner helper
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  let num = (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
  if (num.startsWith("0")) num = "94" + num.slice(1);
  return num;
}

export default {
  name: "msg",
  aliases: ["mgs", "send", "dm", "mgspro", "switchmsg"],
  category: "owner",
  description: "Cute direct message & cross-bot relay controller",

  async execute({ sock, msg, from, args, body, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      // 1. Instant Permission Validation
      const senderJid = msg.key.fromMe
        ? (sock.user?.id || "")
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = fastExtractPhone(senderJid);
      const isDeveloper = DEV_SET.has(cleanSender) || senderJid.includes("15947733680169");
      const isOwner = msg.key.fromMe || isDeveloper;

      // Fast Command Trigger Parsing
      const fullBody = body.trim();
      const firstWord = (fullBody.startsWith(prefix) ? fullBody.slice(prefix.length) : fullBody)
        .trim()
        .split(/\s+/)[0]
        .toLowerCase();

      const isPro = firstWord === "mgspro" || firstWord === "switchmsg";

      // -------------------------------------------------------------
      // OPTION A: .mgspro (Cross-Node Relay - Master Developer Only)
      // -------------------------------------------------------------
      if (isPro) {
        if (!isDeveloper) {
          sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(
            from,
            { text: "🎀 *Only my master developer can dispatch cross-node relays!* 🌸" },
            { quoted: msg }
          );
        }

        const fullText = args.join(" ").trim();
        const parts = fullText.split(",");

        if (parts.length < 3) {
          sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(
            from,
            {
              text: 
`🌸 ｡ﾟ•┈୨ *MGSPRO RELAY GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${prefix}mgspro <sender_bot_number>,<receiver_number>,<message>\`

  ✨ *Example:*
  \`${prefix}mgspro 94771033094,94719845166,Hello sweetheart!\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
            },
            { quoted: msg }
          );
        }

        const senderNum = fastExtractPhone(parts[0]);
        const targetNum = fastExtractPhone(parts[1]);
        const textToSend = parts.slice(2).join(",").trim();

        if (!textToSend) {
          return await sock.sendMessage(
            from,
            { text: "🌸 *Please write a message to transmit, honey!* ✨" },
            { quoted: msg }
          );
        }

        sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        // Resolve Target Socket in Cluster Pool
        const botPool = global.activeSockets || new Map();
        let relaySock = null;
        let matchedNode = null;

        for (const [nodeId, bSock] of botPool.entries()) {
          const bPhone = fastExtractPhone(bSock?.user?.id || "");
          if (bPhone === senderNum || String(nodeId).includes(senderNum)) {
            relaySock = bSock;
            matchedNode = nodeId;
            break;
          }
        }

        if (!relaySock) {
          sock.sendMessage(from, { react: { text: "💔", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(
            from,
            { text: `🌸 *Node Offline:* Bot node +${senderNum} is not currently active in the cloud cluster, honey~` },
            { quoted: msg }
          );
        }

        const targetJid = `${targetNum}@s.whatsapp.net`;
        await relaySock.sendMessage(targetJid, { text: textToSend });

        const relayCard = 
`🎀 ｡ﾟ•┈୨ *CROSS-RELAY DELIVERED* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🤖 *Relay Node:* \`+${senderNum}\` [${matchedNode}]
  🎯 *Destination:* \`+${targetNum}\`
  💌 *Message Content:*
  > ${textToSend}

━━━━━━━━━━━━━━━━━━━━━
✨ *Transmitted successfully across cloud instances! (˶˃ ᵕ ˂˶)*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        await sock.sendMessage(from, { text: relayCard }, { quoted: msg });
        return await sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});
      }

      // -------------------------------------------------------------
      // OPTION B: .msg (Direct DM Send - Owner Only)
      // -------------------------------------------------------------
      if (!isOwner) {
        sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "🎀 *Only my sweet owner can send direct messages!* 🌸" },
          { quoted: msg }
        );
      }

      const fullText = args.join(" ").trim();
      const firstComma = fullText.indexOf(",");

      if (firstComma === -1) {
        sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          {
            text: 
`🌸 ｡ﾟ•┈୨ *DIRECT MESSAGE GUIDE* ୧┈•ﾟ｡ 🐾

  🍭 *Usage:*
  \`${prefix}msg <phone_number>,<message>\`

  ✨ *Example:*
  \`${prefix}msg 94719845166,Hey, how are you doing?\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
          },
          { quoted: msg }
        );
      }

      const rawNumber = fullText.slice(0, firstComma).trim();
      const targetNumber = fastExtractPhone(rawNumber);
      const messageContent = fullText.slice(firstComma + 1).trim();

      if (!messageContent || !targetNumber) {
        return await sock.sendMessage(
          from,
          { text: "🌸 *Oops!* Both phone number and message are needed sweetheart~ ✨" },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "💌", key: msg.key } }).catch(() => {});

      const targetJid = `${targetNumber}@s.whatsapp.net`;
      await sock.sendMessage(targetJid, { text: messageContent });

      const successCard = 
`🎀 ｡ﾟ•┈୨ *DIRECT MESSAGE SENT* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  🎯 *Delivered To:* \`+${targetNumber}\`
  💌 *Message Body:*
  > ${messageContent}

━━━━━━━━━━━━━━━━━━━━━
✨ *Message safely reached the destination softly~ (˶˃ ᵕ ˂˶)*
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      await sock.sendMessage(from, { text: successCard }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[MSG RUNTIME ERROR]:", err);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* Failed to deliver message (${err.message || "Network issue"})` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
