import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { API_BASE_URL } from "@/lib/config";

// Wake up the Render backend immediately on app load (prevents cold-start delay for users)
fetch(`${API_BASE_URL}/`).catch(() => {});

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import Dashboard from "@/pages/Dashboard";
import AptitudePractice from "@/pages/aptitude/AptitudePractice";
import AptitudeResults from "@/pages/aptitude/AptitudeResults";
import InterviewSetup from "@/pages/interview/InterviewSetup";
import MockInterview from "@/pages/interview/MockInterview";
import InterviewResults from "@/pages/interview/InterviewResults";
import GDSetup from "@/pages/gd/GDSetup";
import GDSimulator from "@/pages/gd/GDSimulator";
import ResumeAnalyzer from "@/pages/resume/ResumeAnalyzer";
import CodingSetup from "@/pages/coding/CodingSetup";
import CodingInterview from "@/pages/coding/CodingInterview";
import CodingResults from "@/pages/coding/CodingResults";

import Profile from "@/pages/Profile";
import NotFound from "@/pages/not-found";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/auth" component={Login} />
      <Route path="/auth/signup" component={Signup} />
      <Route path="/auth/forgot-password" component={ForgotPassword} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/aptitude">
        <ProtectedRoute component={AptitudePractice} />
      </Route>
      <Route path="/aptitude/results">
        <ProtectedRoute component={AptitudeResults} />
      </Route>
      <Route path="/interview">
        <ProtectedRoute component={InterviewSetup} />
      </Route>
      <Route path="/interview/start">
        <ProtectedRoute component={MockInterview} />
      </Route>
      <Route path="/interview/results">
        <ProtectedRoute component={InterviewResults} />
      </Route>
      <Route path="/gd">
        <ProtectedRoute component={GDSetup} />
      </Route>
      <Route path="/gd/session">
        <ProtectedRoute component={GDSimulator} />
      </Route>
      <Route path="/resume">
        <ProtectedRoute component={ResumeAnalyzer} />
      </Route>
      <Route path="/coding">
        <ProtectedRoute component={CodingSetup} />
      </Route>
      <Route path="/coding/solve">
        <ProtectedRoute component={CodingInterview} />
      </Route>
      <Route path="/coding/results">
        <ProtectedRoute component={CodingResults} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>

      {/* Default Redirect */}
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
