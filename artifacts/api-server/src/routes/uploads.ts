import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { requireAuth } from "./middleware.js";
import { crewTokenStore, getCrewMemberIdFromToken } from "./crew.js";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";
import { db, digitalAssetsTable, projectFilesTable } from "@workspace/db";

const router: IRouter = Router();

// ── Disk storage (bukan memoryStorage) ──────────────────────────────────────
// Alasan: memoryStorage me-load SELURUH file ke RAM proses Node sekaligus.
// Untuk video besar (puluhan MB), ini cepat menumpuk memory antar-upload
// dan bisa membuat upload berikutnya gagal diam-diam tanpa pesan error jelas.
// Disk storage men-stream file ke disk sementara (OS temp dir / Vercel /tmp),
// jauh lebih ringan untuk memory heap Node, lalu kita upload ke Supabase dari file
// tersebut dan langsung hapus setelah selesai (tidak disimpan permanen di disk).
const tmpUploadDir = process.env.NODE_ENV === "production"
  ? "/tmp/frameless-uploads"
  : path.join(os.tmpdir(), "frameless-uploads");

try {
  fs.mkdirSync(tmpUploadDir, { recursive: true });
} catch (err) {
  logger.error({ err, tmpUploadDir }, "uploads.tmpdir.create_failed");
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, unique);
  },
});

const allowedExtensions = [
  ".jpeg",
  ".jpg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".pdf",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
];

// Limit dinaikkan untuk video produksi (200MB). Sesuaikan lagi jika perlu.
const MAX_FILE_SIZE = 200 * 1024 * 1024;

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    try {
      const ext = path.extname(file.originalname).toLowerCase();

      const isAllowed = allowedExtensions.includes(ext);

      if (!isAllowed) {
        cb(
          new Error(
            `File type ${ext || "unknown"} is not allowed`
          )
        );
        return;
      }

      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  },
});

// Hapus file sementara di disk, aman dipanggil meski file sudah tidak ada
function cleanupTmpFile(filePath?: string) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      logger.error({ err, filePath }, "uploads.tmpfile.cleanup_failed");
    }
  });
}

type UploadCallback = (
  req: Request,
  res: Response
) => Promise<void> | void;

function uploadHandler(callback: UploadCallback) {
  return (
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    upload.single("file")(
      req,
      res,
      async (err: unknown) => {
        try {
          if (err instanceof multer.MulterError) {
            logger.error({ err, code: err.code }, "upload.multer.error");
            const friendly: Record<string, string> = {
              LIMIT_FILE_SIZE: `File terlalu besar. Maksimal ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`,
              LIMIT_UNEXPECTED_FILE: "Field file tidak sesuai. Pastikan upload menggunakan field 'file'.",
            };
            res.status(400).json({
              error: friendly[err.code] || err.message,
            });
            return;
          }

          if (err instanceof Error) {
            logger.error(
              { err },
              "upload.validation.error"
            );

            res.status(400).json({
              error:
                err.message ||
                "File validation failed",
            });
            return;
          }

          await callback(req, res);
        } catch (callbackError) {
          logger.error(
            { err: callbackError },
            "upload.callback.error"
          );

          res.status(500).json({
            error: "Upload handler failed",
          });
        }
      }
    );
  };
}

async function uploadToSupabase(
  file: Express.Multer.File,
  fileName: string
) {
  const bucket = supabase.storage.from(
    "site-assets"
  );

  // Disk storage: file ada di file.path (bukan file.buffer lagi).
  // Stream dari disk ke Supabase — tidak perlu load seluruh file ke memory.
  const fileStream = fs.createReadStream(file.path);

  const { error } = await bucket.upload(
    fileName,
    fileStream,
    {
      contentType: file.mimetype,
      upsert: true,
      duplex: "half",
    } as any
  );

  if (error) {
    throw error;
  }

  const { data } =
    bucket.getPublicUrl(fileName);

  return data.publicUrl;
}

