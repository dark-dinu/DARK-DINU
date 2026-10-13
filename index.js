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

// 🛑 Terminal Buffer Hang Filter
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
  console.log(`✨ Successfully loaded ${commands.size} commands & aliases into fast-memory!`);
}

// Next-Gen Cyber Glassmorphism Web Portal
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${CONFIG.BOT_NAME || "DARK-DINU MD"} | Next-Gen Cloud Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --card-bg: rgba(15, 23, 42, 0.65);
      --border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #06b6d4;
      --accent-blue: #3b82f6;
      --accent-emerald: #10b981;
      --text-main: #f8fafc;
      --text-sub: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(6, 182, 212, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(16, 185, 129, 0.05) 0px, transparent 50%);
      color: var(--text-main); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 16px; overflow-x: hidden; position: relative;
    }
    .wrapper { width: 100%; max-width: 440px; position: relative; z-index: 2; }
    .glass-card {
      background: var(--card-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 28px; padding: 40px 28px 32px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px -10px rgba(6, 182, 212, 0.15); position: relative; overflow: hidden;
    }
    .top-badge {
      display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #34d399; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 24px;
    }
    .ping-dot { width: 6px; height: 6px; background: #34d399; border-radius: 50%; box-shadow: 0 0 10px #34d399; animation: pulseDot 2s infinite ease-in-out; }
    @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    .brand-title { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
    .brand-subtitle { font-size: 13px; color: var(--text-sub); line-height: 1.6; margin-bottom: 32px; font-weight: 500; }
    .form-group { text-align: left; margin-bottom: 22px; }
    .input-label { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .input-label span { color: var(--accent-cyan); font-family: 'JetBrains Mono', monospace; font-size: 10px; }
    input { width: 100%; background: rgba(3, 7, 18, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 16px 18px; font-size: 15px; font-family: 'JetBrains Mono', monospace; color: #fff; outline: none; transition: all 0.25s; }
    input:focus { border-color: var(--accent-cyan); background: rgba(3, 7, 18, 0.9); box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.15); }
    .btn-submit { width: 100%; padding: 16px; border-radius: 14px; border: none; background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue)); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 25px -5px rgba(6, 182, 212, 0.4); transition: all 0.25s; }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .result-container { display: none; margin-top: 24px; background: rgba(3, 7, 18, 0.8); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 18px; padding: 22px 18px; }
    .pair-code-display { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #f8fafc; margin: 10px 0 18px; }
    .btn-copy { width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 10px; color: #cbd5e1; font-size: 13px; font-weight: 600; cursor: pointer; }
    .metrics-bar { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-sub); }
    .metric-value { font-family: 'JetBrains Mono', monospace; color: #38bdf8; font-weight: 700; background: rgba(56, 189, 248, 0.1); padding: 3px 10px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="glass-card">
      <div style="text-align: center;">
        <div class="top-badge"><div class="ping-dot"></div>Multi-Device Node v3.5</div>
        <h1 class="brand-title">DARK-DINU MD</h1>
        <p class="brand-subtitle">Automate your WhatsApp ecosystem with ultra-fast cloud linking.</p>
      </div>
      <div class="form-group">
        <label class="input-label"><span>Phone Number</span><span>E.164 Standard</span></label>
        <input type="tel" id="phone" placeholder="e.g. 94712345678" autocomplete="off" required>
      </div>
      <button id="submitBtn" class="btn-submit" onclick="getCode()">Generate Pairing Code</button>
      <div id="resultBox" class="result-container">
        <div style="font-size:10px; color:var(--accent-cyan); font-weight:700;">AUTHENTICATION CODE</div>
        <div id="pairCode" class="pair-code-display">--------</div>
        <button id="copyBtn" class="btn-copy" onclick="copyCode()">Copy Pairing Code</button>
      </div>
      <div class="metrics-bar">
        <span>Active Cloud Instances</span>
        <span class="metric-value">${activeSockets.size} Sockets</span>
      </div>
    </div>
  </div>
  <script>
    async function getCode() {
      const p = document.getElementById('phone').value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('submitBtn');
      const box = document.getElementById('resultBox');
      const codeEl = document.getElementById('pairCode');
      if (!p || p.length < 10) return alert('Enter valid WhatsApp number with country code.');
      btn.innerText = 'Connecting...'; btn.disabled = true;
      try {
        const res = await fetch('/pair?phone=' + p);
        const data = await res.json();
        if (data.code) {
          codeEl.innerText = data.code; box.style.display = 'block'; btn.innerText = 'Code Ready';
        } else { alert(data.error || 'Failed'); btn.innerText = 'Generate Pairing Code'; btn.disabled = false; }
      } catch { alert('Server error'); btn.innerText = 'Generate Pairing Code'; btn.disabled = false; }
    }
    function copyCode() {
      navigator.clipboard.writeText(document.getElementById('pairCode').innerText.replace(/-/g, ''));
      document.getElementById('copyBtn').innerText = '✓ Copied!';
      setTimeout(() => document.getElementById('copyBtn').innerText = 'Copy Pairing Code', 2500);
    }
  </script>
</body>
</html>`);
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
      browser: ["Mac OS", "Safari", "17.0"], // 🛑 Bypass Device Linking Drop Bug
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
            console.log(`🔒 Settings synced & hooked once for: +${currentPhone}`);
          }
        }
      }

      if (connection === "close") {
        activeSockets.delete(sessionId);
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        // Restart Required (515) Handshake Protection
        if (statusCode === DisconnectReason.restartRequired || (statusCode !== DisconnectReason.loggedOut && sock.authState?.creds?.registered)) {
          console.log(`🔄 Session completing handshake / reconnecting: ${sessionId}`);
          setTimeout(() => startBotSocket(sessionId, authCollection), 2500);
          return;
        }

        if (statusCode !== DisconnectReason.loggedOut) {
          console.log(`🔄 Session reconnecting: ${sessionId}`);
          setTimeout(() => startBotSocket(sessionId, authCollection), 5000);
        } else {
          console.log(`❌ Session logged out: ${sessionId}`);
          await clearSession();
        }
      }
    });

    // Attach modular handler
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
  if (!db) return res.status(503).json({ error: "Database initializing. Retry in a few seconds." });

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
    return res.status(500).json({ error: "Pairing code failed. Retry in 5 seconds." });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", activeBots: activeSockets.size });
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
