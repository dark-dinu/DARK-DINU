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
  MONGODB_URI: "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_multi_bots",
  PREFIX: "."
};

const msgRetryCounterCache = new NodeCache();
const activeSockets = new Map();
let db;

// Web UI එක මෙතැනට (පෙර පරිදිම තබන්න)

async function startBotSocket(sessionId, authCollection) {
  const { state, saveCreds } = await useMongoDBAuthState(authCollection);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    msgRetryCounterCache,
    browser: Browsers.ubuntu("Chrome"), // Safari වෙනුවට Ubuntu Chrome යොදන්න
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    emitOwnEvents: true,
    fireInitQueries: true,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(`[+] Bot connected: ${sessionId}`);
      activeSockets.set(sessionId, sock);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      activeSockets.delete(sessionId);

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

    // පරණ session එකක් ඇත්නම් drop කරමු
    await authCollection.drop().catch(() => {});

    // Single persistent socket එකක් open කර pairing code ඉල්ලීම
    const sock = await startBotSocket(sessionId, authCollection);

    await delay(3000); // Connection එක establish වන තුරු තත්පර 3ක් රැඳෙන්න
    const code = await sock.requestPairingCode(phone);
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
        startBotSocket(col.name, db.collection(col.name));
      }
    }
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
});
