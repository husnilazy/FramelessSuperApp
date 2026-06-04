import express, { type Express } from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
import path from "path";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const pinoHttp = (pinoHttpModule as any).default || pinoHttpModule;
const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://www.framelesscreative.com",
        "https://framelesscreative.com",
        "https://frameless-super-app-frameless.vercel.app"
      ];

      if (!origin) return callback(null, true);

      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.NODE_ENV === "production"
  ? "/tmp/uploads"
  : path.resolve(__dirname, "../../../uploads");
app.use("/api/uploads", express.static(uploadDir));
app.use("/api", router);

// Global error handler — expose detail error di response dan console
app.use((err: any, req: any, res: any, next: any) => {
  console.error("❌ GLOBAL ERROR:", err?.message || err);
  console.error("❌ STACK:", err?.stack);
  res.status(500).json({
    error: err?.message || "Internal Server Error",
    detail: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
  });
});

export default app;