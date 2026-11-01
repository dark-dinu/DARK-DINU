import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import pino from "pino";
import NodeCache from "node-cache";
import { useMongoDBAuthState } from "../../auth.js";
import { setupMessageHandlers } from "../handlers/messageHandler.js";
import { cleanPhone, initializeSessionState, getSessionConfig } from "./sessionManager.js";
import { attachSettingsEngine } from "../../commands/setting.js";
import { attachChannelAutoReact } from "../engines/autoReactEngine.js";
import { commands, replyHandlers } from "./commandLoader.js";
import { startContinuousNewsDaemon } from "../../commands/news.js";

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
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: false,
      fireInitQueries: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      mediaCache: new NodeCache({ stdTTL: 300, checkperiod: 120 })
    });

    // 🟢 Channel (Newsletter) Delivery Patch
    // Channels (@newsletter) වලට යැවෙන ඕනෑම message එකකින් quoted contexts සහ drop වන payload options ඉවත් කිරීම
    const baseSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options = {}) => {
      const isNewsletter = String(jid).endsWith("@newsletter");
      if (isNewsletter) {
        delete options.quoted;
        delete options.ephemeralExpiration;
        options.broadcast = true;
      }
      return await baseSendMessage(jid, content, options);
    };

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        console.log(`🌸 Bot connected successfully: ${sessionId}`);
        activeSockets.set(sessionId, sock);

        // Auto Engines Initializations
        attachChannelAutoReact(sock, activeSockets);

        // Auto-News Daemon එකට active socket එක pass කිරීම
        try {
          if (typeof startContinuousNewsDaemon === "function") {
            startContinuousNewsDaemon(sock);
          }
        } catch (_) {}

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

    // ==========================================
    // 🛡️ ZERO-LAG ANTI-CALL AUTO-REJECT LISTENER
    // ==========================================
    sock.ev.on("call", async (calls) => {
      try {
        const botPhone = cleanPhone(sock.user?.id || "");
        const cfg = typeof getSessionConfig === "function" ? getSessionConfig(botPhone) : {};

        // Anti-Call සක්‍රීය කර නොමැති නම් reject නොකරයි
        if (!cfg?.anticall) return;

        for (const call of calls) {
          if (call.status === "offer") {
            // Call එක reject කිරීම
            await sock.rejectCall(call.id, call.from);

            // Caller ට warning පණිවිඩය යැවීම
            await sock.sendMessage(call.from, {
              text: 
`⚠️ *AUTOMATED CALL REJECTION SYSTEM* ⚠️

> 🚫 *හේතුව:* මෙම WhatsApp අංකය *DARK-DINU BOT* පද්ධතියක් මඟින් ස්වයංක්‍රීයව පාලනය වේ.
> 📵 කරුණාකර Voice හෝ Video Calls ගැනීමෙන් වළකින්න.

👑 *DARK-DINU MD* • https://heshan.devofc.top/`
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[ANTI-CALL ERROR]:", err.message);
      }
    });

    // Setup Main Router
    setupMessageHandlers({ sock, sessionId, commands, replyHandlers, activeSockets });
    return sock;
  } catch (err) {
    console.error(`[Socket Setup Error - ${sessionId}]:`, err.message);
    return null;
  }
}
