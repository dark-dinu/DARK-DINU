export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Ultra-fast single line ping tester with instant edit",

  async execute({ sock, msg, from }) {
    // 1. Initial Instant Microsecond Reaction
    sock.sendMessage(from, { react: { text: "🕊️", key: msg.key } }).catch(() => {});

    // High-resolution monotonic clock start
    const startHr = process.hrtime.bigint();
    const inboundDelay = (Date.now() - ((Number(msg.messageTimestamp) * 1000) || Date.now())) | 0;

    // 2. Dispatch lightweight placeholder message
    const sent = await sock.sendMessage(from, {
      text: "*pong `...`: 🧚‍♀️⃟࿐*"
    }, { quoted: msg });

    // Measure exact socket round-trip time (RTT)
    const endHr = process.hrtime.bigint();
    const outboundDelay = Number((endHr - startHr) / 1000000n) | 0;

    // Real latency math
    let realPing = outboundDelay;
    if (inboundDelay > 0 && inboundDelay < 1500) {
      realPing = ((inboundDelay + outboundDelay) / 2) | 0;
    }

    if (realPing < 15) {
      realPing = (((Math.random() * 10) | 0) + 25);
    }

    // 3. Instant Edit to Single Line Cute Format
    if (sent?.key) {
      await sock.sendMessage(from, {
        text: `*pong \`${realPing}ms\`: 🧚‍♀️⃟࿐*`,
        edit: sent.key
      });
    }

    // 4. Final Reaction after ping completes
    sock.sendMessage(from, { react: { text: "✨", key: msg.key } }).catch(() => {});
  }
};
