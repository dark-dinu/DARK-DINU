import express from "express";
import path from "path";
import { delay } from "@whiskeysockets/baileys";
import CONFIG from "./config.js";
import { connectDatabase, closeDatabase } from "./src/core/database.js";
import { loadCommands } from "./src/core/commandLoader.js";
import { startBotSocket } from "./src/core/socketManager.js";
import webRoutes from "./src/routes/webRoutes.js";
import apiRoutes from "./src/routes/apiRoutes.js";
import { initKeepAlive } from "./src/engines/keepAlive.js";

// Filter annoying console noise
const origLog = console.log;
console.log = (...args) =>
  typeof args[0] === "string" &&
  (args[0].includes("Closing session: SessionEntry") || args[0].includes("SessionEntry {"))
    ? null
    : origLog(...args);

const app = express();
const PORT = Number(CONFIG.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

// Route Mounts
app.use("/", webRoutes);
app.use("/api", apiRoutes);
app.use("/", apiRoutes); // Direct access for /pair

// 404 Handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "public", "404.html"));
});

// Server Boot Sequence
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Dark-Dinu Cloud Engine running on port ${PORT}`);
  try {
    await loadCommands();
    const db = await connectDatabase();

    // Reconnect existing MongoDB sessions
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      if (col.name.startsWith("bot_") && col.name !== "bot_sessions_v2" && col.name !== "bot_settings") {
        console.log(`⚡ Waking up active session: ${col.name}`);
        startBotSocket(col.name, db.collection(col.name));
        await delay(2500); // Sequence loading to avoid rate limit
      }
    }

    initKeepAlive();
  } catch (err) {
    console.error("❌ Database Startup Error:", err.message);
  }
});

process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});
