import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Clock, CalendarDays, CheckSquare,
  Building2, Bell, FileText, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, CalendarOff, Megaphone, BarChart3, UserCircle,
  Network, FolderOpen, ClipboardList, Wallet, Target, PieChart,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", roles: ["admin", "manager", "employee"] },
  { label: "My Profile", icon: UserCircle, path: "/profile", roles: ["admin", "manager", "employee"] },
  { label: "Employees", icon: Users, path: "/employees", roles: ["admin", "manager"] },
  { label: "Org Chart", icon: Network, path: "/org-chart", roles: ["admin", "manager", "employee"] },
  { label: "Attendance", icon: Clock, path: "/attendance", roles: ["admin", "manager", "employee"] },
  { label: "Attendance Reports", icon: BarChart3, path: "/attendance-reports", roles: ["admin", "manager"] },
  { label: "Leave", icon: CalendarDays, path: "/leave", roles: ["admin", "manager", "employee"] },
  { label: "Approvals", icon: CheckSquare, path: "/approvals", roles: ["admin", "manager"] },
  { label: "Holidays", icon: CalendarOff, path: "/holidays", roles: ["admin", "manager", "employee"] },
  { label: "Announcements", icon: Megaphone, path: "/announcements", roles: ["admin", "manager", "employee"] },
  { label: "Documents", icon: FolderOpen, path: "/documents", roles: ["admin", "manager", "employee"] },
  { label: "Onboarding", icon: ClipboardList, path: "/onboarding", roles: ["admin", "manager", "employee"] },
  { label: "Payroll", icon: Wallet, path: "/payroll", roles: ["admin", "manager", "employee"] },
  { label: "Performance", icon: Target, path: "/performance", roles: ["admin", "manager", "employee"] },
  { label: "Reports", icon: PieChart, path: "/reports", roles: ["admin"] },
  { label: "Departments", icon: Building2, path: "/departments", roles: ["admin"] },
  { label: "User Roles", icon: ShieldCheck, path: "/user-roles", roles: ["admin"] },
  { label: "Notifications", icon: Bell, path: "/notifications", roles: ["admin", "manager", "employee"] },
  { label: "Audit Logs", icon: FileText, path: "/audit-logs", roles: ["admin"] },
];

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { profile, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  const initials = profile?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar border-r border-sidebar-border sidebar-transition h-screen sticky top-0",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-foreground tracking-tight">MiniHRMS</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {filteredItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium sidebar-transition",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name}</p>
              <p className="text-xs text-sidebar-muted capitalize">{role}</p>
            </div>
          )}
          <button onClick={signOut} className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted shrink-0" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
