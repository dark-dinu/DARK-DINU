import { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  delay,
  Browsers
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";

const DEFAULT_PHONE = "94719845166";

export default {
  name: "bot",
  aliases: ["pair", "paircode", "clone"],
  category: "general",
  description: "Generate WhatsApp pairing code directly with zero-lag login handshake",

  async execute({ sock, msg, from, args }) {
    sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    let rawNumber = args.join("").replace(/[^0-9]/g, "");
    let targetNumber = rawNumber && rawNumber.length >= 9 ? rawNumber : DEFAULT_PHONE;

    const waitMsg = await sock.sendMessage(
      from,
      {
        text: 
`╔═════════════════════════════╗
   ⚡ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔  𝐂 𝐎 𝐑 𝐄
╚═════════════════════════════╝

> ⏳ *Generating Secure Pairing Code for:*
> 📱 *Number:* \`+${targetNumber}\`

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

      // Handshake එක සුමටව කරවන Socket Configuration
      const tempSock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Chrome"), // macOS Desktop Signature එකෙන් Logging in ඉක්මන් වේ
        syncFullHistory: false,
        markOnlineOnConnect: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: false
      });

      // 🔴 Key Fix: Credentials ක්ෂණිකව Save කරවීම
      tempSock.ev.on("creds.update", async () => {
        await saveCreds();
      });

      // 🔴 Handshake Success Handler (Phone එකේ කැරකෙන එක නවත්වන කොටස)
      tempSock.ev.on("connection.update", async (update) => {
        const { connection, isNewLogin } = update;

        if (connection === "open" || isNewLogin) {
          try {
            await sock.sendMessage(from, {
              text: `🎉 *LOGIN SUCCESSFUL!* \n\n📱 *Number:* \`+${targetNumber}\`\n✅ Device එක සාර්ථකව සම්බන්ධ විය (Linked Successfully)!`
            });
          } catch (_) {}

          // Credentials හොඳින් write වීමට තත්පර 10ක් තබා terminate කිරීම
          setTimeout(() => {
            try {
              tempSock.end(undefined);
              if (fs.existsSync(tempSessionDir)) {
                fs.rmSync(tempSessionDir, { recursive: true, force: true });
              }
            } catch (_) {}
          }, 10000);
        }
      });

      await delay(2500);

      // Code එක ඉල්ලුම් කිරීම
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
├ 2️⃣ ඉහළ දකුණු කෙළවරේ තිත් 3 ඔබන්න.
├ 3️⃣ *Linked Devices* තෝරන්න.
├ 4️⃣ *Link a Device* ඔබන්න.
├ 5️⃣ *Link with phone number instead* තෝරන්න.
├ 6️⃣ පහත ඇති *Code* එක ඇතුළත් කරන්න.
╰─────────────────────────────

💡 _පහතින් එවා ඇති කේතය (Code) එක පාරක් Click කර Copy කරගන්න._

👑 *DARK-DINU MD* • https://heshan.devofc.top/`;

      await sock.sendMessage(from, { text: cardText }, { quoted: msg });
      await sock.sendMessage(from, { text: `${code}` });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

      if (waitMsg?.key) {
        await sock.sendMessage(from, { delete: waitMsg.key }).catch(() => {});
      }

      // Socket එක තත්පර 120ක් ජීවීව තබා ගැනීම (Login වන තෙක්)
      setTimeout(() => {
        try {
          tempSock.end(undefined);
          if (fs.existsSync(tempSessionDir)) {
            fs.rmSync(tempSessionDir, { recursive: true, force: true });
          }
        } catch (_) {}
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
