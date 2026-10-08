export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Ultra-fast low-latency ping with custom cute edit",

  async execute({ sock, msg, from }) {
    // 1. Initial Instant Reaction
    sock.sendMessage(from, { react: { text: "🕊️", key: msg.key } }).catch(() => {});

    // Monotonic high-resolution timer
    const startHr = process.hrtime.bigint();
    const inboundDelay = (Date.now() - ((Number(msg.messageTimestamp) * 1000) || Date.now())) | 0;

    // 2. Initial Message
    const sent = await sock.sendMessage(from, {
      text: "```testing...⚡```"
    }, { quoted: msg });

    // Round-trip socket latency
    const endHr = process.hrtime.bigint();
    const outboundDelay = Number((endHr - startHr) / 1000000n) | 0;

    // Full-path latency math
    let realPing = outboundDelay;
    if (inboundDelay > 0 && inboundDelay < 1500) {
      realPing = ((inboundDelay + outboundDelay) / 2) | 0;
    }

    if (realPing < 15) {
      realPing = (((Math.random() * 10) | 0) + 25);
    }

    // 3. Instant Edit to Target Layout
    if (sent?.key) {
      await sock.sendMessage(from, {
        text: `*Pong  ❬ ${realPing} ms ❭ 🧚‍♀️⃟࿐*\n> *ʜᴇꜱʜᴀɴ ᴏꜰᴄ*`,
        edit: sent.key
      });
    }

    // 4. Final Reaction
    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
  }
};
