import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Printer, FileText, ListChecks, ShieldCheck, User as UserIcon, Trash2, Upload, Building2, ShieldAlert, Eye, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/kyc/$id")({ component: KycDetail });

const PROFILE_FIELDS = [
  "customer_name", "customer_id", "nid_number", "phone", "email", "date_of_birth",
  "father_name", "mother_name", "address", "occupation", "source_of_income",
  "nominee_name", "account_number", "branch_name", "next_review_date",
];

function calcCompletion(k: any): number {
  if (!k) return 0;
  const filled = PROFILE_FIELDS.filter((f) => k[f] !== null && k[f] !== undefined && k[f] !== "").length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

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
    onError: (e: any) => toast.error(e.message),
  });

  if (!kyc) return <div className="p-8">লোড হচ্ছে...</div>;

  const completion = calcCompletion(kyc);
  const reviewDue = kyc.next_review_date && new Date(kyc.next_review_date).getTime() - Date.now() < 30 * 86400000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 no-print">
        <Button asChild variant="ghost" size="sm"><Link to="/kyc"><ArrowLeft className="w-4 h-4 mr-1" /> ফিরে যান</Link></Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print/PDF</Button>
      </div>

      <Card className="p-5 print:shadow-none">
        <div className="flex flex-wrap items-start gap-4">
          <PhotoUploader kyc={kyc} onUpdate={(url) => update.mutate({ photo_url: url })} />
          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{kyc.customer_name}</h1>
              {kyc.pep_status && <Badge className="bg-purple-600"><ShieldAlert className="w-3 h-3 mr-1" /> PEP</Badge>}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {kyc.customer_id && <span className="font-mono">[{kyc.customer_id}] </span>}
              NID: {kyc.nid_number || "—"} • A/C: {kyc.account_number || "—"} • ফোন: {kyc.phone || "—"}
            </div>
            {kyc.branch_name && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> {kyc.branch_name} {kyc.account_type && `• ${kyc.account_type}`}</div>}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge className={kyc.risk_level === "high" ? "bg-red-500" : kyc.risk_level === "medium" ? "bg-amber-500" : "bg-green-600"}>{kyc.risk_level} risk</Badge>
              <Badge variant={kyc.status === "approved" ? "default" : "secondary"}>{kyc.status}</Badge>
              {reviewDue && <Badge className="bg-blue-500">Annual Review Due: {kyc.next_review_date}</Badge>}
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">প্রোফাইল সম্পূর্ণতা</span><span className="font-semibold">{completion}%</span></div>
              <Progress value={completion} className="h-2" />
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto no-print">
          <TabsTrigger value="profile"><UserIcon className="w-4 h-4 mr-1" /> Profile</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-1" /> Documents</TabsTrigger>
          <TabsTrigger value="checklist"><ListChecks className="w-4 h-4 mr-1" /> Checklist</TabsTrigger>
          <TabsTrigger value="approval"><ShieldCheck className="w-4 h-4 mr-1" /> Approval & Sign-off</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab kyc={kyc} onSave={(patch) => update.mutate(patch)} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab kycId={id} /></TabsContent>
        <TabsContent value="checklist"><ChecklistTab kycId={id} /></TabsContent>
        <TabsContent value="approval"><ApprovalTab kyc={kyc} onSave={(patch) => update.mutate(patch)} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PhotoUploader({ kyc, onUpdate }: { kyc: any; onUpdate: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (file: File) => {
    setUploading(true);
    try {
      const path = `kyc/${kyc.id}/photo_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      onUpdate(signed?.signedUrl || null);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };
  return (
    <div className="relative group">
      {kyc.photo_url ? (
        <img src={kyc.photo_url} alt={kyc.customer_name} className="w-24 h-24 rounded-lg object-cover border-2 border-primary/30" />
      ) : (
        <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground border-2 border-dashed">{kyc.customer_name?.[0]?.toUpperCase() || "?"}</div>
      )}
      <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 rounded-lg cursor-pointer no-print">
        {uploading ? "..." : <><Upload className="w-4 h-4 mr-1" /> Photo</>}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      </label>
    </div>
  );
}

const SECTIONS: { title: string; fields: [string, string, string?][] }[] = [
  { title: "ব্যক্তিগত তথ্য", fields: [
    ["customer_name", "নাম"], ["customer_id", "Customer ID"], ["nid_number", "NID"],
    ["date_of_birth", "জন্মতারিখ", "date"], ["gender", "লিঙ্গ", "select:male,female,other"],
    ["marital_status", "বৈবাহিক", "select:single,married,divorced,widowed"],
    ["place_of_birth", "জন্মস্থান"], ["nationality", "জাতীয়তা"],
    ["father_name", "পিতার নাম"], ["mother_name", "মাতার নাম"], ["spouse_name", "স্বামী/স্ত্রী"],
  ]},
  { title: "যোগাযোগ ও ঠিকানা", fields: [
    ["phone", "ফোন"], ["email", "ইমেইল"], ["emergency_contact", "জরুরি যোগাযোগ"],
  ]},
  { title: "ব্যাংকিং তথ্য", fields: [
    ["account_number", "অ্যাকাউন্ট নং"], ["account_type", "অ্যাকাউন্ট ধরন", "select:savings,current,dps,fdr,loan"],
    ["branch_name", "শাখা"], ["relationship_officer", "Relationship Officer"],
    ["opening_date", "অ্যাকাউন্ট খোলার তারিখ", "date"], ["next_review_date", "পরবর্তী Review তারিখ", "date"],
  ]},
  { title: "পেশা ও আর্থিক", fields: [
    ["occupation", "পেশা"], ["source_of_income", "আয়ের উৎস"],
    ["monthly_income", "মাসিক আয় (৳)", "number"], ["expected_monthly_transaction", "প্রত্যাশিত মাসিক লেনদেন (৳)", "number"],
    ["tin_number", "TIN নম্বর"],
  ]},
  { title: "নমিনি ও পরিচয়দানকারী", fields: [
    ["nominee_name", "নমিনি"], ["nominee_relation", "নমিনি সম্পর্ক"], ["nominee_nid", "নমিনি NID"],
    ["introducer_name", "পরিচয়দানকারী"], ["introducer_account", "পরিচয়দানকারী A/C"],
  ]},
];

function ProfileTab({ kyc, onSave }: { kyc: any; onSave: (p: any) => void }) {
  const [f, setF] = useState({ ...kyc });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const renderField = ([k, label, type]: [string, string, string?]) => {
    if (type?.startsWith("select:")) {
      const opts = type.slice(7).split(",");
      return (
        <div key={k}><Label>{label}</Label>
          <Select value={f[k] || ""} onValueChange={(v) => set(k, v)}>
            <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    }
    return <div key={k}><Label>{label}</Label><Input type={type || "text"} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>;
  };

  const save = () => {
    const patch: any = {};
    SECTIONS.flatMap((s) => s.fields).forEach(([k, , type]) => {
      const v = f[k];
      if (type === "number") patch[k] = v === "" || v == null ? null : Number(v);
      else patch[k] = v === "" ? null : v ?? null;
    });
    patch.address = f.address || null;
    patch.permanent_address = f.permanent_address || null;
    patch.risk_level = f.risk_level;
    patch.pep_status = !!f.pep_status;
    patch.notes = f.notes || null;
    onSave(patch);
  };

  return (
    <div className="space-y-4">
      {SECTIONS.map((s) => (
        <Card key={s.title} className="p-4">
          <div className="font-semibold mb-3 text-sm border-l-4 border-primary pl-2">{s.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{s.fields.map(renderField)}</div>
        </Card>
      ))}
      <Card className="p-4">
        <div className="font-semibold mb-3 text-sm border-l-4 border-primary pl-2">ঠিকানা ও Compliance</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>বর্তমান ঠিকানা</Label><Textarea rows={2} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>স্থায়ী ঠিকানা</Label><Textarea rows={2} value={f.permanent_address ?? ""} onChange={(e) => set("permanent_address", e.target.value)} /></div>
          <div>
            <Label>ঝুঁকি স্তর</Label>
            <Select value={f.risk_level} onValueChange={(v) => set("risk_level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="low">নিম্ন</SelectItem><SelectItem value="medium">মাঝারি</SelectItem><SelectItem value="high">উচ্চ</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3 pb-1">
            <div className="flex items-center gap-2">
              <Switch checked={!!f.pep_status} onCheckedChange={(v) => set("pep_status", v)} />
              <Label className="cursor-pointer flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-purple-600" /> PEP (Politically Exposed Person)</Label>
            </div>
          </div>
          <div className="md:col-span-2"><Label>মন্তব্য</Label><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
      </Card>
      <div className="flex justify-end no-print"><Button onClick={save}>সংরক্ষণ</Button></div>
    </div>
  );
}

function isImage(name?: string) { return !!name && /\.(jpe?g|png|gif|webp|bmp)$/i.test(name); }

function DocumentsTab({ kycId }: { kycId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ doc_type: "NID", doc_name: "", issued_on: "", expire_on: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

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
  const update = useMutation({
    mutationFn: async ({ id, patch }: any) => { await supabase.from("kyc_documents").update(patch).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc_documents", kycId] }),
  });
  const del = useMutation({
    mutationFn: async (d: any) => {
      if (d.file_path) await supabase.storage.from("documents").remove([d.file_path]);
      await supabase.from("kyc_documents").delete().eq("id", d.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc_documents", kycId] }),
  });

  const today = new Date();
  const verifiedCount = useMemo(() => data.filter((d: any) => d.verified).length, [data]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">যাচাইকৃত: <span className="font-bold text-green-600">{verifiedCount}</span> / {data.length}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 no-print border-t pt-3">
        <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["NID", "Photo", "Trade License", "TIN", "Passport", "Driving License", "Birth Certificate", "Address Proof", "Bank Statement", "Salary Certificate", "Signature", "Nominee NID", "Nominee Photo", "Utility Bill", "Other"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="ডকুমেন্ট নাম" value={form.doc_name} onChange={(e) => setForm({ ...form, doc_name: e.target.value })} />
        <Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
        <Input type="date" value={form.expire_on} onChange={(e) => setForm({ ...form, expire_on: e.target.value })} />
        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button onClick={() => add.mutate()} disabled={uploading}><Upload className="w-4 h-4 mr-1" /> {uploading ? "..." : "যোগ"}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((d: any) => {
          const exp = d.expire_on ? new Date(d.expire_on) : null;
          const expired = exp && exp < today;
          const soon = exp && !expired && exp.getTime() - today.getTime() < 30 * 86400000;
          const img = isImage(d.file_path || "");
          return (
            <div key={d.id} className={`flex gap-3 border rounded p-2 ${expired ? "border-destructive/40 bg-destructive/5" : ""}`}>
              {img && d.file_url ? (
                <button onClick={() => setPreview(d.file_url)} className="w-16 h-16 rounded overflow-hidden bg-muted shrink-0">
                  <img src={d.file_url} alt={d.doc_type} className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0"><FileText className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-sm">{d.doc_type}</div>
                  {d.doc_name && <div className="text-xs text-muted-foreground">— {d.doc_name}</div>}
                  {d.verified && <Badge className="bg-green-600 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</Badge>}
                  {expired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
                  {soon && <Badge className="bg-amber-500 text-[10px]">Expires Soon</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">ইস্যু: {d.issued_on || "—"} • মেয়াদ: {d.expire_on || "—"}</div>
                <Input placeholder="যাচাইকারী" defaultValue={d.verified_by || ""} onBlur={(e) => e.target.value !== (d.verified_by || "") && update.mutate({ id: d.id, patch: { verified_by: e.target.value || null } })} className="h-7 text-xs mt-1 no-print" />
                <div className="flex items-center gap-2 mt-2 no-print">
                  <Switch checked={!!d.verified} onCheckedChange={(v) => update.mutate({ id: d.id, patch: { verified: v, verified_on: v ? new Date().toISOString().slice(0, 10) : null } })} />
                  <Label className="text-xs cursor-pointer">যাচাইকৃত</Label>
                  {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline ml-auto flex items-center gap-1"><Eye className="w-3 h-3" /> View</a>}
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(d)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              </div>
            </div>
          );
        })}
        {data.length === 0 && <div className="col-span-full text-sm text-muted-foreground text-center py-6">কোনো ডকুমেন্ট নেই</div>}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 no-print" onClick={() => setPreview(null)}>
          <img src={preview} alt="preview" className="max-w-full max-h-full rounded" />
        </div>
      )}
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
  const pct = data.length ? Math.round((done / data.length) * 100) : 0;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">সম্পন্ন: <span className="font-bold">{done} / {data.length}</span></div>
        <Badge variant={pct === 100 ? "default" : "secondary"}>{pct}%</Badge>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="space-y-2 pt-2">
        {data.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 border-b pb-2">
            <input type="checkbox" checked={c.checked} onChange={(e) => update.mutate({ id: c.id, patch: { checked: e.target.checked, checked_on: e.target.checked ? new Date().toISOString().slice(0, 10) : null } })} className="w-4 h-4" />
            <div className="flex-1 text-sm">{c.item_label}</div>
            {c.checked_on && <span className="text-[10px] text-muted-foreground">{c.checked_on}</span>}
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
      {(kyc.verified_on || kyc.approved_on) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded">
          {kyc.verified_on && <div>✅ যাচাই: <strong>{kyc.verified_by}</strong> • {kyc.verified_on}</div>}
          {kyc.approved_on && <div>🛡️ অনুমোদন: <strong>{kyc.approved_by}</strong> • {kyc.approved_on}</div>}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t">
        {["Prepared By", "Checked By", "Approved By"].map((s) => (
          <div key={s} className="text-center">
            <div className="h-12 border-b border-dashed" />
            <div className="text-xs mt-1 text-muted-foreground">{s}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end no-print">
        <Button onClick={() => onSave({ status: f.status, verified_by: f.verified_by || null, verified_on: f.status === "verified" || f.status === "approved" ? new Date().toISOString().slice(0, 10) : null, approved_by: f.approved_by || null, approved_on: f.status === "approved" ? new Date().toISOString().slice(0, 10) : null })}>সংরক্ষণ</Button>
      </div>
    </Card>
  );
}
