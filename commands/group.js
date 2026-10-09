import fs from "fs";
import path from "path";

// 1. In-Memory Isolated Cache & Interactive Session Tracker
global.groupSettingsCache = global.groupSettingsCache || new Map();
global.groupInteractiveSessions = global.groupInteractiveSessions || new Map();
global.groupListenerHooked = global.groupListenerHooked || new WeakSet();

const BACKUP_DIR = path.join(process.cwd(), "session_backups");
const BACKUP_FILE = path.join(BACKUP_DIR, "group_settings.json");

if (!fs.existsSync(BACKUP_DIR)) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) {}
}

const DEFAULT_BAD_WORDS = [
  "fuck", "hutto", "ponnaya", "pakaya", "kariyo", "puka", "ballo", 
  "sex", "porn", "kariya", "hutti", "ammatasiri"
];

function cleanPhone(jid = "") {
  if (!jid) return "";
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getDbInstance() {
  const client = global.mongoClient || global.sharedMongoClient;
  return client ? client.db(process.env.DB_NAME || "whatsapp_multi_bots") : null;
}

// 2. Safe Settings Loader & Persistence
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

async function saveGroupConfig(groupJid, newConfig) {
  global.groupSettingsCache.set(groupJid, newConfig);

  setImmediate(() => {
    try {
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
    const targetClean = cleanPhone(userJid);
    const member = meta.participants.find(p => cleanPhone(p.id) === targetClean);
    return member?.admin === "admin" || member?.admin === "superadmin";
  } catch (_) {
    return false;
  }
}

async function isBotAdmin(sock, groupJid) {
  return await isGroupAdmin(sock, groupJid, sock.user?.id || "");
}

// Generates the Aesthetic Dashboard String
function generateDashboardCard(gConfig, groupJid) {
  return `🎀 ｡ﾟ•┈୨ *GROUP CONTROL DASHBOARD* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━━━

  👥 *Group:* \`${groupJid.slice(0, 16)}...\`
  👑 *Access:* Only Group Admins

┌─〔 ⚙️ *CURRENT ACTIVE SHIELDS* 〕
├─▸ 1️⃣ *Welcome Card*    : ${gConfig.welcome ? "🟢 ON (With DP)" : "🔴 OFF"}
├─▸ 2️⃣ *Goodbye Card*    : ${gConfig.goodbye ? "🟢 ON (With DP)" : "🔴 OFF"}
├─▸ 3️⃣ *Anti-Link Shield*: ${gConfig.antiLink ? "🟢 ON (Kick)" : "🔴 OFF"}
├─▸ 4️⃣ *Anti-Bot Shield* : ${gConfig.antiBot ? "🟢 ON (Kick)" : "🔴 OFF"}
├─▸ 5️⃣ *Anti-Badword*    : ${gConfig.antiBad ? "🟢 ON" : "🔴 OFF"}
├─▸ 6️⃣ *Badword Action*  : \`${gConfig.antiBadMode.toUpperCase()}\` (Warn/Kick)
├─▸ 7️⃣ *Anti-Mention*    : ${gConfig.antiMention ? "🟢 ON" : "🔴 OFF"}
└───────────────────────────

━━━━━━━━━━━━━━━━━━━━━━━━
🍬 *REPLY WITH NUMBER TO TOGGLE:*

  • Reply *1* ➔ Toggle Welcome Card
  • Reply *2* ➔ Toggle Goodbye Card
  • Reply *3* ➔ Toggle Anti-Link
  • Reply *4* ➔ Toggle Anti-Bot
  • Reply *5* ➔ Toggle Anti-Badword
  • Reply *6* ➔ Switch Action (Warn ⇄ Kick)
  • Reply *7* ➔ Toggle Anti-Mention (Anti-Tag)

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;
}

// 3. Background Engine & Interactive Reply Hook
function hookGroupEngine(sock) {
  if (!sock || global.groupListenerHooked.has(sock)) return;
  global.groupListenerHooked.add(sock);

  // Group Welcomer / Goodbye
  sock.ev.on("group-participants.update", async ({ id: groupJid, participants, action }) => {
    try {
      const config = await getGroupConfig(groupJid);

      for (const participant of participants) {
        const cleanUser = cleanPhone(participant);

        if (action === "add" && config.welcome) {
          let ppSource = { url: "https://files.catbox.moe/k315x4.jpg" };
          try {
            const pp = await sock.profilePictureUrl(participant, "image");
            if (pp) ppSource = { url: pp };
          } catch (_) {}

          const welcomeCard = 
`🎀 ｡ﾟ•┈୨ *WELCOME TO THE GROUP* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👋 *Hello:* @${cleanUser}
  ✨ *Welcome to our community!*
  📜 *Please read group description and follow rules.*

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

          await sock.sendMessage(groupJid, {
            image: ppSource,
            caption: welcomeCard,
            mentions: [participant]
          }).catch(() => {});
        }

        if ((action === "remove" || action === "leave") && config.goodbye) {
          let ppSource = { url: "https://files.catbox.moe/k315x4.jpg" };
          try {
            const pp = await sock.profilePictureUrl(participant, "image");
            if (pp) ppSource = { url: pp };
          } catch (_) {}

          const byeCard = 
`🌸 ｡ﾟ•┈୨ *GOODBYE MEMBER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━

  👋 *Goodbye:* @${cleanUser}
  🥺 *We will miss you! Take care!*

━━━━━━━━━━━━━━━━━━━━━
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

          await sock.sendMessage(groupJid, {
            image: ppSource,
            caption: byeCard,
            mentions: [participant]
          }).catch(() => {});
        }
      }
    } catch (_) {}
  });

  // Message Inspector (Shields + Number Reply Handler)
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    if (!from || !from.endsWith("@g.us")) return;

    const sender = m.key.participant || m.participant || from;
    const raw = m.message.ephemeralMessage?.message || m.message;
    const quotedId = raw?.extendedTextMessage?.contextInfo?.stanzaId;
    const text = (
      raw.conversation ||
      raw.extendedTextMessage?.text ||
      raw.imageMessage?.caption ||
      ""
    ).trim();

    // --- A. INTERACTIVE NUMBER REPLY TOGGLE ---
    if (quotedId && global.groupInteractiveSessions.has(quotedId)) {
      const session = global.groupInteractiveSessions.get(quotedId);
      if (session.chat === from) {
        const senderAdmin = await isGroupAdmin(sock, from, sender);
        const botPhone = cleanPhone(sock.user?.id || "");
        const isMaster = cleanPhone(sender) === botPhone || cleanPhone(sender) === "94719845166";

        if (senderAdmin || isMaster) {
          const gConfig = await getGroupConfig(from);
          let changed = false;
          let changedText = "";

          switch (text) {
            case "1":
              gConfig.welcome = !gConfig.welcome;
              changed = true;
              changedText = `Welcome Card is now *${gConfig.welcome ? "🟢 ON" : "🔴 OFF"}*`;
              break;
            case "2":
              gConfig.goodbye = !gConfig.goodbye;
              changed = true;
              changedText = `Goodbye Card is now *${gConfig.goodbye ? "🟢 ON" : "🔴 OFF"}*`;
              break;
            case "3":
              gConfig.antiLink = !gConfig.antiLink;
              changed = true;
              changedText = `Anti-Link Shield is now *${gConfig.antiLink ? "🟢 ON" : "🔴 OFF"}*`;
              break;
            case "4":
              gConfig.antiBot = !gConfig.antiBot;
              changed = true;
              changedText = `Anti-Bot Shield is now *${gConfig.antiBot ? "🟢 ON" : "🔴 OFF"}*`;
              break;
            case "5":
              gConfig.antiBad = !gConfig.antiBad;
              changed = true;
              changedText = `Anti-Badword Shield is now *${gConfig.antiBad ? "🟢 ON" : "🔴 OFF"}*`;
              break;
            case "6":
              gConfig.antiBadMode = gConfig.antiBadMode === "warn" ? "kick" : "warn";
              changed = true;
              changedText = `Anti-Bad Action Mode set to: *\`${gConfig.antiBadMode.toUpperCase()}\`*`;
              break;
            case "7":
              gConfig.antiMention = !gConfig.antiMention;
              changed = true;
              changedText = `Anti-Mention Shield is now *${gConfig.antiMention ? "🟢 ON" : "🔴 OFF"}*`;
              break;
          }

          if (changed) {
            await saveGroupConfig(from, gConfig);
            sock.sendMessage(from, { react: { text: "💖", key: m.key } }).catch(() => {});

            // Send updated dashboard card
            const updatedCard = generateDashboardCard(gConfig, from);
            const newSent = await sock.sendMessage(
              from, 
              { text: `✨ *Setting Updated:* ${changedText}!\n\n${updatedCard}` }, 
              { quoted: m }
            );

            if (newSent?.key?.id) {
              global.groupInteractiveSessions.set(newSent.key.id, { chat: from, time: Date.now() });
            }
            return;
          }
        }
      }
    }

    // --- B. GROUP PROTECTIONS (SHIELDS) ---
    const senderIsAdmin = await isGroupAdmin(sock, from, sender);
    if (senderIsAdmin) return;

    const config = await getGroupConfig(from);
    const botAdmin = await isBotAdmin(sock, from);

    // Anti-Link
    if (config.antiLink && /(chat\.whatsapp\.com|wa\.me\/channel\/|t\.me\/|whatsapp\.com\/channel\/)/i.test(text)) {
      if (botAdmin) {
        await sock.sendMessage(from, { delete: m.key }).catch(() => {});
        await sock.groupParticipantsUpdate(from, [sender], "remove").catch(() => {});
        await sock.sendMessage(from, {
          text: `🛡️ *Link Shield:* @${cleanPhone(sender)} was removed for sending links!`,
          mentions: [sender]
        });
      }
      return;
    }

    // Anti-Badword
    if (config.antiBad) {
      const lower = text.toLowerCase();
      const detected = config.badWords.find(w => lower.includes(w.toLowerCase()));

      if (detected && botAdmin) {
        await sock.sendMessage(from, { delete: m.key }).catch(() => {});

        if (config.antiBadMode === "kick") {
          await sock.groupParticipantsUpdate(from, [sender], "remove").catch(() => {});
          await sock.sendMessage(from, {
            text: `🚨 *ANTI-BADWORD:* @${cleanPhone(sender)} was kicked for using forbidden language!`,
            mentions: [sender]
          });
        } else {
          await sock.sendMessage(from, {
            text: `⚠️ *WARNING:* @${cleanPhone(sender)}, bad words are strictly forbidden here!`,
            mentions: [sender]
          });
        }
        return;
      }
    }

    // Anti-Mention (More than 5 tags)
    if (config.antiMention) {
      const tags = raw.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (tags.length > 5 && botAdmin) {
        await sock.sendMessage(from, { delete: m.key }).catch(() => {});
      }
    }
  });
}

