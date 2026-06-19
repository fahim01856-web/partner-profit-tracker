import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, ExternalLink, Trash2, AlertTriangle, ShieldCheck, Users as UsersIcon, Clock, Download, CalendarClock, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/kyc")({ component: KycLayout });

function KycLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (/\/kyc\/[^/]+$/.test(path)) return <Outlet />;
  return <KycList />;
}

const CHECKLIST_DEFAULT = [
  { key: "nid_verified", label: "NID যাচাই" },
  { key: "photo_attached", label: "ছবি সংযুক্ত" },
  { key: "address_proof", label: "ঠিকানার প্রমাণ" },
  { key: "signature_taken", label: "স্বাক্ষর গ্রহণ" },
  { key: "nominee_info", label: "নমিনি তথ্য" },
  { key: "income_source", label: "আয়ের উৎস যাচাই" },
  { key: "risk_assessed", label: "ঝুঁকি মূল্যায়ন" },
  { key: "tin_verified", label: "TIN যাচাই (যদি প্রযোজ্য)" },
  { key: "trade_license", label: "ট্রেড লাইসেন্স (ব্যবসায়ী)" },
  { key: "phone_verified", label: "ফোন নম্বর যাচাই" },
  { key: "introducer_verified", label: "পরিচয়দানকারী যাচাই" },
  { key: "pep_screened", label: "PEP/Sanction Screening" },
];

