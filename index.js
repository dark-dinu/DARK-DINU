import makeWASocket, { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  proto, 
  initAuthCreds 
} from "@whiskeysockets/baileys";
import { MongoClient } from "mongodb";
import pino from "pino";
import qrcode from "qrcode-terminal";

// --- මූලික සැකසුම් (Configurations) ---
const CONFIG = {
  MONGODB_URI: "mongodb+srv://Darkdinubot_db_user:uQMkdHvMsFO3Z4xf@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: "whatsapp_bot",
  SESSION_NAME: "Dark_Dinu_Session",
  PREFIX: "."
};

// --- MongoDB Authentication Handler ---
async function useMongoDBAuthState(collection) {
  const writeData = async (data, id) => {
    return await collection.replaceOne(
      { _id: id },
      { _id: id, data: JSON.stringify(data, BufferJSON.replacer) },
      { upsert: true }
    );
  };

  const readData = async (id) => {
    try {
      const doc = await collection.findOne({ _id: id });
      if (!doc || !doc.data) return null;
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (id) => {
    try {
      await collection.deleteOne({ _id: id });
    } catch {}
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, "creds")
  };
}

const BufferJSON = {
  replacer: (k, v) => {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array || v?.type === "Buffer") {
      return { type: "Buffer", data: Array.from(v?.data || v) };
    }
    return v;
  },
  reviver: (k, v) => {
    if (typeof v === "object" && v !== null && (v.type === "Buffer" || Array.isArray(v.data)) && Array.isArray(v.data)) {
      return Buffer.from(v.data);
    }
    return v;
  }
};

// --- Bot Main Execution ---
async function startBot() {
  console.log("MongoDB සමඟ සම්බන්ධ වෙමින් පවතී...");
  const mongoClient = new MongoClient(CONFIG.MONGODB_URI);
  await mongoClient.connect();
  
  const db = mongoClient.db(CONFIG.DB_NAME);
  const authCollection = db.collection(CONFIG.SESSION_NAME);

  const { state, saveCreds } = await useMongoDBAuthState(authCollection);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Baileys Version: v${version.join(".")} (Latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"]
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n--- WhatsApp මඟින් පහත QR එක Scan කරන්න ---\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`සම්බන්ධතාවය විසන්ධි විය (Code: ${statusCode}). නැවත උත්සාහ කරමින්:`, shouldReconnect);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log("Session එකෙන් Log out වී ඇත. කරුණාකර MongoDB හි Session Collection එක Delete කර නැවත Scan කරන්න.");
      }
    } else if (connection === "open") {
      console.log("✅ Bot සාර්ථකව WhatsApp වෙත සම්බන්ධ විය!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Messages Handling
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
          { 
            text: "*🤖 Dark-Dinu Bot සක්‍රියයි!*\n\nMongoDB Session Management සාර්ථකව ක්‍රියාත්මක වේ." 
          }, 
          { quoted: msg }
        );
        break;
      }

      case "help": {
        await sock.sendMessage(
          from,
          {
            text: `*📋 Commands List:*\n\n` +
                  `• *${CONFIG.PREFIX}ping* - Speed Test\n` +
                  `• *${CONFIG.PREFIX}alive* - Bot Status\n` +
                  `• *${CONFIG.PREFIX}help* - විධාන මෙනුව`
          },
          { quoted: msg }
        );
        break;
      }
    }
  });
}

startBot().catch((err) => console.error("Critical Bot Error:", err));
