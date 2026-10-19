import axios from "axios";

export function initKeepAlive() {
  const KEEP_ALIVE_URL = process.env.APP_URL || "https://heshan.devofc.top";
  setInterval(async () => {
    try {
      await axios.get(`${KEEP_ALIVE_URL}/health`, { timeout: 8000 });
    } catch (_) {}
  }, 10 * 60 * 1000);
}
