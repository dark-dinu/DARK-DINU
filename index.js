import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} from "@whiskeysockets/baileys";
import { MongoClient } from "mongodb";
import pino from "pino";
import NodeCache from "node-cache";
import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath, pathToFileURL } from "url";
import { useMongoDBAuthState } from "./auth.js";
import { setupMessageHandlers } from "./handlers.js";
import CONFIG from "./config.js";
import { cleanPhone, initializeSessionState } from "./core/sessionManager.js";
import { attachSettingsEngine } from "./commands/setting.js";
import { renderDashboardHtml } from "./dashboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Terminal noise filter
const origLog = console.log;
console.log = (...args) => (typeof args[0] === "string" && (args[0].includes("Closing session: SessionEntry") || args[0].includes("SessionEntry {"))) ? null : origLog(...args);

const app = express();
const PORT = Number(CONFIG.PORT) || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const msgRetryCounterCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
global.activeSockets = global.activeSockets || new Map();
const activeSockets = global.activeSockets;
global.attachedEngineSockets = global.attachedEngineSockets || new WeakSet();

const commands = new Map();
const replyHandlers = new Map();
let db = null;
let mongoClient = null;

// Dynamic Command Loader
async function loadCommands() {
  const dir = path.join(__dirname, "commands");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  commands.clear();
  replyHandlers.clear();

  for (const file of files) {
    try {
      const mod = await import(`${pathToFileURL(path.join(dir, file)).href}?t=${Date.now()}`);
      const cmd = mod.default || mod;
      if (cmd?.name) {
        commands.set(cmd.name.toLowerCase(), cmd);
        if (Array.isArray(cmd.aliases)) cmd.aliases.forEach(a => commands.set(a.toLowerCase(), cmd));
        if (typeof cmd.onReply === "function") replyHandlers.set(cmd.name.toLowerCase(), cmd.onReply);
      }
    } catch (e) {
      console.error(`[!] Failed loading ${file}:`, e.message);
    }
  }
  console.log(`✨ Loaded ${commands.size} commands & aliases into fast-memory!`);
}

// ================= Web Routes =================
app.get("/", (req, res) => {
  res.send(renderDashboardHtml(CONFIG.BOT_NAME));
});

app.get("/api/stats", (req, res) => {
  const mem = process.memoryUsage();
  const up = Math.floor(process.uptime());
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;

  const nodes = [];
  for (const [sId, sock] of activeSockets.entries()) {
    const rawNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
    nodes.push({ sessionId: sId, number: rawNumber ? `+${rawNumber}` : "Connecting..." });
  }

  res.json({
    activeCount: activeSockets.size,
    nodes,
    commandsCount: commands.size,
    uptime: `${h}h ${m}m ${s}s`,
    memory: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", activeBots: activeSockets.size });
});

// ================= Central Socket Launcher =================
async function startBotSocket(sessionId, authCollection) {
  try {
    const { state, saveCreds, clearSession } = await useMongoDBAuthState(authCollection);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "fatal" }),
      printQRInTerminal: false,
      msgRetryCounterCache,
      browser: ["Mac OS", "Safari", "17.0"], // Safari Pairing Handshake
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: false,
      fireInitQueries: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        console.log(`🌸 Bot connected successfully: ${sessionId}`);
        activeSockets.set(sessionId, sock);

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

        // Restart Required (515) Handshake Reconnect
        if (code === DisconnectReason.restartRequired || (code !== DisconnectReason.loggedOut && sock.authState?.creds?.registered)) {
          setTimeout(() => startBotSocket(sessionId, authCollection), 2500);
          return;
        }

        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => startBotSocket(sessionId, authCollection), 5000);
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

// Pairing Endpoint
app.get("/pair", async (req, res) => {
  let phone = req.query.phone?.replace(/[^0-9]/g, "");
  if (!phone) return res.status(400).json({ error: "Phone number required" });
  if (!db) return res.status(503).json({ error: "Database initializing. Retry shortly." });

  const sessionId = `bot_${phone}`;
  try {
    const authCollection = db.collection(sessionId);
    await authCollection.drop().catch(() => {});

    const sock = await startBotSocket(sessionId, authCollection);
    if (!sock) throw new Error("Socket initialization failed");

    await delay(3000);
    const code = await sock.requestPairingCode(phone);
    return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
  } catch (err) {
    console.error(`Pairing failed for ${phone}:`, err.message);
    return res.status(500).json({ error: "Pairing code failed. Retry in 5s." });
  }
});

// Server Boot & DB Multi-Session Wakeup
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Dark-Dinu Cloud Engine running on port ${PORT}`);
  try {
    await loadCommands();
    mongoClient = new MongoClient(CONFIG.MONGODB_URI, { maxPoolSize: 50, minPoolSize: 5 });
    await mongoClient.connect();
    db = mongoClient.db(CONFIG.DB_NAME);
    global.mongoClient = mongoClient;
    global.mongoDbInstance = db;
    console.log("🍃 MongoDB database connected successfully!");

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("bot_") && col.name !== "bot_sessions_v2") {
        console.log(`⚡ Waking up active session: ${col.name}`);
        startBotSocket(col.name, db.collection(col.name));
        await delay(3500);
      }
    }
  } catch (err) {
    console.error("❌ Database Startup Error:", err.message);
  }
});

// Keep-Alive
const KEEP_ALIVE_URL = process.env.APP_URL || "https://heshan.devofc.top";
setInterval(async () => {
  try { await axios.get(`${KEEP_ALIVE_URL}/health`, { timeout: 8000 }); } catch (_) {}
}, 10 * 60 * 1000);

process.on("SIGTERM", async () => {
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});
