import { lazy, Suspense, Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

class LandingErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) return <div className="min-h-screen bg-[#03040a]" />;
    return this.props.children;
  }
}

function RedirectWithSearch({ to, tab }: { to: string; tab: string }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", tab);
  return <Navigate to={`${to}?${params.toString()}`} replace />;
}
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OrganizationGuard } from "@/components/auth/OrganizationGuard";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { SuperAdminGuard } from "@/components/auth/SuperAdminGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
const Landing = lazy(() => import("@/pages/Landing"));
import Dashboard from "@/pages/Dashboard";
import Analytics from "@/pages/Analytics";
import Chat from "@/pages/Chat";
import Direct from "@/pages/Direct";
import Contacts from "@/pages/Contacts";
import Profile from "@/pages/Profile";
import OrganizationSettings from "@/pages/OrganizationSettings";
import WhatsAppConnection from "@/pages/WhatsAppConnection";
import Conexoes from "@/pages/Conexoes";
import Automations from "@/pages/Automations";
import InternalChat from "@/pages/InternalChat";
import FlowBuilder from "@/pages/FlowBuilder";
import Broadcast from "@/pages/Broadcast";
import Pipeline from "@/pages/Pipeline";
import Catalog from "@/pages/Catalog";
import PublicCatalog from "@/pages/PublicCatalog";


import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import ForceLogout from "@/pages/ForceLogout";
import NotFound from "./pages/NotFound";
import SuperAdminDashboard from "@/pages/super-admin/SuperAdminDashboard";
import SuperAdminOrganizations from "@/pages/super-admin/SuperAdminOrganizations";
import SuperAdminUsers from "@/pages/super-admin/SuperAdminUsers";
import SuperAdminPerformance from "@/pages/super-admin/SuperAdminPerformance";
import SuperAdminCalendarTemplates from "@/pages/super-admin/SuperAdminCalendarTemplates";
import JoinOrganization from "@/pages/JoinOrganization";
import SuperAdminOwnerInvites from "@/pages/super-admin/SuperAdminOwnerInvites";
import ContactDiff from "@/pages/ContactDiff";
import PropostaSolarExecutive from "@/pages/PropostaSolarExecutive";
import PlanoCarangueman from "@/pages/PlanoCarangueman";
import DraLuana from "@/pages/DraLuana";
import SatisfactionSurveyPage from "@/pages/SatisfactionSurvey";

