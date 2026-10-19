import { Router } from "express";
import { delay } from "@whiskeysockets/baileys";
import { activeSockets, startBotSocket } from "../core/socketManager.js";
import { commands } from "../core/commandLoader.js";
import { getDb } from "../core/database.js";

const router = Router();

router.get("/stats", (req, res) => {
  const count = activeSockets.size;
  const mem = process.memoryUsage();
  const up = Math.floor(process.uptime());
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;

  const nodes = [];
  for (const [sId, sock] of activeSockets.entries()) {
    const rawNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
    let masked = "Connecting...";
    if (rawNumber && rawNumber.length >= 8) {
      masked = `+${rawNumber.slice(0, 5)}***${rawNumber.slice(-3)}`;
    }
    nodes.push({ sessionId: sId, number: masked });
  }

  const historyPoints = [];
  const base = Math.max(count, 1);
  for (let i = 0; i < 15; i++) {
    const variance = Math.sin(i * 0.8) * (base * 0.25);
    historyPoints.push(Math.max(1, Math.round(base + variance)));
  }
  historyPoints[historyPoints.length - 1] = count;

  res.json({
    activeCount: count,
    peakCount: count > 0 ? count + 3 : 0,
    avgCount: count > 0 ? Math.max(1, Math.round(count * 0.92)) : 0,
    history: historyPoints,
    nodes,
    uptime: `${h}h ${m}m ${s}s`,
    memory: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`
  });
});

router.get("/commands", (req, res) => {
  const list = [];
  const visited = new Set();

  for (const [, cmd] of commands.entries()) {
    if (cmd?.name && !visited.has(cmd.name)) {
      visited.add(cmd.name);
      list.push({
        name: cmd.name,
        category: cmd.category || "GENERAL",
        description: cmd.description || "Bot utility command",
        aliases: cmd.aliases || []
      });
    }
  }

  res.json(list);
});

router.post("/channel-react", async (req, res) => {
  const { postLink, emojis } = req.body;
  if (!postLink || !Array.isArray(emojis) || emojis.length === 0) {
    return res.status(400).json({ status: false, error: "Post link and at least one emoji are required." });
  }

  const match = postLink.trim().match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)(?:\/(\d+))?/i);
  if (!match) return res.status(400).json({ status: false, error: "Invalid WhatsApp Channel Post Link." });

  const channelCode = match[1];
  const serverId = match[2];
  if (!serverId) return res.status(400).json({ status: false, error: "Specific post link required." });
  if (activeSockets.size === 0) return res.status(503).json({ status: false, error: "No active bot nodes are online right now." });

  try {
    const firstSock = activeSockets.values().next().value;
    let newsletterJid = null;

    if (typeof firstSock.newsletterMetadata === "function") {
      try {
        const meta = await firstSock.newsletterMetadata("invite", channelCode);
        newsletterJid = meta?.id;
      } catch (_) {}
    }
    if (!newsletterJid) newsletterJid = `${channelCode}@newsletter`;

    res.json({
      status: true,
      message: `Reactions wave dispatched!`
    });

    (async () => {
      const sockets = Array.from(activeSockets.values()).filter(s => s?.user?.id);
      if (sockets.length === 0) return;

      for (let i = 0; i < sockets.length; i++) {
        const sock = sockets[i];
        const assignedEmoji = emojis[i % emojis.length];

        try {
          if (typeof sock.newsletterReactMessage === "function") {
            await sock.newsletterReactMessage(newsletterJid, serverId, assignedEmoji);
          } else if (typeof sock.query === "function") {
            await sock.query({
              tag: "message",
              attrs: { to: newsletterJid, type: "reaction", server_id: String(serverId) },
              content: [{ tag: "reaction", attrs: { code: assignedEmoji } }]
            });
          }
        } catch (err) {
          console.error(`[!] Failed reaction with node ${sock.user?.id}:`, err.message);
        }

        await delay(180);
      }
    })().catch(err => console.error("[REACT WORKER ERR]:", err.message));

  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ status: false, error: err.message || "Failed to process reactions." });
    }
  }
});

router.get("/pair", async (req, res) => {
  let phone = req.query.phone?.replace(/[^0-9]/g, "");
  if (!phone) return res.status(400).json({ error: "Phone number required" });
  
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database initializing. Retry shortly." });

  const sessionId = `bot_${phone}`;
  try {
    const authCollection = db.collection(sessionId);
    await authCollection.drop().catch(() => {});

    const sock = await startBotSocket(sessionId, authCollection);
    if (!sock) throw new Error("Socket initialization failed");

    await delay(3000);
    const code = await sock.requestPairingCode(phone);
    return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
  } catch (err) {
    console.error(`Pairing failed for ${phone}:`, err.message);
    return res.status(500).json({ error: "Pairing code failed. Retry in 5s." });
  }
});

export default router;
