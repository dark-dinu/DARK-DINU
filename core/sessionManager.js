import fs from "fs";
import path from "path";

// Per-Session Memory Map: Key -> Bot Phone (e.g. "94771033094")
global.sessionStatePool = global.sessionStatePool || new Map();
const LOCAL_BACKUP_DIR = path.join(process.cwd(), "session_backups");

if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
  try { fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true }); } catch (_) {}
}

export function cleanPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

// Local File Persistence Fallback
function saveLocalBackup(botPhone, state) {
  try {
    const filePath = path.join(LOCAL_BACKUP_DIR, `${botPhone}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch (_) {}
}

function readLocalBackup(botPhone) {
  try {
    const filePath = path.join(LOCAL_BACKUP_DIR, `${botPhone}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (_) {}
  return null;
}

// 1. Session Init & Load (Called on Bot Socket Connect)
export async function initializeSessionState(botPhone) {
  if (!botPhone) return null;

  if (global.sessionStatePool.has(botPhone)) {
    return global.sessionStatePool.get(botPhone);
  }

  const defaultState = {
    botPhone,
    config: {
      mode: "public",
      antiDelete: true,
      statusSeen: true,
      statusReact: true,
      statusEmoji: "💖",
      antiSend: "off",
      antiCall: false,
      autoReply: true,
      welcomeCard: true
    },
    timers: [],
    channelPosts: [],
    customReplies: []
  };

  // 1st Priority: MongoDB Load
  let loaded = false;
  try {
    const db = getDbInstance();
    if (db) {
      const col = db.collection("bot_sessions_v2");
      const record = await col.findOne({ _id: botPhone });
      if (record) {
        defaultState.config = { ...defaultState.config, ...record.config };
        defaultState.timers = record.timers || [];
        defaultState.channelPosts = record.channelPosts || [];
        defaultState.customReplies = record.customReplies || [];
        loaded = true;
      } else {
        await col.insertOne({ _id: botPhone, ...defaultState });
        loaded = true;
      }
    }
  } catch (err) {
    console.error(`[SESSION DB ERR - ${botPhone}]:`, err.message);
  }

  // 2nd Priority: Local Storage Fallback if DB is slow or unavailable
  if (!loaded) {
    const local = readLocalBackup(botPhone);
    if (local) {
      defaultState.config = { ...defaultState.config, ...local.config };
      defaultState.timers = local.timers || [];
      defaultState.channelPosts = local.channelPosts || [];
      defaultState.customReplies = local.customReplies || [];
    }
  }

  global.sessionStatePool.set(botPhone, defaultState);
  saveLocalBackup(botPhone, defaultState);
  return defaultState;
}

// 2. Atomic Config Modifier
export async function updateSessionConfig(botPhone, key, value) {
  let session = global.sessionStatePool.get(botPhone);
  if (!session) session = await initializeSessionState(botPhone);

  session.config[key] = value;
  global.sessionStatePool.set(botPhone, session);
  saveLocalBackup(botPhone, session);

  setImmediate(async () => {
    try {
      const db = getDbInstance();
      if (db) {
        await db.collection("bot_sessions_v2").updateOne(
          { _id: botPhone },
          { $set: { [`config.${key}`]: value, lastUpdated: new Date() } },
          { upsert: true }
        );
      }
    } catch (_) {}
  });
}

// 3. Fast Config Getter
export function getSessionConfig(botPhone) {
  const state = global.sessionStatePool.get(botPhone);
  if (state?.config) return state.config;

  return {
    mode: "public",
    antiDelete: true,
    statusSeen: true,
    statusReact: true,
    statusEmoji: "💖",
    antiSend: "off",
    antiCall: false,
    autoReply: true,
    welcomeCard: true
  };
}

// 4. Session Tasks Modifier (Timers & Channel Posts)
export async function updateSessionDataList(botPhone, listKey, newList) {
  let session = global.sessionStatePool.get(botPhone);
  if (!session) session = await initializeSessionState(botPhone);

  session[listKey] = newList;
  global.sessionStatePool.set(botPhone, session);
  saveLocalBackup(botPhone, session);

  setImmediate(async () => {
    try {
      const db = getDbInstance();
      if (db) {
        await db.collection("bot_sessions_v2").updateOne(
          { _id: botPhone },
          { $set: { [listKey]: newList, lastUpdated: new Date() } },
          { upsert: true }
        );
      }
    } catch (_) {}
  });
}
