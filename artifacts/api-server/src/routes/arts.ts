// src/routes/arts.ts
import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * Arts / Projects Management Routes
 * TODO: Implement full CRUD operations
 */

router.get("/arts", async (req, res) => {
  try {
    res.json({
      message: "Arts endpoint",
      status: "not implemented"
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;