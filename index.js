import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  delay
} from "@whiskeysockets/baileys";
import { MongoClient } from "mongodb";
import pino from "pino";
import NodeCache from "node-cache";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { useMongoDBAuthState } from "./auth.js";
import CONFIG from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(CONFIG.PORT) || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Active Bot Sockets Global Store
global.activeSockets = global.activeSockets || new Map();
const activeSockets = global.activeSockets;

const commands = new Map();
const replyHandlers = new Map();
let db = null;
let mongoClient = null;

// 1. Dynamic Auto Command Loader
async function loadCommands() {
  const dir = path.join(__dirname, "commands");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  commands.clear();
  replyHandlers.clear();

  for (const file of files) {
    try {
      const mod = await import(`${pathToFileURL(path.join(dir, file)).href}?t=${Date.now()}`);
      const cmd = mod.default;
      if (cmd?.name) {
        commands.set(cmd.name.toLowerCase(), cmd);
        cmd.aliases?.forEach((a) => commands.set(a.toLowerCase(), cmd));

        if (typeof cmd.onReply === "function") {
          replyHandlers.set(cmd.name.toLowerCase(), cmd.onReply);
        }
      }
    } catch (e) {
      console.error(`[!] Failed loading ${file}:`, e.message);
    }
  }
  console.log(`[+] Auto-loaded ${commands.size} commands/aliases into memory.`);
}

