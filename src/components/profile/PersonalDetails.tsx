import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function PersonalDetails() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ phone: "", address: "", emergency_contact_name: "", emergency_contact_phone: "", date_of_birth: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*, departments(name)").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        phone: profile.phone || "",
        address: profile.address || "",
        emergency_contact_name: profile.emergency_contact_name || "",
        emergency_contact_phone: profile.emergency_contact_phone || "",
        date_of_birth: profile.date_of_birth || "",
      });
      if (profile.avatar_url) {
        supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 3600).then(({ data }) => {
          if (data?.signedUrl) setAvatarUrl(data.signedUrl);
        });
      }
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        phone: form.phone || null,
        address: form.address || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        date_of_birth: form.date_of_birth || null,
      }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatar = async (file: File) => {
    const path = `${user!.id}/avatar-${Date.now()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { error: upErr } = await supabase.from("profiles").update({ avatar_url: path }).eq("user_id", user!.id);
    if (upErr) return toast.error(upErr.message);
    toast.success("Avatar updated!");
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const initials = profile?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardContent className="pt-6 flex items-center gap-6">
          <Avatar className="h-20 w-20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={profile?.full_name} />}
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile?.employee_id} · {profile?.email}</p>
            <p className="text-sm text-muted-foreground">{(profile?.departments as { name?: string } | null)?.name || "No department"}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Change Photo
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Your address" rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Emergency Contact Name</Label>
              <Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact Phone</Label>
              <Input value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
