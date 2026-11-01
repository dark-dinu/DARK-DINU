import { cleanPhone } from "./src/core/sessionManager.js";

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
    // Status broadcast පමණක් නවත්වයි, @newsletter (Channels) සඳහා සම්පූර්ණයෙන්ම ඉඩ දේ
    if (!from || from === "status@broadcast") return;

    const isChannel = from.endsWith("@newsletter");
    const isGroup = from.endsWith("@g.us");

    const body = extractMessageBody(msg.message);

    const prefixMatch = body.match(/^[./!#$]/);
    const hasPrefix = Boolean(prefixMatch);
    const usedPrefix = prefixMatch ? prefixMatch[0] : "";
    const commandName = hasPrefix 
      ? body.slice(usedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase() 
      : "";

    const isCommand = Boolean(commandName && commands?.has(commandName));

    if (isCommand) {
      const cmd = commands.get(commandName);
      const args = body.slice(usedPrefix.length + commandName.length).trim().split(/\s+/).filter(Boolean);

      try {
        await cmd.execute({
          sock,
          msg,
          from,
          jid: from,
          args,
          body,
          prefix: usedPrefix,
          command: commandName,
          isChannel,
          isGroup,
          sessionId,
          activeSockets
        });
      } catch (err) {
        console.error(`[COMMAND ERROR - ${commandName}]:`, err.message);
      }
    }
  });
}
