import { Router } from "express";
import type { RequestHandler } from "express"; // 1. Import RequestHandler
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router();

// 2. Bungkus fungsi ke dalam RequestHandler agar otomatis ter-type dengan aman
const handleHealthCheck: RequestHandler = (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

router.get("/healthz", handleHealthCheck);

export default router;