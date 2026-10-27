import { cleanPhone } from "./src/core/sessionManager.js"; // core path එක නිවැරදි කරගන්න

const DEV_WHITELIST = new Set([
  "15947733680169@lid",
  "15947733680169",
  "15947733080169@lid",
  "15947733080169"
]);

const DEV_REACT_EMOJI = "👨🏻‍💻";

// Link Previews, Channels, Buttons ඕනෑම එකකින් Text එක හරියටම ගන්නා කොටස
function extractMessageBody(m) {
  if (!m) return "";
  const msg = m.ephemeralMessage?.message || 
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
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    // 1. Sender හරියටම අඳුරගන්න එක (DM / Group / LID)
    const rawSender = msg.key.fromMe
      ? (sock.user?.id || "")
      : (msg.key.participant || msg.participant || from || "");

    const cleanSender = cleanPhone ? cleanPhone(rawSender) : rawSender.replace(/[^0-9]/g, "");
    const bareSender = rawSender.split("@")[0].split(":")[0];
    const fullNormalizedJid = rawSender.split(":")[0] + (rawSender.includes("@lid") ? "@lid" : (rawSender.includes("@s.whatsapp.net") ? "@s.whatsapp.net" : ""));

    const isDeveloper = (
      DEV_WHITELIST.has(rawSender) ||
      DEV_WHITELIST.has(bareSender) ||
      DEV_WHITELIST.has(cleanSender) ||
      DEV_WHITELIST.has(fullNormalizedJid) ||
      rawSender.includes("15947733680169") ||
      rawSender.includes("15947733080169")
    );

    // 2. Message Body එක Extract කිරීම
    const body = extractMessageBody(msg.message);

    // 3. Prefix & Command Check
    const prefixMatch = body.match(/^[./!#$]/);
    const hasPrefix = Boolean(prefixMatch);
    const usedPrefix = prefixMatch ? prefixMatch[0] : "";
    const commandName = hasPrefix 
      ? body.slice(usedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase() 
      : "";

    const isCommand = Boolean(commandName && commands?.has(commandName));

    // ========================================================
    // 👨🏻‍💻 4. DEVELOPER AUTO-REACT (Zero-Lag)
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
    // 5. COMMAND RUNNER
    // ========================================================
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
          sessionId,
          activeSockets
        });
      } catch (err) {
        console.error(`[COMMAND ERROR - ${commandName}]:`, err.message);
      }
    }
  });
}
