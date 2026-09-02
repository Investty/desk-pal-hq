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
import UserRoles from "@/pages/UserRoles";
import Holidays from "@/pages/Holidays";
import Announcements from "@/pages/Announcements";
import AttendanceReports from "@/pages/AttendanceReports";
import MyProfile from "@/pages/MyProfile";
import OrgChart from "@/pages/OrgChart";
import Documents from "@/pages/Documents";
import Onboarding from "@/pages/Onboarding";
import Payroll from "@/pages/Payroll";
import Performance from "@/pages/Performance";
import Reports from "@/pages/Reports";
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
      <Route path="/attendance-reports" element={<ProtectedRoute roles={["admin", "manager"]}><AttendanceReports /></ProtectedRoute>} />
      <Route path="/leave" element={<Leave />} />
      <Route path="/approvals" element={<ProtectedRoute roles={["admin", "manager"]}><Approvals /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute roles={["admin"]}><Departments /></ProtectedRoute>} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/audit-logs" element={<ProtectedRoute roles={["admin"]}><AuditLogs /></ProtectedRoute>} />
      <Route path="/user-roles" element={<ProtectedRoute roles={["admin"]}><UserRoles /></ProtectedRoute>} />
      <Route path="/holidays" element={<Holidays />} />
      <Route path="/announcements" element={<Announcements />} />
      <Route path="/profile" element={<MyProfile />} />
      <Route path="/org-chart" element={<OrgChart />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/payroll" element={<Payroll />} />
      <Route path="/performance" element={<Performance />} />
      <Route path="/reports" element={<ProtectedRoute roles={["admin"]}><Reports /></ProtectedRoute>} />
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
