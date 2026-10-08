import fs from "fs";
import path from "path";

// Active Menu Reply Sessions (O(1) Hash Map)
global.menuTracker = global.menuTracker || new Map();
global.menuHookedSockets = global.menuHookedSockets || new WeakSet();

// 🔒 PERMANENT LOCKED OFFICIAL LOGO
let lockedLogoBuffer = null;

(function initLockedLogo() {
  const localCandidates = [
    path.join(process.cwd(), "logo.jpg"),
    path.join(process.cwd(), "logo.png"),
    path.join(process.cwd(), "assets", "logo.jpg"),
    path.join(process.cwd(), "assets", "logo.png")
  ];

  for (const p of localCandidates) {
    if (fs.existsSync(p)) {
      lockedLogoBuffer = fs.readFileSync(p);
      return;
    }
  }

  lockedLogoBuffer = { url: "https://files.catbox.moe/k315x4.jpg" };
})();

// Fast Listener Hook (Zero Leak, Zero CPU Overhead)
function attachMenuReplyEngine(sock) {
  if (!sock || global.menuHookedSockets.has(sock)) return;
  global.menuHookedSockets.add(sock);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    if (!from || from === "status@broadcast") return;

    const rawMsg = m.message.ephemeralMessage?.message || m.message;
    const contextInfo =
      rawMsg.extendedTextMessage?.contextInfo ||
      rawMsg.imageMessage?.contextInfo ||
      rawMsg.videoMessage?.contextInfo;

    const quotedId = contextInfo?.stanzaId;
    if (!quotedId || !global.menuTracker.has(quotedId)) return;

    const session = global.menuTracker.get(quotedId);
    if (session.chat !== from) return;

    const choice = (
      rawMsg.conversation ||
      rawMsg.extendedTextMessage?.text ||
      ""
    ).trim();

    const p = session.pref;
    const bName = session.botName;
    const link = session.fixedLink;

    let subText = "";
    let reactIcon = "";

    switch (choice) {
      case "1":
        reactIcon = "🌸";
        subText = 
`🎀 ｡ﾟ•┈୨ *GENERAL & INFO* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  🌸 *${p}ping*       ➔ Check bot response latency ✨
  🍰 *${p}menu*       ➔ Display aesthetic dashboard 📜
  💖 *${p}alive*      ➔ Server heartbeat & cute card 🐾
  🍬 *${p}status*     ➔ Cluster nodes & live metrics ⚡
  🏷️ *${p}jid*        ➔ Extract instant chat/user JID 🍬

━━━━━━━━━━━━━━━━━━━━━━
🐾 *${bName}* • ${link}`;
        break;

      case "2":
        reactIcon = "📥";
        subText = 
`🎀 ｡ﾟ•┈୨ *MEDIA DOWNLOADER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  🎵 *${p}song*       ➔ High quality MP3 & Voice notes (PTT) 🎧
  🎬 *${p}video*      ➔ Crisp multi-quality YouTube videos 📺
  🍿 *${p}fb*         ➔ Facebook HD/SD video downloader 💌
  🍭 *${p}tiktok*     ➔ TikTok watermark-free HD videos 🫧
  📸 *${p}insta*      ➔ Instagram Reels & Carousels 🌷
  🔍 *${p}img*        ➔ Google image search & downloader 🖼️
  👁️ *${p}vv*         ➔ Decrypt secret ViewOnce media 🔓

━━━━━━━━━━━━━━━━━━━━━━
🐾 *${bName}* • ${link}`;
        break;

      case "3":
        reactIcon = "🛡️";
        subText = 
`🎀 ｡ﾟ•┈୨ *STEALTH & CONFIG* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  🎛️ *${p}setting*    ➔ All-in-one Master Settings Dashboard ⚙️
  🎯 *${p}mode*       ➔ Switch Public / Private / Group / Inbox 🌐
  🛡️ *${p}antisend*   ➔ Auto delete messages (me/from/all) 🚫
  📸 *${p}getdp*      ➔ Download user/group profile picture 🖼️
  💌 *${p}addmsg*     ➔ Save permanent auto-reply trigger ✨
  🗑️ *${p}delmsg*     ➔ Remove saved auto-reply trigger 🧹
  📑 *${p}allmsg*     ➔ View all stored auto-replies 📋

━━━━━━━━━━━━━━━━━━━━━━
🐾 *${bName}* • ${link}`;
        break;

      case "4":
        reactIcon = "👑";
        subText = 
`🎀 ｡ﾟ•┈୨ *SYSTEM & CLUSTER* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  🤖 *${p}bots*       ➔ View active connected bot instances 📊
  🔄 *${p}restart*    ➔ Gracefully reboot bot session 💤

━━━━━━━━━━━━━━━━━━━━━━
🐾 *${bName}* • ${link}`;
        break;

      case "5":
        reactIcon = "⏰";
        subText = 
`🎀 ｡ﾟ•┈୨ *AUTOMATION & TIMERS* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  ⏰ *${p}settime*     ➔ Set daily recurring timed message 💌
     _Ex: \`${p}settime <number>,<msg>,<HH:mm>\`_
  🗑️ *${p}deltime*     ➔ Remove daily timed message 🛑
  📋 *${p}time list*   ➔ View active scheduled timers 📑

  🚀 *${p}autosend*    ➔ Reply to post & set recurring interval ⏱️
     _Ex: Reply post with \`${p}autosend <channel_link>\`_
  🛑 *${p}delautosend* ➔ Cancel recurring post for channel 🧹
  📑 *${p}listautosend*➔ View all active recurring channel posts 📋

  📢 *${p}autoch*      ➔ Set text interval broadcast to channel 💬
     _Ex: \`${p}autoch <channel_link>,<msg>,30m\`_

━━━━━━━━━━━━━━━━━━━━━━
🐾 *${bName}* • ${link}`;
        break;

      case "6":
        reactIcon = "📜";
        subText = 
`🎀 ｡ﾟ•┈୨ *COMPLETE INDEX* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  🌸 *${p}ping • ${p}menu • ${p}alive • ${p}status • ${p}jid*
  📥 *${p}song • ${p}video • ${p}fb • ${p}tiktok • ${p}insta • ${p}img*
  🛡️ *${p}setting • ${p}mode • ${p}antisend • ${p}addmsg • ${p}delmsg*
  👑 *${p}bots • ${p}restart*
  ⏰ *${p}settime • ${p}deltime • ${p}autosend • ${p}autoch*

━━━━━━━━━━━━━━━━━━━━━━
🐾 *${bName}* • ${link}`;
        break;

      default:
        return;
    }

    if (subText) {
      sock.sendMessage(from, { react: { text: reactIcon, key: m.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        {
          image: lockedLogoBuffer,
          caption: subText
        },
        { quoted: m }
      );
    }
  });
}

