import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Attendance from "@/pages/Attendance";
import Leave from "@/pages/Leave";
import Approvals from "@/pages/Approvals";
import Departments from "@/pages/Departments";
import Notifications from "@/pages/Notifications";
import AuditLogs from "@/pages/AuditLogs";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/employees" element={<ProtectedRoute roles={["admin", "manager"]}><Employees /></ProtectedRoute>} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/leave" element={<Leave />} />
      <Route path="/approvals" element={<ProtectedRoute roles={["admin", "manager"]}><Approvals /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute roles={["admin"]}><Departments /></ProtectedRoute>} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/audit-logs" element={<ProtectedRoute roles={["admin"]}><AuditLogs /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
