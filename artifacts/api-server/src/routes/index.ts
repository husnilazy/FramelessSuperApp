// src/routes/index.ts
import { Router, type IRouter } from "express";
import authRouter from "./auth";
import artsRouter from "./arts";
import calendarRouter from "./calendar";
import chatRouter from "./chat";
import clientsRouter from "./clients";
import cmsRouter from "./cms";
import coursesRouter from "./courses";
import crewRouter from "./crew";
import dashboardRouter from "./dashboard";
import digitalAssetsRouter from "./digital-assets";
import expensesRouter from "./expenses";
import healthRouter from "./health";
import invoicesRouter from "./invoices";
import paymentSettingsRouter from "./payment-settings";
import paymentsRouter from "./payments";
import projectsRouter from "./projects";
import siteLogosRouter from "./site-logos";
import siteVideosRouter from "./site-videos";
import teamRouter from "./team";
import uploadsRouter from "./uploads";

const router: IRouter = Router();

// Auth routes (PENTING - ini yang kamu butuh!)
router.use(authRouter);

// Semua routes lainnya
router.use(artsRouter);
router.use(calendarRouter);
router.use(chatRouter);
router.use(clientsRouter);
router.use(cmsRouter);
router.use(coursesRouter);
router.use(crewRouter);
router.use(dashboardRouter);
router.use(digitalAssetsRouter);
router.use(expensesRouter);
router.use(healthRouter);
router.use(invoicesRouter);
router.use(paymentSettingsRouter);
router.use(paymentsRouter);
router.use(projectsRouter);
router.use(siteLogosRouter);
router.use(siteVideosRouter);
router.use(teamRouter);
router.use(uploadsRouter);

// 404 fallback
router.use((req, res) => {
  res.status(404).json({
    error: "Route tidak ditemukan",
    path: req.path,
    method: req.method,
  });
});

export default router;