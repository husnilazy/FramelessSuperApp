// artifacts/frameless/src/App.tsx
const CrewLinkPage = lazy(() => import("@/pages/crew-link-page"));
const CrewLinkSubPage = lazy(() => import("@/pages/crew-link-subpage"));
import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, AuthGuard } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";

// Auth
const LoginPage = lazy(() => import("@/pages/login"));
// Public pages
const LandingPage = lazy(() => import("@/pages/landing"));
const ServicesPage = lazy(() => import("@/pages/services"));
const ServiceDetailPage = lazy(() => import("@/pages/service-detail"));
const CoursePage = lazy(() => import("@/pages/course-page"));
const CoursesPage = lazy(() => import("@/pages/courses"));
const DigitalAssetsPage = lazy(() => import("@/pages/digital-assets"));
const PortalPage = lazy(() => import("@/pages/portal"));
const AcademyLoginPage = lazy(() => import("@/pages/academy-login"));
// Crew
const CrewLoginPage = lazy(() => import("@/pages/crew-login"));
const CrewDashboard = lazy(() => import("@/pages/crew-dashboard"));
// Admin pages
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CommandCenterPage = lazy(() => import("@/pages/command-center"));
const ProjectsPage = lazy(() => import("@/pages/projects"));
const ProjectDetailPage = lazy(() => import("@/pages/project-detail"));
const TeamPage = lazy(() => import("@/pages/team"));
const ClientsPage = lazy(() => import("@/pages/clients"));
const InvoicesPage = lazy(() => import("@/pages/invoices"));
const InvoiceEditorPage = lazy(() => import("@/pages/invoice-editor"));
const QuotationsPage = lazy(() => import("@/pages/quotations"));
const QuotationEditorPage = lazy(() => import("@/pages/quotation-editor"));
const ExpensesPage = lazy(() => import("@/pages/expenses"));
const FinancePage = lazy(() => import("@/pages/finance"));
const AccountingPage = lazy(() => import("@/pages/accounting"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const CmsEditorPage = lazy(() => import("@/pages/cms-editor"));
const PaymentSettingsPage = lazy(() => import("@/pages/payment-settings"));
const CoursesAdminPage = lazy(() => import("@/pages/courses-admin"));
const DigitalAssetsAdminPage = lazy(() => import("@/pages/digital-assets-admin"));
const AppearancePage = lazy(() => import("@/pages/appearance"));
const FilmmakingTools = lazy(() => import("@/pages/FilmmakingTools").then((m) => ({ default: m.FilmmakingTools })));
const FilmmakingSubmissionsAdmin = lazy(() => import("@/pages/FilmmakingSubmissionsAdmin"));

/** Layar tunggu ringan saat potongan halaman diunduh. Header & menu admin tetap tampil. */
function PageFallback() {
  return (
    <div role="status" aria-label="Memuat halaman" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid hsl(var(--primary))", borderTopColor: "transparent", animation: "pfspin .7s linear infinite" }} />
      <style>{`@keyframes pfspin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false } },
});

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <AppLayout>
        <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/"                         component={Dashboard} />
          <Route path="/dashboard"                component={Dashboard} />
          <Route path="/command-center"           component={CommandCenterPage} />
          <Route path="/projects/:id"             component={ProjectDetailPage} />
          <Route path="/projects"                 component={ProjectsPage} />
          <Route path="/team"                     component={TeamPage} />
          <Route path="/clients"                  component={ClientsPage} />
          <Route path="/quotations/new"           component={QuotationEditorPage} />
          <Route path="/quotations/:id"           component={QuotationEditorPage} />
          <Route path="/quotations"               component={QuotationsPage} />
          <Route path="/invoices/new"             component={InvoiceEditorPage} />
          <Route path="/invoices/:id"             component={InvoiceEditorPage} />
          <Route path="/invoices"                 component={InvoicesPage} />
          <Route path="/expenses"                 component={ExpensesPage} />
          <Route path="/finance"                  component={FinancePage} />
          <Route path="/accounting"               component={AccountingPage} />
          <Route path="/settings"                 component={SettingsPage} />
          <Route path="/cms"                      component={CmsEditorPage} />
          <Route path="/payment-settings"         component={PaymentSettingsPage} />
          <Route path="/courses-admin"            component={CoursesAdminPage} />
          <Route path="/digital-assets-admin"     component={DigitalAssetsAdminPage} />
          <Route path="/appearance"               component={AppearancePage} />
          <Route path="/filmmaking-tools"         component={FilmmakingTools} />
          <Route path="/filmmaking-tools/documents/:id" component={FilmmakingTools} />
          <Route path="/admin/filmmaking-submissions" component={FilmmakingSubmissionsAdmin} />
          <Route                                  component={NotFound} />
        </Switch>
        </Suspense>
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Switch>
      {/* Public */}
      <Route path="/"               component={LandingPage} />
      <Route path="/landing"        component={LandingPage} />
      <Route path="/login"          component={LoginPage} />
      <Route path="/services"       component={ServicesPage} />
      <Route path="/services/:slug" component={ServiceDetailPage} />
      <Route path="/courses"        component={CoursesPage} />
      <Route path="/course/:slug"   component={CoursePage} />
      <Route path="/store"          component={DigitalAssetsPage} />
      <Route path="/portal/:id"     component={PortalPage} />
      <Route path="/academy/login"  component={AcademyLoginPage} />
      <Route path="/academy-login"  component={AcademyLoginPage} />

      {/* Crew Link-in-Bio public pages */}
      <Route path="/crew/link/:username" component={CrewLinkPage} />

      {/* Crew */}
      <Route path="/crew/login"     component={CrewLoginPage} />
      <Route path="/crew/dashboard" component={CrewDashboard} />
      <Route path="/crew"           component={CrewDashboard} />

      {/* Admin (protected) — SEMUA route spesifik WAJIB di atas catch-all :username di bawah */}
      <Route path="/admin"               component={ProtectedRoutes} />
      <Route path="/dashboard"           component={ProtectedRoutes} />
      <Route path="/command-center"      component={ProtectedRoutes} />
      <Route path="/projects"            component={ProtectedRoutes} />
      <Route path="/projects/:id"        component={ProtectedRoutes} />
      <Route path="/team"                component={ProtectedRoutes} />
      <Route path="/clients"             component={ProtectedRoutes} />
      <Route path="/quotations"          component={ProtectedRoutes} />
      <Route path="/quotations/new"      component={ProtectedRoutes} />
      <Route path="/quotations/:id"      component={ProtectedRoutes} />
      <Route path="/invoices"            component={ProtectedRoutes} />
      <Route path="/invoices/new"        component={ProtectedRoutes} />
      <Route path="/invoices/:id"        component={ProtectedRoutes} />
      <Route path="/expenses"            component={ProtectedRoutes} />
      <Route path="/finance"             component={ProtectedRoutes} />
      <Route path="/accounting"          component={ProtectedRoutes} />
      <Route path="/settings"            component={ProtectedRoutes} />
      <Route path="/cms"                 component={ProtectedRoutes} />
      <Route path="/payment-settings"    component={ProtectedRoutes} />
      <Route path="/courses-admin"       component={ProtectedRoutes} />
      <Route path="/digital-assets-admin" component={ProtectedRoutes} />
      <Route path="/appearance"          component={ProtectedRoutes} />
      <Route path="/filmmaking-tools"    component={ProtectedRoutes} />
      <Route path="/filmmaking-tools/documents/:id" component={ProtectedRoutes} />
      <Route path="/admin/filmmaking-submissions" component={ProtectedRoutes} />

      {/* ── Catch-all Link-in-Bio — HARUS PALING BAWAH sebelum NotFound.
          Kalau nambah route admin baru bentuk "/sesuatu/sesuatu" di masa depan,
          taruh SEBELUM 3 baris ini, jangan sesudahnya. ── */}
      <Route path="/@:username/:slug" component={CrewLinkSubPage} />
      <Route path="/:username/:slug"  component={CrewLinkSubPage} />
      <Route path="/:username"        component={CrewLinkPage} />

      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;