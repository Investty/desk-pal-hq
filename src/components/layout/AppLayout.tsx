import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import SupportModeBanner from "./SupportModeBanner";
import LimitBanner from "./LimitBanner";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <SupportModeBanner />
        <div className="p-6 max-w-7xl mx-auto animate-fade-in space-y-4">
          <LimitBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
