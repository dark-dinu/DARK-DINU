import fs from "fs";
import path from "path";

const configPath = path.resolve("./autovoice.json");

// Voice Mapping (Google Drive Direct Links)
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

// Basahin ang status mula sa JSON file
function getStatus() {
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

// I-save ang status sa JSON file
function setStatus(enabled) {
  fs.writeFileSync(configPath, JSON.stringify({ enabled }, null, 2));
}

global.autoVoiceHooked = global.autoVoiceHooked || new WeakSet();

export default {
  name: "autovoice",
  aliases: ["avoice"],
  category: "settings",
  description: "I-on o i-off ang auto voice reply",

  async execute({ sock, msg, from, args, prefix, isOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";

    // Auto-listener para sa mga pumapasok na mensahe
    if (sock && !global.autoVoiceHooked.has(sock)) {
      global.autoVoiceHooked.add(sock);

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        const m = messages[0];
        if (!m?.message || m.key.fromMe) return;

        // Suriin kung naka-on ang auto voice
        if (!getStatus()) return;

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
            await sock.sendMessage(
              chatJid,
              {
                audio: { url: audioUrl },
                mimetype: "audio/mp4",
                ptt: true
              },
              { quoted: m }
            );
          } catch (err) {
            console.error("[AUTOVOICE ERROR]:", err.message);
          }
        }
      });
    }

    // Command para sa ON at OFF
    const action = args[0]?.toLowerCase();

    if (action === "on") {
      if (!isOwner && !msg.key.fromMe) {
        return await sock.sendMessage(from, { text: "❌ May-ari lamang ang maaaring magbago nito." }, { quoted: msg });
      }
      setStatus(true);
      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎙️ *Ang Auto Voice ay matagumpay na na-ON!*" },
        { quoted: msg }
      );
    }

    if (action === "off") {
      if (!isOwner && !msg.key.fromMe) {
        return await sock.sendMessage(from, { text: "❌ May-ari lamang ang maaaring magbago nito." }, { quoted: msg });
      }
      setStatus(false);
      sock.sendMessage(from, { react: { text: "🛑", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔇 *Ang Auto Voice ay matagumpay na na-OFF!*" },
        { quoted: msg }
      );
    }

    const currentStatus = getStatus() ? "NAKA-ON ✅" : "NAKA-OFF ❌";
    return await sock.sendMessage(
      from,
      {
        text: `🎙️ *AUTO VOICE STATUS:* ${currentStatus}\n\n*Paggamit:*\n• \`${pref}autovoice on\` - Upang i-activate\n• \`${pref}autovoice off\` - Upang i-deactivate`
      },
      { quoted: msg }
    );
  }
};
