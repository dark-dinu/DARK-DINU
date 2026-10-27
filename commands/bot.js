import { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  delay
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import NodeCache from "node-cache";

// Sender ගේ number එක clean කරගන්නා function එක
function getSenderNumber(msg, from) {
  const senderJid = msg.key.fromMe
    ? (from || "")
    : (msg.key.participant || msg.participant || from || "");
  
  return senderJid.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

export default {
  name: "bot",
  aliases: ["pair", "paircode", "clone"],
  category: "general",
  description: "Generate WhatsApp pairing code directly with zero-lag login handshake",

  async execute({ sock, msg, from, args }) {
    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    // 1. User number එකක් දීලා ඇත්නම් එය ලබාගැනීම, නැත්නම් command එක ගහපු කෙනාගේ number එක auto-detect කිරීම
    let inputNumber = args.join("").replace(/[^0-9]/g, "");
    let targetNumber = (inputNumber && inputNumber.length >= 9) 
      ? inputNumber 
      : getSenderNumber(msg, from);

    if (!targetNumber || targetNumber.length < 9) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "❌ *දුරකථන අංකය හඳුනාගත නොහැකි විය!* කරුණාකර `.bot 947xxxxxxxx` ආකාරයට අංකය ලබාදෙන්න." },
        { quoted: msg }
      );
    }

    const waitMsg = await sock.sendMessage(
      from,
      {
        text: 
`╔═════════════════════════════╗
   ⚡ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐂 𝐎 𝐑 𝐄
╚═════════════════════════════╝

> ⏳ *Generating Secure Pairing Code for:*
> 📱 *Target Number:* \`+${targetNumber}\`

_කරුණාකර තත්පර කිහිපයක් රැඳී සිටින්න..._`
      },
      { quoted: msg }
    );

    const tempSessionDir = path.join(process.cwd(), `temp_pair_${targetNumber}_${Date.now()}`);
    if (!fs.existsSync(tempSessionDir)) {
      fs.mkdirSync(tempSessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(tempSessionDir);
      const { version } = await fetchLatestBaileysVersion();
      const msgRetryCounterCache = new NodeCache();

      // Handshake එක සුමටව කරවන Socket Configuration
      const tempSock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "122.0.0.0"],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false,
        msgRetryCounterCache
      });

      tempSock.ev.on("creds.update", saveCreds);

      let isHandshakeComplete = false;

      tempSock.ev.on("connection.update", async (update) => {
        const { connection } = update;

        if (connection === "open") {
          isHandshakeComplete = true;
          try {
            await sock.sendMessage(from, {
              text: `🎉 *LOGIN SUCCESSFUL!*\n\n📱 *Number:* \`+${targetNumber}\`\n✅ Device එක සාර්ථකව සම්බන්ධ විය (Linked Successfully)!`
            });
          } catch (_) {}

          setTimeout(() => {
            try {
              tempSock.ws.close();
              if (fs.existsSync(tempSessionDir)) {
                fs.rmSync(tempSessionDir, { recursive: true, force: true });
              }
            } catch (_) {}
          }, 8000);
        }
      });

      await delay(3000);

      // Pairing code එක ලබාගැනීම
      let code = await tempSock.requestPairingCode(targetNumber);
      if (!code) throw new Error("WhatsApp server එකෙන් Code එක ලබාගැනීමට නොහැකි විය.");

      code = code.match(/.{1,4}/g)?.join("-") || code;

      const cardText = 
`╔═════════════════════════════╗
   🌸 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐂 𝐋 𝐎 𝐍 𝐄 🌸
╚═════════════════════════════╝

📱 *Target Number:* \`+${targetNumber}\`
🔑 *Pairing Code:* *${code}*
⏳ *Valid For:* \`60 Seconds\`

╭───〔 📖 𝐇𝐎𝐖 𝐓𝐎 𝐋𝐈𝐍𝐊 𝐃𝐄𝐕𝐈𝐂𝐄 〕
├ 1️⃣ WhatsApp විවෘත කරන්න.
├ 2️⃣ Settings (හෝ තිත් 3) ➔ *Linked Devices* යන්න.
├ 3️⃣ *Link a Device* ඔබන්න.
├ 4️⃣ *Link with phone number instead* තෝරන්න.
├ 5️⃣ පහත කේතය (Code) ඇතුළත් කරන්න.
╰─────────────────────────────

💡 _පහතින් එවා ඇති කේතය (Code) එක පාරක් Click කර Copy කරගන්න._

👑 *DARK-DINU MD* • https://heshan.devofc.top/`;

      await sock.sendMessage(from, { text: cardText }, { quoted: msg });
      await sock.sendMessage(from, { text: `${code}` });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

      if (waitMsg?.key) {
        await sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

      // Login වෙනකම් socket එක මිනිත්තු 2ක් තබා ගැනීම
      setTimeout(() => {
        if (!isHandshakeComplete) {
          try {
            tempSock.ws.close();
            if (fs.existsSync(tempSessionDir)) {
              fs.rmSync(tempSessionDir, { recursive: true, force: true });
            }
          } catch (_) {}
        }
      }, 120000);

    } catch (err) {
      console.error("[PAIR ERROR]:", err.message);

      if (waitMsg?.key) {
        sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ *Pairing Code එක ලබාගැනීම අසාර්ථක විය:*\n_${err.message}_` },
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
