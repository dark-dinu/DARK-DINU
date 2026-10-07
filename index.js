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

const CONFIG = {
  MONGODB_URI: "mongodb+srv://Darkdinubot_db_user:uQMkdHvMsFO3Z4xf@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_bot",
  SESSION_NAME: "Dark_Dinu_Session",
  PREFIX: "."
};

const msgRetryCounterCache = new NodeCache();
let sock = null;
let authCollection = null;
let authStateData = null;

// Pairing Web Interface UI
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DARK-DINU PAIRING WEB</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background: #0b0e14; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 16px; padding: 30px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h2 { color: #25d366; margin-bottom: 8px; font-size: 24px; }
        p { color: #8b949e; font-size: 14px; margin-bottom: 24px; }
        .input-group { margin-bottom: 20px; text-align: left; }
        label { display: block; font-size: 13px; color: #c9d1d9; margin-bottom: 6px; }
        input { width: 100%; padding: 14px; border-radius: 8px; border: 1px solid #30363d; background: #0d1117; color: #fff; font-size: 16px; outline: none; transition: 0.3s; }
        input:focus { border-color: #25d366; }
        button { width: 100%; padding: 14px; border-radius: 8px; border: none; background: #238636; color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
        button:hover { background: #2ea043; }
        .code-box { display: none; margin-top: 24px; padding: 16px; background: #0d1117; border: 2px dashed #25d366; border-radius: 10px; }
        .code-box h3 { font-size: 26px; letter-spacing: 4px; color: #25d366; margin-bottom: 8px; }
        .copy-btn { margin-top: 10px; background: #21262d; border: 1px solid #30363d; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #58a6ff; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>DARK-DINU PAIRING</h2>
        <p>Enter your WhatsApp Number with Country Code</p>
        
        <div class="input-group">
          <label>Phone Number (e.g. 94771234567)</label>
          <input type="text" id="phone" placeholder="947xxxxxxxx" required>
        </div>

        <button id="submitBtn" onclick="getPairingCode()">Get Pairing Code</button>

        <div id="resultBox" class="code-box">
          <div style="font-size: 13px; color: #8b949e; margin-bottom: 6px;">YOUR PAIRING CODE:</div>
          <h3 id="pairCode">--------</h3>
          <button class="copy-btn" onclick="copyCode()">Copy Code</button>
        </div>
      </div>

      <script>
        async function getPairingCode() {
          const phone = document.getElementById('phone').value.trim().replace(/[^0-9]/g, '');
          const btn = document.getElementById('submitBtn');
          const box = document.getElementById('resultBox');
          const codeEl = document.getElementById('pairCode');

          if (!phone || phone.length < 10) {
            alert('කරුණාකර නිවැරදි දුරකථන අංකය ඇතුළත් කරන්න!');
            return;
          }

          btn.innerText = 'Generating Code...';
          btn.disabled = true;

          try {
            const res = await fetch('/pair?phone=' + phone);
            const data = await res.json();

            if (data.code) {
              codeEl.innerText = data.code;
              box.style.display = 'block';
              btn.innerText = 'Get Pairing Code';
              btn.disabled = false;
            } else {
              alert(data.error || 'දෝෂයක් සිදුවිය.');
              btn.innerText = 'Get Pairing Code';
              btn.disabled = false;
            }
          } catch (err) {
            alert('Network Error! මඳ වේලාවකින් නැවත උත්සාහ කරන්න.');
            btn.innerText = 'Get Pairing Code';
            btn.disabled = false;
          }
        }

        function copyCode() {
          const code = document.getElementById('pairCode').innerText;
          navigator.clipboard.writeText(code);
          alert('Copied: ' + code);
        }
      </script>
    </body>
    </html>
  `);
});

// Pairing Code Generator Endpoint
app.get("/pair", async (req, res) => {
  let phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "Phone number is required" });
  phone = phone.replace(/[^0-9]/g, "");

  try {
    if (!sock || !sock.authState) {
      return res.status(503).json({ error: "Server initializing, please wait 5 seconds and retry." });
    }

    if (sock.authState.creds.registered) {
      return res.json({ error: "Bot දැනටමත් ලින්ක් වී ඇත! අලුතින් ලින්ක් කිරීමට Atlas හි Collection එක clear කරන්න." });
    }

    await delay(2000);
    const code = await sock.requestPairingCode(phone);
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
    return res.json({ code: formattedCode });
  } catch (err) {
    console.error("Pairing Error details:", err);
    return res.status(500).json({ error: "Pairing code එක generate කරගත නොහැකි විය. අංකය නිවැරදි දැයි බලන්න." });
  }
});

// WhatsApp Bot Main Starter
async function startBot() {
  console.log("Connecting to MongoDB Atlas...");
  const mongoClient = new MongoClient(CONFIG.MONGODB_URI);
  await mongoClient.connect();

  const db = mongoClient.db(CONFIG.DB_NAME);
  authCollection = db.collection(CONFIG.SESSION_NAME);

  authStateData = await useMongoDBAuthState(authCollection);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys Version: v${version.join(".")} (Latest: ${isLatest})`);

  sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: authStateData.state,
    msgRetryCounterCache,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed (Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("🚀 ✅ WhatsApp Bot සාර්ථකව සම්බන්ධ විය!");
    }
  });

  sock.ev.on("creds.update", authStateData.saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!body.startsWith(CONFIG.PREFIX)) return;

    const args = body.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "ping") {
      await sock.sendMessage(from, { text: "Pong! 🏓 Latency OK" }, { quoted: msg });
    } else if (command === "alive") {
      await sock.sendMessage(from, { text: "👋 Dark-Dinu Bot Online!" }, { quoted: msg });
    }
  });
}

app.listen(PORT, () => {
  console.log(`Web Server listening on port ${PORT}`);
  startBot().catch((err) => console.error("Start Bot Error:", err));
});
