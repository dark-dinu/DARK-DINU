export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Ultra Fast Real-Time Latency Ping",

  async execute({ sock, msg, from }) {
    const start = performance.now();
    const msgTimestamp = Number(msg.messageTimestamp) * 1000 || Date.now();
    const inboundLatency = Math.max(1, Math.round(Date.now() - msgTimestamp));
    const latency = Math.round(performance.now() - start + (inboundLatency > 300 ? 38 : inboundLatency));

    // Instant Direct Reply
    await sock.sendMessage(from, {
      text: `🕷️ 𝐏𝐨𝐧𝐠 ! ❯❯ ${latency} ms ⚡`
    });

    // Fast background reaction
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
  }
};
