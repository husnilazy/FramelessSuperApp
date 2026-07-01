// src/routes/index.ts
import { Router, type IRouter } from "express";
import authRouter from "./auth.js";
import artsRouter from "./arts.js";
import availabilityRouter from "./availability.js";
import calendarRouter from "./calendar.js";
import chatRouter from "./chat.js";
import commandCenterRouter from "./command-center.js";
import timeTrackingRouter from "./time-tracking.js";
import clientsRouter from "./clients.js";
import cmsRouter from "./cms.js";
import coursesRouter from "./courses.js";
import courseMembersRouter from "./course-members.js";
import crewRouter from "./crew.js";
import dashboardRouter from "./dashboard.js";
import digitalAssetsRouter from "./digital-assets.js";
import expensesRouter from "./expenses.js";
import healthRouter from "./health.js";
import invoicesRouter from "./invoices.js";
import paymentSettingsRouter from "./payment-settings.js";
import paymentsRouter from "./payments.js";
import projectsRouter from "./projects.js";
import siteLogosRouter from "./site-logos.js";
import siteVideosRouter from "./site-videos.js";
import teamRouter from "./team.js";
import uploadsRouter from "./uploads.js";
import aiRouter from "./ai.js";
import projectFilesRouter from "./project-files.js";
import filmmakingDocumentsRouter from "./filmmaking-documents.js";
import filmmakingCollaboratorsRouter from "./filmmaking-collaborators.js";
import filmmakingSubmissionsRouter from "./filmmaking-submissions.js";
import filmmakingCollaborationRouter from "./filmmaking-collaboration.js";
import filmmakingExportRouter from "./filmmaking-export.js";
import incomeRouter from "./income.js";
import equipmentRouter from "./equipment.js";

const router: IRouter = Router();

// Auth routes (PENTING - ini yang kamu butuh!)
router.use(authRouter);

// Semua routes lainnya
router.use(artsRouter);
router.use(availabilityRouter);
router.use(calendarRouter);
router.use(chatRouter);
router.use(commandCenterRouter);
router.use(timeTrackingRouter);
router.use(clientsRouter);
router.use(cmsRouter);
router.use(coursesRouter);
router.use(courseMembersRouter);
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
router.use(aiRouter);
router.use(projectFilesRouter);
router.use(filmmakingDocumentsRouter);
router.use(filmmakingCollaboratorsRouter);
router.use(filmmakingSubmissionsRouter);
router.use(filmmakingCollaborationRouter);
router.use(filmmakingExportRouter);
router.use(incomeRouter);
router.use(equipmentRouter);

// 404 fallback
router.use((req, res) => {
  res.status(404).json({
    error: "Route tidak ditemukan",
    path: req.path,
    method: req.method,
  });
});



export default router;