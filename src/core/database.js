import { MongoClient } from "mongodb";
import CONFIG from "../../config.js";

let mongoClient = null;
let db = null;

export async function connectDatabase() {
  if (db) return db;

  mongoClient = new MongoClient(CONFIG.MONGODB_URI, {
    maxPoolSize: 75,
    minPoolSize: 10,
    connectTimeoutMS: 30000
  });

  await mongoClient.connect();
  db = mongoClient.db(CONFIG.DB_NAME);

  global.mongoClient = mongoClient;
  global.mongoDbInstance = db;

  console.log("🍃 MongoDB database connected successfully!");
  return db;
}

export function getDb() {
  return db || global.mongoDbInstance;
}

export async function closeDatabase() {
  if (mongoClient) {
    await mongoClient.close();
    console.log("🍃 MongoDB connection closed.");
  }
}
