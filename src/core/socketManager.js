import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import pino from "pino";
import NodeCache from "node-cache";
import { useMongoDBAuthState } from "../../auth.js";
import { setupMessageHandlers } from "../handlers/messageHandler.js";
import { cleanPhone, initializeSessionState } from "./sessionManager.js";
import { attachSettingsEngine } from "../../commands/setting.js";
import { attachChannelAutoReact } from "../engines/autoReactEngine.js";
import { commands, replyHandlers } from "./commandLoader.js";

const msgRetryCounterCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
export const activeSockets = global.activeSockets || new Map();
global.activeSockets = activeSockets;
global.attachedEngineSockets = global.attachedEngineSockets || new WeakSet();

export async function startBotSocket(sessionId, authCollection) {
  try {
    const { state, saveCreds, clearSession } = await useMongoDBAuthState(authCollection);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "fatal" }),
      printQRInTerminal: false,
      msgRetryCounterCache,
      browser: ["Ubuntu", "Chrome", "122.0.0.0"],
      connectTimeoutMs: 45000,
      defaultQueryTimeoutMs: 45000,
      keepAliveIntervalMs: 20000,
      emitOwnEvents: false,
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        console.log(`🌸 Bot connected successfully: ${sessionId}`);
        activeSockets.set(sessionId, sock);

        attachChannelAutoReact(sock, activeSockets);

        const currentPhone = cleanPhone(sock.user?.id || "");
        if (currentPhone) {
          await initializeSessionState(currentPhone);
          if (!global.attachedEngineSockets.has(sock)) {
            global.attachedEngineSockets.add(sock);
            attachSettingsEngine(sock);
          }
        }
      }

      if (connection === "close") {
        activeSockets.delete(sessionId);
        const code = lastDisconnect?.error?.output?.statusCode;

        if (
          code === DisconnectReason.restartRequired ||
          (code !== DisconnectReason.loggedOut && sock.authState?.creds?.registered)
        ) {
          setTimeout(() => startBotSocket(sessionId, authCollection), 2000);
          return;
        }

        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => startBotSocket(sessionId, authCollection), 4000);
        } else {
          console.log(`❌ Session logged out: ${sessionId}`);
          await clearSession();
        }
      }
    });

    setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets });
    return sock;
  } catch (err) {
    console.error(`[Socket Setup Error - ${sessionId}]:`, err.message);
    return null;
  }
}