import McpDocs from "@/pages/McpDocs";
import SquadAI from "@/pages/SquadAI";
import InstagramConnection from "@/pages/InstagramConnection";
import InstagramComments from "@/pages/InstagramComments";
import EmailSettings from "@/pages/EmailSettings";
import Support from "@/pages/Support";
import SuperAdminSupport from "@/pages/super-admin/SuperAdminSupport";
import SharedAnalyses from "@/pages/SharedAnalyses";
import Gestao from "@/pages/Gestao";
import Forms from "@/pages/Forms";
import PaymentIntegrations from "@/pages/PaymentIntegrations";
import PublicForm from "@/pages/PublicForm";
import Calendars from "@/pages/Calendars";
import CalendarEditor from "@/pages/CalendarEditor";
import Agenda from "@/pages/Agenda";
import PublicBooking from "@/pages/PublicBooking";
import BookingCancel from "@/pages/BookingCancel";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Financial from "@/pages/Financial";
import SuperAdminBlog from "@/pages/super-admin/SuperAdminBlog";
import { HelmetProvider } from "react-helmet-async";
import Privacy from "@/pages/legal/Privacy";
import Terms from "@/pages/legal/Terms";
import DataDeletion from "@/pages/legal/DataDeletion";
import MetaUrlsCheck from "@/pages/MetaUrlsCheck";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/*
        Render toasters at the highest level (and Toaster is portaled to <body>)
        so they are never clipped by layout containers (overflow/transform).
      */}
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={
              <LandingErrorBoundary>
                <Suspense fallback={<div className="min-h-screen bg-[#03040a]" />}>
                  <Landing />
                </Suspense>
              </LandingErrorBoundary>
            } />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/datadeletion" element={<DataDeletion />} />
            <Route path="/data-deletion" element={<Navigate to="/datadeletion" replace />} />
            <Route path="/meta-urls-check" element={<MetaUrlsCheck />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/force-logout" element={<ForceLogout />} />
            <Route path="/join/:inviteCode" element={<JoinOrganization />} />
            <Route path="/join" element={<JoinOrganization />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="chat">
                        <Chat />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            {/* INSTAGRAM_HIDDEN:
            <Route
              path="/direct"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="chat">
                        <Direct />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            */}
            <Route
              path="/contatos"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="chat">
                        <Contacts />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analises"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="analytics">
                        <Analytics />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Profile />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizacao"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="settings">
                        <OrganizationSettings />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ia"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="settings">
                        <SquadAI />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conexoes"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="connection">
                        <Conexoes />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/whatsapp" element={<RedirectWithSearch to="/conexoes" tab="whatsapp" />} />
            {/* INSTAGRAM_HIDDEN:
            <Route path="/instagram" element={<RedirectWithSearch to="/conexoes" tab="instagram" />} />
            <Route
              path="/instagram/comentarios"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="connection">
                        <InstagramComments />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            */}
            <Route path="/email" element={<RedirectWithSearch to="/conexoes" tab="email" />} />
            <Route
              path="/automations"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="settings">
                        <Automations />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/automations/:id"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="settings">
                        <FlowBuilder />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat-interno"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <InternalChat />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/broadcast"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Broadcast />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pipeline"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Pipeline />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            {/* Support Route */}
            <Route
              path="/suporte"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Support />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Gestao />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/tarefas" element={<Navigate to="/gestao?view=tarefas" replace />} />
            <Route path="/projetos" element={<Navigate to="/gestao?view=projetos" replace />} />
            <Route path="/metas" element={<Navigate to="/gestao?view=metas" replace />} />
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Financial />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            {/* Super Admin Routes */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminDashboard />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminOrganizations />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/users"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminUsers />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/performance"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminPerformance />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/calendar-templates"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminCalendarTemplates />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/suporte"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout fullHeight>
                      <SuperAdminSupport />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin/convites-owner"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminOwnerInvites />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/formularios"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="forms">
                        <Forms />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integracoes-pagamento"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="settings">
                        <PaymentIntegrations />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/f/:slug" element={<PublicForm />} />
            <Route path="/loja/:slug" element={<PublicCatalog />} />
            <Route
              path="/catalogo"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <Catalog />
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/calendarios/:id"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="settings">
                        <CalendarEditor />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agenda"
              element={
                <ProtectedRoute>
                  <OrganizationGuard>
                    <AppLayout>
                      <PermissionGuard permission="bookings_view">
                        <Agenda />
                      </PermissionGuard>
                    </AppLayout>
                  </OrganizationGuard>
                </ProtectedRoute>
              }
            />
            <Route path="/agenda/:slug" element={<PublicBooking />} />
            <Route path="/booking/cancel/:token" element={<BookingCancel />} />
            <Route path="/contact-diff" element={<ContactDiff />} />
            <Route path="/proposta/solar-executive" element={<PropostaSolarExecutive />} />
            <Route path="/plano-carangueman" element={<PlanoCarangueman />} />
            <Route path="/dra-luana" element={<DraLuana />} />
            <Route path="/pesquisa/:token" element={<SatisfactionSurveyPage />} />
            <Route path="/docs/mcp" element={<McpDocs />} />
            <Route path="/analises-compartilhadas/:token" element={<SharedAnalyses />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route
              path="/super-admin/blog"
              element={
                <ProtectedRoute>
                  <SuperAdminGuard>
                    <SuperAdminLayout>
                      <SuperAdminBlog />
                    </SuperAdminLayout>
                  </SuperAdminGuard>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
