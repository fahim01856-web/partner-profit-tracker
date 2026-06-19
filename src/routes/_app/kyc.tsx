import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Plus, Search, ExternalLink, Trash2, AlertTriangle, ShieldCheck, Users as UsersIcon, Clock } from "lucide-react";

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
];

function KycList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [form, setForm] = useState({ customer_name: "", nid_number: "", phone: "", address: "", account_number: "", occupation: "", risk_level: "low" });

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
      // seed default checklist
      const items = CHECKLIST_DEFAULT.map((c) => ({ kyc_id: data.id, item_key: c.key, item_label: c.label, checked: false }));
      await supabase.from("kyc_checklist_items").insert(items);
      return data;
    },
    onSuccess: () => { toast.success("KYC প্রোফাইল তৈরি"); setOpen(false); setForm({ customer_name: "", nid_number: "", phone: "", address: "", account_number: "", occupation: "", risk_level: "low" }); qc.invalidateQueries({ queryKey: ["kyc_profiles"] }); },
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

  const filtered = list.filter((k: any) => {
    if (filterStatus !== "all" && k.status !== filterStatus) return false;
    if (filterRisk !== "all" && k.risk_level !== filterRisk) return false;
    if (search) {
      const q = search.toLowerCase();
      return (k.customer_name?.toLowerCase().includes(q) || k.nid_number?.includes(q) || k.phone?.includes(q) || k.account_number?.includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">KYC Documents</h1>
          <p className="text-sm text-muted-foreground">গ্রাহক KYC ও ডকুমেন্ট ব্যবস্থাপনা</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/documents">📁 Documents</Link></Button>
          <Button asChild variant="outline"><Link to="/signature-cards">✍️ Signature Cards</Link></Button>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> নতুন KYC</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><UsersIcon className="w-3 h-3" /> মোট KYC</div><div className="text-xl font-bold">{totalKyc}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">অপেক্ষমাণ</div><div className="text-xl font-bold text-amber-600">{pendingKyc}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> অনুমোদিত</div><div className="text-xl font-bold text-green-600">{approvedKyc}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">উচ্চ ঝুঁকি</div><div className="text-xl font-bold text-red-600">{highRisk}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> মেয়াদ ৩০দিন</div><div className="text-xl font-bold text-orange-600">{expiringSoon}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> মেয়াদোত্তীর্ণ</div><div className="text-xl font-bold text-red-600">{expired}</div></Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="নাম / NID / ফোন / অ্যাকাউন্ট নং" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((k: any) => (
          <Card key={k.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-semibold">{k.customer_name}</div>
              <Badge variant={k.status === "approved" ? "default" : k.status === "rejected" ? "destructive" : "secondary"}>{k.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mb-3">
              {k.nid_number && <div>NID: {k.nid_number}</div>}
              {k.phone && <div>📞 {k.phone}</div>}
              {k.account_number && <div>A/C: {k.account_number}</div>}
              <Badge variant="outline" className={`text-[10px] ${k.risk_level === "high" ? "border-red-500 text-red-600" : k.risk_level === "medium" ? "border-amber-500 text-amber-600" : ""}`}>{k.risk_level} risk</Badge>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/kyc/$id" params={{ id: k.id }}><ExternalLink className="w-3 h-3 mr-1" /> খুলুন</Link></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট করবেন?")) del.mutate(k.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">কোনো KYC প্রোফাইল নেই</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>নতুন KYC প্রোফাইল</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>গ্রাহকের নাম *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>NID নম্বর</Label><Input value={form.nid_number} onChange={(e) => setForm({ ...form, nid_number: e.target.value })} /></div>
            <div><Label>ফোন</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>অ্যাকাউন্ট নং</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label>পেশা</Label><Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></div>
            <div className="col-span-2"><Label>ঠিকানা</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>ঝুঁকি স্তর</Label>
              <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">নিম্ন</SelectItem><SelectItem value="medium">মাঝারি</SelectItem><SelectItem value="high">উচ্চ</SelectItem></SelectContent>
              </Select>
            </div>
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
