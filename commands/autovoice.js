import fs from "fs";
import path from "path";
import axios from "axios";

const configPath = path.resolve("./autovoice.json");
const sudoPath = path.resolve("./sudo.json");

// Voice Clips Mapping (Google Drive Links)
const voiceResponses = {
  "hi": "https://drive.google.com/uc?export=download&id=17MNI_gDra5NIyij3HOutvel0mB4PSygW",
  "හායි": "https://drive.google.com/uc?export=download&id=17MNI_gDra5NIyij3HOutvel0mB4PSygW",
  "හෙ": "https://drive.google.com/uc?export=download&id=17MNI_gDra5NIyij3HOutvel0mB4PSygW",
  "hello": "https://drive.google.com/uc?export=download&id=17MNI_gDra5NIyij3HOutvel0mB4PSygW",

  "mk": "https://drive.google.com/uc?export=download&id=16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",
  "mk itin": "https://drive.google.com/uc?export=download&id=16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",
  "mk itim": "https://drive.google.com/uc?export=download&id=16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",
  "මොකද කරන්නෙ": "https://drive.google.com/uc?export=download&id=16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",

  "morn": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "moni": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "gm": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "good morning": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "උදෑස": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "උදැස": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "ගුඩ් මොනින්": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "ගුඩ් මොනිම්": "https://drive.google.com/uc?export=download&id=16IUuZNdV3md2mT4BcZhuJMfokCanTevn",

  "ko oya": "https://drive.google.com/uc?export=download&id=16MtgtmFPndiXrPIFBONtdU6qy3iAqSnr",
  "ko": "https://drive.google.com/uc?export=download&id=16MtgtmFPndiXrPIFBONtdU6qy3iAqSnr",

  "gn": "https://drive.google.com/uc?export=download&id=16DTGPY_Q2ygf1uKi_CD-hOI94OTMiJu-",
  "gd night": "https://drive.google.com/uc?export=download&id=16DTGPY_Q2ygf1uKi_CD-hOI94OTMiJu-",
  "ගුඩ් නයිට්": "https://drive.google.com/uc?export=download&id=16DTGPY_Q2ygf1uKi_CD-hOI94OTMiJu-",

  "මොකො": "https://drive.google.com/uc?export=download&id=17Kku_JRLVvQtHgIR5IqZiw6Oc0bVdYCf",
  "moko": "https://drive.google.com/uc?export=download&id=17Kku_JRLVvQtHgIR5IqZiw6Oc0bVdYCf"
};

// Config කියවීම (Auto Voice Status)
function isAutoVoiceActive() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({ enabled: true }, null, 2));
      return true;
    }
    const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return data.enabled !== false;
  } catch {
    return true;
  }
}

// Config ලියවීම
function setAutoVoiceStatus(status) {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ enabled: status }, null, 2));
  } catch (err) {
    console.error("[AUTOVOICE SAVE ERR]:", err.message);
  }
}

// Owner සහ Sudo පරීක්ෂාව
function checkIsOwner(msg, senderNum, baseIsOwner, config) {
  if (baseIsOwner || msg.key.fromMe) return true;

  try {
    if (fs.existsSync(sudoPath)) {
      const sudos = JSON.parse(fs.readFileSync(sudoPath, "utf-8") || "[]");
      if (sudos.includes(senderNum)) return true;
    }
  } catch (_) {}

  const ownerNums = [
    ...(Array.isArray(config?.OWNER_NUMBERS) ? config.OWNER_NUMBERS : []),
    config?.OWNER_NUMBER,
    config?.ownerNumber
  ].filter(Boolean).map(n => String(n).replace(/[^0-9]/g, ""));

  return ownerNums.includes(senderNum);
}

// Google Drive Link එකෙන් කෙලින්ම Buffer එකක් ලෙස download කරගැනීම
async function fetchAudioBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  return Buffer.from(res.data);
}

// Global listener hook
global.autoVoiceEngineHooked = global.autoVoiceEngineHooked || new WeakSet();

export default {
  name: "autovoice",
  aliases: ["avoice"],
  category: "settings",
  description: "Turn on/off auto voice replies",

  async execute({ sock, msg, from, args, prefix, isOwner: baseIsOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderNum = sender.replace(/[^0-9]/g, "");

    // 1. Background Message Listener එක register කිරීම
    if (sock && !global.autoVoiceEngineHooked.has(sock)) {
      global.autoVoiceEngineHooked.add(sock);

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const m = messages[0];
        if (!m?.message || m.key.fromMe) return;

        // Auto Voice OFF කර ඇත්නම් ක්‍රියාත්මක නොවේ
        if (!isAutoVoiceActive()) return;

        const chatJid = m.key.remoteJid;
        const raw = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const clean = raw.trim().toLowerCase();

        if (!clean) return;

        let audioUrl = voiceResponses[clean];
        if (!audioUrl) {
          for (const key of Object.keys(voiceResponses)) {
            if (clean === key || clean.startsWith(key + " ") || clean.endsWith(" " + key)) {
              audioUrl = voiceResponses[key];
              break;
            }
          }
        }

        if (audioUrl) {
          try {
            const audioBuf = await fetchAudioBuffer(audioUrl);
            await sock.sendMessage(
              chatJid,
              {
                audio: audioBuf,
                mimetype: "audio/mp4",
                ptt: true // WhatsApp Voice Note (කොළ පාට mic icon එක සහිතව)
              },
              { quoted: m }
            );
          } catch (err) {
            console.error("[AUTOVOICE SEND ERR]:", err.message);
          }
        }
      });
    }

    // 2. Command එක Handle කිරීම (.autovoice on / off)
    const opt = (args[0] || "").toLowerCase();
    const isAuthorized = checkIsOwner(msg, senderNum, baseIsOwner, config);

    if (opt === "on") {
      if (!isAuthorized) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ මෙම විධානය භාවිත කළ හැක්කේ Bot Owner හෝ Sudo පරිශීලකයින්ට පමණි!" },
          { quoted: msg }
        );
      }

      setAutoVoiceStatus(true);
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎙️ *DARK-DINU MD Auto Voice සාර්ථකව සක්‍රිය (ON) කරන ලදී!*" },
        { quoted: msg }
      );
    }

    if (opt === "off") {
      if (!isAuthorized) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ මෙම විධානය භාවිත කළ හැක්කේ Bot Owner හෝ Sudo පරිශීලකයින්ට පමණි!" },
          { quoted: msg }
        );
      }

      setAutoVoiceStatus(false);
      sock.sendMessage(from, { react: { text: "🔇", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔇 *DARK-DINU MD Auto Voice සාර්ථකව අක්‍රිය (OFF) කරන ලදී!*" },
        { quoted: msg }
      );
    }

    // Status එක පෙන්වීම
    const state = isAutoVoiceActive() ? "ක්‍රියාත්මකයි (ON) ✅" : "අක්‍රියයි (OFF) ❌";
    return await sock.sendMessage(
      from,
      {
        text: 
`🎙️ ｡ﾟ•┈୨ *AUTO VOICE SYSTEM* ୧┈•ﾟ｡ 🔊
━━━━━━━━━━━━━━━━━━━━━

⚙️ *තත්ත්වය:* ${state}

📌 *භාවිතය:*
  • \`${pref}autovoice on\` ➔ සක්‍රිය කිරීමට
  • \`${pref}autovoice off\` ➔ අක්‍රිය කිරීමට

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
