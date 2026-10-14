import CONFIG from "./config.js";
import { getSessionConfig } from "./core/sessionManager.js";

export function extractMessageBody(m) {
  if (!m) return "";
  const msg = m.ephemeralMessage?.message || m.viewOnceMessageV2?.message || m.viewOnceMessage?.message || m.documentWithCaptionMessage?.message || m;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.templateButtonReplyMessage?.selectedId ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ""
  ).trim();
}

export function setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets }) {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" || !messages || !messages[0]) return;
    const msg = messages[0];
    if (!msg?.message || msg.message?.protocolMessage || msg.message?.reactionMessage) return;

    const from = msg.key.remoteJid;
    if (!from) return;

    const botJid = sock.user?.id || "";
    const botPhone = botJid.split(":")[0].replace(/[^0-9]/g, "");
    const isFromMe = Boolean(msg.key.fromMe);
    const sessionConfig = getSessionConfig(botPhone);

    // ==========================================
    // 🎭 FAKE TYPING & RECORDING SIMULATION
    // ==========================================
    if (!isFromMe && from !== "status@broadcast") {
      if (sessionConfig.fakeTyping) {
        sock.sendPresenceUpdate("composing", from).catch(() => {});
      } else if (sessionConfig.fakeRecording) {
        sock.sendPresenceUpdate("recording", from).catch(() => {});
      } else if (sessionConfig.alwaysOnline) {
        sock.sendPresenceUpdate("available", from).catch(() => {});
      }
    }

    // 1. Auto Status Seen & React
    if (from === "status@broadcast") {
      if (isFromMe) return;
      if (sessionConfig.statusSeen || CONFIG.AUTO_STATUS_SEEN) {
        try {
          await sock.readMessages([msg.key]);
          const participant = msg.key.participant || msg.participant;
          if (participant && (sessionConfig.statusReact || CONFIG.AUTO_REACT)) {
            const emojis = ["💖", "✨", "🔥", "⚡", "🤍", "🥀"];
            const emoji = sessionConfig.statusEmoji || emojis[Math.floor(Math.random() * emojis.length)];
            setTimeout(() => {
              sock.sendMessage("status@broadcast", {
                react: {
                  text: emoji,
                  key: { remoteJid: "status@broadcast", id: msg.key.id, participant, fromMe: false }
                }
              }, { statusJidList: [participant] }).catch(() => {});
            }, 2000);
          }
        } catch (_) {}
      }
      return;
    }

    const body = extractMessageBody(msg.message);
    if (!body) return;

    const quotedStanzaId =
      msg.message?.extendedTextMessage?.contextInfo?.stanzaId ||
      msg.message?.imageMessage?.contextInfo?.stanzaId ||
      msg.message?.videoMessage?.contextInfo?.stanzaId;

    // 2. Interactive Reply Handlers
    if (quotedStanzaId && replyHandlers.size > 0) {
      queueMicrotask(async () => {
        for (const [, handler] of replyHandlers) {
          try {
            const handled = await handler({ sock, msg, from, body, quotedStanzaId, config: CONFIG });
            if (handled) return;
          } catch (e) {
            console.error("[Reply Handler Error]:", e.message);
          }
        }
      });
    }

    // 3. Command Parsing & Dispatch
    const prefix = CONFIG.PREFIX || ".";
    if (!body.startsWith(prefix)) return;

    const isGroup = from.endsWith("@g.us");
    const sender = isGroup
      ? (msg.key.participant || msg.participant || from)
      : (isFromMe ? `${botPhone}@s.whatsapp.net` : from);

    const cleanSender = String(sender).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
    const isOwner = isFromMe || cleanSender === botPhone || (CONFIG.OWNER_NUMBERS && CONFIG.OWNER_NUMBERS.includes(cleanSender));

    // Mode Barrier
    const currentMode = sessionConfig.mode || CONFIG.MODE || "public";
    if (!isOwner) {
      if (currentMode === "private" && isGroup) return;
      if (currentMode === "group" && !isGroup) return;
    }

    const args = body.slice(prefix.length).trim().split(/ +/);
    const cmdName = args.shift()?.toLowerCase();
    if (!cmdName) return;

    const command = commands.get(cmdName);
    if (command) {
      queueMicrotask(async () => {
        try {
          // Command එක run වෙද්දී fake status refresh කිරීම
          if (sessionConfig.fakeTyping) {
            sock.sendPresenceUpdate("composing", from).catch(() => {});
          } else if (sessionConfig.fakeRecording) {
            sock.sendPresenceUpdate("recording", from).catch(() => {});
          }

          await command.execute({
            sock,
            msg,
            from,
            args,
            body,
            sender,
            config: CONFIG,
            prefix,
            sessionId,
            activeBotsCount: activeSockets.size,
            commands
          });
        } catch (err) {
          console.error(`[Command Error - ${cmdName}]:`, err.message);
          await sock.sendMessage(
            from,
            { text: `✨ *Oopsie!* Something went wrong.\n_Error: ${err.message || "Execution error"}_` },
            { quoted: msg }
          ).catch(() => {});
        }
      });
    }
  });
}
