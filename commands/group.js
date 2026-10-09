import fs from "fs";
import path from "path";
import { cleanPhone } from "../core/sessionManager.js";

// Global In-Memory Group Settings Cache
global.groupSettingsCache = global.groupSettingsCache || new Map();
global.groupListenerHooked = global.groupListenerHooked || new WeakSet();

const BACKUP_FILE = path.join(process.cwd(), "session_backups", "group_settings.json");

// Default Bad Words Base List
const DEFAULT_BAD_WORDS = [
  "fuck", "hutto", "ponnaya", "pakaya", "kariyo", "puka", "ballo", 
  "sex", "porn", "kariya", "hutti", "ammatasiri", "vasiya"
];

// Default Bot Logo Fallback
let defaultBotLogo = null;
(function initDefaultLogo() {
  const localCandidates = [
    path.join(process.cwd(), "logo.jpg"),
    path.join(process.cwd(), "logo.png"),
    path.join(process.cwd(), "assets", "logo.jpg"),
    path.join(process.cwd(), "assets", "logo.png")
  ];
  for (const p of localCandidates) {
    if (fs.existsSync(p)) {
      defaultBotLogo = fs.readFileSync(p);
      return;
    }
  }
  defaultBotLogo = { url: "https://files.catbox.moe/k315x4.jpg" };
})();

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

// 1. Group State Load & Dual Storage
async function getGroupConfig(groupJid) {
  if (global.groupSettingsCache.has(groupJid)) {
    return global.groupSettingsCache.get(groupJid);
  }

  const defaults = {
    jid: groupJid,
    welcome: true,
    goodbye: true,
    antiLink: false,
    antiBot: false,
    antiBad: false,
    antiBadMode: "warn", // 'warn' or 'kick'
    badWords: [...DEFAULT_BAD_WORDS],
    antiMention: false
  };

  try {
    const db = getDbInstance();
    if (db) {
      const saved = await db.collection("group_configurations").findOne({ _id: groupJid });
      if (saved) {
        delete saved._id;
        const merged = { ...defaults, ...saved };
        if (!Array.isArray(merged.badWords) || merged.badWords.length === 0) {
          merged.badWords = [...DEFAULT_BAD_WORDS];
        }
        global.groupSettingsCache.set(groupJid, merged);
        return merged;
      }
    }
  } catch (_) {}

  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const all = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      if (all[groupJid]) {
        const merged = { ...defaults, ...all[groupJid] };
        global.groupSettingsCache.set(groupJid, merged);
        return merged;
      }
    }
  } catch (_) {}

  global.groupSettingsCache.set(groupJid, defaults);
  return defaults;
}

// 2. Group State Save
async function saveGroupConfig(groupJid, newConfig) {
  global.groupSettingsCache.set(groupJid, newConfig);

  setImmediate(() => {
    try {
      const dir = path.dirname(BACKUP_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let currentData = {};
      if (fs.existsSync(BACKUP_FILE)) {
        try { currentData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8")); } catch (_) {}
      }
      currentData[groupJid] = newConfig;
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(currentData, null, 2));
    } catch (_) {}
  });

  setImmediate(async () => {
    try {
      const db = getDbInstance();
      if (db) {
        await db.collection("group_configurations").updateOne(
          { _id: groupJid },
          { $set: newConfig },
          { upsert: true }
        );
      }
    } catch (_) {}
  });
}

async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const participant = meta.participants.find(p => p.id.split(":")[0] === userJid.split(":")[0]);
    return participant?.admin === "admin" || participant?.admin === "superadmin";
  } catch (_) {
    return false;
  }
}

async function isBotAdmin(sock, groupJid) {
  const botPhone = cleanPhone(sock.user?.id || "");
  return await isGroupAdmin(sock, groupJid, `${botPhone}@s.whatsapp.net`);
}

async function getUserProfilePic(sock, userJid) {
  try {
    const url = await sock.profilePictureUrl(userJid, "image");
    return { url };
  } catch (_) {
    return defaultBotLogo;
  }
}

