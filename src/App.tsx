import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import OnboardingPage from "./pages/OnboardingPage";
import MentorPage from "./pages/MentorPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import RoadmapPage from "./pages/RoadmapPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ConceptMapPage from "./pages/ConceptMapPage";
import ReportPage from "./pages/ReportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
            <Route path="/login" element={<ErrorBoundary><SignInPage /></ErrorBoundary>} />
            <Route path="/signin" element={<ErrorBoundary><SignInPage /></ErrorBoundary>} />
            <Route path="/signup" element={<ErrorBoundary><SignUpPage /></ErrorBoundary>} />

            {/* Onboarding - requires auth but not onboarding completion */}
            <Route path="/onboarding" element={
              <ProtectedRoute requireOnboarding={false}>
                <ErrorBoundary><OnboardingPage /></ErrorBoundary>
              </ProtectedRoute>
            } />

            {/* Protected routes - require auth AND onboarding completion */}
            <Route path="/mentor" element={
              <ProtectedRoute>
                <ErrorBoundary><MentorPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <ErrorBoundary><DashboardPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ErrorBoundary><ProfilePage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/roadmap" element={
              <ProtectedRoute>
                <ErrorBoundary><RoadmapPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <ErrorBoundary><AnalyticsPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/concept-map" element={
              <ProtectedRoute>
                <ErrorBoundary><ConceptMapPage /></ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/report" element={
              <ProtectedRoute>
                <ErrorBoundary><ReportPage /></ErrorBoundary>
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
