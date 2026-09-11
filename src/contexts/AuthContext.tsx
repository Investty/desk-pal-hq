import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isHR: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    const [membershipRes, ownerRes] = await Promise.all([
      supabase.rpc("get_my_memberships"),
      supabase.rpc("is_platform_admin", {}),
    ]);

    setIsPlatformAdmin(Boolean(ownerRes.data));

    const list = (membershipRes.data ?? []) as Membership[];
    setMemberships(list);

    const active = list.find((m) => m.is_active) ?? list[0] ?? null;
    if (!active) {
      setProfile(null);
      setRole(null);
      setCompany(null);
      setFeatures({});
      return;
    }

    setRole(active.role ?? null);

    const [profileRes, companyRes, featureRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).eq("company_id", active.company_id).maybeSingle(),
      supabase.from("companies").select("id, name, status, plan, seat_limit, trial_ends_at").eq("id", active.company_id).maybeSingle(),
      supabase.from("company_features").select("feature_key, is_enabled").eq("company_id", active.company_id),
    ]);

    setProfile((profileRes.data as Profile) ?? null);
    setCompany((companyRes.data as CompanyInfo) ?? null);
    const map: Record<string, boolean> = {};
    (featureRes.data ?? []).forEach((f) => { map[f.feature_key] = f.is_enabled; });
    setFeatures(map);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        setTimeout(() => { fetchUserData(session.user.id).finally(() => setLoading(false)); }, 0);
      } else {
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
        fetchUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const refresh = async () => {
    if (user) await fetchUserData(user.id);
  };

  const switchCompany = async (companyId: string) => {
    const { error } = await supabase.rpc("set_active_company", { _company_id: companyId });
    if (error) throw error;
    if (user) await fetchUserData(user.id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
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
  };

  const hasFeature = (key: string) => features[key] !== false;

  return (
    <AuthContext.Provider value={{
      session, user, profile, role, loading, company, memberships, features, hasFeature,
      isPlatformAdmin, companySuspended: !!company && company.status !== "active",
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
