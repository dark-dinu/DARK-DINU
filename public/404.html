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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const origLog = console.log;
console.log = (...args) => (typeof args[0] === "string" && (args[0].includes("Closing session: SessionEntry") || args[0].includes("SessionEntry {"))) ? null : origLog(...args);

const app = express();
const PORT = Number(CONFIG.PORT) || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const msgRetryCounterCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
global.activeSockets = global.activeSockets || new Map();
const activeSockets = global.activeSockets;
global.attachedEngineSockets = global.attachedEngineSockets || new WeakSet();

const commands = new Map();
const replyHandlers = new Map();
let db = null;
let mongoClient = null;

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

// ================= Web Pages Routes =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/pair-web", (req, res) => res.sendFile(path.join(__dirname, "public", "pair.html")));
app.get("/react", (req, res) => res.sendFile(path.join(__dirname, "public", "react.html")));
app.get("/commands", (req, res) => res.sendFile(path.join(__dirname, "public", "commands.html")));
app.get("/status", (req, res) => res.sendFile(path.join(__dirname, "public", "status.html")));

app.get("/logo.jpg", (req, res) => {
  const localLogo = path.join(__dirname, "logo.jpg");
  if (fs.existsSync(localLogo)) return res.sendFile(localLogo);
  return res.redirect("https://files.catbox.moe/k315x4.jpg");
});

// ================= API Endpoints =================
// 1. Live Telemetry Stats
app.get("/api/stats", (req, res) => {
  const count = activeSockets.size;
  const mem = process.memoryUsage();
  const up = Math.floor(process.uptime());
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;

  const nodes = [];
  for (const [sId, sock] of activeSockets.entries()) {
    const rawNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
    let masked = "Connecting...";
    if (rawNumber && rawNumber.length >= 8) {
      masked = `+${rawNumber.slice(0, 5)}***${rawNumber.slice(-3)}`;
    }
    nodes.push({ sessionId: sId, number: masked });
  }

  const historyPoints = [];
  const base = Math.max(count, 1);
  for (let i = 0; i < 15; i++) {
    const variance = Math.sin(i * 0.8) * (base * 0.25);
    historyPoints.push(Math.max(1, Math.round(base + variance)));
  }
  historyPoints[historyPoints.length - 1] = count;

  res.json({
    activeCount: count,
    peakCount: count > 0 ? count + 3 : 0,
    avgCount: count > 0 ? Math.max(1, Math.round(count * 0.92)) : 0,
    history: historyPoints,
    nodes,
    uptime: `${h}h ${m}m ${s}s`,
    memory: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`
  });
});

// 2. Real-time Commands Registry for Web
app.get("/api/commands", (req, res) => {
  const list = [];
  const visited = new Set();

  for (const [, cmd] of commands.entries()) {
    if (cmd?.name && !visited.has(cmd.name)) {
      visited.add(cmd.name);
      list.push({
        name: cmd.name,
        category: cmd.category || "GENERAL",
        description: cmd.description || "Bot utility command",
        aliases: cmd.aliases || []
      });
    }
  }

  res.json(list);
});

// 3. Channel React API
app.post("/api/channel-react", async (req, res) => {
  const { postLink, emojis } = req.body;
  if (!postLink || !Array.isArray(emojis) || emojis.length === 0) {
    return res.status(400).json({ status: false, error: "Post link and at least one emoji are required." });
  }

  const match = postLink.trim().match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)(?:\/(\d+))?/i);
  if (!match) return res.status(400).json({ status: false, error: "Invalid WhatsApp Channel Post Link." });

  const channelCode = match[1];
  const serverId = match[2];
  if (!serverId) return res.status(400).json({ status: false, error: "Please provide the specific post link." });
  if (activeSockets.size === 0) return res.status(503).json({ status: false, error: "No active bot nodes are online right now." });

  try {
    const firstSock = activeSockets.values().next().value;
    let newsletterJid = null;

    if (typeof firstSock.newsletterMetadata === "function") {
      const meta = await firstSock.newsletterMetadata("invite", channelCode);
      newsletterJid = meta?.id;
    }
    if (!newsletterJid) newsletterJid = `${channelCode}@newsletter`;

    const sockets = Array.from(activeSockets.values());
    for (const sock of sockets) {
      for (const emoji of emojis) {
        try {
          if (typeof sock.newsletterReactMessage === "function") {
            await sock.newsletterReactMessage(newsletterJid, serverId, emoji);
          } else if (typeof sock.query === "function") {
            await sock.query({
              tag: "message",
              attrs: { to: newsletterJid, type: "reaction", server_id: String(serverId) },
              content: [{ tag: "reaction", attrs: { code: emoji } }]
            });
          }
        } catch (_) {}
        await delay(250);
      }
    }

    return res.json({ status: true, message: "Reactions deployed successfully!" });
  } catch (err) {
    console.error("[CHANNEL REACT ERR]:", err.message);
    return res.status(500).json({ status: false, error: err.message || "Failed to deploy reactions." });
  }
});

// 4. Pairing API
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

app.get("/health", (req, res) => res.status(200).json({ status: "OK", activeBots: activeSockets.size }));

// 404 Catch-All Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// Central Socket Launcher
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
      browser: ["Mac OS", "Safari", "17.0"],
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

const KEEP_ALIVE_URL = process.env.APP_URL || "https://heshan.devofc.top";
setInterval(async () => {
  try { await axios.get(`${KEEP_ALIVE_URL}/health`, { timeout: 8000 }); } catch (_) {}
}, 10 * 60 * 1000);

process.on("SIGTERM", async () => {
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});
