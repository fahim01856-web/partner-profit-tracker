import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Printer, FileText, ListChecks, ShieldCheck, User as UserIcon, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_app/kyc/$id")({ component: KycDetail });

function KycDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: kyc } = useQuery({
    queryKey: ["kyc", id],
    queryFn: async () => { const { data, error } = await supabase.from("kyc_profiles").select("*").eq("id", id).single(); if (error) throw error; return data; },
  });
  const update = useMutation({
    mutationFn: async (patch: any) => { const { error } = await supabase.from("kyc_profiles").update(patch).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["kyc", id] }); qc.invalidateQueries({ queryKey: ["kyc_profiles"] }); },
  });

  if (!kyc) return <div className="p-8">লোড হচ্ছে...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 no-print">
        <Button asChild variant="ghost" size="sm"><Link to="/kyc"><ArrowLeft className="w-4 h-4 mr-1" /> ফিরে যান</Link></Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print/PDF</Button>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{kyc.customer_name}</h1>
            <div className="text-sm text-muted-foreground">NID: {kyc.nid_number || "—"} • A/C: {kyc.account_number || "—"} • ফোন: {kyc.phone || "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={kyc.risk_level === "high" ? "bg-red-500" : kyc.risk_level === "medium" ? "bg-amber-500" : ""}>{kyc.risk_level} risk</Badge>
            <Badge variant={kyc.status === "approved" ? "default" : "secondary"}>{kyc.status}</Badge>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto no-print">
          <TabsTrigger value="profile"><UserIcon className="w-4 h-4 mr-1" /> Profile</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-1" /> Documents</TabsTrigger>
          <TabsTrigger value="checklist"><ListChecks className="w-4 h-4 mr-1" /> Checklist</TabsTrigger>
          <TabsTrigger value="approval"><ShieldCheck className="w-4 h-4 mr-1" /> Approval</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab kyc={kyc} onSave={(patch) => update.mutate(patch)} />
        </TabsContent>
        <TabsContent value="documents"><DocumentsTab kycId={id} /></TabsContent>
        <TabsContent value="checklist"><ChecklistTab kycId={id} /></TabsContent>
        <TabsContent value="approval"><ApprovalTab kyc={kyc} onSave={(patch) => update.mutate(patch)} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab({ kyc, onSave }: { kyc: any; onSave: (p: any) => void }) {
  const [f, setF] = useState({ ...kyc });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          ["customer_name", "নাম"], ["nid_number", "NID"], ["phone", "ফোন"], ["email", "ইমেইল"],
          ["account_number", "অ্যাকাউন্ট"], ["date_of_birth", "জন্মতারিখ", "date"],
          ["father_name", "পিতার নাম"], ["mother_name", "মাতার নাম"], ["spouse_name", "স্বামী/স্ত্রী"],
          ["occupation", "পেশা"], ["source_of_income", "আয়ের উৎস"], ["monthly_income", "মাসিক আয়", "number"],
          ["nominee_name", "নমিনি"], ["nominee_relation", "নমিনি সম্পর্ক"], ["nominee_nid", "নমিনি NID"],
        ].map(([k, label, type]: any) => (
          <div key={k}><Label>{label}</Label><Input type={type || "text"} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
        ))}
        <div className="md:col-span-3"><Label>ঠিকানা</Label><Textarea rows={2} value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label>ঝুঁকি</Label>
          <Select value={f.risk_level} onValueChange={(v) => setF({ ...f, risk_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="low">নিম্ন</SelectItem><SelectItem value="medium">মাঝারি</SelectItem><SelectItem value="high">উচ্চ</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3"><Label>মন্তব্য</Label><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <div className="flex justify-end no-print">
        <Button onClick={() => onSave({ customer_name: f.customer_name, nid_number: f.nid_number || null, phone: f.phone || null, email: f.email || null, address: f.address || null, account_number: f.account_number || null, date_of_birth: f.date_of_birth || null, father_name: f.father_name || null, mother_name: f.mother_name || null, spouse_name: f.spouse_name || null, occupation: f.occupation || null, source_of_income: f.source_of_income || null, monthly_income: f.monthly_income ? Number(f.monthly_income) : null, nominee_name: f.nominee_name || null, nominee_relation: f.nominee_relation || null, nominee_nid: f.nominee_nid || null, risk_level: f.risk_level, notes: f.notes || null })}>সংরক্ষণ</Button>
      </div>
    </Card>
  );
}

function DocumentsTab({ kycId }: { kycId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ doc_type: "NID", doc_name: "", issued_on: "", expire_on: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["kyc_documents", kycId],
    queryFn: async () => { const { data } = await supabase.from("kyc_documents").select("*").eq("kyc_id", kycId).order("created_at", { ascending: false }); return data || []; },
  });
  const add = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let file_url: string | null = null;
      let file_path: string | null = null;
      if (file) {
        const path = `kyc/${kycId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        file_path = path;
        const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 365);
        file_url = signed?.signedUrl || null;
      }
      const { error } = await supabase.from("kyc_documents").insert({ kyc_id: kycId, ...form, issued_on: form.issued_on || null, expire_on: form.expire_on || null, file_url, file_path });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ডকুমেন্ট যোগ"); setForm({ doc_type: "NID", doc_name: "", issued_on: "", expire_on: "" }); setFile(null); setUploading(false); qc.invalidateQueries({ queryKey: ["kyc_documents", kycId] }); qc.invalidateQueries({ queryKey: ["kyc_documents_all"] }); },
    onError: (e: any) => { setUploading(false); toast.error(e.message); },
  });
  const del = useMutation({
    mutationFn: async (d: any) => {
      if (d.file_path) await supabase.storage.from("documents").remove([d.file_path]);
      await supabase.from("kyc_documents").delete().eq("id", d.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc_documents", kycId] }),
  });
  const today = new Date();
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 no-print">
        <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["NID", "Photo", "Trade License", "TIN", "Passport", "Driving License", "Address Proof", "Signature", "Nominee NID", "Other"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="ডকুমেন্ট নাম" value={form.doc_name} onChange={(e) => setForm({ ...form, doc_name: e.target.value })} />
        <Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} placeholder="ইস্যু তারিখ" />
        <Input type="date" value={form.expire_on} onChange={(e) => setForm({ ...form, expire_on: e.target.value })} placeholder="মেয়াদ" />
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button onClick={() => add.mutate()} disabled={uploading}><Upload className="w-4 h-4 mr-1" /> {uploading ? "..." : "যোগ"}</Button>
      </div>
      <div className="space-y-2">
        {data.map((d: any) => {
          const exp = d.expire_on ? new Date(d.expire_on) : null;
          const expired = exp && exp < today;
          const soon = exp && !expired && exp.getTime() - today.getTime() < 30 * 86400000;
          return (
            <div key={d.id} className="flex items-center gap-3 border rounded p-2">
              <div className="flex-1">
                <div className="font-medium text-sm">{d.doc_type} {d.doc_name && `— ${d.doc_name}`}</div>
                <div className="text-xs text-muted-foreground">ইস্যু: {d.issued_on || "—"} • মেয়াদ: {d.expire_on || "—"}</div>
              </div>
              {expired && <Badge variant="destructive">Expired</Badge>}
              {soon && <Badge className="bg-amber-500">Expires Soon</Badge>}
              {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View</a>}
              <Button size="sm" variant="ghost" onClick={() => del.mutate(d)} className="no-print"><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          );
        })}
        {data.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো ডকুমেন্ট নেই</div>}
      </div>
    </Card>
  );
}

function ChecklistTab({ kycId }: { kycId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["kyc_checklist", kycId],
    queryFn: async () => { const { data } = await supabase.from("kyc_checklist_items").select("*").eq("kyc_id", kycId).order("created_at"); return data || []; },
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: any) => { await supabase.from("kyc_checklist_items").update(patch).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc_checklist", kycId] }),
  });
  const done = data.filter((c: any) => c.checked).length;
  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm">সম্পন্ন: <span className="font-bold">{done} / {data.length}</span></div>
      <div className="space-y-2">
        {data.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 border-b pb-2">
            <input type="checkbox" checked={c.checked} onChange={(e) => update.mutate({ id: c.id, patch: { checked: e.target.checked, checked_on: e.target.checked ? new Date().toISOString().slice(0, 10) : null } })} className="w-4 h-4" />
            <div className="flex-1 text-sm">{c.item_label}</div>
            <Input placeholder="নোট" defaultValue={c.note || ""} onBlur={(e) => e.target.value !== (c.note || "") && update.mutate({ id: c.id, patch: { note: e.target.value } })} className="max-w-xs no-print" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ApprovalTab({ kyc, onSave }: { kyc: any; onSave: (p: any) => void }) {
  const [f, setF] = useState({ status: kyc.status, verified_by: kyc.verified_by || "", approved_by: kyc.approved_by || "" });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><Label>স্ট্যাটাস</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">অপেক্ষমাণ</SelectItem>
              <SelectItem value="verified">যাচাইকৃত</SelectItem>
              <SelectItem value="approved">অনুমোদিত</SelectItem>
              <SelectItem value="rejected">প্রত্যাখ্যাত</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>যাচাইকারী</Label><Input value={f.verified_by} onChange={(e) => setF({ ...f, verified_by: e.target.value })} /></div>
        <div><Label>অনুমোদনকারী</Label><Input value={f.approved_by} onChange={(e) => setF({ ...f, approved_by: e.target.value })} /></div>
      </div>
      <div className="flex justify-end no-print">
        <Button onClick={() => onSave({ status: f.status, verified_by: f.verified_by || null, verified_on: f.status === "verified" || f.status === "approved" ? new Date().toISOString().slice(0, 10) : null, approved_by: f.approved_by || null, approved_on: f.status === "approved" ? new Date().toISOString().slice(0, 10) : null })}>সংরক্ষণ</Button>
      </div>
    </Card>
  );
}
