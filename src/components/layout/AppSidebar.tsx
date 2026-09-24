import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Clock, CalendarDays, CheckSquare,
  Building2, Bell, FileText, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, CalendarOff, Megaphone, BarChart3, UserCircle,
  Network, PieChart, Settings2, IndianRupee, ShieldAlert, Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const ALL = ["admin", "hr", "manager", "employee"];

type NavItem = {
  label: string; icon: typeof Users; path: string; roles: string[]; feature?: string; children?: NavItem[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/", roles: ALL },
  { label: "My Profile", icon: UserCircle, path: "/profile", roles: ALL },
  { label: "My Team", icon: Users, path: "/team", roles: ["admin", "hr", "manager"] },
  { label: "Employees", icon: Users, path: "/employees", roles: ["admin", "hr", "manager"] },
  { label: "Org Chart", icon: Network, path: "/org-chart", roles: ALL, feature: "org_chart" },
  { label: "Attendance", icon: Clock, path: "/attendance", roles: ALL },
  { label: "Attendance Reports", icon: BarChart3, path: "/attendance-reports", roles: ["admin", "hr", "manager"], feature: "reports" },
  { label: "Leave", icon: CalendarDays, path: "/leave", roles: ALL },
  { label: "Leave Types", icon: Settings2, path: "/leave-types", roles: ["admin", "hr"] },
  { label: "Approvals", icon: CheckSquare, path: "/approvals", roles: ["admin", "hr", "manager"] },
  { label: "Holidays", icon: CalendarOff, path: "/holidays", roles: ALL },
  { label: "Announcements", icon: Megaphone, path: "/announcements", roles: ALL, feature: "announcements" },
  { label: "Reports", icon: PieChart, path: "/reports", roles: ["admin", "hr"], feature: "reports" },
  { label: "Salary Entry", icon: IndianRupee, path: "/salary", roles: ["admin", "hr"], feature: "payroll" },
  {
    label: "Company", icon: Building2, path: "/company", roles: ["admin", "hr"],
    children: [
      { label: "Departments", icon: Building2, path: "/departments", roles: ["admin", "hr"] },
      { label: "User Roles", icon: ShieldCheck, path: "/user-roles", roles: ["admin"] },
      { label: "Shifts", icon: Clock, path: "/shifts", roles: ["admin", "hr"] },
      { label: "Attendance Rules", icon: Settings2, path: "/attendance-rules", roles: ["admin", "hr"] },
      { label: "Import Data", icon: Upload, path: "/import", roles: ["admin", "hr"] },
    ],
  },
  { label: "Notifications", icon: Bell, path: "/notifications", roles: ALL },
  { label: "Audit Logs", icon: FileText, path: "/audit-logs", roles: ["admin", "hr"], feature: "audit_logs" },
];

export default function AppSidebar() {
  const { pathname } = useLocation();
  const { profile, role, signOut, company, hasFeature, isPlatformAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const filteredItems = navItems.filter(
    (item) => role && item.roles.includes(role) && (!item.feature || hasFeature(item.feature)),
  );
  const items = isPlatformAdmin
    ? [...filteredItems, { label: "Owner console", icon: ShieldAlert, path: "/owner", roles: ALL }]
    : filteredItems;

  const initials = profile?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <aside className={cn(
      "flex flex-col bg-sidebar border-r border-sidebar-border sidebar-transition h-screen sticky top-0",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
        {!collapsed && (
          <div className="min-w-0">
            <span className="block text-lg font-bold text-sidebar-foreground leading-tight">MiniHRMS</span>
            <span className="block text-xs text-sidebar-muted truncate">{company?.name}</span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto h-8 w-8 border-0 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {items.map((item) => {
          const children = (item.children ?? []).filter(
            (c) => role && c.roles.includes(role) && (!c.feature || hasFeature(c.feature)),
          );
          return (
            <div key={item.path} className="space-y-1">
              <Link
                to={item.path}
                className={cn(
                   "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium sidebar-transition",
                    pathname === item.path
                     ? "border-l-2 border-sidebar-primary bg-sidebar-accent/15 pl-[10px] text-sidebar-foreground"
                     : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {children.map((child) => (
                <Link
                  key={child.path}
                  to={child.path}
                  className={cn(
                     "flex items-center gap-3 rounded-md text-sm sidebar-transition py-2",
                    collapsed ? "px-3" : "pl-9 pr-3 border-l border-sidebar-border ml-4",
                    pathname === child.path
                       ? "border-l-2 border-sidebar-primary bg-sidebar-accent/15 text-sidebar-foreground"
                       : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  title={collapsed ? child.label : undefined}
                >
                  <child.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{child.label}</span>}
                </Link>
              ))}
            </div>
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
          <Button type="button" variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 shrink-0 border-0 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" title="Sign out" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
