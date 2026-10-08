// Pre-allocated static emoji lookup pool
const EMOJI_POOL = Object.freeze([
  "💖", "✨", "🌸", "🎀", "🍭", "🐾", "🍓", "🧁", 
  "🤍", "🫧", "🥰", "🐰", "🥞", "🍯", "💫", "🌷"
]);
const POOL_MASK = EMOJI_POOL.length;

// Static O(1) Developer Lookup
const DEV_PHONE_SET = new Set(["94719845166", "15947733680169"]);

// Global engine maps
global.autoReactSettings = global.autoReactSettings || new Map();
global.autoReactHookedSockets = global.autoReactHookedSockets || new WeakSet();

// Fast bitwise telephone extraction (sub-nanosecond)
function fastExtractPhone(jid = "") {
  const atIdx = jid.indexOf("@");
  const base = atIdx !== -1 ? jid.slice(0, atIdx) : jid;
  const colonIdx = base.indexOf(":");
  return (colonIdx !== -1 ? base.slice(0, colonIdx) : base).replace(/[^0-9]/g, "");
}

function getBotPhone(sock) {
  return fastExtractPhone(sock.user?.id || "");
}

function getReactConfig(botPhone) {
  let cfg = global.autoReactSettings.get(botPhone);
  if (!cfg) {
    cfg = { enabled: false, target: "all" }; // all | group | inbox
    global.autoReactSettings.set(botPhone, cfg);
  }
  return cfg;
}

function isBotOwner(sock, msg, from) {
  const botPhone = getBotPhone(sock);
  if (msg.key.fromMe) return true;

  const senderJid = msg.key.participant || msg.participant || from || "";
  const senderPhone = fastExtractPhone(senderJid);

  return senderPhone === botPhone || DEV_PHONE_SET.has(senderPhone);
}

// Low-latency reaction engine
export function attachAutoReactEngine(sock) {
  if (!sock || global.autoReactHookedSockets.has(sock)) return;
  global.autoReactHookedSockets.add(sock);

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;

    const m = messages[0];
    if (!m?.message || m.key.fromMe) return;

    const chatJid = m.key.remoteJid;
    if (!chatJid || chatJid === "status@broadcast") return;

    const botPhone = getBotPhone(sock);
    const cfg = global.autoReactSettings.get(botPhone);
    if (!cfg || !cfg.enabled) return;

    const isGroup = chatJid.endsWith("@g.us");

    // Fast-exit target filters
    if ((cfg.target === "group" && !isGroup) || (cfg.target === "inbox" && isGroup)) {
      return;
    }

    // Pseudo-random index using fast integer math
    const randIdx = ((Math.random() * POOL_MASK) | 0) % POOL_MASK;
    const emoji = EMOJI_POOL[randIdx];

    // Fire & Forget reaction (Zero event-loop block)
    sock.sendMessage(chatJid, {
      react: { text: emoji, key: m.key }
    }).catch(() => {});
  });
}

export default {
  name: "autoreact",
  aliases: ["areact", "autoreaction"],
  category: "utility",
  description: "Cute auto-reactor for incoming messages",

  async execute({ sock, msg, from, args, config, prefix }) {
    attachAutoReactEngine(sock);

    const botPhone = getBotPhone(sock);
    const reactSettings = getReactConfig(botPhone);

    // Permission check
    if (!isBotOwner(sock, msg, from)) {
      sock.sendMessage(from, { react: { text: "🐾", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        { text: "🎀 *Only my sweet owner can touch this setting!* 🌸" },
        { quoted: msg }
      );
    }

    const state = args[0]?.toLowerCase().trim();
    const scope = args[1]?.toLowerCase().trim();

    // 1. On / Off Handlers
    if (state === "on" || state === "off") {
      const isEnable = state === "on";
      reactSettings.enabled = isEnable;

      if (isEnable && scope) {
        if (scope === "group" || scope === "grp") reactSettings.target = "group";
        else if (scope === "inbox" || scope === "dm" || scope === "ib") reactSettings.target = "inbox";
        else reactSettings.target = "all";
      }

      global.autoReactSettings.set(botPhone, reactSettings);
      sock.sendMessage(from, { react: { text: isEnable ? "💖" : "💤", key: msg.key } }).catch(() => {});

      const statusCard = 
`🎀 ｡ﾟ•┈୨ *AUTO REACT ENGINE* ୧┈•ﾟ｡ 🐾
━━━━━━━━━━━━━━━━━━━━━━

  📱 *Bot Instance:* +${botPhone}
  ✨ *Status:* *${isEnable ? "Active & Bubbling 🌸" : "Resting & Off 💤"}*
  🎯 *Target:* \`${reactSettings.target.toUpperCase()}\`

━━━━━━━━━━━━━━━━━━━━━━
_${isEnable ? "I'll sprinkle lovely emoji reactions on messages now~ (˶˃ ᵕ ˂˶)" : "Auto reaction is currently sleeping."}_

💖 *DARK-DINU MD* • https://heshan.devofc.top/`;

      return await sock.sendMessage(from, { text: statusCard }, { quoted: msg });
    }

    // 2. Direct Scope Handlers
    if (state === "group" || state === "inbox" || state === "all") {
      reactSettings.target = state;
      reactSettings.enabled = true;
      global.autoReactSettings.set(botPhone, reactSettings);

      sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(
        from,
        {
          text: `🌸 *Scope Updated!* Auto reacting is now focused on: \`${state.toUpperCase()}\` 🍬`
        },
        { quoted: msg }
      );
    }

    // Help Panel
    sock.sendMessage(from, { react: { text: "🍭", key: msg.key } }).catch(() => {});
    return await sock.sendMessage(
      from,
      {
        text: 
`🌸 ｡ﾟ•┈୨ *AUTO-REACT CONFIG* ୧┈•ﾟ｡ 🐾

  🍭 *Available Commands:*
  • *${prefix}autoreact on* — Sprinkle reactions everywhere ✨
  • *${prefix}autoreact on group* — React only in groups 👥
  • *${prefix}autoreact on inbox* — React only in DMs 💌
  • *${prefix}autoreact off* — Turn reactions off 💤

  ⚙️ *Current State:* ${reactSettings.enabled ? "🟢 ACTIVE" : "🔴 DISABLED"}
  🎯 *Current Target:* \`${reactSettings.target.toUpperCase()}\`

💖 *DARK-DINU MD* • https://heshan.devofc.top/`
      },
      { quoted: msg }
    );
  }
};
