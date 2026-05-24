import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "./middleware";
import { crewTokenStore } from "./crew";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// __dirname is injected by esbuild banner to point to dist/
const uploadDir = path.resolve(__dirname, "../../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Accept: images, PDFs, videos, and Office documents
    const allowed = /\.(jpeg|jpg|png|gif|webp|svg|pdf|mp4|webm|mov|m4v|doc|docx|xls|xlsx|ppt|pptx)$/i.test(ext);
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext.slice(1)} not allowed. Allowed: images, PDF, video, Word, Excel, PowerPoint`));
    }
  },
});

// Wrapper to handle multer errors
const uploadHandler = (callback: (req: Request, res: Response) => void) => (req: Request, res: Response, next: any) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      logger.error({ err }, "upload_error");
      return res.status(400).json({ error: err.message || "File validation failed" });
    }
    callback(req, res);
  });
};

router.post("/uploads", requireAuth, uploadHandler((req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
}));

// Allow crew uploads using crew token store at /api/crew/uploads
router.post("/crew/uploads", uploadHandler((req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  logger.info({ authHeader: !!authHeader }, "crew_upload_auth_check");
  
  if (!authHeader?.startsWith("Bearer ")) { 
    logger.warn("crew_upload_rejected: no_auth_header");
    res.status(401).json({ error: "Unauthorized: Missing Authorization header" }); 
    return; 
  }
  
  const token = authHeader.slice(7);
  const memberId = crewTokenStore.get(token);
  logger.info({ tokenLen: token.length, storeSize: crewTokenStore.size, found: !!memberId }, "crew_token_lookup");
  
  if (!memberId) { 
    logger.warn("crew_upload_invalid_token");
    res.status(401).json({ error: "Invalid or expired token. Please log in again." }); 
    return; 
  }

  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  const url = `/api/uploads/${req.file.filename}`;
  logger.info({ filename: req.file.filename, size: req.file.size, memberId }, "crew_upload_success");
  res.json({ url, filename: req.file.filename });
}));

export default router;
