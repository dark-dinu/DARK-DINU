export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Fast Ping without edit loops",

  async execute({ sock, msg, from }) {
    try {
      const startTime = performance.now();

      // Non-blocking Reaction (Instant trigger)
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      // Calculate latency before sending message
      const latency = Math.max(1, Math.round(performance.now() - startTime));

      await sock.sendMessage(
        from,
        {
          text: `*🎭 pong . \`${latency} ms\` ✨*`
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("[PING ERR]:", err.message);
    }
  }
};