// 2. Next-Gen Cyber Glassmorphism Web Portal
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
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(6, 182, 212, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(16, 185, 129, 0.05) 0px, transparent 50%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 16px;
      overflow-x: hidden;
      position: relative;
    }
    /* Grid Mesh Overlay */
    body::before {
      content: "";
      position: absolute;
      inset: 0;
      background-size: 32px 32px;
      background-image: linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      pointer-events: none;
      z-index: 1;
    }
    .wrapper {
      width: 100%;
      max-width: 440px;
      position: relative;
      z-index: 2;
    }
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 28px;
      padding: 40px 28px 32px;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7),
                  0 0 40px -10px rgba(6, 182, 212, 0.15);
      position: relative;
      overflow: hidden;
    }
    .glass-card::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent);
    }
    .top-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      color: #34d399;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .ping-dot {
      width: 6px;
      height: 6px;
      background: #34d399;
      border-radius: 50%;
      box-shadow: 0 0 10px #34d399;
      animation: pulseDot 2s infinite ease-in-out;
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .brand-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .brand-subtitle {
      font-size: 13px;
      color: var(--text-sub);
      line-height: 1.6;
      margin-bottom: 32px;
      font-weight: 500;
    }
    .form-group {
      text-align: left;
      margin-bottom: 22px;
    }
    .input-label {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .input-label span {
      color: var(--accent-cyan);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
    }
    .input-box {
      position: relative;
    }
    input {
      width: 100%;
      background: rgba(3, 7, 18, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 16px 18px;
      font-size: 15px;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
      outline: none;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    input:focus {
      border-color: var(--accent-cyan);
      background: rgba(3, 7, 18, 0.9);
      box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.15);
    }
    input::placeholder {
      color: #475569;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .btn-submit {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.03em;
      cursor: pointer;
      box-shadow: 0 10px 25px -5px rgba(6, 182, 212, 0.4);
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }
    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px -5px rgba(6, 182, 212, 0.5);
    }
    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    /* Pairing Display Box */
    .result-container {
      display: none;
      margin-top: 24px;
      background: rgba(3, 7, 18, 0.8);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 18px;
      padding: 22px 18px;
      animation: fadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .code-tag {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent-cyan);
      font-weight: 700;
      margin-bottom: 8px;
    }
    .pair-code-display {
      font-family: 'JetBrains Mono', monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #f8fafc;
      margin: 10px 0 18px;
      text-shadow: 0 0 25px rgba(6, 182, 212, 0.4);
    }
    .btn-copy {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px;
      border-radius: 10px;
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    /* Stats Bar */
    .metrics-bar {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-sub);
    }
    .metric-value {
      font-family: 'JetBrains Mono', monospace;
      color: #38bdf8;
      font-weight: 700;
      background: rgba(56, 189, 248, 0.1);
      padding: 3px 10px;
      border-radius: 6px;
    }
    .footer-credits {
      margin-top: 22px;
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }
    .footer-credits span {
      color: #cbd5e1;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="glass-card">
      <div style="text-align: center;">
        <div class="top-badge">
          <div class="ping-dot"></div>
          Multi-Device Node v3.0
        </div>
        <h1 class="brand-title">DARK-DINU MD</h1>
        <p class="brand-subtitle">Automate your WhatsApp ecosystem effortlessly with ultra-fast cloud linking.</p>
      </div>

      <div class="form-group">
        <label class="input-label">
          <span>Phone Number</span>
          <span>E.164 Standard</span>
        </label>
        <div class="input-box">
          <input type="tel" id="phone" placeholder="e.g. 94712345678" autocomplete="off" required>
        </div>
      </div>

      <button id="submitBtn" class="btn-submit" onclick="getCode()">
        Generate Pairing Code
      </button>

      <div id="resultBox" class="result-container">
        <div class="code-tag">Authentication Code</div>
        <div id="pairCode" class="pair-code-display">--------</div>
        <button id="copyBtn" class="btn-copy" onclick="copyCode()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy Pairing Code
        </button>
      </div>

      <div class="metrics-bar">
        <span>Active Cloud Instances</span>
        <span class="metric-value">${activeSockets.size} Sockets</span>
      </div>
    </div>

    <div class="footer-credits" style="text-align: center;">
      Architected & Maintained by <span>Dinidu Heshan</span>
    </div>
  </div>

  <script>
    async function getCode() {
      const phoneInput = document.getElementById('phone');
      const phone = phoneInput.value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('submitBtn');
      const box = document.getElementById('resultBox');
      const codeEl = document.getElementById('pairCode');

      if (!phone || phone.length < 10) {
        return alert('Please enter a valid WhatsApp number including country code (without + sign).');
      }

      btn.innerText = 'Establishing Connection...';
      btn.disabled = true;

      try {
        const res = await fetch('/pair?phone=' + phone);
        const data = await res.json();
        
        if (data.code) {
          codeEl.innerText = data.code;
          box.style.display = 'block';
          btn.innerText = 'Pairing Code Active';
          box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          alert(data.error || 'Connection failed. Please retry.');
          btn.innerText = 'Generate Pairing Code';
          btn.disabled = false;
        }
      } catch {
        alert('Server unreachable. Please verify network and retry.');
        btn.innerText = 'Generate Pairing Code';
        btn.disabled = false;
      }
    }

    function copyCode() {
      const code = document.getElementById('pairCode').innerText.replace(/-/g, '');
      const copyBtn = document.getElementById('copyBtn');
      navigator.clipboard.writeText(code);
      copyBtn.innerHTML = '✓ Code Copied to Clipboard!';
      setTimeout(() => {
        copyBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy Pairing Code';
      }, 2500);
    }
  </script>
</body>
</html>`);
});

// 3. Central Socket Launcher & Universal Handler
async function startBotSocket(sessionId, authCollection) {
  try {
    const { state, saveCreds } = await useMongoDBAuthState(authCollection);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      msgRetryCounterCache,
      browser: Browsers.ubuntu("Chrome"),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: true,
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        console.log(`[+] Bot connected: ${sessionId}`);
        activeSockets.set(sessionId, sock);
      }
      if (connection === "close") {
        activeSockets.delete(sessionId);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode !== DisconnectReason.loggedOut) {
          console.log(`[*] Reconnecting: ${sessionId}`);
          setTimeout(() => startBotSocket(sessionId, authCollection), 3000);
        } else {
          console.log(`[-] Logged out: ${sessionId}`);
          await authCollection.drop().catch(() => {});
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      const msg = messages[0];
      if (!msg?.message) return;

      const from = msg.key.remoteJid;
      if (from === "status@broadcast") return;

      const isGroup = from.endsWith("@g.us");
      const sender = isGroup
        ? (msg.key.participant || msg.participant || from)
        : (msg.key.fromMe ? (sock.user?.id || from) : from);

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      const quotedStanzaId =
        msg.message?.extendedTextMessage?.contextInfo?.stanzaId ||
        msg.message?.imageMessage?.contextInfo?.stanzaId;

      if (quotedStanzaId) {
        for (const [, handler] of replyHandlers) {
          try {
            const handled = await handler({ sock, msg, from, body, quotedStanzaId, config: CONFIG });
            if (handled) return;
          } catch (e) {
            console.error("[Reply Handler Error]:", e.message);
          }
        }
      }

      if (!body.startsWith(CONFIG.PREFIX)) return;

      const args = body.slice(CONFIG.PREFIX.length).trim().split(/ +/);
      const cmdName = args.shift().toLowerCase();
      const command = commands.get(cmdName);

      if (command) {
        try {
          await command.execute({
            sock,
            msg,
            from,
            args,
            body,
            sender,
            config: CONFIG,
            activeBotsCount: activeSockets.size,
            commands
          });
        } catch (err) {
          console.error(`[!] Command error [${cmdName}]:`, err.message);
          await sock.sendMessage(from, { text: "❌ Command execution error!" }, { quoted: msg }).catch(() => {});
        }
      }
    });

    return sock;
  } catch (err) {
    console.error(`[Socket Setup Error - ${sessionId}]:`, err.message);
    return null;
  }
}

// 4. Pairing Endpoint
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", activeBots: activeSockets.size });
});

// 5. Server Run
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[+] Web server listening on port ${PORT}`);

  try {
    await loadCommands();
    mongoClient = new MongoClient(CONFIG.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(CONFIG.DB_NAME);
    console.log("[+] MongoDB Connected Successfully!");

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("bot_")) {
        console.log(`[*] Auto-starting session: ${col.name}`);
        startBotSocket(col.name, db.collection(col.name));
      }
    }
  } catch (err) {
    console.error("[!] Database Startup Error:", err.message);
  }
});

// Graceful Termination
process.on("SIGTERM", async () => {
  console.log("[*] SIGTERM received. Closing active sessions...");
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});
