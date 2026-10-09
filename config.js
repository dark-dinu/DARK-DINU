const CONFIG = {
  // MongoDB Credentials & Cluster Database
  MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://dark-dinu:Heshan2007%23@cluster0.cumegre.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  DB_NAME: process.env.DB_NAME || "whatsapp_multi_bots",

  // Bot Core Identification
  BOT_NAME: "DARK-DINU MULTI BOT",
  OWNER_NAME: "Dinidu Heshan",
  OWNER_NUMBER: "94719845166",
  OWNER_NUMBERS: ["94719845166", "15947733680169"],
  PREFIX: ".",

  // System & API Keys
  CHAMA_API_KEY: "chama_api_ec9848130d1aea209f08fb85e0b4720f",
  PORT: process.env.PORT || 3000,

  // Performance & Feature Flags
  AUTO_VOICE: true,
  AUTO_STATUS_SEEN: false, // Statuses auto-read වීම slow වීමට හේතු වන නිසා default false කර ඇත
  AUTO_REACT: false,
  MODE: "public" // "public" | "private"
};

export default CONFIG;
