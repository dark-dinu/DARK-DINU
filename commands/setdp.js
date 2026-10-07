import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "setdp",
  aliases: ["setdppro", "setpfp", "setpfppro"],
  category: "owner",
  description: "Update Profile Picture for Current Bot (Owner) or Any Linked Node (Developer Only)",

  async execute({ sock, msg, from, args, body, config }) {
    const prefix = config?.PREFIX || ".";

    try {
      // 1. අදාළ විධානය කුමක්දැයි හඳුනා ගැනීම (.setdppro ද .setdp ද යන්න)
      const isProCommand = body.toLowerCase().startsWith(`${prefix}setdppro`) || 
                           body.toLowerCase().startsWith(`${prefix}setpfppro`);

      // 2. Sender සහ Bot තොරතුරු ලබා ගැනීම
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const currentBotNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      
      const devNumbers = ["94719845166", "15947733680169"];
      const isDeveloper = devNumbers.includes(cleanSender);
      const isCurrentOwner = msg.key.fromMe || cleanSender === currentBotNumber || isDeveloper;

      // 3. Image Message එක අල්ලා ගැනීම
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetPayload = null;

      if (quotedMsg?.imageMessage) {
        targetPayload = {
          message: {
            imageMessage: quotedMsg.imageMessage
          }
        };
      } else if (msg.message?.imageMessage) {
        targetPayload = msg;
      }

      if (!targetPayload) {
        return await sock.sendMessage(from, { 
          text: "📸 *කරුණාකර Profile Picture එකට දැමීමට අවශ්‍ය Photo එකකට Reply කර විධානය ලබා දෙන්න!*" 
        }, { quoted: msg });
      }

      // ==========================================
      // 👑 MODE 1: DEVELOPER MASTER (.setdppro)
      // ==========================================
      if (isProCommand) {
        if (!isDeveloper) {
          return await sock.sendMessage(from, { 
            text: "⛔ *PERMISSION DENIED*\n\nThis master cluster control command is reserved strictly for Developer Dinidu Heshan." 
          }, { quoted: msg });
        }

        const targetPhone = (args[0] || "").replace(/[^0-9]/g, "");
        if (!targetPhone) {
          return await sock.sendMessage(from, { 
            text: `⚠️ *Usage Error:*\n\nPhoto එකකට Reply කර bot අංකය ලබා දෙන්න.\n*Format:* \`${prefix}setdppro 947xxxxxxxx\`` 
          }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        // Cluster එකෙන් අදාළ Bot Socket එක සෙවීම
        const botPool = global.activeSockets || new Map();
        let targetBotSocket = null;
        let foundSessionId = null;

        for (const [sId, instanceSock] of botPool.entries()) {
          const instanceNum = (instanceSock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
          if (instanceNum === targetPhone || sId.includes(targetPhone)) {
            targetBotSocket = instanceSock;
            foundSessionId = sId;
            break;
          }
        }

        if (!targetBotSocket) {
          await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, { 
            text: `❌ *Target Node Offline:*\n\nCluster එක තුළ +${targetPhone} අංකයට අදාළ active bot node එකක් සොයාගත නොහැකි විය.` 
          }, { quoted: msg });
        }

        // Image Buffer එක බාගත කිරීම
        const buffer = await downloadMediaMessage(
          targetPayload,
          "buffer",
          {},
          { reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer || buffer.length === 0) throw new Error("Failed to process image buffer.");

        // Target Bot හරහා Profile Picture එක Update කිරීම
        const targetBotJid = targetBotSocket.user?.id ? targetBotSocket.user.id.split(":")[0] + "@s.whatsapp.net" : `${targetPhone}@s.whatsapp.net`;
        await targetBotSocket.updateProfilePicture(targetBotJid, buffer);

        const devSuccessCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 👑 *DEVELOPER REMOTE ACTION* 〕
├─▸ 🎯 *Target Node* : +${targetPhone}
├─▸ 🏷️ *Session ID*  : ${foundSessionId}
├─▸ ⚡ *Cluster Rel* : Successfully Updated
├─▸ 🛡️ *Executed By* : Master Developer
└───────────────────────

> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐋𝐔𝐒𝐓𝐄𝐑 🐦‍🔥*`;

        await sock.sendMessage(from, { text: devSuccessCard }, { quoted: msg });
        return await sock.sendMessage(from, { react: { text: "🔥", key: msg.key } }).catch(() => {});
      }

      // ==========================================
      // 🤖 MODE 2: BOT OWNER ONLY (.setdp)
      // ==========================================
      if (!isCurrentOwner) {
        return await sock.sendMessage(from, { 
          text: "⚠️ *ACCESS DENIED*\n\nThis command can only be used by this Bot's Owner." 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const buffer = await downloadMediaMessage(
        targetPayload,
        "buffer",
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer || buffer.length === 0) throw new Error("Failed to download image buffer.");

      const currentBotJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : `${currentBotNumber}@s.whatsapp.net`;
      await sock.updateProfilePicture(currentBotJid, buffer);

      const successCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🖼️ *PROFILE UPDATED* 〕
├─▸ 🤖 *Target Bot* : +${currentBotNumber}
├─▸ 👤 *Action By*  : Owner
├─▸ ⚡ *Status*     : DP Applied Successfully
└───────────────────────

> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(from, { text: successCard }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[SETDP COMBO ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ *DP Update Failed:* ${err.message}` }, { quoted: msg });
    }
  }
};
