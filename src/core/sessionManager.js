import fs from "fs";
import path from "path";
import { getDb } from "./database.js";

// Fast In-Memory State Cache
global.sessionStatePool = global.sessionStatePool || new Map();
const LOCAL_BACKUP_DIR = path.join(process.cwd(), "session_backups");

if (!fs.existsSync(LOCAL_BACKUP_DIR)) {
  try { fs.mkdirSync(LOCAL_BACKUP_DIR, { recursive: true }); } catch (_) {}
}

export function cleanPhone(rawJid = "") {
  if (!rawJid) return "";
  const atIdx = rawJid.indexOf("@");
  const base = atIdx !== -1 ? rawJid.slice(0, atIdx) : rawJid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
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

export const DEFAULT_CONFIG = {
  mode: "public",
  antiDelete: true,
  antiViewOnce: true,
  antiSendDest: "me",
  antiCall: true,
  statusSeen: true,
  statusReact: true,
  statusEmoji: "💖",
  alwaysOnline: false,
  autoVoice: false,
  autoReply: true,
  autoSeen: false,
  autoReact: false,
  welcomeCard: true,
  fakeTyping: false,
  fakeRecording: false,
  antiSend: "off"
};

/**
 * Boots seamlessly on socket startup (Loads from DB -> Fallback to Local JSON -> In-Memory)
 */
export async function initializeSessionState(rawPhone) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return null;

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

  let loaded = false;
  try {
    const db = getDb();
    if (db) {
      const col = db.collection("bot_sessions_v2");
      const record = await col.findOne({ _id: String(botPhone) });
      if (record) {
        defaultState.config = { ...DEFAULT_CONFIG, ...(record.config || {}) };
        defaultState.timers = record.timers || [];
        defaultState.channelPosts = record.channelPosts || [];
        defaultState.customReplies = record.customReplies || [];
        loaded = true;
      } else {
        await col.insertOne({ _id: String(botPhone), ...defaultState, createdAt: new Date() }).catch(() => {});
        loaded = true;
      }
    }
  } catch (err) {
    console.error(`[SESSION DB ERR - +${botPhone}]:`, err.message);
  }

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

/**
 * Atomic Config Modifier (Immediate RAM update + Background Mongo write + Local Backup)
 */
export async function updateSessionConfig(rawPhone, key, value) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return;

  let session = global.sessionStatePool.get(botPhone);
  if (!session) session = await initializeSessionState(botPhone);

  session.config[key] = value;
  global.sessionStatePool.set(botPhone, session);
  saveLocalBackup(botPhone, session);

  try {
    const db = getDb();
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

/**
 * Fast In-Memory Config Getter (0ms Low Latency)
 */
export function getSessionConfig(rawPhone) {
  const botPhone = cleanPhone(rawPhone);
  const state = global.sessionStatePool.get(botPhone);
  if (state?.config) return state.config;

  return { ...DEFAULT_CONFIG };
}

/**
 * Session Tasks Modifier
 */
export async function updateSessionDataList(rawPhone, listKey, newList) {
  const botPhone = cleanPhone(rawPhone);
  if (!botPhone) return;

  let session = global.sessionStatePool.get(botPhone);
  if (!session) session = await initializeSessionState(botPhone);

  session[listKey] = newList;
  global.sessionStatePool.set(botPhone, session);
  saveLocalBackup(botPhone, session);

  try {
    const db = getDb();
    if (db) {
      await db.collection("bot_sessions_v2").updateOne(
        { _id: String(botPhone) },
        { $set: { [listKey]: newList, lastUpdated: new Date() } },
        { upsert: true }
      );
    }
  } catch (_) {}
}