function exportCsv(rows: any[]) {
  if (!rows.length) return toast.error("কোনো ডেটা নেই");
  const headers = ["customer_id", "customer_name", "nid_number", "phone", "account_number", "branch_name", "risk_level", "pep_status", "status", "opening_date", "next_review_date"];
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kyc_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function KycList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [form, setForm] = useState({ customer_name: "", customer_id: "", nid_number: "", phone: "", address: "", account_number: "", occupation: "", risk_level: "low", branch_name: "", account_type: "savings" });

  const { data: list = [] } = useQuery({
    queryKey: ["kyc_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kyc_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["kyc_documents_all"],
    queryFn: async () => { const { data } = await supabase.from("kyc_documents").select("kyc_id,expire_on"); return data || []; },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("kyc_profiles").insert(form as any).select().single();
      if (error) throw error;
      const items = CHECKLIST_DEFAULT.map((c) => ({ kyc_id: data.id, item_key: c.key, item_label: c.label, checked: false }));
      await supabase.from("kyc_checklist_items").insert(items);
      return data;
    },
    onSuccess: () => { toast.success("KYC প্রোফাইল তৈরি"); setOpen(false); setForm({ customer_name: "", customer_id: "", nid_number: "", phone: "", address: "", account_number: "", occupation: "", risk_level: "low", branch_name: "", account_type: "savings" }); qc.invalidateQueries({ queryKey: ["kyc_profiles"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("kyc_profiles").delete().eq("id", id); }, onSuccess: () => { toast.success("ডিলিট হয়েছে"); qc.invalidateQueries({ queryKey: ["kyc_profiles"] }); } });

  const today = new Date();
  const expiringSoon = docs.filter((d: any) => d.expire_on && new Date(d.expire_on).getTime() - today.getTime() < 30 * 86400000 && new Date(d.expire_on) >= today).length;
  const expired = docs.filter((d: any) => d.expire_on && new Date(d.expire_on) < today).length;
  const totalKyc = list.length;
  const pendingKyc = list.filter((k: any) => k.status === "pending").length;
  const approvedKyc = list.filter((k: any) => k.status === "approved").length;
  const highRisk = list.filter((k: any) => k.risk_level === "high").length;
  const pepCount = list.filter((k: any) => k.pep_status).length;
  const reviewDue = list.filter((k: any) => k.next_review_date && new Date(k.next_review_date).getTime() - today.getTime() < 30 * 86400000).length;

  const branches = useMemo(() => Array.from(new Set(list.map((k: any) => k.branch_name).filter(Boolean))), [list]);

  const filtered = list.filter((k: any) => {
    if (filterStatus !== "all" && k.status !== filterStatus) return false;
    if (filterRisk !== "all" && k.risk_level !== filterRisk) return false;
    if (filterBranch !== "all" && k.branch_name !== filterBranch) return false;
    if (search) {
      const q = search.toLowerCase();
      return (k.customer_name?.toLowerCase().includes(q) || k.nid_number?.includes(q) || k.phone?.includes(q) || k.account_number?.includes(q) || k.customer_id?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">KYC Documents</h1>
          <p className="text-sm text-muted-foreground">Banking-grade গ্রাহক KYC ও ডকুমেন্ট ব্যবস্থাপনা</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(filtered)}><Download className="w-4 h-4 mr-1" /> CSV Export</Button>
          <Button asChild variant="outline" size="sm"><Link to="/documents">📁 Documents</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/signature-cards">✍️ Signature Cards</Link></Button>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> নতুন KYC</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3"><div className="text-[11px] text-muted-foreground flex items-center gap-1"><UsersIcon className="w-3 h-3" /> মোট KYC</div><div className="text-xl font-bold">{totalKyc}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground">অপেক্ষমাণ</div><div className="text-xl font-bold text-amber-600">{pendingKyc}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> অনুমোদিত</div><div className="text-xl font-bold text-green-600">{approvedKyc}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground">উচ্চ ঝুঁকি</div><div className="text-xl font-bold text-red-600">{highRisk}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> PEP</div><div className="text-xl font-bold text-purple-600">{pepCount}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Review Due</div><div className="text-xl font-bold text-blue-600">{reviewDue}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> মেয়াদ ৩০দিন</div><div className="text-xl font-bold text-orange-600">{expiringSoon}</div></Card>
        <Card className="p-3"><div className="text-[11px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> মেয়াদোত্তীর্ণ</div><div className="text-xl font-bold text-red-600">{expired}</div></Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="নাম / Customer ID / NID / ফোন / অ্যাকাউন্ট" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
              <SelectItem value="pending">অপেক্ষমাণ</SelectItem>
              <SelectItem value="verified">যাচাইকৃত</SelectItem>
              <SelectItem value="approved">অনুমোদিত</SelectItem>
              <SelectItem value="rejected">প্রত্যাখ্যাত</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ঝুঁকি</SelectItem>
              <SelectItem value="low">নিম্ন</SelectItem>
              <SelectItem value="medium">মাঝারি</SelectItem>
              <SelectItem value="high">উচ্চ</SelectItem>
            </SelectContent>
          </Select>
          {branches.length > 0 && (
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-40"><SelectValue placeholder="শাখা" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব শাখা</SelectItem>
                {branches.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((k: any) => {
          const due = k.next_review_date && new Date(k.next_review_date).getTime() - today.getTime() < 30 * 86400000;
          return (
            <Card key={k.id} className="p-4 hover:shadow-md transition relative">
              {k.pep_status && <Badge className="absolute top-2 right-2 bg-purple-600 text-[10px]">PEP</Badge>}
              <div className="flex items-start gap-3 mb-2">
                {k.photo_url ? (
                  <img src={k.photo_url} alt={k.customer_name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">{k.customer_name?.[0]?.toUpperCase() || "?"}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{k.customer_name}</div>
                  {k.customer_id && <div className="text-[10px] text-muted-foreground font-mono">ID: {k.customer_id}</div>}
                  <Badge variant={k.status === "approved" ? "default" : k.status === "rejected" ? "destructive" : "secondary"} className="mt-1 text-[10px]">{k.status}</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 mb-3">
                {k.nid_number && <div>NID: {k.nid_number}</div>}
                {k.phone && <div>📞 {k.phone}</div>}
                {k.account_number && <div>A/C: {k.account_number} {k.account_type && <span className="text-[10px]">({k.account_type})</span>}</div>}
                {k.branch_name && <div>🏦 {k.branch_name}</div>}
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className={`text-[10px] ${k.risk_level === "high" ? "border-red-500 text-red-600" : k.risk_level === "medium" ? "border-amber-500 text-amber-600" : ""}`}>{k.risk_level} risk</Badge>
                  {due && <Badge className="bg-blue-500 text-[10px]">Review Due</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/kyc/$id" params={{ id: k.id }}><ExternalLink className="w-3 h-3 mr-1" /> খুলুন</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট করবেন?")) del.mutate(k.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">কোনো KYC প্রোফাইল নেই</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>নতুন KYC প্রোফাইল</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            <div className="col-span-2"><Label>গ্রাহকের নাম *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>Customer ID</Label><Input value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} placeholder="যেমন: CUS-001" /></div>
            <div><Label>NID নম্বর</Label><Input value={form.nid_number} onChange={(e) => setForm({ ...form, nid_number: e.target.value })} /></div>
            <div><Label>ফোন</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>অ্যাকাউন্ট নং</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label>অ্যাকাউন্ট ধরন</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="dps">DPS</SelectItem>
                  <SelectItem value="fdr">FDR</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>শাখা</Label><Input value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })} /></div>
            <div><Label>পেশা</Label><Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></div>
            <div><Label>ঝুঁকি স্তর</Label>
              <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">নিম্ন</SelectItem><SelectItem value="medium">মাঝারি</SelectItem><SelectItem value="high">উচ্চ</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>ঠিকানা</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={() => create.mutate()} disabled={!form.customer_name}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
