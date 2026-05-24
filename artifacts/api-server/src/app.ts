import express, { type Express } from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

// Perbaikan untuk mengatasi "Expression is not callable" di Vercel
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
// ... kode lainnya
app.use(
  cors({
    origin: "https://frameless-super-app-frameless.vercel.app", // Alamat frontend kamu
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Penting jika kamu menggunakan session/cookies
  })
);
// ... kode lainnya

// __dirname is injected by esbuild banner to point to dist/
const uploadDir = path.resolve(__dirname, "../../../uploads");
app.use("/api/uploads", express.static(uploadDir));
app.use("/api", router);

export default app;