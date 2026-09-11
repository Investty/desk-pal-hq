import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

function remaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${String(secs).padStart(2, "0")}s left`;
}

export default function SupportModeBanner() {
  const { supportSession, endSupport } = useAuth();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!supportSession) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [supportSession]);

  useEffect(() => {
    if (supportSession && new Date(supportSession.expires_at).getTime() <= Date.now()) {
      endSupport().then(() => navigate("/owner"));
    }
  }, [tick, supportSession, endSupport, navigate]);

  if (!supportSession) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-3 bg-destructive px-4 py-2 text-destructive-foreground">
      <Eye className="h-4 w-4" />
      <p className="text-sm font-medium">
        Support mode — viewing {supportSession.company_name} (read-only)
      </p>
      <span className="text-xs opacity-90">{remaining(supportSession.expires_at)}</span>
      <Button
        size="sm"
        variant="secondary"
        className="ml-auto"
        onClick={() => endSupport().then(() => navigate("/owner"))}
      >
        Exit support mode
      </Button>
    </div>
  );
}
