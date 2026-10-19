import { getDb } from "./database.js";

const sessionConfigs = new Map();

export const DEFAULT_CONFIG = {
  mode: "public",
  antiDelete: false,
  antiCall: false,
  statusSeen: true,
  statusReact: true,
  statusEmoji: "💖",
  fakeTyping: false,
  fakeRecording: false,
  antiSend: "off",
  autoReply: false,
  welcomeCard: false
};

export function cleanPhone(rawJid = "") {
  if (!rawJid) return "";
  return rawJid.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

export async function initializeSessionState(phone) {
  if (!phone) return { ...DEFAULT_CONFIG };

  const db = getDb();
  if (!db) {
    if (!sessionConfigs.has(phone)) {
      sessionConfigs.set(phone, { ...DEFAULT_CONFIG });
    }
    return sessionConfigs.get(phone);
  }

  try {
    const settingsCol = db.collection("bot_settings");
    let record = await settingsCol.findOne({ phone });

    if (!record) {
      record = { phone, ...DEFAULT_CONFIG, updatedAt: new Date() };
      await settingsCol.insertOne(record).catch(() => {});
    }

    const { _id, phone: _, updatedAt: __, ...settings } = record;
    const finalConfig = { ...DEFAULT_CONFIG, ...settings };
    
    sessionConfigs.set(phone, finalConfig);
    return finalConfig;
  } catch (err) {
    console.error(`[SESSION MGR ERR] Failed to load config for ${phone}:`, err.message);
    if (!sessionConfigs.has(phone)) {
      sessionConfigs.set(phone, { ...DEFAULT_CONFIG });
    }
    return sessionConfigs.get(phone);
  }
}

export function getSessionConfig(phone) {
  if (!phone) return { ...DEFAULT_CONFIG };
  if (!sessionConfigs.has(phone)) {
    sessionConfigs.set(phone, { ...DEFAULT_CONFIG });
    initializeSessionState(phone).catch(() => {});
  }
  return sessionConfigs.get(phone);
}

export async function updateSessionConfig(phone, key, value) {
  if (!phone || !key) return false;

  const current = getSessionConfig(phone);
  current[key] = value;
  sessionConfigs.set(phone, current);

  const db = getDb();
  if (db) {
    try {
      const settingsCol = db.collection("bot_settings");
      await settingsCol.updateOne(
        { phone },
        { 
          $set: { 
            [key]: value, 
            updatedAt: new Date() 
          } 
        },
        { upsert: true }
      );
      return true;
    } catch (err) {
      console.error(`[DB SETTINGS SAVE ERR] Phone: ${phone}:`, err.message);
      return false;
    }
  }
  return true;
}