// -------------------------------------------------------------
// Core Group Guardian & Welcomer Listener
// -------------------------------------------------------------
export function hookGroupEngine(sock) {
  if (!sock || global.groupListenerHooked.has(sock)) return;
  global.groupListenerHooked.add(sock);

  // 1. Welcome & Goodbye Events
  sock.ev.on("group-participants.update", async ({ id: groupJid, participants, action }) => {
    const config = await getGroupConfig(groupJid);

    for (const participant of participants) {
      const cleanUser = cleanPhone(participant);

      if (action === "add" && config.welcome) {
        const imageSource = await getUserProfilePic(sock, participant);
        const welcomeText = 
`🎀 ｡ﾟ•┈୨ *WELCOME TO THE GROUP* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👋 *Hello:* @${cleanUser}
  ✨ *Welcome to our sweet community!*
  📜 *Please read group description and follow rules.*

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        await sock.sendMessage(groupJid, {
          image: imageSource,
          caption: welcomeText,
          mentions: [participant]
        }).catch(() => {});
      }

      if ((action === "remove" || action === "leave") && config.goodbye) {
        const imageSource = await getUserProfilePic(sock, participant);
        const byeText = 
`🌸 ｡ﾟ•┈୨ *GOODBYE MEMBER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👋 *Goodbye:* @${cleanUser}
  🥺 *We will miss you! Take care on your way!*

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

        await sock.sendMessage(groupJid, {
          image: imageSource,
          caption: byeText,
          mentions: [participant]
        }).catch(() => {});
      }
    }
  });

  // 2. Anti-Shields Inspector
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    if (!from || !from.endsWith("@g.us")) return;

    const sender = m.key.participant || m.participant || from;
    const config = await getGroupConfig(from);
    const botIsAdmin = await isBotAdmin(sock, from);

    // Skip if sender is an Admin
    const senderIsAdmin = await isGroupAdmin(sock, from, sender);
    if (senderIsAdmin) return;

    const raw = m.message.ephemeralMessage?.message || m.message;
    const bodyText = (
      raw.conversation ||
      raw.extendedTextMessage?.text ||
      raw.imageMessage?.caption ||
      raw.videoMessage?.caption ||
      ""
    ).trim();

    // Shield 1: Anti-Link
    if (config.antiLink && /(chat\.whatsapp\.com|wa\.me\/channel\/|t\.me\/|whatsapp\.com\/channel\/)/i.test(bodyText)) {
      if (botIsAdmin) {
        await sock.sendMessage(from, { delete: m.key }).catch(() => {});
        await sock.groupParticipantsUpdate(from, [sender], "remove").catch(() => {});
        await sock.sendMessage(from, {
          text: `🛡️ *Link Shield:* @${cleanPhone(sender)} was removed for sharing unauthorized links!`,
          mentions: [sender]
        });
      }
      return;
    }

    // Shield 2: Anti-Badword (Custom Words + Warn/Kick Mode)
    if (config.antiBad) {
      const lower = bodyText.toLowerCase();
      const detectedWord = config.badWords.find(w => {
        const regex = new RegExp(`\\b${w}\\b`, "i");
        return regex.test(lower) || lower.includes(w.toLowerCase());
      });

      if (detectedWord) {
        if (botIsAdmin) {
          // Message එක ක්ෂණිකව Delete කිරීම
          await sock.sendMessage(from, { delete: m.key }).catch(() => {});

          if (config.antiBadMode === "kick") {
            // Instant Kick Mode
            await sock.groupParticipantsUpdate(from, [sender], "remove").catch(() => {});
            await sock.sendMessage(from, {
              text: `🚨 *ANTI-BADWORD ACTION (KICK)* 🚨\n\n@${cleanPhone(sender)} was *KICKED* for using banned language: \`"${detectedWord}"\`! 🚫`,
              mentions: [sender]
            });
          } else {
            // Warning Card Mode
            await sock.sendMessage(from, {
              text: 
`⚠️ ｡ﾟ•┈୨ *BADWORD WARNING* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━
  👤 *User:* @${cleanPhone(sender)}
  🚫 *Violation:* Inappropriate word detected!
  🛑 *Notice:* Bad words are strictly prohibited here.
━━━━━━━━━━━━━━━━━━━━━
_Please respect group members or you will be removed!_`,
              mentions: [sender]
            });
          }
        }
        return;
      }
    }

    // Shield 3: Anti-Mention / Mass Tag Shield
    if (config.antiMention) {
      const mentions = raw.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentions.length > 5) {
        if (botIsAdmin) {
          await sock.sendMessage(from, { delete: m.key }).catch(() => {});
        }
        return;
      }
    }
  });
}

