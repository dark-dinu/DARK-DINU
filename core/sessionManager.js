import fs from "fs";
import path from "path";

// Per-Session Memory Map: Key -> Bot Phone (e.g. "94771033094")
global.sessionStatePool = global.sessionStatePool || new Map();
const LOCAL_BACKUP_DIR = path.join(process.cwd(), "session_backups");

if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
  try { fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true }); } catch (_) {}
}

export function cleanPhone(jid = "") {
  if (!jid) return "";
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

// Global Shared Database Instance Retriever
function getDbInstance() {
  if (global.mongoDbInstance) return global.mongoDbInstance;
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

// Default Schema
const DEFAULT_CONFIG = {
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

// 1. Session Init & Load (Bot Socket Connect වෙද්දී Run වෙන කොටස)
export async function initializeSessionState(rawPhone) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return null;

  // RAM Pool එකේ කලින්ම තියෙනවද බැලීම
  if (global.sessionStatePool.has(botPhone)) {
    return global.sessionStatePool.get(botPhone);
  }

  const defaultState = {
    botPhone,
    config: { ...DEFAULT_CONFIG },
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
      const record = await col.findOne({ _id: String(botPhone) });
      if (record) {
        defaultState.config = { ...defaultState.config, ...record.config };
        defaultState.timers = record.timers || [];
        defaultState.channelPosts = record.channelPosts || [];
        defaultState.customReplies = record.customReplies || [];
        loaded = true;
      } else {
        await col.insertOne({ _id: String(botPhone), ...defaultState, createdAt: new Date() });
        loaded = true;
      }
    } else {
      console.warn(`[SESSION WARNING]: MongoDB not ready for +${botPhone}, trying local backup...`);
    }
  } catch (err) {
    console.error(`[SESSION DB ERR - +${botPhone}]:`, err.message);
  }

  // 2nd Priority: Local Storage Fallback
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

// 2. Atomic Config Modifier (Settings වෙනස් කරපු සැණින් Save වීම)
export async function updateSessionConfig(rawPhone, key, value) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return;

  let session = global.sessionStatePool.get(botPhone);
  if (!session) session = await initializeSessionState(botPhone);

  session.config[key] = value;
  global.sessionStatePool.set(botPhone, session);
  saveLocalBackup(botPhone, session);

  try {
    const db = getDbInstance();
    if (db) {
      await db.collection("bot_sessions_v2").updateOne(
        { _id: String(botPhone) },
        { $set: { [`config.${key}`]: value, lastUpdated: new Date() } },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error(`[DB UPDATE FAILED - +${botPhone}]:`, err.message);
  }
}

// 3. Fast Config Getter
export function getSessionConfig(rawPhone) {
  const botPhone = cleanPhone(rawPhone);
  const state = global.sessionStatePool.get(botPhone);
  if (state?.config) return state.config;

  return { ...DEFAULT_CONFIG };
}

// 4. Session Tasks Modifier
export async function updateSessionDataList(rawPhone, listKey, newList) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return;

  let session = global.sessionStatePool.get(botPhone);
  if (!session) session = await initializeSessionState(botPhone);

  session[listKey] = newList;
  global.sessionStatePool.set(botPhone, session);
  saveLocalBackup(botPhone, session);

  try {
    const db = getDbInstance();
    if (db) {
      await db.collection("bot_sessions_v2").updateOne(
        { _id: String(botPhone) },
        { $set: { [listKey]: newList, lastUpdated: new Date() } },
        { upsert: true }
      );
    }
  } catch (_) {}
}
