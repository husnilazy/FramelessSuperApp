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
    origin: [
      "https://www.framelesscreative.com",
      "https://framelesscreative.com",
      "https://frameless-super-app-frameless.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.resolve(__dirname, "../../../uploads");
app.use("/api/uploads", express.static(uploadDir));
app.use("/api", router);

export default app;