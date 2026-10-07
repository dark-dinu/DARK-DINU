export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Fast Ping without edit loops",

  async execute({ sock, msg, from }) {
    try {
      const startTime = performance.now();

      // 1. React පමණක් යැවීම
      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const latency = Math.round(performance.now() - startTime);

      // 2. Direct message එකක් යැවීම (Edit නොකර)
      await sock.sendMessage(from, {
        text: `*🎭 pong . \`${latency} ms\` ✨*`
      }, { quoted: msg });

    } catch (err) {
      console.error("[PING ERR]:", err.message);
    }
  }
};
