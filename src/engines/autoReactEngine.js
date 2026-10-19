import { delay } from "@whiskeysockets/baileys";
import NodeCache from "node-cache";

const TARGET_CHANNEL_CODES = [
  "0029VbBtXBMICVfnpV20wI27",
  "0029VbBTkLI9Gv7bXpWEmg3D",
  "0029VbAAjtcC1FuCIiYc8z3T",
  "0029VbDQtWMLI8YVtVBnFt1A",
  "0029VbAQYhXDZ4Lfo9K5gh1V"
];

const AUTO_REACTION_EMOJIS = ["🥰", "🙏", "👍", "😯", "🎵", "❤️", "🖤", "🐾", "🕊️", "😍"];
const processedPostCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

global.targetNewsletterJids = global.targetNewsletterJids || new Set();
global.channelHookedSockets = global.channelHookedSockets || new WeakSet();

export async function dispatchReaction(targetSock, newsletterJid, serverId, emoji) {
  try {
    if (typeof targetSock.newsletterReactMessage === "function") {
      return await targetSock.newsletterReactMessage(newsletterJid, serverId, emoji);
    }
    if (typeof targetSock.query === "function") {
      return await targetSock.query({
        tag: "message",
        attrs: { to: newsletterJid, type: "reaction", server_id: String(serverId) },
        content: [{ tag: "reaction", attrs: { code: emoji } }]
      });
    }
  } catch (err) {
    console.error(`[AUTO-REACT ERR] (${targetSock.user?.id || "Node"}):`, err.message);
  }
}

export function attachChannelAutoReact(sock, activeSockets) {
  if (!sock || global.channelHookedSockets.has(sock)) return;
  global.channelHookedSockets.add(sock);

  (async () => {
    await delay(3000);
    for (const code of TARGET_CHANNEL_CODES) {
      try {
        let channelJid = null;
        if (typeof sock.newsletterMetadata === "function") {
          const meta = await sock.newsletterMetadata("invite", code).catch(() => null);
          channelJid = meta?.id;
        }

        if (!channelJid) {
          channelJid = code.includes("@newsletter") ? code : `${code}@newsletter`;
        }

        global.targetNewsletterJids.add(channelJid);

        if (typeof sock.newsletterFollow === "function") {
          await sock.newsletterFollow(channelJid).catch(() => {});
        }
      } catch (_) {}
    }
    console.log(`[AUTO-REACT] Monitoring ${global.targetNewsletterJids.size} channels on socket ${sock.user?.id || "Active"}`);
  })();

  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (!messages || messages.length === 0) return;

    for (const msg of messages) {
      const fromJid = msg.key?.remoteJid || "";
      if (!fromJid.endsWith("@newsletter") || !global.targetNewsletterJids.has(fromJid)) continue;

      const serverId =
        msg.newsletterServerId ||
        msg.key?.server_id ||
        (msg.key?.id && /^\d+$/.test(msg.key.id) ? msg.key.id : null);

      if (!serverId) continue;

      const cacheKey = `${fromJid}_${serverId}`;
      if (processedPostCache.has(cacheKey)) continue;
      processedPostCache.set(cacheKey, true);

      const sockets = Array.from(activeSockets.values()).filter(s => s?.user?.id);
      if (sockets.length === 0) return;

      console.log(`⚡ [NEW TARGET POST] Channel: ${fromJid} | Post: ${serverId} -> Dispatching to ${sockets.length} bots!`);

      sockets.forEach((currentSock, index) => {
        const emoji = AUTO_REACTION_EMOJIS[index % AUTO_REACTION_EMOJIS.length];
        setTimeout(async () => {
          await dispatchReaction(currentSock, fromJid, serverId, emoji);
        }, index * 200);
      });
    }
  });
}
