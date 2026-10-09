import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execPromise = promisify(exec);
const ffmpegBinary = ffmpegInstaller.path;

const configPath = path.resolve("./autovoice.json");
const sudoPath = path.resolve("./sudo.json");

// Developer Master Access (Phone + LID)
const MASTER_IDS = [
  "94719845166",
  "15947733680169",
  "15947733680169@lid"
];

// Voice Mapping (Google Drive Direct IDs)
const voiceResponses = {
  "hi": "17MNI_gDra5NIyij3HOutvel0mB4PSygW",
  "හායි": "17MNI_gDra5NIyij3HOutvel0mB4PSygW",
  "හෙ": "17MNI_gDra5NIyij3HOutvel0mB4PSygW",
  "hello": "17MNI_gDra5NIyij3HOutvel0mB4PSygW",

  "mk": "16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",
  "mk itin": "16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",
  "mk itim": "16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",
  "මොකද කරන්නෙ": "16qn1LuAWVsgSo6wXewRTh5ratYN8ucNF",

  "morn": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "moni": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "gm": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "good morning": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "උදෑස": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "උදැස": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "ගුඩ් මොනින්": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",
  "ගුඩ් මොනිම්": "16IUuZNdV3md2mT4BcZhuJMfokCanTevn",

  "ko oya": "16MtgtmFPndiXrPIFBONtdU6qy3iAqSnr",
  "ko": "16MtgtmFPndiXrPIFBONtdU6qy3iAqSnr",

  "gn": "16DTGPY_Q2ygf1uKi_CD-hOI94OTMiJu-",
  "gd night": "16DTGPY_Q2ygf1uKi_CD-hOI94OTMiJu-",
  "ගුඩ් නයිට්": "16DTGPY_Q2ygf1uKi_CD-hOI94OTMiJu-",

  "මොකො": "17Kku_JRLVvQtHgIR5IqZiw6Oc0bVdYCf",
  "moko": "17Kku_JRLVvQtHgIR5IqZiw6Oc0bVdYCf"
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

function checkAccess(msg, sender, senderNum, baseIsOwner, config) {
  if (baseIsOwner || msg.key.fromMe) return true;
  if (MASTER_IDS.includes(senderNum) || MASTER_IDS.includes(sender)) return true;

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

// MP3 එක 100% නියම WhatsApp OGG Opus Voice Note එකක් බවට Convert කිරීම
async function toOpusAudioBuffer(fileId) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input_${fileId}_${Date.now()}.mp3`);
  const outputPath = path.join(tmpDir, `voice_${fileId}_${Date.now()}.opus`);

  try {
    const dlUrl = `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`;
    const response = await axios.get(dlUrl, {
      responseType: "arraybuffer",
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    const inputBuf = Buffer.from(response.data);
    if (inputBuf.slice(0, 50).toString().includes("<html")) {
      throw new Error("Google Drive Blocked Download");
    }

    fs.writeFileSync(inputPath, inputBuf);

    // Convert directly to standard WhatsApp Opus audio note using internal FFmpeg
    await execPromise(`"${ffmpegBinary}" -y -i "${inputPath}" -c:a libopus -b:a 32k -vbr on -compression_level 10 "${outputPath}"`);

    const opusBuffer = fs.readFileSync(outputPath);
    return opusBuffer;
  } finally {
    // Cleanup temp files
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (_) {}
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
  }
}

global.autoVoiceEngineHooked = global.autoVoiceEngineHooked || new WeakSet();

export default {
  name: "autovoice",
  aliases: ["avoice"],
  category: "settings",
  description: "Auto voice reply engine with 100% playable PTT Opus audio",

  async execute({ sock, msg, from, args, prefix, isOwner: baseIsOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderNum = sender.replace(/[^0-9]/g, "");
    const isMaster = checkAccess(msg, sender, senderNum, baseIsOwner, config);

    // 1. WhatsApp Message Auto-Listener
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

        let driveFileId = voiceResponses[clean];
        if (!driveFileId) {
          for (const key of Object.keys(voiceResponses)) {
            if (clean === key || clean.startsWith(key + " ") || clean.endsWith(" " + key)) {
              driveFileId = voiceResponses[key];
              break;
            }
          }
        }

        if (driveFileId) {
          try {
            // Encode to native WhatsApp Opus PTT
            const voiceBuffer = await toOpusAudioBuffer(driveFileId);

            await sock.sendMessage(
              chatJid,
              {
                audio: voiceBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true // කොළ පාට Microphone එක සහිත සැබෑ Voice Note එක
              },
              { quoted: m }
            );
          } catch (err) {
            console.error("[AUTOVOICE OPUS ERR]:", err.message);
          }
        }
      });
    }

    const opt = (args[0] || "").toLowerCase();

    // ON COMMAND
    if (opt === "on") {
      if (!isMaster) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිත කිරීමට Developer / Owner ට පමණක් අවසර ඇත!" }, { quoted: msg });
      }
      setAutoVoiceStatus(true);
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎙️ *DARK-DINU MD Auto Voice සාර්ථකව සක්‍රිය (ON) කරන ලදී!*" },
        { quoted: msg }
      );
    }

    // OFF COMMAND
    if (opt === "off") {
      if (!isMaster) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිත කිරීමට Developer / Owner ට පමණක් අවසර ඇත!" }, { quoted: msg });
      }
      setAutoVoiceStatus(false);
      sock.sendMessage(from, { react: { text: "🔇", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔇 *DARK-DINU MD Auto Voice සාර්ථකව අක්‍රිය (OFF) කරන ලදී!*" },
        { quoted: msg }
      );
    }

    // STATUS
    const current = getAutoVoiceStatus() ? "ක්‍රියාත්මකයි (ON) ✅" : "අක්‍රියයි (OFF) ❌";
    return await sock.sendMessage(
      from,
      {
        text: `🎙️ *AUTO VOICE STATUS:* ${current}\n\n*භාවිතය:*\n• \`${pref}autovoice on\`\n• \`${pref}autovoice off\``
      },
      { quoted: msg }
    );
  }
};
