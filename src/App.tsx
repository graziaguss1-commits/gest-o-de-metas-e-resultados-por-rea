import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import AuthPage from "./pages/AuthPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import MetasPage from "./pages/MetasPage";
import AnaliseMetaPage from "./pages/AnaliseMetaPage";
import PlanosPage from "./pages/PlanosPage";
import CalendarPage from "./pages/CalendarPage";
import WeeklyPlanningPage from "./pages/WeeklyPlanningPage";
import ActionsPage from "./pages/ActionsPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import AjudaPage from "./pages/AjudaPage";
import SettingsPage from "./pages/SettingsPage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFound from "./pages/NotFound";
import GoogleCalendarStart from "./pages/oauth/GoogleCalendarStart";
import GoogleCalendarReturn from "./pages/oauth/GoogleCalendarReturn";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false } } });
function TriggerHealthCheck() { useEffect(() => { const checked = sessionStorage.getItem("auth_trigger_checked"); if (checked) return; supabase.functions.invoke("ensure-auth-trigger").then(({ data, error }) => { sessionStorage.setItem("auth_trigger_checked", "1"); if (error || !(data as { ok?: boolean })?.ok) console.warn("[Auth Setup] Trigger check failed:", error || (data as { message?: string })?.message); }).catch((err) => console.warn("[Auth Setup]", err)); }, []); return null; }

const App = () => <QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter><AuthProvider><TriggerHealthCheck /><Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/auth" element={<AuthPage />} />
  <Route path="/pending-approval" element={<ProtectedRoute allowUnapproved><PendingApprovalPage /></ProtectedRoute>} />
  <Route path="/oauth/google-calendar/start" element={<GoogleCalendarStart />} />
  <Route path="/oauth/google-calendar/return" element={<GoogleCalendarReturn />} />
  <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
  <Route path="/metas" element={<ProtectedRoute><MetasPage /></ProtectedRoute>} />
  <Route path="/metas/:id/analise" element={<ProtectedRoute><AnaliseMetaPage /></ProtectedRoute>} />
  <Route path="/planos" element={<ProtectedRoute><PlanosPage /></ProtectedRoute>} />
  <Route path="/calendario" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
  <Route path="/planejamento-semanal" element={<ProtectedRoute><WeeklyPlanningPage /></ProtectedRoute>} />
  <Route path="/acoes" element={<ProtectedRoute><ActionsPage /></ProtectedRoute>} />
  <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
  <Route path="/ajuda" element={<ProtectedRoute><AjudaPage /></ProtectedRoute>} />
  <Route path="/configuracoes/*" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
  <Route path="/settings/*" element={<Navigate to="/configuracoes" replace />} />
  <Route path="*" element={<NotFound />} />
</Routes></AuthProvider></BrowserRouter></TooltipProvider></QueryClientProvider>;
export default App;
