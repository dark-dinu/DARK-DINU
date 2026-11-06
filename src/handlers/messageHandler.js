import { cleanPhone, getSessionConfig } from "../core/sessionManager.js";
import CONFIG from "../../config.js";
import { generateWAMessageFromContent } from "@whiskeysockets/baileys";
import { handleAiAutoChat } from "../engines/aiAutoChatEngine.js";

// Developer Numbers & LIDs Only
const DEV_NUMBERS = new Set([
  "94719845166", 
  "15947733680169", 
  "15947733680169@lid",
  "15947733080169",
  "15947733080169@lid"
]);

// Text Extract කිරීම
function extractMessageBody(m) {
  if (!m) return "";
  const msg =
    m.ephemeralMessage?.message ||
    m.viewOnceMessage?.message ||
    m.viewOnceMessageV2?.message ||
    m.documentWithCaptionMessage?.message ||
    m;

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.extendedTextMessage?.matchedText ||
    msg.interactiveResponseMessage?.body?.text ||
    msg.templateButtonReplyMessage?.selectedId ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    ""
  ).trim();
}

/**
 * 🚀 Universal Sender: චැනල්, ගෲප් සහ ඉන්බොක්ස් ඕනෑම තැනකට 100% මැසේජ් යවන Function එක
 */
export async function sendUniversalMessage(sock, jid, content, options = {}) {
  const isNewsletter = String(jid).endsWith("@newsletter");

  // 1. WhatsApp Channel (Newsletter) Handling
  if (isNewsletter) {
    try {
      // Audio / Voice Note සහිත Channel Message
      if (content.audio) {
        return await sock.sendMessage(jid, {
          audio: content.audio,
          mimetype: content.mimetype || "audio/ogg; codecs=opus",
          ptt: content.ptt ?? true
        });
      }

      // Image සහිත Channel Message
      if (content.image) {
        return await sock.sendMessage(jid, {
          image: content.image,
          caption: content.caption || ""
        });
      }

      // Video සහිත Channel Message
      if (content.video) {
        return await sock.sendMessage(jid, {
          video: content.video,
          caption: content.caption || ""
        });
      }

      // Plain Text Channel Message
      if (content.text) {
        return await sock.sendMessage(jid, {
          text: content.text
        });
      }
    } catch (err) {
      console.warn(`[STANDARD CHANNEL SEND FAILED -> ${jid}]:`, err.message);

      // 🛡️ Newsletter Low-Level Relay Fallback Engine
      try {
        const textData = content.text || content.caption || "";
        const protoMsg = {
          extendedTextMessage: {
            text: textData
          }
        };

        const channelMsg = generateWAMessageFromContent(jid, protoMsg, {});
        return await sock.relayMessage(jid, channelMsg.message, {
          messageId: channelMsg.key.id
        });
      } catch (relayErr) {
        console.error(`[CHANNEL RELAY FATAL ERROR -> ${jid}]:`, relayErr.message);
        throw relayErr;
      }
    }
  }

  // 2. Normal Chat & Group Sending
  return await sock.sendMessage(jid, content, options);
}

export function setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets }) {
  // sock object එකට universal channel send function එක inject කිරීම
  sock.sendChannelMessage = (jid, content, opt) => sendUniversalMessage(sock, jid, content, opt);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !messages || !messages[0]) return;
    const msg = messages[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    // Status broadcast පමණක් bypass කරයි
    if (!from || from === "status@broadcast") return;

    const botPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig ? getSessionConfig(botPhone) : {};

    const isGroup = from.endsWith("@g.us");
    const isChannel = from.endsWith("@newsletter");
    
    // Sender නිවැරදිව ලබාගැනීම
    const rawSender = msg.key.fromMe
      ? (sock.user?.id || "")
      : (isGroup ? (msg.key.participant || msg.participant || from) : (isChannel ? (msg.key.participant || from) : from));

    const cleanSender = cleanPhone(rawSender);
    const bareSender = rawSender.split("@")[0].split(":")[0];

    // Developer Check
    const isDeveloper = 
      DEV_NUMBERS.has(cleanSender) || 
      DEV_NUMBERS.has(bareSender) || 
      DEV_NUMBERS.has(rawSender) ||
      rawSender.includes("15947733680169") ||
      rawSender.includes("94719845166");

    // 🔴 1. Permissions: Channel එකෙන් එන commands වලට සම්පූර්ණ Access දීම
    const isOwner = msg.key.fromMe || cleanSender === botPhone || isDeveloper || isChannel;

    // Group / Mode Barrier (Channel එකකට බලනොපායි)
    if (!isOwner && !isChannel && cfg) {
      if (cfg.mode === "private" && isGroup) return;
      if (cfg.mode === "group" && !isGroup) return;
      if (cfg.mode === "inbox" && isGroup) return;
    }

    // Extract Message Body
    const body = extractMessageBody(msg.message);

    // 1. Reply Handler
    const contextInfo = 
      msg.message.extendedTextMessage?.contextInfo ||
      msg.message.imageMessage?.contextInfo ||
      msg.message.videoMessage?.contextInfo;

    const quotedStanzaId = contextInfo?.stanzaId;

    if (quotedStanzaId && replyHandlers) {
      for (const [cmdName, handler] of replyHandlers.entries()) {
        try {
          const handled = await handler({ sock, msg, from, body, quotedStanzaId });
          if (handled) return;
        } catch (err) {
          console.error(`[REPLY HANDLER ERR] (${cmdName}):`, err.message);
        }
      }
    }

    // 2. Prefix & Command Resolution
    const prefix = CONFIG.PREFIX || ".";
    const isCommand = body.startsWith(prefix);

    // Command එකක් නොවන විට Auto AI Chat Engine එක ක්‍රියාත්මක කිරීම
    if (!isCommand) {
      if (body && typeof handleAiAutoChat === "function") {
        try {
          const handledAi = await handleAiAutoChat({ sock, msg, from, body, isChannel, isGroup });
          if (handledAi) return;
        } catch (aiErr) {
          console.error("[AUTO AI DISPATCH ERROR]:", aiErr.message);
        }
      }
      return;
    }

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    const cmd = commands.get(cmdName);

    // 3. Universal Command Execution
    if (cmd && typeof cmd.execute === "function") {
      try {
        await cmd.execute({
          sock,
          msg,
          from,
          jid: from,
          args,
          body,
          prefix,
          isChannel,
          isGroup,
          isOwner,
          config: CONFIG,
          activeSockets,
          sessionId
        });
      } catch (err) {
        console.error(`[CMD ERR - ${cmdName}]:`, err.message);
        if (!isChannel) {
          sock.sendMessage(from, { text: `⚠️ Error: ${err.message}` }, { quoted: msg }).catch(() => {});
        }
      }
    }
  });
}
