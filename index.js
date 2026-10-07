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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CONFIG = {
  MONGODB_URI: "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_multi_bots",
  PREFIX: "."
};

const msgRetryCounterCache = new NodeCache();

// Active Bot Sockets Global Store (Commands සඳහා Direct Access සහිතව)
global.activeSockets = global.activeSockets || new Map();
const activeSockets = global.activeSockets;

const commands = new Map();
const replyHandlers = new Map();
let db;

// 1. Dynamic Auto Command Loader
async function loadCommands() {
  const dir = path.join(__dirname, "commands");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  
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

        // Command එකේ interactive reply handler එකක් ඇත්නම් register කිරීම
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

// 2. Web UI (Pairing Portal)
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DARK-DINU MULTI-BOT CLOUD</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
    body { background: radial-gradient(circle at top, #111928, #05070a); color: #f0f6fc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: rgba(22, 27, 34, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(88, 166, 255, 0.2); border-radius: 18px; padding: 32px 24px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 16px 40px rgba(0,0,0,0.8); }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(35, 134, 54, 0.2); border: 1px solid #2ea043; color: #3fb950; font-size: 11px; padding: 4px 12px; border-radius: 20px; font-weight: 700; margin-bottom: 14px; text-transform: uppercase; }
    h2 { font-size: 24px; color: #58a6ff; letter-spacing: 1px; font-weight: 800; }
    p { color: #8b949e; font-size: 13px; margin: 8px 0 24px; line-height: 1.5; }
    .input-group { text-align: left; margin-bottom: 18px; }
    label { display: block; font-size: 11px; color: #8b949e; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
    input { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid #30363d; background: #0d1117; color: #fff; font-size: 15px; outline: none; transition: 0.3s; }
    input:focus { border-color: #58a6ff; box-shadow: 0 0 10px rgba(88,166,255,0.25); }
    button { width: 100%; padding: 14px; border-radius: 10px; border: none; background: linear-gradient(135deg, #238636, #2ea043); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; transition: 0.2s; }
    button:hover { opacity: 0.95; transform: translateY(-1px); }
    .code-box { display: none; margin-top: 20px; padding: 16px; background: #0d1117; border: 1px dashed #238636; border-radius: 12px; }
    .code-box h3 { font-size: 28px; letter-spacing: 6px; color: #3fb950; margin: 10px 0; font-family: monospace; font-weight: bold; }
    .copy-btn { background: #21262d; border: 1px solid #30363d; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #58a6ff; font-weight: 600; }
    .stats { margin-top: 24px; font-size: 12px; color: #8b949e; border-top: 1px solid #21262d; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">● Multi-Bot Engine</span>
    <h2>DARK-DINU PAIRING</h2>
    <p>WhatsApp අංකය යොදා පහසුවෙන් pairing code එක ලබාගන්න.</p>
    <div class="input-group">
      <label>WhatsApp Number (Country Code සහිතව, + රහිතව)</label>
      <input type="text" id="phone" placeholder="947xxxxxxxx" required>
    </div>
    <button id="submitBtn" onclick="getCode()">Get Pairing Code</button>
    <div id="resultBox" class="code-box">
      <div style="font-size: 11px; color: #8b949e; text-transform: uppercase;">YOUR PAIRING CODE</div>
      <h3 id="pairCode">--------</h3>
      <button class="copy-btn" onclick="copyCode()">Copy Code</button>
    </div>
    <div class="stats">
      Active Bots in Cloud: <span style="color:#3fb950; font-weight:bold;">${activeSockets.size}</span>
    </div>
  </div>
  <script>
    async function getCode() {
      const phone = document.getElementById('phone').value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('submitBtn');
      const box = document.getElementById('resultBox');
      const codeEl = document.getElementById('pairCode');

      if (!phone || phone.length < 10) return alert('කරුණාකර නිවැරදි අංකයක් ලබාදෙන්න!');

      btn.innerText = 'Connecting...';
      btn.disabled = true;

      try {
        const res = await fetch('/pair?phone=' + phone);
        const data = await res.json();
        if (data.code) {
          codeEl.innerText = data.code;
          box.style.display = 'block';
          btn.innerText = 'Code Received!';
        } else {
          alert(data.error || 'දෝෂයක් ඇති විය!');
          btn.innerText = 'Get Pairing Code';
          btn.disabled = false;
        }
      } catch {
        alert('Server error! මඳ වේලාවකින් නැවත උත්සාහ කරන්න.');
        btn.innerText = 'Get Pairing Code';
        btn.disabled = false;
      }
    }
    function copyCode() {
      const code = document.getElementById('pairCode').innerText.replace(/-/g, '');
      navigator.clipboard.writeText(code);
      alert('Copied: ' + code);
    }
  </script>
</body>
</html>`);
});

// 3. Central Socket Launcher & Universal Handler
async function startBotSocket(sessionId, authCollection) {
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
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        console.log(`[*] Reconnecting: ${sessionId}`);
        setTimeout(() => startBotSocket(sessionId, authCollection), 3000);
      } else {
        console.log(`[-] Logged out: ${sessionId}`);
        await authCollection.drop().catch(() => {});
      }
    }
  });

  // Universal Message Processor (Owner, Members & Users Supported)
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

    const quotedStanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

    // Interactive Reply Handlers පරීක්ෂාව
    if (quotedStanzaId) {
      for (const [, handler] of replyHandlers) {
        try {
          const handled = await handler({ sock, msg, from, body, quotedStanzaId, config: CONFIG });
          if (handled) return;
        } catch (e) {
          console.error("[Reply Handler Error]:", e);
        }
      }
    }

    // Command Parsing
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
        console.error(`[!] Command error [${cmdName}]:`, err);
        await sock.sendMessage(from, { text: "❌ Command execution error!" }, { quoted: msg });
      }
    }
  });

  return sock;
}

// 4. Pairing Endpoint
app.get("/pair", async (req, res) => {
  let phone = req.query.phone?.replace(/[^0-9]/g, "");
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  const sessionId = `bot_${phone}`;
  try {
    const authCollection = db.collection(sessionId);
    await authCollection.drop().catch(() => {});

    const sock = await startBotSocket(sessionId, authCollection);
    await delay(3000);

    const code = await sock.requestPairingCode(phone);
    return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
  } catch (err) {
    console.error(`Pairing failed for ${phone}:`, err);
    return res.status(500).json({ error: "Pairing code failed. Retry in 5 seconds." });
  }
});

// 5. Server Run
app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);
  try {
    await loadCommands();
    const client = new MongoClient(CONFIG.MONGODB_URI);
    await client.connect();
    db = client.db(CONFIG.DB_NAME);
    console.log("MongoDB Connected Successfully!");

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("bot_")) {
        console.log(`Auto-starting: ${col.name}`);
        startBotSocket(col.name, db.collection(col.name));
      }
    }
  } catch (err) {
    console.error("MongoDB Error:", err);
  }
});
