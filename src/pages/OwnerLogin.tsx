import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function OwnerLogin() {
  const { user, loading: authLoading, isPlatformAdmin, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authLoading && user && isPlatformAdmin) return <Navigate to="/owner" replace />;

  const handleSignIn = async () => {
    const { error } = await signIn(email, password);
    if (error) return toast.error(error.message);
    const { data: isOwner } = await supabase.rpc("is_platform_admin", {});
    if (!isOwner) {
      await supabase.auth.signOut();
      return toast.error("This account does not have owner access.");
    }
    navigate("/owner", { replace: true });
  };

  const handleSetup = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { owner_signup: "true", full_name: "Platform Owner" }, emailRedirectTo: `${window.location.origin}/owner-login` },
    });
    if (error) return toast.error("This email is not approved for an owner account.");
    toast.success("Owner account created. Signing you in…");
    await handleSignIn();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await handleSignIn();
      else await handleSetup();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Platform owner</CardTitle>
          <CardDescription>
            {mode === "signin" ? "Sign in to the Owner console" : "Create your owner account (one time, approved email only)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="owner-email">Email</Label>
              <Input id="owner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required requiredMessage="Please enter Email Address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-password">Password</Label>
              <PasswordInput id="owner-password" value={password} onChange={(e) => setPassword(e.target.value)} required requiredMessage="Please enter Password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Create owner account"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setMode(mode === "signin" ? "setup" : "signin")}>
              {mode === "signin" ? "First time? Set up owner account" : "Already set up? Sign in"}
            </Button>
          </div>
          <div className="mt-2 text-center text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-primary">Company sign-in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
