import fs from "fs";
import path from "path";
import axios from "axios";

const configPath = path.resolve("./autovoice.json");
const sudoPath = path.resolve("./sudo.json");

// Master Owners (ඔයාගේ අංකය)
const MASTER_OWNERS = ["94719845166"];

// Voice clips links (Google Drive Direct streamable IDs)
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

function isUserMaster(msg, senderNum, baseIsOwner, config) {
  if (baseIsOwner || msg.key.fromMe) return true;
  if (MASTER_OWNERS.includes(senderNum)) return true;

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

// Google Drive File එකක් Real Audio Buffer එකක් ලෙස download කරගැනීම
async function downloadDriveAudio(fileId) {
  const downloadUrl = `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`;
  const response = await axios.get(downloadUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Accept": "*/*"
    }
  });

  const buffer = Buffer.from(response.data);
  // Verify it is actual media and not HTML error page
  const head = buffer.slice(0, 50).toString();
  if (head.includes("<!DOCTYPE") || head.includes("<html")) {
    throw new Error("Google Drive blocked direct audio download.");
  }

  return buffer;
}

global.autoVoiceEngineHooked = global.autoVoiceEngineHooked || new WeakSet();

export default {
  name: "autovoice",
  aliases: ["avoice"],
  category: "settings",
  description: "Turn on/off auto voice replies (100% Alive PTT style)",

  async execute({ sock, msg, from, args, prefix, isOwner: baseIsOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderNum = sender.replace(/[^0-9]/g, "");
    const isMaster = isUserMaster(msg, senderNum, baseIsOwner, config);

    // 1. WhatsApp Messages Listener (Auto Voice Engine)
    if (sock && !global.autoVoiceEngineHooked.has(sock)) {
      global.autoVoiceEngineHooked.add(sock);

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const m = messages[0];
        if (!m?.message || m.key.fromMe) return;

        // Auto Voice OFF නම් ක්‍රියාත්මක නොවේ
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
            const audioBuffer = await downloadDriveAudio(driveFileId);

            // Alive Voice එකේ යවන සැබෑ PTT Voice Note (කොළ මයික්) ක්‍රමය
            await sock.sendMessage(
              chatJid,
              {
                audio: audioBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
              },
              { quoted: m }
            );
          } catch (err) {
            console.error("[AUTOVOICE AUDIO FAIL]:", err.message);

            // Fallback: mp4/mpeg mimetype උත්සාහ කිරීම
            try {
              const dlUrl = `https://docs.google.com/uc?export=download&id=${driveFileId}&confirm=t`;
              const fbRes = await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 15000 });
              await sock.sendMessage(
                chatJid,
                {
                  audio: Buffer.from(fbRes.data),
                  mimetype: "audio/mp4",
                  ptt: true
                },
                { quoted: m }
              );
            } catch (fbErr) {
              console.error("[AUTOVOICE FALLBACK FAIL]:", fbErr.message);
            }
          }
        }
      });
    }

    const opt = (args[0] || "").toLowerCase();

    // ON COMMAND
    if (opt === "on") {
      if (!isMaster) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිතා කිරීමට Master Owner ට පමණක් අවසර ඇත!" }, { quoted: msg });
      }
      setAutoVoiceStatus(true);
      sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: "🎙️ *DARK-DINU MD Auto Voice සාර්ථකව සක්‍රිය (ON) කරන ලදී!*" }, { quoted: msg });
    }

    // OFF COMMAND
    if (opt === "off") {
      if (!isMaster) {
        return await sock.sendMessage(from, { text: "❌ මෙම විධානය භාවිතා කිරීමට Master Owner ට පමණක් අවසර ඇත!" }, { quoted: msg });
      }
      setAutoVoiceStatus(false);
      sock.sendMessage(from, { react: { text: "🔇", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: "🔇 *DARK-DINU MD Auto Voice සාර්ථකව අක්‍රිය (OFF) කරන ලදී!*" }, { quoted: msg });
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
