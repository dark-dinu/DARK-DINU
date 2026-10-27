import { cleanPhone, getSessionConfig } from "../core/sessionManager.js";
import CONFIG from "../../config.js";

const DEV_NUMBERS = new Set([
  "94719845166", 
  "15947733680169", 
  "15947733680169@lid",
  "15947733080169",
  "15947733080169@lid"
]);

const DEV_REACT_EMOJI = "👨🏻‍💻";

// Link Previews, Interactive Cards, Ephemeral ඕනෑම මැසේජ් එකකින් Text හරියටම ගන්නා Function එක
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
    
    // Sender JID නිවැරදිව හඳුනාගැනීම (DM, Group, Channel සහ LIDs)
    const rawSender = msg.key.fromMe
      ? (sock.user?.id || "")
      : (isGroup ? (msg.key.participant || msg.participant || from) : from);

    const cleanSender = cleanPhone(rawSender);
    const bareSender = rawSender.split("@")[0].split(":")[0];

    // Owner / Developer Check (LID හා Number දෙකම match කරයි)
    const isOwner = 
      msg.key.fromMe || 
      cleanSender === botPhone || 
      DEV_NUMBERS.has(cleanSender) || 
      DEV_NUMBERS.has(bareSender) || 
      DEV_NUMBERS.has(rawSender) ||
      rawSender.includes("15947733680169") ||
      rawSender.includes("94719845166");

    // Group / Mode Barrier
    if (!isOwner && cfg) {
      if (cfg.mode === "private" && isGroup) return;
      if (cfg.mode === "group" && !isGroup) return;
      if (cfg.mode === "inbox" && isGroup) return;
    }

    // Extract Message Body (Link Card ආවත් Text එක අහුවේ)
    const body = extractMessageBody(msg.message);

    // 1. Reply Handler (e.g. Setting menu number replies / autosend interval selection)
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

    // ========================================================
    // 👨🏻‍💻 3. ZERO-LAG DEVELOPER AUTO-REACT ENGINE
    // ========================================================
    // Developer සාමාන්‍ය මැසේජ් එකක් දැමූ විට පමණක් 👨🏻‍💻 reaction එක වැටේ.
    // Command එකක් ගැසූ විට මෙතනින් bypass වී command එකට අදාළ react එක වැටේ.
    if (isOwner && !isCommand && body.length > 0) {
      sock.sendMessage(from, {
        react: {
          text: DEV_REACT_EMOJI,
          key: msg.key
        }
      }).catch(() => {});
    }

    if (!isCommand) return;

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    const cmd = commands.get(cmdName);

    // ========================================================
    // 4. COMMAND EXECUTION (With jid fallback for Channel Commands)
    // ========================================================
    if (cmd && typeof cmd.execute === "function") {
      try {
        await cmd.execute({
          sock,
          msg,
          from,
          jid: from, // Channel / Newsletter commands වලට අත්‍යවශ්‍යයි
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
