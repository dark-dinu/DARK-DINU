import { cleanPhone, getSessionConfig } from "../core/sessionManager.js";
import CONFIG from "../../config.js";

const DEV_NUMBERS = new Set(["94719845166", "15947733680169"]);

export function setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets }) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !messages || !messages[0]) return;
    const msg = messages[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const botPhone = cleanPhone(sock.user?.id || "");
    const cfg = getSessionConfig(botPhone);

    const isGroup = from.endsWith("@g.us");
    const sender = isGroup ? (msg.key.participant || msg.participant || from) : from;
    const cleanSender = cleanPhone(sender);
    const isOwner = msg.key.fromMe || cleanSender === botPhone || DEV_NUMBERS.has(cleanSender);

    // Group / Mode Barrier
    if (!isOwner) {
      if (cfg.mode === "private" && isGroup) return;
      if (cfg.mode === "group" && !isGroup) return;
      if (cfg.mode === "inbox" && isGroup) return;
    }

    // Extract Message Body
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      "";

    // 1. Reply Handler (e.g. Setting menu number replies)
    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const quotedStanzaId = contextInfo?.stanzaId;

    if (quotedStanzaId) {
      for (const [cmdName, handler] of replyHandlers.entries()) {
        try {
          const handled = await handler({ sock, msg, from, body, quotedStanzaId });
          if (handled) return;
        } catch (err) {
          console.error(`[REPLY HANDLER ERR] (${cmdName}):`, err.message);
        }
      }
    }

    // 2. Command Execution
    const prefix = CONFIG.PREFIX || ".";
    if (!body.startsWith(prefix)) return;

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();
    const cmd = commands.get(cmdName);

    if (cmd && typeof cmd.execute === "function") {
      try {
        await cmd.execute({
          sock,
          msg,
          from,
          args,
          body,
          prefix,
          config: CONFIG,
          activeSockets
        });
      } catch (err) {
        console.error(`[CMD ERR - ${cmdName}]:`, err.message);
        sock.sendMessage(from, { text: `⚠️ Error: ${err.message}` }, { quoted: msg }).catch(() => {});
      }
    }
  });
}
