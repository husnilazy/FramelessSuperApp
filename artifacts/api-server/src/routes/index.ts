import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import teamRouter from "./team";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import expensesRouter from "./expenses";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(teamRouter);
router.use(clientsRouter);
router.use(invoicesRouter);
router.use(expensesRouter);
router.use(dashboardRouter);

export default router;
