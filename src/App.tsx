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
import SalaryEntry from "@/pages/SalaryEntry";
import Performance from "@/pages/Performance";
import Reports from "@/pages/Reports";
import LeaveTypes from "@/pages/LeaveTypes";
import Team from "@/pages/Team";
import Company from "@/pages/Company";
import Owner from "@/pages/Owner";
import JoinCompany from "@/pages/JoinCompany";
import Suspended from "@/pages/Suspended";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const Loading = () => (
  <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>
);

function ProtectedRoute({ children, roles, feature }: { children: React.ReactNode; roles?: string[]; feature?: string }) {
  const { user, role, loading, hasFeature } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/" replace />;
  if (feature && !hasFeature(feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function WorkspaceRoute() {
  const { user, loading, memberships, companySuspended, isPlatformAdmin, supportSession } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!supportSession && memberships.length === 0) return <Navigate to={isPlatformAdmin ? "/owner" : "/join"} replace />;
  if (companySuspended) return <Suspended />;
  return <AppLayout />;
}


function OwnerRoute() {
  const { user, loading, isPlatformAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return <Owner />;
}

function JoinRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <JoinCompany />;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/join" element={<JoinRoute />} />
    <Route path="/owner" element={<OwnerRoute />} />
    <Route element={<WorkspaceRoute />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/employees" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><Employees /></ProtectedRoute>} />
      <Route path="/attendance" element={<Attendance />} />
      <Route path="/attendance-reports" element={<ProtectedRoute roles={["admin", "hr", "manager"]} feature="reports"><AttendanceReports /></ProtectedRoute>} />
      <Route path="/leave" element={<Leave />} />
      <Route path="/leave-types" element={<ProtectedRoute roles={["admin", "hr"]}><LeaveTypes /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><Approvals /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute roles={["admin", "hr", "manager"]}><Team /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute roles={["admin", "hr"]}><Departments /></ProtectedRoute>} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/audit-logs" element={<ProtectedRoute roles={["admin", "hr"]} feature="audit_logs"><AuditLogs /></ProtectedRoute>} />
      <Route path="/user-roles" element={<ProtectedRoute roles={["admin"]}><UserRoles /></ProtectedRoute>} />
      <Route path="/company" element={<ProtectedRoute roles={["admin", "hr"]}><Company /></ProtectedRoute>} />
      <Route path="/holidays" element={<Holidays />} />
      <Route path="/announcements" element={<ProtectedRoute feature="announcements"><Announcements /></ProtectedRoute>} />
      <Route path="/profile" element={<MyProfile />} />
      <Route path="/org-chart" element={<ProtectedRoute feature="org_chart"><OrgChart /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute feature="documents"><Documents /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute feature="onboarding"><Onboarding /></ProtectedRoute>} />
      <Route path="/payroll" element={<ProtectedRoute feature="payroll"><Payroll /></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute roles={["admin", "hr"]} feature="payroll"><SalaryEntry /></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute feature="performance"><Performance /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={["admin", "hr"]} feature="reports"><Reports /></ProtectedRoute>} />
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