// -------------------------------------------------------------
// Plugin Command Execution
// -------------------------------------------------------------
export default {
  name: "group",
  aliases: ["kick", "add", "grp", "groupsetting", "badword"],
  category: "group",
  description: "Ultimate Group Administration, Badword Customizer & Protection Shields",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    hookGroupEngine(sock);

    const pref = prefix || appConfig?.PREFIX || ".";
    if (!from.endsWith("@g.us")) {
      return await sock.sendMessage(
        from,
        { text: "🌸 *Oopsie!* This command can only be used inside groups, honey~" },
        { quoted: msg }
      );
    }

    const sender = msg.key.participant || msg.participant || from;
    const botPhone = cleanPhone(sock.user?.id || "");
    const isOwner = msg.key.fromMe || cleanPhone(sender) === botPhone;
    const adminCheck = await isGroupAdmin(sock, from, sender);

    if (!adminCheck && !isOwner) {
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only Group Admins can control group features!* 🌸" },
        { quoted: msg }
      );
    }

    const fullBody = body.trim();
    const cmdTrigger = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const gConfig = await getGroupConfig(from);

    // -------------------------------------------------------------
    // 1. Badword Manager (.badword add / del / list)
    // -------------------------------------------------------------
    if (cmdTrigger === "badword") {
      const sub = args[0]?.toLowerCase()?.trim();
      const targetWord = args.slice(1).join(" ").trim().toLowerCase();

      if (sub === "add") {
        if (!targetWord) {
          return await sock.sendMessage(from, { text: `🌸 *Usage:* \`${pref}badword add <word>\`` }, { quoted: msg });
        }
        if (!gConfig.badWords.includes(targetWord)) {
          gConfig.badWords.push(targetWord);
          await saveGroupConfig(from, gConfig);
        }
        sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🛡️ *Badword Added:* Added \`"${targetWord}"\` to the banned words list!` },
          { quoted: msg }
        );
      }

      if (sub === "del" || sub === "remove") {
        if (!targetWord) {
          return await sock.sendMessage(from, { text: `🌸 *Usage:* \`${pref}badword del <word>\`` }, { quoted: msg });
        }
        gConfig.badWords = gConfig.badWords.filter(w => w !== targetWord);
        await saveGroupConfig(from, gConfig);

        sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🧹 *Badword Removed:* \`"${targetWord}"\` was removed from the list!` },
          { quoted: msg }
        );
      }

      if (sub === "list") {
        let listStr = `🎀 ｡ﾟ•┈୨ *BANNED WORDS LIST* ୧┈•ﾟ｡ 🐾\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        gConfig.badWords.forEach((w, i) => {
          listStr += `  • ${i + 1}. \`${w}\`\n`;
        });
        listStr += `\n━━━━━━━━━━━━━━━━━━━━━\n⚙️ *Current Action Mode:* \`${gConfig.antiBadMode.toUpperCase()}\`\n💖 *DARK-DINU MD*`;
        return await sock.sendMessage(from, { text: listStr }, { quoted: msg });
      }

      return await sock.sendMessage(
        from,
        { text: `🌸 *Usage:*\n• \`${pref}badword add <word>\`\n• \`${pref}badword del <word>\`\n• \`${pref}badword list\`` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 2. Direct Commands: .kick & .add
    // -------------------------------------------------------------
    if (cmdTrigger === "kick") {
      const botCanKick = await isBotAdmin(sock, from);
      if (!botCanKick) {
        return await sock.sendMessage(from, { text: "💔 *I need to be an Admin to remove members!*" }, { quoted: msg });
      }

      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const targetUser = quoted?.participant || (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])[0];

      if (!targetUser) {
        return await sock.sendMessage(from, { text: `🌸 *Usage:* Tag or reply to a user with \`${pref}kick\`` }, { quoted: msg });
      }

      await sock.groupParticipantsUpdate(from, [targetUser], "remove");
      sock.sendMessage(from, { react: { text: "👋", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🧹 *Removed:* Successfully kicked @${cleanPhone(targetUser)}!`, mentions: [targetUser] },
        { quoted: msg }
      );
    }

    if (cmdTrigger === "add") {
      const botCanAdd = await isBotAdmin(sock, from);
      if (!botCanAdd) {
        return await sock.sendMessage(from, { text: "💔 *I need to be an Admin to add members!*" }, { quoted: msg });
      }

      const inputNumber = args.join("").replace(/[^0-9]/g, "");
      if (!inputNumber) {
        return await sock.sendMessage(from, { text: `🌸 *Usage:* \`${pref}add 9471xxxxxxx\`` }, { quoted: msg });
      }

      const targetJid = `${inputNumber}@s.whatsapp.net`;
      await sock.groupParticipantsUpdate(from, [targetJid], "add");
      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `🎉 *Added:* Added +${inputNumber} to the group!` }, { quoted: msg });
    }

    // -------------------------------------------------------------
    // 3. Settings Toggles (.group <feature> on/off & mode)
    // -------------------------------------------------------------
    const opt = args[0]?.toLowerCase()?.trim();
    const val = args[1]?.toLowerCase()?.trim();

    // Anti-Bad Action Mode (.group antibad mode warn/kick)
    if (opt === "antibad" && val === "mode" && args[2]) {
      const targetMode = args[2].toLowerCase().trim();
      if (["warn", "kick"].includes(targetMode)) {
        gConfig.antiBadMode = targetMode;
        await saveGroupConfig(from, gConfig);
        sock.sendMessage(from, { react: { text: "⚙️", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: `🌸 *Anti-Bad Action Mode Updated to:* \`${targetMode.toUpperCase()}\`!` },
          { quoted: msg }
        );
      }
    }

    const featureKeys = {
      "welcome": "welcome",
      "goodbye": "goodbye",
      "bye": "goodbye",
      "antilink": "antiLink",
      "link": "antiLink",
      "antibot": "antiBot",
      "bot": "antiBot",
      "antibad": "antiBad",
      "badword": "antiBad",
      "antimention": "antiMention",
      "mention": "antiMention"
    };

    if (opt && featureKeys[opt]) {
      const targetKey = featureKeys[opt];
      let newState = !gConfig[targetKey];
      if (val === "on") newState = true;
      if (val === "off") newState = false;

      gConfig[targetKey] = newState;
      await saveGroupConfig(from, gConfig);

      sock.sendMessage(from, { react: { text: newState ? "💖" : "💤", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: `🌸 *${opt.toUpperCase()}:* ${newState ? "🟢 ACTIVATED & RUNNING ✨" : "🔴 DISABLED SOFTLY 💤"}` },
        { quoted: msg }
      );
    }

    // -------------------------------------------------------------
    // 4. Main Group Dashboard (.group)
    // -------------------------------------------------------------
    sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});

    const card = 
