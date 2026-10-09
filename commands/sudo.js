import fs from "fs";
import path from "path";

const sudoFile = path.resolve("./sudo.json");

// Helper: Read sudo users
function getSudoList() {
  try {
    if (!fs.existsSync(sudoFile)) {
      fs.writeFileSync(sudoFile, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(sudoFile, "utf-8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("[SUDO READ ERR]:", err.message);
    return [];
  }
}

// Helper: Save sudo users
function saveSudoList(users) {
  try {
    fs.writeFileSync(sudoFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("[SUDO WRITE ERR]:", err.message);
  }
}

export default {
  name: "sudo",
  aliases: ["setsudo", "delsudo", "getsudo"],
  category: "owner",
  description: "Manage secondary bot administrators (Sudo users)",

  async execute({ sock, msg, from, args, body, prefix, isOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const full = (body || "").trim();
    const cmd = full.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();

    // 1. GET SUDO LIST
    if (cmd === "getsudo" || (cmd === "sudo" && args.length === 0)) {
      sock.sendMessage(from, { react: { text: "📜", key: msg.key } }).catch(() => {});
      const sudoUsers = getSudoList();

      if (sudoUsers.length === 0) {
        return await sock.sendMessage(
          from,
          { text: "🚫 දැනට ලියාපදිංචි කර ඇති Sudo පරිශීලකයින් කිසිවෙක් නැත." },
          { quoted: msg }
        );
      }

      let list = 
`╭─❏ *🌟 SUDO USERS LIST 🌟* ❏
│
`;
      sudoUsers.forEach((user, index) => {
        list += `│ *${index + 1}.* +${user}\n`;
      });
      list += 
`│
╰───────────────⟢
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: list }, { quoted: msg });
    }

    // Security Check: Only Bot Owner can modify sudo users
    if (!isOwner) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "❌ මෙම විධානය භාවිතා කළ හැක්කේ ප්‍රධාන Bot Owner ට පමණි!" },
        { quoted: msg }
      );
    }

    // Extract target number from mention, reply, or typed argument
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    let targetJid = null;

    if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
      targetJid = ctx.mentionedJid[0];
    } else if (ctx?.participant) {
      targetJid = ctx.participant;
    } else if (args[0]) {
      targetJid = args[0];
    }

    if (!targetJid) {
      return await sock.sendMessage(
        from,
        {
          text: 
`🌸 *භාවිතය:*
  • *එක් කිරීමට:* \`${pref}setsudo <අංකය / Mention / Reply>\`
  • *ඉවත් කිරීමට:* \`${pref}delsudo <අංකය / Mention / Reply>\`
  • *ලැයිස්තුව බැලීමට:* \`${pref}getsudo\``
        },
        { quoted: msg }
      );
    }

    const cleanNum = targetJid.replace(/[^0-9]/g, "");
    if (!cleanNum || cleanNum.length < 8) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ වලංගු දුරකථන අංකයක් ලබා දෙන්න!" },
        { quoted: msg }
      );
    }

    const sudoList = getSudoList();

    // 2. SET SUDO COMMAND
    if (cmd === "setsudo") {
      sock.sendMessage(from, { react: { text: "🔧", key: msg.key } }).catch(() => {});

      if (sudoList.includes(cleanNum)) {
        return await sock.sendMessage(
          from,
          { text: `ℹ️ *+${cleanNum}* දැනටමත් Sudo ලැයිස්තුවේ පවතී.` },
          { quoted: msg }
        );
      }

      sudoList.push(cleanNum);
      saveSudoList(sudoList);

      return await sock.sendMessage(
        from,
        { text: `✅ *+${cleanNum}* සාර්ථකව Sudo ලැයිස්තුවට ඇතුළත් කරන ලදී!` },
        { quoted: msg }
      );
    }

    // 3. DEL SUDO COMMAND
    if (cmd === "delsudo") {
      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});

      if (!sudoList.includes(cleanNum)) {
        return await sock.sendMessage(
          from,
          { text: `⚠️ *+${cleanNum}* Sudo ලැයිස්තුවේ නොමැත.` },
          { quoted: msg }
        );
      }

      const updated = sudoList.filter((u) => u !== cleanNum);
      saveSudoList(updated);

      return await sock.sendMessage(
        from,
        { text: `🗑️ *+${cleanNum}* සාර්ථකව Sudo ලැයිස්තුවෙන් ඉවත් කරන ලදී.` },
        { quoted: msg }
      );
    }
  }
};
