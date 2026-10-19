import { Router } from "express";
import path from "path";
import fs from "fs";
import { activeSockets } from "../core/socketManager.js";

const router = Router();
const publicDir = path.join(process.cwd(), "public");

router.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
router.get("/pair-web", (req, res) => res.sendFile(path.join(publicDir, "pair.html")));
router.get("/react", (req, res) => res.sendFile(path.join(publicDir, "react.html")));
router.get("/commands", (req, res) => res.sendFile(path.join(publicDir, "commands.html")));
router.get("/status", (req, res) => res.sendFile(path.join(publicDir, "status.html")));
router.get("/health", (req, res) => res.status(200).json({ status: "OK", activeBots: activeSockets.size }));

router.get("/logo.jpg", (req, res) => {
  const localLogoPublic = path.join(publicDir, "logo.jpg");
  const localLogoRoot = path.join(process.cwd(), "logo.jpg");

  if (fs.existsSync(localLogoPublic)) {
    return res.sendFile(localLogoPublic);
  } else if (fs.existsSync(localLogoRoot)) {
    return res.sendFile(localLogoRoot);
  }
  return res.redirect("https://files.catbox.moe/s1q558.jpg");
});

export default router;
