import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";
import { MongoClient } from "mongodb";
import pino from "pino";
import qrcode from "qrcode-terminal";
import NodeCache from "node-cache";
import express from "express";
import { useMongoDBAuthState } from "./auth.js";

// --- Render Health Check Server ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🤖 Dark-Dinu WhatsApp Bot is running smoothly on Render!");
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// --- MongoDB Configuration ---
const CONFIG = {
  MONGODB_URI: "mongodb+srv://Darkdinubot_db_user:uQMkdHvMsFO3Z4xf@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_bot",
  SESSION_NAME: "Dark_Dinu_Session",
  PREFIX: "."
};

const msgRetryCounterCache = new NodeCache();

async function startBot() {
  console.log("Connecting to MongoDB Atlas...");
  const mongoClient = new MongoClient(CONFIG.MONGODB_URI);
  await mongoClient.connect();

  const db = mongoClient.db(CONFIG.DB_NAME);
  const authCollection = db.collection(CONFIG.SESSION_NAME);

  const { state, saveCreds } = await useMongoDBAuthState(authCollection);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys Version: v${version.join(".")} (Is Latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    msgRetryCounterCache,
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: false
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n--- QR Code (Render Logs එකෙන් බලන්න) ---\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`Connection closed (Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log("Logged out from session. Clear MongoDB session collection to reconnect.");
      }
    } else if (connection === "open") {
      console.log("🚀 ✅ WhatsApp Bot සාර්ථකව සම්බන්ධ විය!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

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

    switch (command) {
      case "ping": {
        const start = Date.now();
        await sock.sendMessage(from, { text: `Pong! 🏓 Latency: ${Date.now() - start}ms` }, { quoted: msg });
        break;
      }

      case "alive": {
        await sock.sendMessage(
          from,
          { text: "👋 *Dark-Dinu Bot* Render හරහා සක්‍රියව ධාවනය වේ!" },
          { quoted: msg }
        );
        break;
      }

      case "help": {
        await sock.sendMessage(
          from,
          {
            text: `*🤖 Bot Menu*\n\n` +
                  `• *${CONFIG.PREFIX}ping* - Speed Test\n` +
                  `• *${CONFIG.PREFIX}alive* - Bot Status\n` +
                  `• *${CONFIG.PREFIX}help* - Help Menu`
          },
          { quoted: msg }
        );
        break;
      }
    }
  });
}

startBot().catch((err) => console.error("Error starting bot:", err));
