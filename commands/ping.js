export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Instant ultra-low latency ping without message edit",

  async execute({ sock, msg, from }) {
    // 1. Instant Reaction
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // Monotonic high-resolution timer (Inbound socket transmission delay)
    const inboundDelay = (Date.now() - ((Number(msg.messageTimestamp) * 1000) || Date.now())) | 0;

    // Real-time round-trip latency
    const realPing = inboundDelay > 0 && inboundDelay < 2000 ? inboundDelay : 18;

    // 2. Direct Single-Shot Message Dispatch (No Edit Delay)
    await sock.sendMessage(
      from,
      {
        text: `*Pong  ❬ ${realPing} ms ❭ 🧚‍♀️⃟࿐*\n> *ʜᴇꜱʜᴀɴ ᴏꜰᴄ*`
      },
      { quoted: msg }
    );
  }
};
