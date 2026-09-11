import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Clock, CalendarDays, CheckSquare,
  Building2, Bell, FileText, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, CalendarOff, Megaphone, BarChart3, UserCircle,
  Network, PieChart, Settings2, IndianRupee,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ALL = ["admin", "hr", "manager", "employee"];

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", roles: ALL },
  { label: "My Profile", icon: UserCircle, path: "/profile", roles: ALL },
  { label: "My Team", icon: Users, path: "/team", roles: ["admin", "hr", "manager"] },
  { label: "Employees", icon: Users, path: "/employees", roles: ["admin", "hr", "manager"] },
  { label: "Org Chart", icon: Network, path: "/org-chart", roles: ALL },
  { label: "Attendance", icon: Clock, path: "/attendance", roles: ALL },
  { label: "Attendance Reports", icon: BarChart3, path: "/attendance-reports", roles: ["admin", "hr", "manager"] },
  { label: "Leave", icon: CalendarDays, path: "/leave", roles: ALL },
  { label: "Leave Types", icon: Settings2, path: "/leave-types", roles: ["admin", "hr"] },
  { label: "Approvals", icon: CheckSquare, path: "/approvals", roles: ["admin", "hr", "manager"] },
  { label: "Holidays", icon: CalendarOff, path: "/holidays", roles: ALL },
  { label: "Announcements", icon: Megaphone, path: "/announcements", roles: ALL },
  { label: "Reports", icon: PieChart, path: "/reports", roles: ["admin", "hr"] },
  { label: "Salary Entry", icon: IndianRupee, path: "/salary", roles: ["admin", "hr"] },
  { label: "Departments", icon: Building2, path: "/departments", roles: ["admin", "hr"] },
  { label: "Company", icon: Building2, path: "/company", roles: ["admin", "hr"] },
  { label: "User Roles", icon: ShieldCheck, path: "/user-roles", roles: ["admin"] },
  { label: "Notifications", icon: Bell, path: "/notifications", roles: ALL },
  { label: "Audit Logs", icon: FileText, path: "/audit-logs", roles: ["admin", "hr"] },
];

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { profile, role, signOut, company } = useAuth();
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
          <div className="min-w-0">
            <span className="block text-lg font-bold text-sidebar-foreground tracking-tight leading-tight">MiniHRMS</span>
            <span className="block text-xs text-sidebar-muted truncate">{company?.name}</span>
          </div>
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
              <p className="text-xs text-sidebar-muted uppercase">{role === "hr" ? "HR" : role}</p>
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
