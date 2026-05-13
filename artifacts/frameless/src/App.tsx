import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, AuthGuard } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";

import LoginPage from "@/pages/login";
import LandingPage from "@/pages/landing";
import CoursePage from "@/pages/course-page";
import CrewLoginPage from "@/pages/crew-login";
import CrewDashboard from "@/pages/crew-dashboard";
import Dashboard from "@/pages/dashboard";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import TeamPage from "@/pages/team";
import ClientsPage from "@/pages/clients";
import InvoicesPage from "@/pages/invoices";
import InvoiceEditorPage from "@/pages/invoice-editor";
import ExpensesPage from "@/pages/expenses";
import FinancePage from "@/pages/finance";
import SettingsPage from "@/pages/settings";
import CmsEditorPage from "@/pages/cms-editor";
import PaymentSettingsPage from "@/pages/payment-settings";
import CoursesAdminPage from "@/pages/courses-admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/projects/:id" component={ProjectDetailPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/team" component={TeamPage} />
          <Route path="/clients" component={ClientsPage} />
          <Route path="/invoices/new" component={InvoiceEditorPage} />
          <Route path="/invoices/:id" component={InvoiceEditorPage} />
          <Route path="/invoices" component={InvoicesPage} />
          <Route path="/expenses" component={ExpensesPage} />
          <Route path="/finance" component={FinancePage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/cms" component={CmsEditorPage} />
          <Route path="/payment-settings" component={PaymentSettingsPage} />
          <Route path="/courses-admin" component={CoursesAdminPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/" component={LandingPage} />
      <Route path="/course/:slug" component={CoursePage} />
      <Route path="/crew/login" component={CrewLoginPage} />
      <Route path="/crew/dashboard" component={CrewDashboard} />
      <Route path="/crew" component={CrewDashboard} />
      <Route path="/admin" component={ProtectedRoutes} />
      <Route path="/dashboard" component={ProtectedRoutes} />
      <Route path="/projects" component={ProtectedRoutes} />
      <Route path="/projects/:id" component={ProtectedRoutes} />
      <Route path="/team" component={ProtectedRoutes} />
      <Route path="/clients" component={ProtectedRoutes} />
      <Route path="/invoices" component={ProtectedRoutes} />
      <Route path="/invoices/new" component={ProtectedRoutes} />
      <Route path="/invoices/:id" component={ProtectedRoutes} />
      <Route path="/expenses" component={ProtectedRoutes} />
      <Route path="/finance" component={ProtectedRoutes} />
      <Route path="/settings" component={ProtectedRoutes} />
      <Route path="/cms" component={ProtectedRoutes} />
      <Route path="/payment-settings" component={ProtectedRoutes} />
      <Route path="/courses-admin" component={ProtectedRoutes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
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
  );
}

export default App;
