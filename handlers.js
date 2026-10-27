import { cleanPhone } from "../core/sessionManager.js";

// Developer Whitelist (Raw Numbers & LIDs)
const DEV_WHITELIST = new Set([
  "15947733680169@lid",
  "15947733680169",
  "15947733080169@lid",
  "15947733080169"
]);

// Developer Designated Custom Reaction
const DEV_REACT_EMOJI = "👨🏻‍💻";

export function setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets }) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    // 1. Identify Sender safely across DM, Groups, Channels & LIDs
    const rawSender = msg.key.fromMe
      ? (sock.user?.id || "")
      : (msg.key.participant || msg.participant || from || "");

    const cleanSender = cleanPhone(rawSender);
    const bareSender = rawSender.split("@")[0].split(":")[0];
    const fullNormalizedJid = rawSender.split(":")[0] + (rawSender.includes("@lid") ? "@lid" : (rawSender.includes("@s.whatsapp.net") ? "@s.whatsapp.net" : ""));

    // Robust Developer Check (Matches any format WhatsApp passes)
    const isDeveloper = (
      DEV_WHITELIST.has(rawSender) ||
      DEV_WHITELIST.has(bareSender) ||
      DEV_WHITELIST.has(cleanSender) ||
      DEV_WHITELIST.has(fullNormalizedJid) ||
      rawSender.includes("15947733680169") ||
      rawSender.includes("15947733080169")
    );

    // 2. Extract Message Text (Handles ephemeral, view-once, link previews)
    const unwrap = (
      msg.message.ephemeralMessage?.message ||
      msg.message.viewOnceMessage?.message ||
      msg.message.viewOnceMessageV2?.message ||
      msg.message.documentWithCaptionMessage?.message ||
      msg.message
    );

    const body = (
      unwrap.conversation ||
      unwrap.extendedTextMessage?.text ||
      unwrap.imageMessage?.caption ||
      unwrap.videoMessage?.caption ||
      unwrap.documentMessage?.caption ||
      unwrap.extendedTextMessage?.matchedText ||
      ""
    ).trim();

    // 3. Command Resolution (Prefixes: . ! # / $)
    const prefixMatch = body.match(/^[./!#$]/);
    const hasPrefix = Boolean(prefixMatch);
    const usedPrefix = prefixMatch ? prefixMatch[0] : "";
    const commandName = hasPrefix 
      ? body.slice(usedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase() 
      : "";

    const isCommand = Boolean(commandName && commands.has(commandName));

    // ========================================================
    // 👨🏻‍💻 4. DEVELOPER AUTO-REACT ENGINE (Zero-Lag & Non-Blocking)
    // ========================================================
    if (isDeveloper && !hasPrefix && !isCommand && body.length > 0) {
      sock.sendMessage(from, {
        react: {
          text: DEV_REACT_EMOJI,
          key: msg.key
        }
      }).catch(() => {});
    }

    // ========================================================
    // 5. COMMAND EXECUTION PIPELINE
    // ========================================================
    if (isCommand) {
      const cmd = commands.get(commandName);
      const args = body.slice(usedPrefix.length + commandName.length).trim().split(/\s+/).filter(Boolean);

      try {
        await cmd.execute({
          sock,
          msg,
          from,
          jid: from, // Channel commands වලට අවශ්‍ය fallback key එක
          args,
          body,
          prefix: usedPrefix,
          command: commandName,
          sessionId,
          activeSockets
        });
      } catch (err) {
        console.error(`[COMMAND ERROR - ${commandName}]:`, err.message);
      }
    }
  });
}
