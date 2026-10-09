import fs from "fs";
import path from "path";
import axios from "axios";

const configPath = path.resolve("./autovoice.json");

// Hardcoded Master Owners (ඔයාගේ අංකය කෙලින්ම ඇතුළත් කර ඇත)
const MASTER_OWNERS = ["94719845166"];

// Voice Responses (Google Drive Direct Links)
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

function getAutoVoiceStatus() {
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

function setAutoVoiceStatus(val) {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ enabled: val }, null, 2));
  } catch (err) {
    console.error("[AUTOVOICE ERR]:", err.message);
  }
}

global.autoVoiceEngineHooked = global.autoVoiceEngineHooked || new WeakSet();

export default {
  name: "autovoice",
  aliases: ["avoice"],
  category: "settings",
  description: "Turn on/off auto voice replies",

  async execute({ sock, msg, from, args, prefix, isOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderNum = sender.replace(/[^0-9]/g, "");

    // 100% Unstoppable Owner Access Check
    const isMaster =
      isOwner ||
      msg.key.fromMe ||
      MASTER_OWNERS.includes(senderNum) ||
      (config?.OWNER_NUMBER && String(config.OWNER_NUMBER).includes(senderNum));

    // Message Hook for Voice Replies
    if (sock && !global.autoVoiceEngineHooked.has(sock)) {
      global.autoVoiceEngineHooked.add(sock);

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const m = messages[0];
        if (!m?.message || m.key.fromMe) return;

        if (!getAutoVoiceStatus()) return;

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
            const res = await axios.get(audioUrl, {
              responseType: "arraybuffer",
              timeout: 15000,
              headers: { "User-Agent": "Mozilla/5.0" }
            });

            await sock.sendMessage(
              chatJid,
              {
                audio: Buffer.from(res.data),
                mimetype: "audio/mp4",
                ptt: true
              },
              { quoted: m }
            );
          } catch (err) {
            console.error("[AUTOVOICE AUDIO ERR]:", err.message);
          }
        }
      });
    }

    const opt = (args[0] || "").toLowerCase();

    // ON COMMAND
    if (opt === "on") {
      if (!isMaster) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිතා කළ හැක්කේ Owner ට පමණි!" }, { quoted: msg });
      }
      setAutoVoiceStatus(true);
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: "🎙️ *Auto Voice සාර්ථකව සක්‍රිය (ON) කරන ලදී!*" }, { quoted: msg });
    }

    // OFF COMMAND
    if (opt === "off") {
      if (!isMaster) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිතා කළ හැක්කේ Owner ට පමණි!" }, { quoted: msg });
      }
      setAutoVoiceStatus(false);
      sock.sendMessage(from, { react: { text: "🔇", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: "🔇 *Auto Voice සාර්ථකව අක්‍රිය (OFF) කරන ලදී!*" }, { quoted: msg });
    }

    // STATUS
    const current = getAutoVoiceStatus() ? "සක්‍රියයි (ON) ✅" : "අක්‍රියයි (OFF) ❌";
    return await sock.sendMessage(
      from,
      {
        text: `🎙️ *AUTO VOICE STATUS:* ${current}\n\n*භාවිතය:*\n• \`${pref}autovoice on\`\n• \`${pref}autovoice off\``
      },
      { quoted: msg }
    );
  }
};
