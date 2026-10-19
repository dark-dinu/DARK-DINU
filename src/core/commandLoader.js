import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export const commands = new Map();
export const replyHandlers = new Map();

export async function loadCommands(baseDir = process.cwd()) {
  const dir = path.join(baseDir, "commands");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  commands.clear();
  replyHandlers.clear();

  for (const file of files) {
    try {
      const mod = await import(`${pathToFileURL(path.join(dir, file)).href}?t=${Date.now()}`);
      const cmd = mod.default || mod;
      if (cmd?.name) {
        commands.set(cmd.name.toLowerCase(), cmd);
        if (Array.isArray(cmd.aliases)) {
          cmd.aliases.forEach(a => commands.set(a.toLowerCase(), cmd));
        }
        if (typeof cmd.onReply === "function") {
          replyHandlers.set(cmd.name.toLowerCase(), cmd.onReply);
        }
      }
    } catch (e) {
      console.error(`[!] Failed loading ${file}:`, e.message);
    }
  }
  console.log(`✨ Loaded ${commands.size} commands & aliases into fast-memory!`);
}
