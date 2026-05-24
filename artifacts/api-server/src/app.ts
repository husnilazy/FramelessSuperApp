import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http"; // 1. Gunakan named import untuk mengatasi 'no call signatures'
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import type { IncomingMessage, ServerResponse } from "http"; // 2. Import tipe data bawaan Node.js

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      // 3. Definisikan tipe data secara eksplisit untuk menghindari implicit 'any'
      req(req: IncomingMessage & { id?: string | number }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname is injected by esbuild banner to point to dist/
const uploadDir = path.resolve(__dirname, "../../../uploads");
app.use("/api/uploads", express.static(uploadDir));
app.use("/api", router);

export default app;