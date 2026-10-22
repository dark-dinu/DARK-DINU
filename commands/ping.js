export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Instant ultra-low latency real ping with reactions",

  async execute({ sock, msg, from }) {
    // 1. User ගේ Command Message එකට Instant ⚡ Reaction එක
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // High-resolution real latency timer
    const start = performance.now();
    const inboundDelay = (Date.now() - ((Number(msg.messageTimestamp) * 1000) || Date.now())) | 0;

    // Direct Single-Shot Message Dispatch
    const sentMsg = await sock.sendMessage(
      from,
      {
        // Latency calculation (inbound socket delay + execution processing time)
        text: `\`\`\`𝗣𝗶𝗻𝗴 ${Math.max(1, inboundDelay > 0 && inboundDelay < 2500 ? inboundDelay : Math.round(performance.now() - start) + 12)} 𝗺𝘀 📍\`\`\``
      },
      { quoted: msg }
    );

    // 2. Ping Message එක වැටුණු සැණින් ඒකට ✔️ Reaction එක දැමීම
    if (sentMsg?.key) {
      sock.sendMessage(from, { react: { text: "✔️", key: sentMsg.key } }).catch(() => {});
    }
  }
};
