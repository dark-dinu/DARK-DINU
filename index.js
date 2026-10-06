import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";
import { MongoClient } from "mongodb";
import pino from "pino";
import qrcode from "qrcode-terminal";
import NodeCache from "node-cache";
import { useMongoDBAuthState } from "./auth.js";

// MongoDB Configuration
const CONFIG = {
  MONGODB_URI: "mongodb+srv://Darkdinubot_db_user:uQMkdHvMsFO3Z4xf@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_bot",
  SESSION_NAME: "Dark_Dinu_Session",
  PREFIX: "."
};

// Message Retry Cache එකක් මඟින් Decryption Errors වළක්වයි
const msgRetryCounterCache = new NodeCache();

async function startBot() {
  console.log("Connecting to MongoDB Atlas...");
  const mongoClient = new MongoClient(CONFIG.MONGODB_URI);
  await mongoClient.connect();

  const db = mongoClient.db(CONFIG.DB_NAME);
  const authCollection = db.collection(CONFIG.SESSION_NAME);

  const { state, saveCreds } = await useMongoDBAuthState(authCollection);
  
  // නවතම Baileys Web Version එක ලබා ගැනීම
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys Version: v${version.join(".")} (Is Latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    msgRetryCounterCache,
    browser: Browsers.macOS("Desktop"),
    syncFullHistory: false,
    generateHighQualityLinkPreview: true
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n--- WhatsApp මඟින් පහත QR Code එක Scan කරන්න ---\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`සම්බන්ධතාවය බිඳ වැටුණි (Code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log("⚠️ Logged out වී ඇත. කරුණාකර MongoDB හි Session collection එක clear කර නැවත run කරන්න.");
      }
    } else if (connection === "open") {
      console.log("🚀 ✅ WhatsApp Bot සාර්ථකව සම්බන්ධ විය!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // පණිවිඩ හැසිරවීම (Message Handler)
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
          { text: "👋 *Dark-Dinu Bot* නවතම Version එකෙන් සාර්ථකව ක්‍රියාත්මක වේ!" },
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
