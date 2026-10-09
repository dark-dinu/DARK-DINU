import fs from "fs";
import path from "path";

const sudoFile = path.resolve("./sudo.json");

// Sudo List එක කියවීම
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

// Sudo List එක Save කිරීම
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
  description: "Manage secondary bot administrators without editing index.js",

  async execute({ sock, msg, from, args, body, prefix, isOwner: baseIsOwner, config }) {
    const pref = prefix || config?.PREFIX || ".";
    const full = (body || "").trim();
    const cmd = full.slice(pref.length).trim().split(/\s+/)[0].toLowerCase();

    // Sender ගේ අංකය වෙන්කර ගැනීම
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderNum = sender.replace(/[^0-9]/g, "");

    // Config එකෙන් Owner අංක ලබා ගැනීම
    const ownerConfigNums = [
      ...(Array.isArray(config?.OWNER_NUMBERS) ? config.OWNER_NUMBERS : []),
      config?.OWNER_NUMBER,
      config?.ownerNumber
    ]
      .filter(Boolean)
      .map((n) => String(n).replace(/[^0-9]/g, ""));

    const currentSudoList = getSudoList();

    // Owner ද නැද්ද යන්න Plugin එක ඇතුළෙන්ම Check කිරීම
    const isRealOwner =
      baseIsOwner ||
      msg.key.fromMe ||
      ownerConfigNums.includes(senderNum);

    // 1. GET SUDO LIST (ඕනෑම කෙනෙකුට හෝ Admin ට බැලිය හැක)
    if (cmd === "getsudo" || (cmd === "sudo" && args.length === 0)) {
      sock.sendMessage(from, { react: { text: "📜", key: msg.key } }).catch(() => {});

      if (currentSudoList.length === 0) {
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
      currentSudoList.forEach((user, index) => {
        list += `│ *${index + 1}.* +${user}\n`;
      });
      list += 
`│
╰───────────────⟢
💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: list }, { quoted: msg });
    }

    // ආරක්ෂක පරීක්ෂාව: Sudo හැසිරවිය හැක්කේ ප්‍රධාන Owner ට පමණි
    if (!isRealOwner) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "❌ මෙම විධානය භාවිතා කිරීමට ප්‍රධාන Bot Owner ට පමණක් අවසර ඇත!" },
        { quoted: msg }
      );
    }

    // ඉලක්ක අංකය සොයා ගැනීම (Mention / Reply / Typed Number)
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    let targetNum = null;

    if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
      targetNum = ctx.mentionedJid[0];
    } else if (ctx?.participant) {
      targetNum = ctx.participant;
    } else if (args[0]) {
      targetNum = args[0];
    }

    if (!targetNum) {
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

    const cleanTarget = targetNum.replace(/[^0-9]/g, "");
    if (!cleanTarget || cleanTarget.length < 8) {
      return await sock.sendMessage(
        from,
        { text: "⚠️ කරුණාකර වලංගු දුරකථන අංකයක් ලබා දෙන්න!" },
        { quoted: msg }
      );
    }

    // 2. SET SUDO COMMAND
    if (cmd === "setsudo") {
      sock.sendMessage(from, { react: { text: "🔧", key: msg.key } }).catch(() => {});

      if (currentSudoList.includes(cleanTarget)) {
        return await sock.sendMessage(
          from,
          { text: `ℹ️ *+${cleanTarget}* දැනටමත් Sudo ලැයිස්තුවේ පවතී.` },
          { quoted: msg }
        );
      }

      currentSudoList.push(cleanTarget);
      saveSudoList(currentSudoList);

      return await sock.sendMessage(
        from,
        { text: `✅ *+${cleanTarget}* සාර්ථකව Sudo ලැයිස්තුවට එක් කරන ලදී!` },
        { quoted: msg }
      );
    }

    // 3. DEL SUDO COMMAND
    if (cmd === "delsudo") {
      sock.sendMessage(from, { react: { text: "🗑️", key: msg.key } }).catch(() => {});

      if (!currentSudoList.includes(cleanTarget)) {
        return await sock.sendMessage(
          from,
          { text: `⚠️ *+${cleanTarget}* Sudo ලැයිස්තුවේ නොමැත.` },
          { quoted: msg }
        );
      }

      const updated = currentSudoList.filter((u) => u !== cleanTarget);
      saveSudoList(updated);

      return await sock.sendMessage(
        from,
        { text: `🗑️ *+${cleanTarget}* සාර්ථකව Sudo ලැයිස්තුවෙන් ඉවත් කරන ලදී.` },
        { quoted: msg }
      );
    }
  }
};
