import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import { requireAuth } from "./middleware";
import { crewTokenStore } from "./crew";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabase";

const router: IRouter = Router();

// Memory storage → file masuk RAM lalu dikirim ke Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const allowed =
      /\.(jpeg|jpg|png|gif|webp|svg|pdf|mp4|webm|mov|m4v|doc|docx|xls|xlsx|ppt|pptx)$/i.test(
        ext
      );

    if (allowed) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type .${ext.slice(
            1
          )} not allowed`
        )
      );
    }
  },
});

const uploadHandler =
  (
    callback: (
      req: Request,
      res: Response
    ) => Promise<void> | void
  ) =>
  (
    req: Request,
    res: Response,
    next: any
  ) => {
    upload.single("file")(
      req,
      res,
      (err) => {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({
            error: err.message,
          });
        }

        if (err) {
          logger.error(
            { err },
            "upload_error"
          );

          return res.status(400).json({
            error:
              err.message ||
              "File validation failed",
          });
        }

        callback(req, res);
      }
    );
  };

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
    ) => {
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

        const fileName =
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}${ext}`;

        const { error } =
          await supabase.storage
            .from("site-assets")
            .upload(
              fileName,
              req.file.buffer,
              {
                contentType:
                  req.file.mimetype,
                upsert: true,
              }
            );

        if (error) {
          throw error;
        }

        const { data } =
          supabase.storage
            .from("site-assets")
            .getPublicUrl(fileName);

        logger.info(
          {
            fileName,
            publicUrl:
              data.publicUrl,
          },
          "upload_success"
        );

        res.json({
          url: data.publicUrl,
          filename: fileName,
        });

      } catch (err) {
        logger.error(
          { err },
          "supabase_upload_error"
        );

        res.status(500).json({
          error:
            "Failed to upload file",
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
    ) => {
      try {
        const authHeader =
          req.headers.authorization;

        if (
          !authHeader?.startsWith(
            "Bearer "
          )
        ) {
          res.status(401).json({
            error:
              "Unauthorized",
          });
          return;
        }

        const token =
          authHeader.slice(7);

        const memberId =
          crewTokenStore.get(
            token
          );

        if (!memberId) {
          res.status(401).json({
            error:
              "Invalid token",
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            error:
              "No file uploaded",
          });
          return;
        }

        const ext =
          path.extname(
            req.file.originalname
          );

        const fileName =
          `crew-${memberId}-${Date.now()}${ext}`;

        const { error } =
          await supabase.storage
            .from("site-assets")
            .upload(
              fileName,
              req.file.buffer,
              {
                contentType:
                  req.file.mimetype,
                upsert: true,
              }
            );

        if (error) {
          throw error;
        }

        const { data } =
          supabase.storage
            .from("site-assets")
            .getPublicUrl(fileName);

        res.json({
          url: data.publicUrl,
          filename: fileName,
        });

      } catch (err) {
        logger.error(
          { err },
          "crew_upload_error"
        );

        res.status(500).json({
          error:
            "Upload failed",
        });
      }
    }
  )
);

export default router;