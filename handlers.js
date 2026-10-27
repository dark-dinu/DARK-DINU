import { cleanPhone } from "../core/sessionManager.js";

// Developer Whitelist (LID & Phone JIDs)
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

    // 1. Extract sender information safely
    const senderJid = msg.key.fromMe
      ? (sock.user?.id || "")
      : (msg.key.participant || msg.participant || from || "");

    const cleanSender = cleanPhone(senderJid);
    const rawLid = senderJid.split(":")[0];

    // Check Developer status (O(1) Memory lookup - Zero Lag)
    const isDeveloper = (
      DEV_WHITELIST.has(senderJid) ||
      DEV_WHITELIST.has(rawLid) ||
      DEV_WHITELIST.has(cleanSender)
    );

    // 2. Extract Message Text
    const body = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      ""
    ).trim();

    // 3. Command Check (Prefixes: . ! # / $)
    const prefixMatch = body.match(/^[./!#$]/);
    const hasPrefix = Boolean(prefixMatch);
    const usedPrefix = prefixMatch ? prefixMatch[0] : "";
    const commandName = hasPrefix 
      ? body.slice(usedPrefix.length).trim().split(/\s+/)[0]?.toLowerCase() 
      : "";

    const isCommand = Boolean(commandName && commands.has(commandName));

    // ========================================================
    // 👨🏻‍💻 4. ZERO-RISK DEVELOPER AUTO-REACT ENGINE
    // ========================================================
    // Developer සාමාන්‍ය මැසේජ් එකක් දැමූ විට පමණක් 👨🏻‍💻 reaction එක වැටේ.
    // Command එකක් ක්‍රියාත්මක කළහොත් මෙම කොටස සම්පූර්ණයෙන්ම bypass වේ.
    if (isDeveloper && !hasPrefix && !isCommand && body.length > 0) {
      // Non-blocking background dispatch (Speed එකට 0% බලපෑමක් ඇත)
      sock.sendMessage(from, {
        react: {
          text: DEV_REACT_EMOJI,
          key: msg.key
        }
      }).catch(() => {});
    }

    // ========================================================
    // 5. REGULAR COMMAND EXECUTION
    // ========================================================
    if (isCommand) {
      const cmd = commands.get(commandName);
      const args = body.slice(usedPrefix.length + commandName.length).trim().split(/\s+/).filter(Boolean);

      try {
        await cmd.execute({
          sock,
          msg,
          from,
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
