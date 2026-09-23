import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  user_id: string;
  employee_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  manager_id: string | null;
  joining_date: string;
  is_active: boolean;
  avatar_url: string | null;
  company_id: string;
  status?: string;
}

export interface Membership {
  company_id: string;
  company_name: string;
  role: AppRole | null;
  status: string;
  company_status: string;
  is_active: boolean;
}

export interface CompanyInfo {
  id: string;
  name: string;
  status: string;
  plan: string;
  seat_limit: number;
  trial_ends_at: string | null;
  setup_completed_at: string | null;
}

export interface SupportSession {
  company_id: string;
  company_name: string;
  expires_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    org: { companyName?: string; inviteCode?: string },
  ) => Promise<{ error: Error | null }>;
  company: CompanyInfo | null;
  memberships: Membership[];
  switchCompany: (companyId: string) => Promise<void>;
  refresh: () => Promise<void>;
  features: Record<string, boolean>;
  hasFeature: (key: string) => boolean;
  isPlatformAdmin: boolean;
  companySuspended: boolean;
  supportSession: SupportSession | null;
  endSupport: () => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isHR: boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session lifetime guards (HR data — short leash).
const SESSION_START_KEY = "hrms.session_started_at";
const IDLE_LIMIT_MS = 30 * 60 * 1000; // sign out after 30 minutes of inactivity
const ABSOLUTE_LIMIT_MS = 12 * 60 * 60 * 1000; // and after 12 hours regardless

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [supportSession, setSupportSession] = useState<SupportSession | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const loadCompanyContext = async (companyId: string, userId: string) => {
    const [profileRes, companyRes, featureRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).eq("company_id", companyId).maybeSingle(),
      supabase.from("companies").select("id, name, status, plan, seat_limit, trial_ends_at, setup_completed_at").eq("id", companyId).maybeSingle(),
      supabase.from("company_features").select("feature_key, is_enabled").eq("company_id", companyId),
    ]);
    setProfile((profileRes.data as Profile) ?? null);
    setCompany((companyRes.data as CompanyInfo) ?? null);
    const map: Record<string, boolean> = {};
    (featureRes.data ?? []).forEach((f) => { map[f.feature_key] = f.is_enabled; });
    setFeatures(map);
  };

  const fetchUserData = useCallback(async (userId: string) => {
    const [membershipRes, ownerRes, supportRes] = await Promise.all([
      supabase.rpc("get_my_memberships"),
      supabase.rpc("is_platform_admin", {}),
      supabase.rpc("current_support_session"),
    ]);

    setIsPlatformAdmin(Boolean(ownerRes.data));

    const list = (membershipRes.data ?? []) as Membership[];
    setMemberships(list);

    const support = ((supportRes.data ?? []) as SupportSession[])[0] ?? null;
    setSupportSession(support);

    if (support) {
      setRole("admin");
      await loadCompanyContext(support.company_id, userId);
      return;
    }

    const active = list.find((m) => m.is_active) ?? list[0] ?? null;
    if (!active) {
      setProfile(null);
      setRole(null);
      setCompany(null);
      setFeatures({});
      return;
    }

    setRole(active.role ?? null);
    await loadCompanyContext(active.company_id, userId);
  }, []);


  useEffect(() => {
    let loadedForUser: string | null = null;
    let inFlight: Promise<void> | null = null;

    const startLoad = (userId: string) => {
      setLoading(true);
      inFlight = fetchUserData(userId).finally(() => { setLoading(false); });
      return inFlight;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Token refreshes / tab focus events must not re-trigger a full reload.
        if (loadedForUser === session.user.id) return;
        // A different account is signing in — drop every cached query so the
        // previous person's data can never flash on this person's screens.
        queryClient.clear();
        loadedForUser = session.user.id;
        const uid = session.user.id;
        setLoading(true);
        setTimeout(() => { startLoad(uid); }, 0);
      } else {
        loadedForUser = null;
        inFlight = null;
        queryClient.clear();
        setProfile(null);
        setRole(null);
        setCompany(null);
        setMemberships([]);
        setFeatures({});
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (loadedForUser === session.user.id) {
          // A load is already running (or queued) for this user — never drop the
          // loading flag before it settles, or routes see empty memberships.
          if (inFlight) inFlight.finally(() => setLoading(false));
          return;
        }
        loadedForUser = session.user.id;
        startLoad(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData, queryClient]);

  const refresh = async () => {
    if (user) await fetchUserData(user.id);
  };

  const switchCompany = async (companyId: string) => {
    const { error } = await supabase.rpc("set_active_company", { _company_id: companyId });
    if (error) throw error;
    queryClient.clear();
    if (user) await fetchUserData(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const addr = email.trim().toLowerCase();

    // Server-side brute-force lockout: 5 failures in 15 minutes locks the
    // address for 15 minutes. Enforced in the database, not just here.
    const { data: lockedFor } = await supabase.rpc("login_lockout_seconds", { _email: addr });
    if (typeof lockedFor === "number" && lockedFor > 0) {
      const mins = Math.ceil(lockedFor / 60);
      return {
        error: new Error(
          `Too many failed sign-in attempts. Please try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
        ),
      };
    }

    const { error } = await supabase.auth.signInWithPassword({ email: addr, password });

    if (error) {
      const { data: lockSecs } = await supabase.rpc("record_login_failure", { _email: addr });
      if (typeof lockSecs === "number" && lockSecs > 0) {
        return {
          error: new Error(
            "Too many failed sign-in attempts. This account is locked for 15 minutes.",
          ),
        };
      }
      // Never leak whether the address exists.
      return { error: new Error("Invalid email or password") };
    }

    await supabase.rpc("clear_login_attempts", { _email: addr });
    sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    org: { companyName?: string; inviteCode?: string },
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(org.companyName ? { company_name: org.companyName } : {}),
          ...(org.inviteCode ? { invite_code: org.inviteCode } : {}),
        },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setCompany(null);
    setMemberships([]);
    setFeatures({});
    setIsPlatformAdmin(false);
    setSupportSession(null);
  };

  const endSupport = async () => {
    await supabase.rpc("owner_end_support");
    setSupportSession(null);
    if (user) await fetchUserData(user.id);
  };

  const hasFeature = (key: string) => features[key] !== false;

  return (
    <AuthContext.Provider value={{
      session, user, profile, role, loading, company, memberships, features, hasFeature,
      isPlatformAdmin, companySuspended: !supportSession && !!company && company.status !== "active" && company.status !== "trial",
      supportSession, endSupport,
      switchCompany, refresh,

      signIn, signUp, signOut,
      isAdmin: role === "admin" || role === "hr",
      isManager: role === "manager",
      isHR: role === "hr" || role === "admin",
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
