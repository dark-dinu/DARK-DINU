export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Ultra Fast Real Network Latency",

  async execute({ sock, msg, from }) {
    const tStart = Date.now();
    const msgStamp = Number(msg.messageTimestamp) * 1000 || tStart;
    
    // Inbound network delay (Message sent -> Server received)
    const inbound = Math.max(1, tStart - msgStamp);

    // Initial message send
    const sent = await sock.sendMessage(from, {
      text: `🕷️ 𝐏𝐨𝐧𝐠 ! ❯❯ ... ms ⚡`
    });

    // Outbound round-trip duration
    const roundTrip = Date.now() - tStart;
    const finalPing = inbound > 0 && inbound < 2000 ? Math.round((inbound + roundTrip) / 2) : roundTrip;

    // Direct in-place edit for accurate round-trip calculation
    if (sent?.key) {
      await sock.sendMessage(from, {
        text: `🕷️ 𝐏𝐨𝐧𝐠 ! ❯❯ ${finalPing} ms ⚡`,
        edit: sent.key
      });
    }

    // Reaction in background
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
  }
};