// =============================
// Admin Upload
// =============================

router.post(
  "/uploads",
  requireAuth,
  uploadHandler(
    async (
      req: Request,
      res: Response
    ): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({
            error: "No file uploaded",
          });
          return;
        }

        const ext = path.extname(
          req.file.originalname
        );

        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}${ext}`;

        let publicUrl: string;
        try {
          publicUrl = await uploadToSupabase(
            req.file,
            fileName
          );
        } finally {
          // Selalu hapus file sementara di disk, sukses maupun gagal
          cleanupTmpFile(req.file.path);
        }

        logger.info(
          {
            fileName,
            publicUrl,
            sizeBytes: req.file.size,
          },
          "admin.upload.success"
        );

        res.json({
          url: publicUrl,
          filename: fileName,
        });
      } catch (error) {
        cleanupTmpFile(req.file?.path);
        logger.error(
          { err: error },
          "admin.upload.failed"
        );

        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to upload file",
        });
      }
    }
  )
);

// =============================
// Crew Upload
// =============================

router.post(
  "/crew/uploads",
  uploadHandler(
    async (
      req: Request,
      res: Response
    ): Promise<void> => {
      try {
        const authHeader =
          req.headers.authorization;

        if (
          !authHeader ||
          !authHeader.startsWith(
            "Bearer "
          )
        ) {
          res.status(401).json({
            error: "Unauthorized",
          });
          return;
        }

        const token =
          authHeader.slice(7);

        const memberId = getCrewMemberIdFromToken(token);

        if (!memberId) {
          res.status(401).json({
            error: "Invalid token",
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            error: "No file uploaded",
          });
          return;
        }

        const ext = path.extname(
          req.file.originalname
        );

        const fileName = `crew-${memberId}-${Date.now()}${ext}`;

        let publicUrl: string;
        try {
          publicUrl = await uploadToSupabase(
            req.file,
            fileName
          );
        } finally {
          cleanupTmpFile(req.file.path);
        }

        let asset = null;
        let projectFile = null;

        const label =
          typeof req.body.label === "string" && req.body.label.trim()
            ? req.body.label.trim()
            : req.file.originalname;

        const projectId =
          typeof req.body.projectId === "string" && req.body.projectId.trim()
            ? req.body.projectId.trim()
            : "";

        try {
          if (projectId) {
            // === NEW: Attach to specific project (recommended for crew work) ===
            const [createdFile] = await db
              .insert(projectFilesTable)
              .values({
                projectId,
                uploadedBy: memberId,
                title: label,
                fileUrl: publicUrl,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                category: req.body.assetStatus || "work-file",
                description: `Uploaded by crew. Original: ${req.file.originalname}`,
              })
              .returning();

            projectFile = createdFile;
          } else {
            // Legacy behavior: goes to digital assets as draft (not recommended for work files)
            const assetStatus = req.body.assetStatus || "raw-footage";
            const [createdAsset] = await db
              .insert(digitalAssetsTable)
              .values({
                title: label,
                description: `Uploaded by crew ${memberId} | Original: ${req.file.originalname}`,
                category: assetStatus,
                price: 0,
                fileUrl: publicUrl,
                thumbnailUrl: null,
                previewImages: "[]",
                isActive: false,
                isFeatured: false,
              })
              .returning();

            asset = createdAsset;
          }
        } catch (assetError) {
          logger.error({ err: assetError, memberId, fileName }, "crew.upload.tracking_failed");
        }

        logger.info(
          {
            memberId,
            fileName,
            publicUrl,
          },
          "crew.upload.success"
        );

        res.json({
          url: publicUrl,
          filename: fileName,
          asset,
          projectFile,
          projectId: projectId || null,
        });
      } catch (error) {
        cleanupTmpFile(req.file?.path);
        logger.error(
          { err: error },
          "crew.upload.failed"
        );

        res.status(500).json({
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }
  )
);

export default router;