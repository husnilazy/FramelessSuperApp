import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import teamRouter from "./team";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import expensesRouter from "./expenses";
import dashboardRouter from "./dashboard";
import cmsRouter from "./cms";
import coursesRouter from "./courses";
import crewRouter from "./crew";
import calendarRouter from "./calendar";
import paymentSettingsRouter from "./payment-settings";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(teamRouter);
router.use(clientsRouter);
router.use(invoicesRouter);
router.use(expensesRouter);
router.use(dashboardRouter);
router.use(cmsRouter);
router.use(coursesRouter);
router.use(crewRouter);
router.use(calendarRouter);
router.use(paymentSettingsRouter);
router.use(aiRouter);

export default router;