`🎀 ｡ﾟ•┈୨ *GROUP CONTROL & PROTECTION* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━━━

  👥 *Group JID:* \`${from.slice(0, 15)}...@g.us\`
  👑 *Admin Controller:* Only Admins & Owner

┌─〔 ⚙️ *CURRENT ACTIVE GROUP SHIELDS* 〕
├─▸ 💌 *Welcome Card*    : ${gConfig.welcome ? "🟢 ON (With User DP)" : "🔴 OFF"}
├─▸ 🌸 *Goodbye Card*    : ${gConfig.goodbye ? "🟢 ON (With User DP)" : "🔴 OFF"}
├─▸ 🛡️ *Anti-Link Shield*: ${gConfig.antiLink ? "🟢 ON (Auto Kick)" : "🔴 OFF"}
├─▸ 🤖 *Anti-Bot Shield* : ${gConfig.antiBot ? "🟢 ON (Auto Kick)" : "🔴 OFF"}
├─▸ 🤬 *Anti-Badword*    : ${gConfig.antiBad ? `🟢 ON [Mode: ${gConfig.antiBadMode.toUpperCase()}]` : "🔴 OFF"}
├─▸ 🏷️ *Anti-Mention*    : ${gConfig.antiMention ? "🟢 ON (Anti-Spam)" : "🔴 OFF"}
├─▸ 📜 *Total Badwords*  : \`${gConfig.badWords.length} Words Loaded\`
└───────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━
🍬 *ANTI-BADWORD CONTROLS:*
  • *${pref}group antibad on/off* ➔ On or Off Shield
  • *${pref}group antibad mode warn* ➔ Delete & Send Warning ⚠️
  • *${pref}group antibad mode kick* ➔ Delete & Instant Kick 🚨
  • *${pref}badword add <word>* ➔ Add custom word
  • *${pref}badword del <word>* ➔ Remove word
  • *${pref}badword list* ➔ View all banned words

🍬 *OTHER GROUP SHIELDS:*
  • *${pref}group welcome on/off*
  • *${pref}group goodbye on/off*
  • *${pref}group antilink on/off*
  • *${pref}group antibot on/off*
  • *${pref}group antimention on/off*

⚡ *ADMIN ACTIONS:*
  • *${pref}kick @user*  ➔ Remove Member
  • *${pref}add <phone>* ➔ Add Member

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

    await sock.sendMessage(from, { text: card }, { quoted: msg });
  }
};