// 4. Main Command Dispatcher
export default {
  name: "group",
  aliases: ["kick", "add", "grp", "badword"],
  category: "group",
  description: "One-tap Interactive Group Dashboard & Administration",

  async execute({ sock, msg, from, args, body, prefix, config: appConfig }) {
    hookGroupEngine(sock);

    const pref = prefix || appConfig?.PREFIX || ".";

    if (!from || !from.endsWith("@g.us")) {
      return await sock.sendMessage(from, { text: "🌸 *This command can only be used in Groups!*" }, { quoted: msg });
    }

    const sender = msg.key.participant || msg.participant || from;
    const botPhone = cleanPhone(sock.user?.id || "");
    const senderPhone = cleanPhone(sender);

    const isMaster = msg.key.fromMe || senderPhone === botPhone || senderPhone === "94719845166";
    const senderAdmin = await isGroupAdmin(sock, from, sender);

    if (!senderAdmin && !isMaster) {
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: "🎀 *Only Group Admins can use group commands!* 🌸" }, { quoted: msg });
    }

    const fullBody = body.trim();
    const cmd = fullBody.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const gConfig = await getGroupConfig(from);

    // .kick @user
    if (cmd === "kick") {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      const target = quoted?.participant || (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [])[0];

      if (!target) {
        return await sock.sendMessage(from, { text: `🌸 *Usage:* Reply to a message or tag someone with \`${pref}kick\`` }, { quoted: msg });
      }

      const botAdmin = await isBotAdmin(sock, from);
      if (!botAdmin) {
        return await sock.sendMessage(from, { text: "💔 *I need to be an Admin to remove members!*" }, { quoted: msg });
      }

      await sock.groupParticipantsUpdate(from, [target], "remove");
      sock.sendMessage(from, { react: { text: "👋", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `🧹 *Removed:* Successfully removed @${cleanPhone(target)}!`, mentions: [target] }, { quoted: msg });
    }

    // .add <phone>
    if (cmd === "add") {
      const input = args.join("").replace(/[^0-9]/g, "");
      if (!input) {
        return await sock.sendMessage(from, { text: `🌸 *Usage:* \`${pref}add 9471xxxxxxx\`` }, { quoted: msg });
      }

      const botAdmin = await isBotAdmin(sock, from);
      if (!botAdmin) {
        return await sock.sendMessage(from, { text: "💔 *I need to be an Admin to add members!*" }, { quoted: msg });
      }

      await sock.groupParticipantsUpdate(from, [`${input}@s.whatsapp.net`], "add");
      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(from, { text: `🎉 *Added:* +${input} to the group!` }, { quoted: msg });
    }

    // .badword add / del / list
    if (cmd === "badword") {
      const sub = args[0]?.toLowerCase()?.trim();
      const targetWord = args.slice(1).join(" ").trim().toLowerCase();

      if (sub === "add") {
        if (!targetWord) return await sock.sendMessage(from, { text: `🌸 *Usage:* \`${pref}badword add <word>\`` }, { quoted: msg });
        if (!gConfig.badWords.includes(targetWord)) {
          gConfig.badWords.push(targetWord);
          await saveGroupConfig(from, gConfig);
        }
        return await sock.sendMessage(from, { text: `🛡️ Added \`"${targetWord}"\` to the banned words list!` }, { quoted: msg });
      }

      if (sub === "del") {
        if (!targetWord) return await sock.sendMessage(from, { text: `🌸 *Usage:* \`${pref}badword del <word>\`` }, { quoted: msg });
        gConfig.badWords = gConfig.badWords.filter(w => w !== targetWord);
        await saveGroupConfig(from, gConfig);
        return await sock.sendMessage(from, { text: `🧹 Removed \`"${targetWord}"\` from the list!` }, { quoted: msg });
      }

      if (sub === "list") {
        let listStr = `🎀 ｡ﾟ•┈୨ *BANNED WORDS LIST* ୧┈•ﾟ｡ 🐾\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
        gConfig.badWords.forEach((w, i) => { listStr += `  • ${i + 1}. \`${w}\`\n`; });
        listStr += `\n━━━━━━━━━━━━━━━━━━━━━\n⚙️ *Mode:* \`${gConfig.antiBadMode.toUpperCase()}\`\n💖 *DARK-DINU MD*`;
        return await sock.sendMessage(from, { text: listStr }, { quoted: msg });
      }
    }

    // Interactive Dashboard (.group)
    sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});

    const card = generateDashboardCard(gConfig, from);
    const sentMsg = await sock.sendMessage(from, { text: card }, { quoted: msg });

    // Store Interactive Session
    if (sentMsg?.key?.id) {
      global.groupInteractiveSessions.set(sentMsg.key.id, {
        chat: from,
        time: Date.now()
      });

      // 5 Minutes auto-prune
      setTimeout(() => {
        global.groupInteractiveSessions.delete(sentMsg.key.id);
      }, 300000);
    }
  }
};
