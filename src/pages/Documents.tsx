import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { FolderOpen, Upload, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const DOC_TYPES = ["offer_letter", "id_proof", "contract", "certificate", "other"];

export default function Documents() {
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("other");
  const [targetUser, setTargetUser] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["doc-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, employee_id").eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: documents } = useQuery({
    queryKey: ["employee-documents", isAdmin],
    queryFn: async () => {
      const { data } = await supabase.from("employee_documents").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error("File and title are required");
      const uid = isAdmin ? targetUser : user!.id;
      if (!uid) throw new Error("Select an employee");
      const path = `${uid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("employee-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("employee_documents").insert({
        user_id: uid, title: title.trim(), document_type: docType, file_path: path, uploaded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document uploaded!");
      setOpen(false); setTitle(""); setDocType("other"); setFile(null); setTargetUser("");
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("employee-documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("Could not generate download link");
    window.open(data.signedUrl, "_blank");
  };

  const remove = useMutation({
    mutationFn: async (doc: { id: string; file_path: string }) => {
      await supabase.storage.from("employee-documents").remove([doc.file_path]);
      const { error } = await supabase.from("employee_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const employeeName = (uid: string) => employees?.find((e) => e.user_id === uid)?.full_name || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FolderOpen className="h-6 w-6" /> Documents</h1>
          <p className="text-muted-foreground">{isAdmin ? "Manage employee documents" : "Your documents"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Upload className="h-4 w-4 mr-2" /> Upload</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={targetUser} onValueChange={setTargetUser}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees?.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name} ({e.employee_id})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Offer Letter 2026" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File</Label>
                <Input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <Button onClick={() => upload.mutate()} disabled={upload.isPending} className="w-full">Upload</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && <TableHead>Employee</TableHead>}
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents?.map((d) => (
                <TableRow key={d.id}>
                  {isAdmin && <TableCell className="font-medium">{employeeName(d.user_id)}</TableCell>}
                  <TableCell>{d.title}</TableCell>
                  <TableCell className="capitalize">{d.document_type.replace("_", " ")}</TableCell>
                  <TableCell>{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => download(d.file_path)}><Download className="h-4 w-4" /></Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: d.id, file_path: d.file_path })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {documents?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No documents yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
