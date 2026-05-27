import express, { type Express } from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

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
        "https://www.framelesscreative.com",
        "https://framelesscreative.com",
        "https://frameless-super-app-frameless.vercel.app"
      ];

      // izinkan request non-browser (Postman/server)
      if (!origin) return callback(null, true);

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

// penting untuk preflight request
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.NODE_ENV === "production"
  ? "/tmp/uploads"
  : path.resolve(__dirname, "../../../uploads");
app.use("/api/uploads", express.static(uploadDir));
app.use("/api", router);

export default app;