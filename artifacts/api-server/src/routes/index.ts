// src/routes/index.ts
import crewLinkInBioRouter from "./crew-linkinbio.js";
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
import accountsRouter from "./accounts.js";
import journalRouter from "./journal.js";
import accountMappingRouter from "./account-mapping.js";
import autoPosterRouter from "./auto-poster.js";
import quotationsRouter from "./quotations.js";
import companyProfileRouter from "./company-profile.js";
import { requireAdmin } from "../middlewares/auth.js";
import { requireUniversalAuth } from "./middleware.js";
import { ensureInvoiceColumns } from "../lib/invoice-schema.js";
import { rateLimit } from "../middlewares/rate-limit.js";


const router: IRouter = Router();

// Skema invoice (kolom tambahan) disiapkan sekali per instance sebelum route apa pun
// yang menyentuh tabel invoices. Non-fatal: bila gagal, query terkait yang akan error jelas.
router.use((_req, _res, next) => {
  ensureInvoiceColumns().then(() => next(), () => next());
});

// ── Admin guard ──────────────────────────────────────────────────────────────
// Semua endpoint back-office WAJIB admin. Dipasang di sini (sebelum router) supaya
// route baru di file-file ini otomatis terlindungi. Endpoint publik (landing, kursus,
// webhook Midtrans, link-in-bio, endpoint crew) sengaja TIDAK ada di daftar ini.
router.use(
  [
    "/invoices",
    "/expenses",
    "/income",
    "/journal",
    "/ledger",
    "/trial-balance",
    "/financial-statements",
    "/accounts",
    "/account-mappings",
    "/auto-post",
    "/clients",
    "/projects",
    "/tasks",
    "/quotations",
    "/equipment",
    "/dashboard",
    "/finance",
    "/activity",
    "/team-safe",
    "/team-columns",
    "/payments/activate",
    "/company-profile",
    "/calendar",
    "/availability",
    "/admin",
  ],
  requireAdmin,
);
// Method-aware: GET /team boleh publik (landing page; isinya disaring di team.ts), tulis = admin.
router.use("/team", (req, res, next) => {
  if (req.method === "GET" || req.method === "OPTIONS") return next();
  return requireAdmin(req, res, next);
});

// Endpoint dengan data peserta/pembayaran yang tidak dipakai halaman publik → admin saja.
router.get("/payments/enrollment/:id", requireAdmin);
router.get("/enrollments/:id", requireAdmin);
router.patch("/course-workshops/:id/increment", requireAdmin);

// Route yang di file aslinya hanya `requireAuth` (= SIAPA PUN yang punya akun valid, bukan cek peran).
// Tanpa penjaga ini, akun biasa bisa mengubah CMS/kursus/pembayaran dan membaca data peserta.
// Aturan: semua method tulis wajib admin; GET hanya admin untuk data sensitif. Endpoint publik
// (inquiry, beli/unduh aset, katalog, payment-settings/public) sengaja dikecualikan.
const WRITE_ADMIN_PREFIXES = [
  "/cms", "/courses", "/course-packages", "/course-materials", "/course-workshops",
  "/course-gallery", "/enrollments", "/payment-settings", "/site-logos", "/site-videos",
  "/digital-assets", "/uploads",
];
const PUBLIC_WRITES = [/^\/cms\/inquiry\/?$/, /^\/digital-assets\/[^/]+\/(purchase|download)\/?$/];
const ADMIN_READS = [
  /^\/enrollments(\/|$)/, /^\/payment-settings\/?$/,
  /^\/courses\/[^/]+\/(packages|materials|workshops|gallery)\/?$/,
];
router.use((req, res, next) => {
  const p = req.path;
  if (req.method === "OPTIONS") return next();
  const isRead = req.method === "GET" || req.method === "HEAD";
  if (isRead) {
    return ADMIN_READS.some((re) => re.test(p)) ? requireAdmin(req, res, next) : next();
  }
  if (PUBLIC_WRITES.some((re) => re.test(p))) return next();
  if (WRITE_ADMIN_PREFIXES.some((pre) => p === pre || p.startsWith(pre + "/"))) return requireAdmin(req, res, next);
  next();
});

// Pendaftaran akun mandiri ditutup: akun baru hanya dibuat admin (tidak ada UI yang memakainya).
router.post("/auth/register", requireAdmin);

// Chat internal tim: admin ATAU crew yang login.
router.use("/chat/messages", requireUniversalAuth);

// Anti brute-force untuk endpoint yang menerima kredensial / kode member.
router.post(["/auth/login", "/crew/login", "/academy/login", "/course-members/login"], rateLimit({ windowMs: 15 * 60_000, max: 20, key: "login" }));
router.post("/auth/register", rateLimit({ windowMs: 60 * 60_000, max: 5, key: "register" }));
// Estimasi AI publik memanggil Gemini berbayar: batasi per IP.
router.post("/ai/chat", rateLimit({ windowMs: 10 * 60_000, max: 20, key: "ai-chat" }));
router.post("/course-members/resend-access", rateLimit({ windowMs: 60 * 60_000, max: 5, key: "resend" }));

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
router.use(accountsRouter);
router.use(journalRouter);
router.use(accountMappingRouter);
router.use(autoPosterRouter);
router.use(quotationsRouter);
router.use(companyProfileRouter);
router.use(crewLinkInBioRouter);

// 404 fallback
router.use((req, res) => {
  res.status(404).json({
    error: "Route tidak ditemukan",
    path: req.path,
    method: req.method,
  });
});



export default router;