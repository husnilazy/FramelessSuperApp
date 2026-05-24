import { Router, type Request, type Response } from "express"; // 1. Import tipe data Request dan Response
import { HealthCheckResponse } from "@workspace/api-zod";

const router = Router(); // 2. Hapus ': IRouter', biarkan TypeScript mendeteksi secara otomatis

// 3. Tambahkan tipe data eksplisit pada _req dan res
router.get("/healthz", (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;