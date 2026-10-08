import { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  makeCacheableSignalKeyStore,
  delay 
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";

export default {
  name: "bot",
  aliases: ["pair", "paircode", "clone"],
  category: "general",
  description: "Generate WhatsApp pairing code directly from Baileys engine",

  async execute({ sock, msg, from, args }) {
    sock.sendMessage(from, { react: { text: "⛓️‍💥", key: msg.key } }).catch(() => {});

    // 1. Determine Target Number
    let targetNumber = args.join("").replace(/[^0-9]/g, "");
    if (!targetNumber) {
      const senderJid = msg.key.participant || msg.participant || from || "";
      targetNumber = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
    }

    if (!targetNumber || targetNumber.length < 9) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ *කරුණාකර නිවැරදි දුරකථන අංකයක් ඇතුළත් කරන්න!*\nඋදා: `.bot 9471xxxxxxx`" },
        { quoted: msg }
      );
    }

    const waitMsg = await sock.sendMessage(
      from,
      {
        text: `🍓 ༆⃝⃤ *DARK-DINU PAIRING ENGINE* 🐾\n\n> ⏳ _Generating pairing code for +${targetNumber}..._`
      },
      { quoted: msg }
    );

    const tempSessionDir = path.join(process.cwd(), `temp_pair_${targetNumber}_${Date.now()}`);

    try {
      // 2. Direct Baileys Pairing Engine
      const { state, saveCreds } = await useMultiFileAuthState(tempSessionDir);
      const { version } = await fetchLatestBaileysVersion();

      const tempSock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
      });

      tempSock.ev.on("creds.update", saveCreds);

      await delay(2500);

      // Request pairing code directly
      let code = await tempSock.requestPairingCode(targetNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;

      const fixedFooterLink = "https://heshan.devofc.top/";

      // Clean Aesthetic Card
      const cardText = 
`🍓 ༆⃝⃤ *DARK-DINU BOT CLONE SYSTEM* 🎀 🐾
━━━━━━━━━━━━━━━━━━━━

┊◈ 📱 *ɴᴜᴍʙᴇʀ* : +${targetNumber}
┊◈ 🔑 *ᴄᴏᴅᴇ*   : *${code}*
┊◈ 💡 *ɴᴏᴛᴇ*   : _Notification එක click කර Code එක paste කරන්න._

────────────────────
🍰 *© 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐎ꜰᴄ* 🤍 | 📍 ${fixedFooterLink}`;

      // 1. Visual Card Send
      await sock.sendMessage(from, { text: cardText }, { quoted: msg });

      // 2. Raw Code for 1-Tap Copy
      await sock.sendMessage(from, { text: `${code}` });

      // Delete wait notification
      if (waitMsg?.key) {
        sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

      // Cleanup temp socket & folder after request
      setTimeout(() => {
        try {
          tempSock.end(undefined);
          if (fs.existsSync(tempSessionDir)) {
            fs.rmSync(tempSessionDir, { recursive: true, force: true });
          }
        } catch (_) {}
      }, 60000);

    } catch (err) {
      console.error("[PAIR ERROR]:", err.message);

      if (waitMsg?.key) {
        sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

      await sock.sendMessage(
        from,
        { text: `❌ *Pairing Code ලබාගැනීම අසාර්ථක විය:*\n_${err.message}_` },
        { quoted: msg }
      ).catch(() => {});

      try {
        if (fs.existsSync(tempSessionDir)) {
          fs.rmSync(tempSessionDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }
  }
};
