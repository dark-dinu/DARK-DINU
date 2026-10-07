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
import { useMongoDBAuthState } from "./auth.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Special character '#' encoded as '%23' to prevent auth crash
const CONFIG = {
  MONGODB_URI: "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_multi_bots",
  PREFIX: "."
};

const msgRetryCounterCache = new NodeCache();
const activeSockets = new Map();
let db;

// Pairing Web UI
app.get("/", async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DARK-DINU MULTI-BOT CLOUD</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #080c10; color: #f0f6fc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 14px; padding: 28px; width: 100%; max-width: 440px; text-align: center; box-shadow: 0 12px 32px rgba(0,0,0,0.6); }
        .badge { display: inline-block; background: #238636; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 12px; margin-bottom: 12px; font-weight: 600; text-transform: uppercase; }
        h2 { font-size: 22px; color: #58a6ff; margin-bottom: 6px; }
        p { color: #8b949e; font-size: 13px; margin-bottom: 22px; line-height: 1.4; }
        .input-group { text-align: left; margin-bottom: 18px; }
        label { display: block; font-size: 12px; color: #8b949e; margin-bottom: 6px; font-weight: 500; }
        input { width: 100%; padding: 13px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; color: #fff; font-size: 15px; outline: none; }
        input:focus { border-color: #58a6ff; }
        button { width: 100%; padding: 13px; border-radius: 8px; border: none; background: #238636; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        button:hover { background: #2ea043; }
        .code-box { display: none; margin-top: 20px; padding: 16px; background: #0d1117; border: 1px solid #238636; border-radius: 10px; }
        .code-box h3 { font-size: 26px; letter-spacing: 5px; color: #3fb950; margin: 8px 0; font-family: monospace; }
        .copy-btn { background: #21262d; border: 1px solid #30363d; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #58a6ff; }
        .stats { margin-top: 22px; font-size: 12px; color: #8b949e; border-top: 1px solid #21262d; padding-top: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">Multi-Bot Engine</span>
        <h2>DARK-DINU PAIRING</h2>
        <p>WhatsApp අංකය ඇතුළත් කර Pairing Code එක ලබාගන්න.</p>
        
        <div class="input-group">
          <label>WhatsApp Number (Country Code සමඟ, + නැතුව)</label>
          <input type="text" id="phone" placeholder="947xxxxxxxx" required>
        </div>

        <button id="submitBtn" onclick="getCode()">Generate Pairing Code</button>

        <div id="resultBox" class="code-box">
          <div style="font-size: 12px; color: #8b949e;">YOUR PAIRING CODE:</div>
          <h3 id="pairCode">--------</h3>
          <button class="copy-btn" onclick="copyCode()">Copy Code</button>
        </div>

        <div class="stats">
          Active Bots in Cloud: <span style="color:#3fb950; font-weight:bold;" id="count">${activeSockets.size}</span>
        </div>
      </div>

      <script>
        async function getCode() {
          const phone = document.getElementById('phone').value.trim().replace(/[^0-9]/g, '');
          const btn = document.getElementById('submitBtn');
          const box = document.getElementById('resultBox');
          const codeEl = document.getElementById('pairCode');

          if (!phone || phone.length < 10) {
            alert('කරුණාකර නිවැරදි අංකයක් ඇතුළත් කරන්න (උදා: 94712345678)');
            return;
          }

          btn.innerText = 'Creating session & code...';
          btn.disabled = true;

          try {
            const res = await fetch('/pair?phone=' + phone);
            const data = await res.json();

            if (data.code) {
              codeEl.innerText = data.code;
              box.style.display = 'block';
              btn.innerText = 'Code Received!';
            } else {
              alert(data.error || 'දෝෂයක් ඇති විය.');
              btn.innerText = 'Generate Pairing Code';
              btn.disabled = false;
            }
          } catch {
            alert('Server error! මඳ වේලාවකින් නැවත බලන්න.');
            btn.innerText = 'Generate Pairing Code';
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
    </html>
  `);
});

// Bot Instance Launcher
async function launchBot(sessionId) {
  if (activeSockets.has(sessionId)) return;

  const authCollection = db.collection(sessionId);
  const { state, saveCreds } = await useMongoDBAuthState(authCollection);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    msgRetryCounterCache,
    browser: Browsers.macOS("Safari"),
    syncFullHistory: false
  });

  activeSockets.set(sessionId, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(`[+] Bot connected: ${sessionId}`);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      activeSockets.delete(sessionId);

      if (shouldReconnect) {
        console.log(`[*] Reconnecting bot: ${sessionId}`);
        setTimeout(() => launchBot(sessionId), 3000);
      } else {
        console.log(`[-] Bot logged out: ${sessionId}. Removing session...`);
        await authCollection.drop().catch(() => {});
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (!body.startsWith(CONFIG.PREFIX)) return;
    const cmd = body.slice(CONFIG.PREFIX.length).trim().split(/ +/)[0].toLowerCase();

    if (cmd === "ping") {
      await sock.sendMessage(from, { text: "Pong! 🏓" }, { quoted: msg });
    } else if (cmd === "alive") {
      await sock.sendMessage(from, { text: "👋 Dark-Dinu Bot is Active!" }, { quoted: msg });
    }
  });

  return sock;
}

// Pairing Endpoint
app.get("/pair", async (req, res) => {
  let phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "Phone number required" });
  phone = phone.replace(/[^0-9]/g, "");

  const sessionId = `bot_${phone}`;

  try {
    const authCollection = db.collection(sessionId);
    const credsCheck = await authCollection.findOne({ _id: "creds" });

    if (credsCheck) {
      await authCollection.drop().catch(() => {});
    }

    const { state, saveCreds } = await useMongoDBAuthState(authCollection);
    const { version } = await fetchLatestBaileysVersion();

    const tempSock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.macOS("Safari"),
      syncFullHistory: false
    });

    tempSock.ev.on("creds.update", saveCreds);

    tempSock.ev.on("connection.update", async (s) => {
      if (s.connection === "open") {
        console.log(`[+] Auto-paired successfully: ${sessionId}`);
        activeSockets.set(sessionId, tempSock);
      }
    });

    await delay(2000);
    const code = await tempSock.requestPairingCode(phone);
    const formatted = code?.match(/.{1,4}/g)?.join("-") || code;

    return res.json({ code: formatted });
  } catch (err) {
    console.error(`Pairing failed for ${phone}:`, err);
    return res.status(500).json({ error: "Pairing code generate failed. Try again in 5 seconds." });
  }
});

// Server Initialization
app.listen(PORT, async () => {
  console.log(`Server started on port ${PORT}`);
  try {
    const client = new MongoClient(CONFIG.MONGODB_URI);
    await client.connect();
    db = client.db(CONFIG.DB_NAME);
    console.log("MongoDB Connected Successfully!");

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("bot_")) {
        console.log(`Auto-starting: ${col.name}`);
        launchBot(col.name);
      }
    }
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
});
