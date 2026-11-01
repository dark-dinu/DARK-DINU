import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export const commands = new Map();
export const replyHandlers = new Map();

// Subdirectories ඇතුළත ඇති සියලුම .js files recursively ලබාගැනීම
function getAllCommandFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllCommandFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".js") && !file.startsWith("_")) {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

export async function loadCommands(baseDir = process.cwd()) {
  const dir = path.join(baseDir, "commands");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = getAllCommandFiles(dir);
  commands.clear();
  replyHandlers.clear();

  let uniqueCommandsCount = 0;

  for (const filePath of files) {
    const relativeFileName = path.basename(filePath);
    try {
      // Dynamic import with cache-busting timestamp
      const fileUrl = `${pathToFileURL(filePath).href}?update=${Date.now()}`;
      const mod = await import(fileUrl);
      const cmd = mod.default || mod;

      if (cmd?.name) {
        const primaryName = cmd.name.toLowerCase().trim();
        commands.set(primaryName, cmd);
        uniqueCommandsCount++;

        // Aliases register කිරීම
        if (Array.isArray(cmd.aliases)) {
          for (const alias of cmd.aliases) {
            if (typeof alias === "string" && alias.trim()) {
              commands.set(alias.toLowerCase().trim(), cmd);
            }
          }
        }

        // Interactive Reply Handlers register කිරීම (.video, settings replies සඳහා)
        if (typeof cmd.onReply === "function") {
          replyHandlers.set(primaryName, cmd.onReply);
        }
      }
    } catch (e) {
      console.error(`[!] Failed loading command [${relativeFileName}]:`, e.message);
    }
  }

  console.log(`✨ Loaded ${uniqueCommandsCount} main commands (${commands.size} total triggers with aliases) & ${replyHandlers.size} reply handlers!`);
}
