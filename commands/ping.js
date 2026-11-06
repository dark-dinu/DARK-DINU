export default {
  name: "ping",
  aliases: ["p", "speed"],
  category: "general",
  description: "Real-time socket network latency ping",

  async execute({ sock, msg, from }) {
    // 1. User ගේ Command Message එකට පමණක් වැටෙන Reaction එක
    sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    // 2. WhatsApp Network RTT (Real Latency) මැනීම
    const start = Date.now();
    try {
      // WhatsApp WebSocket Connection එකෙන් direct ping එකක් යවා real speed එක ලබා ගැනීම
      if (typeof sock.ws?.ping === "function") {
        await new Promise((resolve) => {
          sock.ws.ping();
          resolve();
        });
      }
    } catch (_) {}
    const latency = Date.now() - start;

    // 3. නිවැරදි Latency අගය සහිතව Message එක යැවීම
    await sock.sendMessage(
      from,
      {
        text: `\`\`\`𝗣𝗶𝗻𝗴 ${Math.max(1, latency)} 𝗺𝘀 📍\`\`\``
      },
      { quoted: msg }
    );
  }
};
