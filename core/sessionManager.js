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

// 🛡️ Comprehensive Default Schema (All Modern Features)
export const DEFAULT_CONFIG = {
  mode: "public",             // 'public' | 'private' | 'group' | 'inbox'
  antiDelete: true,           // Recover deleted messages
  antiViewOnce: true,         // Recover view-once media
  antiSendDest: "me",         // 'me' (Private Inbox) | 'from' (Current Chat)
  antiCall: true,             // Auto reject incoming calls
  statusSeen: true,           // Auto mark statuses as viewed
  statusReact: true,          // Auto react to statuses
  statusEmoji: "💖",          // Custom status reaction emoji
  alwaysOnline: false,        // Keep WhatsApp 24/7 available status
  autoVoice: false,           // Auto voice note response engine
  autoReply: true,            // Auto reply triggers
  autoSeen: false,            // Auto read chat messages
  autoReact: false,           // Auto emoji react to chat messages
  welcomeCard: true,          // Group member join banner
  fakeTyping: false,          // Continuous typing presence simulation
  fakeRecording: false,       // Continuous audio recording presence simulation
  antiSend: "off"             // 'me' | 'from' | 'all' | 'off'
};

// 1. Session Init & Load (Boots seamlessly on socket startup)
export async function initializeSessionState(rawPhone) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return null;

  // Read instantly from fast RAM Cache
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

  // 1st Priority: Database Cluster Load
  let loaded = false;
  try {
    const db = getDbInstance();
    if (db) {
      const col = db.collection("bot_sessions_v2");
      const record = await col.findOne({ _id: String(botPhone) });
      if (record) {
        // Merge defaults to automatically inject newly added keys into legacy sessions
        defaultState.config = { ...DEFAULT_CONFIG, ...(record.config || {}) };
        defaultState.timers = record.timers || [];
        defaultState.channelPosts = record.channelPosts || [];
        defaultState.customReplies = record.customReplies || [];
        loaded = true;
      } else {
        await col.insertOne({ _id: String(botPhone), ...defaultState, createdAt: new Date() });
        loaded = true;
      }
    }
  } catch (err) {
    console.error(`[SESSION DB ERR - +${botPhone}]:`, err.message);
  }

  // 2nd Priority: Local Storage Fallback
  if (!loaded) {
    const local = readLocalBackup(botPhone);
    if (local) {
      defaultState.config = { ...DEFAULT_CONFIG, ...(local.config || {}) };
      defaultState.timers = local.timers || [];
      defaultState.channelPosts = local.channelPosts || [];
      defaultState.customReplies = local.customReplies || [];
    }
  }

  global.sessionStatePool.set(botPhone, defaultState);
  saveLocalBackup(botPhone, defaultState);
  return defaultState;
}

// 2. Atomic Config Modifier (Immediate RAM update + Background Mongo write)
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

// 3. Fast In-Memory Config Getter (O(1) Ultra-Low Latency)
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
