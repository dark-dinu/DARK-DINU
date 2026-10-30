import { cleanPhone, getSessionConfig } from "../core/sessionManager.js";
import CONFIG from "../../config.js";

// Developer Numbers & LIDs Only
const DEV_NUMBERS = new Set([
  "94719845166", 
  "15947733680169", 
  "15947733680169@lid",
  "15947733080169",
  "15947733080169@lid"
]);

// Link Cards / Interactive messages වලින් Text හරියටම extract කිරීම
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

export function setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets }) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !messages || !messages[0]) return;
    const msg = messages[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const botPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig ? getSessionConfig(botPhone) : {};

    const isGroup = from.endsWith("@g.us");
    
    // Sender නිවැරදිව ලබාගැනීම
    const rawSender = msg.key.fromMe
      ? (sock.user?.id || "")
      : (isGroup ? (msg.key.participant || msg.participant || from) : from);

    const cleanSender = cleanPhone(rawSender);
    const bareSender = rawSender.split("@")[0].split(":")[0];

    // Developer Check (Permissions සඳහා)
    const isDeveloper = 
      DEV_NUMBERS.has(cleanSender) || 
      DEV_NUMBERS.has(bareSender) || 
      DEV_NUMBERS.has(rawSender) ||
      rawSender.includes("15947733680169") ||
      rawSender.includes("94719845166");

    // Bot Owner Permissions (Settings, Commands සඳහා)
    const isOwner = msg.key.fromMe || cleanSender === botPhone || isDeveloper;

    // Group / Mode Barrier
    if (!isOwner && cfg) {
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

    if (!isCommand) return;

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    const cmd = commands.get(cmdName);

    // 3. Command Execution
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
          config: CONFIG,
          activeSockets,
          sessionId
        });
      } catch (err) {
        console.error(`[CMD ERR - ${cmdName}]:`, err.message);
        sock.sendMessage(from, { text: `⚠️ Error: ${err.message}` }, { quoted: msg }).catch(() => {});
      }
    }
  });
}