export default {
  name: "menu",
  aliases: ["help", "list", "panel", "m"],
  category: "general",
  description: "Aesthetic Interactive Category Menu with Locked Logo",

  async execute({ sock, msg, from, config, activeBotsCount, commands }) {
    attachMenuReplyEngine(sock);

    sock.sendMessage(from, { react: { text: "💖", key: msg.key } }).catch(() => {});

    try {
      const uptimeSec = process.uptime() | 0;
      const hours = (uptimeSec / 3600) | 0;
      const mins = ((uptimeSec % 3600) / 60) | 0;
      const secs = (uptimeSec % 60) | 0;

      const pref = config?.PREFIX || ".";
      const botDisplayName = config?.BOT_NAME || "DARK-DINU MD";
      const ownerName = "Dinidu Heshan";
      const fixedLink = "https://heshan.devofc.top/";
      const totalCmds = commands?.size || 0;

      const mainCard = 
`🎀 ｡ﾟ•┈୨ *${botDisplayName.toUpperCase()}* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  👑 *Creator:* ${ownerName}
  ⚡ *Prefix:* \`[ ${pref} ]\`
  🌐 *Cloud Nodes:* \`${activeBotsCount || 1} Instances Online\`
  ⏱️ *Uptime:* \`${hours}h ${mins}m${secs}s\`
  📦 *Commands Loaded:* \`${totalCmds} Modules\`

━━━━━━━━━━━━━━━━━━━━━━
🌸 *CHOOSE A CATEGORY* 🌸

  🌸 *[ 1 ]* ➔ General & Info
  📥 *[ 2 ]* ➔ Media Downloader
  🛡️ *[ 3 ]* ➔ Stealth & Config
  👑 *[ 4 ]* ➔ System & Cluster
  ⏰ *[ 5 ]* ➔ Automation & Timers ✨
  📜 *[ 6 ]* ➔ Full Command Index

━━━━━━━━━━━━━━━━━━━━━━
🍬 _Reply with *1 - 6* to view commands softly~ (˶˃ ᵕ ˂˶)_
💖 *Official Core* • ${fixedLink}`;

      const sentMsg = await sock.sendMessage(
        from,
        {
          image: lockedLogoBuffer,
          caption: mainCard
        },
        { quoted: msg }
      );

      const menuId = sentMsg?.key?.id;
      if (menuId) {
        global.menuTracker.set(menuId, {
          chat: from,
          pref,
          botName: botDisplayName,
          fixedLink,
          time: Date.now()
        });

        setTimeout(() => {
          global.menuTracker.delete(menuId);
        }, 300000);
      }

    } catch (err) {
      console.error("[MENU ERROR]:", err);
      sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `🌸 *Glitch detected:* ${err.message || "Failed to render menu softly"}` },
        { quoted: msg }
      ).catch(() => {});
    }
  }
};
