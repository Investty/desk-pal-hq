import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
