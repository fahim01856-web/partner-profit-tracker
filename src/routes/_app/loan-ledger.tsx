import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFmt } from "@/lib/format";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Search, Printer, ArrowLeft, Users, Wallet,
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Upload, FileText, Phone, MapPin,
  TrendingUp, TrendingDown, Image as ImageIcon, Filter, Download, MessageSquare,
  Percent, Calendar, ShieldCheck, AlertTriangle, CheckCircle2, Calculator, UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/_app/loan-ledger")({ component: LoanLedgerPage });

type Person = {
  id: string; name: string; phone: string | null; address: string | null;
  opening_balance: number; notes: string | null;
  photo_url: string | null; nid_url: string | null; account_number: string | null;
  opening_date: string | null;
  due_date: string | null;
  loan_amount: number | null;
  interest_rate: number | null;
  tenure_months: number | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  guarantor_nid: string | null;
  purpose: string | null;
  loan_type: string | null;
  status: string | null;
  emi_day: number | null;
};

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}
type Tx = {
  id: string; person_id: string; date: string; time: string | null;
  type: string; amount: number; description: string | null; receipt_url: string | null;
};

const TX_TYPES = [
  { v: "deposit", bn: "জমা (Deposit)", sign: +1, color: "text-success", icon: ArrowDownCircle },
  { v: "withdraw", bn: "উত্তোলন (Withdraw)", sign: -1, color: "text-destructive", icon: ArrowUpCircle },
  { v: "transfer", bn: "ট্রান্সফার (Transfer)", sign: -1, color: "text-amber-600", icon: ArrowRightLeft },
];
const LEGACY_MAP: Record<string, number> = {
  loan_out: +1, loan_in: -1, payment_in: -1, payment_out: +1, interest: +1, adjustment: +1,
};
const txMeta = (v: string) => TX_TYPES.find(t => t.v === v);
const txSign = (v: string) => txMeta(v)?.sign ?? LEGACY_MAP[v] ?? 1;
const txLabel = (v: string) => txMeta(v)?.bn ?? v;

const LOAN_TYPES = [
  { v: "personal", bn: "ব্যক্তিগত" },
  { v: "business", bn: "ব্যবসায়িক" },
  { v: "agriculture", bn: "কৃষি" },
  { v: "home", bn: "গৃহ" },
  { v: "vehicle", bn: "যানবাহন" },
  { v: "education", bn: "শিক্ষা" },
  { v: "other", bn: "অন্যান্য" },
];
const STATUSES = [
  { v: "active", bn: "চলমান", cls: "bg-success/10 text-success border-success/30" },
  { v: "closed", bn: "পরিশোধিত", cls: "bg-muted text-muted-foreground border-border" },
  { v: "defaulted", bn: "খেলাপি", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { v: "pending", bn: "অপেক্ষমাণ", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
];
const statusMeta = (v: string | null) => STATUSES.find(s => s.v === (v ?? "active")) ?? STATUSES[0];

const BUCKET = "loan-ledger";

/** Simple-interest EMI calc. principal, annual rate %, months */
function calcEMI(principal: number, ratePct: number, months: number) {
  if (!principal || !months) return 0;
  if (!ratePct) return principal / months;
  const r = (ratePct / 100) / 12;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

function LoanLedgerPage() {
  const fmt = useFmt();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [delConfirmId, setDelConfirmId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  const { data: persons = [] } = useQuery({
    queryKey: ["loan_persons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_persons").select("*").order("name");
      if (error) throw error;
      return data as Person[];
    },
  });

  const { data: allTx = [] } = useQuery({
    queryKey: ["loan_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_transactions")
        .select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  const stats = useMemo(() => {
    const bal = new Map<string, number>();
    const lastDate = new Map<string, string>();
    const txCount = new Map<string, number>();
    const recovered = new Map<string, number>();
    for (const p of persons) bal.set(p.id, Number(p.opening_balance) || 0);
    for (const t of allTx) {
      bal.set(t.person_id, (bal.get(t.person_id) ?? 0) + txSign(t.type) * Number(t.amount));
      txCount.set(t.person_id, (txCount.get(t.person_id) ?? 0) + 1);
      if (txSign(t.type) < 0) recovered.set(t.person_id, (recovered.get(t.person_id) ?? 0) + Number(t.amount));
      const prev = lastDate.get(t.person_id);
      if (!prev || t.date > prev) lastDate.set(t.person_id, t.date);
    }
    return { bal, lastDate, txCount, recovered };
  }, [persons, allTx]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let r = persons.filter(p =>
      (!search || p.name.toLowerCase().includes(search.toLowerCase())
        || (p.phone ?? "").includes(search)
        || (p.account_number ?? "").includes(search))
      && (statusFilter === "all" || (p.status ?? "active") === statusFilter)
    );
    r = [...r].sort((a, b) => {
      if (sortBy === "balance") return (stats.bal.get(b.id) ?? 0) - (stats.bal.get(a.id) ?? 0);
      if (sortBy === "due") {
        const ad = a.due_date ?? "9999"; const bd = b.due_date ?? "9999";
        return ad.localeCompare(bd);
      }
      if (sortBy === "recent") {
        const ad = stats.lastDate.get(a.id) ?? ""; const bd = stats.lastDate.get(b.id) ?? "";
        return bd.localeCompare(ad);
      }
      return a.name.localeCompare(b.name);
    });
    return r;
  }, [persons, search, statusFilter, sortBy, stats]);

  const totals = useMemo(() => {
    let receivable = 0, payable = 0, disbursed = 0, recovered = 0;
    let overdue = 0, active = 0, closed = 0;
    for (const p of persons) {
      const b = stats.bal.get(p.id) ?? 0;
      if (b > 0) receivable += b;
      if (b < 0) payable += -b;
      disbursed += Number(p.loan_amount) || 0;
      recovered += stats.recovered.get(p.id) ?? 0;
      const st = p.status ?? "active";
      if (st === "active") active++;
      if (st === "closed") closed++;
      if (p.due_date && p.due_date < today && b > 0 && st !== "closed") overdue++;
    }
    return { receivable, payable, disbursed, recovered, overdue, active, closed };
  }, [persons, stats, today]);

  const savePerson = useMutation({
    mutationFn: async (p: Partial<Person> & { id?: string }) => {
      const payload = {
        name: p.name ?? "", phone: p.phone || null, address: p.address || null,
        opening_balance: Number(p.opening_balance) || 0, notes: p.notes || null,
        photo_url: p.photo_url || null, nid_url: p.nid_url || null,
        account_number: p.account_number || null,
        opening_date: p.opening_date || new Date().toISOString().slice(0, 10),
        due_date: p.due_date || null,
        loan_amount: Number(p.loan_amount) || 0,
        interest_rate: Number(p.interest_rate) || 0,
        tenure_months: Number(p.tenure_months) || 0,
        emi_day: p.emi_day ? Number(p.emi_day) : null,
        guarantor_name: p.guarantor_name || null,
        guarantor_phone: p.guarantor_phone || null,
        guarantor_nid: p.guarantor_nid || null,
        purpose: p.purpose || null,
        loan_type: p.loan_type || "personal",
        status: p.status || "active",
      };
      if (p.id) {
        const { error } = await supabase.from("loan_persons").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loan_persons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("সংরক্ষিত হয়েছে");
      setPersonDialogOpen(false); setEditingPerson(null);
      qc.invalidateQueries({ queryKey: ["loan_persons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_transactions").delete().eq("person_id", id);
      if (error) throw error;
      const { error: e2 } = await supabase.from("loan_persons").delete().eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("ডিলিট হয়েছে");
      setSelectedId(null); setDelConfirmId(null);
      qc.invalidateQueries({ queryKey: ["loan_persons"] });
      qc.invalidateQueries({ queryKey: ["loan_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportAllCsv = () => {
    const rows = [["Name", "Phone", "A/C", "Loan Amount", "Interest %", "Tenure (m)", "Recovered", "Balance", "Status", "Due Date"]];
    for (const p of filtered) {
      rows.push([
        p.name, p.phone ?? "", p.account_number ?? "",
        String(p.loan_amount ?? 0), String(p.interest_rate ?? 0), String(p.tenure_months ?? 0),
        String(stats.recovered.get(p.id) ?? 0), String(stats.bal.get(p.id) ?? 0),
        p.status ?? "active", p.due_date ?? "",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `loan-ledger-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedPerson = selectedId ? persons.find(p => p.id === selectedId) : null;

  return (
    <div className="space-y-6">
      {selectedPerson ? (
        <PersonDetail
          person={selectedPerson}
          balance={stats.bal.get(selectedPerson.id) ?? 0}
          txs={allTx.filter(t => t.person_id === selectedPerson.id)}
          onBack={() => setSelectedId(null)}
          onEdit={() => { setEditingPerson(selectedPerson); setPersonDialogOpen(true); }}
          onDelete={() => setDelConfirmId(selectedPerson.id)}
        />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ঋণ খতিয়ান (Loan Ledger)</h1>
              <p className="text-sm text-muted-foreground">স্মার্ট লোন ম্যানেজমেন্ট — EMI, রিকভারি ও ঝুঁকি বিশ্লেষণ</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportAllCsv}><Download className="w-4 h-4 mr-2" /> CSV</Button>
              <Button onClick={() => { setEditingPerson(null); setPersonDialogOpen(true); }} size="lg" className="shadow-md">
                <Plus className="w-4 h-4 mr-2" /> নতুন একাউন্ট
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Users className="w-5 h-5" />} label="মোট একাউন্ট" value={fmt.num(persons.length)} sub={`${fmt.num(totals.active)} চলমান · ${fmt.num(totals.closed)} পরিশোধিত`} />
            <StatCard icon={<Wallet className="w-5 h-5 text-primary" />} label="মোট বিতরণ" value={fmt.bdt(totals.disbursed)} sub={`আদায়: ${fmt.bdt(totals.recovered)}`} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-success" />} label="মোট পাওনা" value={fmt.bdt(totals.receivable)} accent="success" sub={`দেনা: ${fmt.bdt(totals.payable)}`} />
            <StatCard icon={<AlertTriangle className="w-5 h-5 text-destructive" />} label="ওভারডিউ" value={fmt.num(totals.overdue)} accent="destructive" sub="পরিশোধের তারিখ পার" />
          </div>

          <Card className="p-4">
            <div className="flex gap-2 flex-wrap mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 h-11" placeholder="নাম, মোবাইল বা একাউন্ট নম্বর" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="h-11 rounded-md border border-input px-3 text-sm bg-background"
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">সব স্ট্যাটাস</option>
                {STATUSES.map(s => <option key={s.v} value={s.v}>{s.bn}</option>)}
              </select>
              <select className="h-11 rounded-md border border-input px-3 text-sm bg-background"
                value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">নাম অনুসারে</option>
                <option value="balance">ব্যালেন্স (বেশি→কম)</option>
                <option value="due">পরিশোধের তারিখ</option>
                <option value="recent">সাম্প্রতিক লেনদেন</option>
              </select>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(p => {
                const bal = stats.bal.get(p.id) ?? 0;
                const count = stats.txCount.get(p.id) ?? 0;
                const last = stats.lastDate.get(p.id);
                const rec = stats.recovered.get(p.id) ?? 0;
                const risk = riskLevel(bal);
                const sm = statusMeta(p.status);
                const daysLeft = p.due_date ? daysBetween(today, p.due_date) : null;
                const dueCls = daysLeft === null ? "" :
                  daysLeft < 0 ? "bg-destructive/10 text-destructive border-destructive/30" :
                  daysLeft <= 7 ? "bg-amber-500/10 text-amber-700 border-amber-500/30" :
                  "bg-success/10 text-success border-success/30";
                const loanAmt = Number(p.loan_amount) || 0;
                const pct = loanAmt > 0 ? Math.min(100, (rec / loanAmt) * 100) : 0;
                const emi = calcEMI(loanAmt, Number(p.interest_rate) || 0, Number(p.tenure_months) || 0);
                return (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    className="text-left rounded-xl border bg-card hover:shadow-lg hover:border-primary/40 transition-all p-4 group">
                    {p.due_date && (
                      <div className={`mb-2 px-2 py-1 rounded-md border text-[11px] flex items-center justify-between ${dueCls}`}>
                        <span className="font-medium">📅 {fmt.date(p.due_date)}</span>
                        <span className="font-bold">
                          {daysLeft! < 0 ? `${fmt.num(Math.abs(daysLeft!))} দিন overdue` :
                           daysLeft === 0 ? "আজ" :
                           `${fmt.num(daysLeft!)} দিন বাকি`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <PersonAvatar person={p} size={56} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold truncate">{p.name}</div>
                          <Badge variant="outline" className={sm.cls}>{sm.bn}</Badge>
                        </div>
                        {p.account_number && <div className="text-xs text-muted-foreground font-mono mt-0.5">A/C: {p.account_number}</div>}
                        {p.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{p.phone}</div>}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={risk.cls}>{risk.icon} {risk.label}</Badge>
                          {p.interest_rate ? <Badge variant="outline" className="text-[10px]"><Percent className="w-3 h-3 mr-1" />{fmt.num(p.interest_rate)}%</Badge> : null}
                          {p.tenure_months ? <Badge variant="outline" className="text-[10px]">{fmt.num(p.tenure_months)} মাস</Badge> : null}
                        </div>
                      </div>
                    </div>
                    {loanAmt > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">আদায়: {fmt.bdt(rec)} / {fmt.bdt(loanAmt)}</span>
                          <span className="font-semibold">{fmt.num(pct.toFixed(0))}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">ব্যালেন্স</div>
                        <div className={`font-bold ${bal > 0 ? "text-success" : bal < 0 ? "text-destructive" : ""}`}>
                          {fmt.bdt(Math.abs(bal))}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">EMI</div>
                        <div className="font-semibold">{emi ? fmt.bdt(emi) : "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-muted-foreground">লেনদেন</div>
                        <div className="font-semibold">{fmt.num(count)}</div>
                        {last && <div className="text-[10px] text-muted-foreground">{fmt.date(last)}</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full p-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  কোনো একাউন্ট নেই
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <Dialog open={personDialogOpen} onOpenChange={(o) => { setPersonDialogOpen(o); if (!o) setEditingPerson(null); }}>
        <PersonDialog
          initial={editingPerson}
          onSave={(p) => savePerson.mutate(p)}
          saving={savePerson.isPending}
        />
      </Dialog>

      <AlertDialog open={!!delConfirmId} onOpenChange={(o) => !o && setDelConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>একাউন্ট ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই ব্যক্তির সকল লেনদেনসহ পুরো হিসাব মুছে যাবে। এটি ফেরানো যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => delConfirmId && deletePerson.mutate(delConfirmId)} disabled={deletePerson.isPending}>ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function riskLevel(bal: number) {
  const a = Math.abs(bal);
  if (a < 5000) return { label: "ভালো", icon: "🟢", cls: "border-success/40 text-success" };
  if (a < 50000) return { label: "মাঝারি", icon: "🟡", cls: "border-amber-500/40 text-amber-600" };
  return { label: "বেশি বাকি", icon: "🔴", cls: "border-destructive/40 text-destructive" };
}

function StatCard({ icon, label, value, accent, sub }: { icon: React.ReactNode; label: string; value: string; accent?: "success" | "destructive"; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`text-lg font-bold ${accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

/* ---------------- Signed URL helpers ---------------- */
function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function PersonAvatar({ person, size = 40 }: { person: Person; size?: number }) {
  const url = useSignedUrl(person.photo_url);
  const initial = person.name.slice(0, 1).toUpperCase();
  return (
    <Avatar style={{ width: size, height: size }} className="border-2 border-primary/20">
      {url && <AvatarImage src={url} alt={person.name} />}
      <AvatarFallback className="bg-primary/10 text-primary font-bold">{initial}</AvatarFallback>
    </Avatar>
  );
}

function SignedImage({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const url = useSignedUrl(path);
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={alt} className={className} /></a>;
}

/* ---------------- File upload helper ---------------- */
async function uploadFile(file: File, prefix: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

function FileUploadField({ value, onChange, prefix, label, accept = "image/*", preview = true }: {
  value: string | null; onChange: (path: string | null) => void; prefix: string;
  label: string; accept?: string; preview?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const url = useSignedUrl(value);
  const handle = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadFile(f, prefix)); toast.success("আপলোড হয়েছে"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        {preview && url ? (
          <a href={url} target="_blank" rel="noreferrer" className="block">
            <img src={url} alt={label} className="w-14 h-14 rounded-md object-cover border" />
          </a>
        ) : value ? (
          <div className="w-14 h-14 rounded-md border bg-muted flex items-center justify-center"><FileText className="w-5 h-5" /></div>
        ) : (
          <div className="w-14 h-14 rounded-md border border-dashed bg-muted/30 flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>
        )}
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>
          <Upload className="w-4 h-4 mr-1" /> {busy ? "..." : value ? "পরিবর্তন" : "আপলোড"}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>মুছুন</Button>}
      </div>
    </div>
  );
}

/* ---------------- Person Dialog ---------------- */
function PersonDialog({ initial, onSave, saving }: { initial: Person | null; onSave: (p: Partial<Person> & { id?: string }) => void; saving: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const blank = {
    name: "", phone: "", address: "", account_number: "",
    opening_balance: "0", opening_date: today, due_date: "", notes: "",
    photo_url: null as string | null, nid_url: null as string | null,
    loan_amount: "0", interest_rate: "0", tenure_months: "0", emi_day: "",
    loan_type: "personal", status: "active", purpose: "",
    guarantor_name: "", guarantor_phone: "", guarantor_nid: "",
  };
  const fromInitial = (p: Person | null) => p ? {
    name: p.name ?? "", phone: p.phone ?? "", address: p.address ?? "",
    account_number: p.account_number ?? "",
    opening_balance: String(p.opening_balance ?? 0),
    opening_date: p.opening_date ?? today,
    due_date: p.due_date ?? "", notes: p.notes ?? "",
    photo_url: p.photo_url, nid_url: p.nid_url,
    loan_amount: String(p.loan_amount ?? 0),
    interest_rate: String(p.interest_rate ?? 0),
    tenure_months: String(p.tenure_months ?? 0),
    emi_day: p.emi_day ? String(p.emi_day) : "",
    loan_type: p.loan_type ?? "personal",
    status: p.status ?? "active",
    purpose: p.purpose ?? "",
    guarantor_name: p.guarantor_name ?? "",
    guarantor_phone: p.guarantor_phone ?? "",
    guarantor_nid: p.guarantor_nid ?? "",
  } : blank;
  const [form, setForm] = useState(fromInitial(initial));
  useEffect(() => { setForm(fromInitial(initial)); /* eslint-disable-next-line */ }, [initial]);

  // Auto due-date from opening + tenure
  const autoDue = useMemo(() => {
    const months = Number(form.tenure_months) || 0;
    if (!months || !form.opening_date) return "";
    const d = new Date(form.opening_date);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }, [form.opening_date, form.tenure_months]);

  const emi = calcEMI(Number(form.loan_amount) || 0, Number(form.interest_rate) || 0, Number(form.tenure_months) || 0);
  const fmt = useFmt();

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "একাউন্ট এডিট" : "নতুন ঋণ একাউন্ট"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: initial?.id, ...form,
          opening_balance: Number(form.opening_balance),
          loan_amount: Number(form.loan_amount),
          interest_rate: Number(form.interest_rate),
          tenure_months: Number(form.tenure_months),
          emi_day: form.emi_day ? Number(form.emi_day) : null,
          due_date: form.due_date || autoDue || null,
        });
      }} className="space-y-4">
        {/* Identity */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2"><UserCheck className="w-4 h-4 text-primary" /> পরিচয়</h4>
          <div className="grid grid-cols-2 gap-3">
            <FileUploadField value={form.photo_url} onChange={(v) => setForm({ ...form, photo_url: v })} prefix="photos" label="ছবি" />
            <FileUploadField value={form.nid_url} onChange={(v) => setForm({ ...form, nid_url: v })} prefix="nid" label="NID / ডকুমেন্ট" accept="image/*,.pdf" preview={!!form.nid_url?.match(/\.(jpg|jpeg|png|webp|gif)$/i)} />
          </div>
          <div><Label>নাম *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>মোবাইল</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>একাউন্ট নম্বর</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
          </div>
          <div><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>

        {/* Loan terms */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> ঋণের শর্তাবলি</h4>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>ঋণের ধরন</Label>
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
                value={form.loan_type} onChange={(e) => setForm({ ...form, loan_type: e.target.value })}>
                {LOAN_TYPES.map(t => <option key={t.v} value={t.v}>{t.bn}</option>)}
              </select>
            </div>
            <div><Label>স্ট্যাটাস</Label>
              <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s.v} value={s.v}>{s.bn}</option>)}
              </select>
            </div>
            <div><Label>EMI পরিশোধের দিন</Label>
              <Input type="number" min={1} max={28} placeholder="যেমন: ৫" value={form.emi_day} onChange={(e) => setForm({ ...form, emi_day: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>ঋণের পরিমাণ</Label>
              <Input type="number" step="0.01" value={form.loan_amount} onChange={(e) => setForm({ ...form, loan_amount: e.target.value })} />
            </div>
            <div><Label>সুদের হার (% বার্ষিক)</Label>
              <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} />
            </div>
            <div><Label>মেয়াদ (মাস)</Label>
              <Input type="number" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} />
            </div>
          </div>
          {emi > 0 && (
            <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span>হিসাবকৃত EMI: <b className="text-primary">{fmt.bdt(emi)}</b> / মাস</span>
              <span className="ml-auto text-xs text-muted-foreground">মোট পরিশোধ: {fmt.bdt(emi * (Number(form.tenure_months) || 0))}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>একাউন্ট খোলার তারিখ</Label>
              <Input type="date" required value={form.opening_date} onChange={(e) => setForm({ ...form, opening_date: e.target.value })} />
            </div>
            <div><Label>পরিশোধের তারিখ {autoDue && !form.due_date && <span className="text-[10px] text-muted-foreground">(auto: {autoDue})</span>}</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div><Label>ওপেনিং ব্যালেন্স <span className="text-xs text-muted-foreground">(+ পাওনা / − দেনা)</span></Label>
            <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
          </div>
          <div><Label>ঋণের উদ্দেশ্য</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="যেমন: ব্যবসা সম্প্রসারণ" /></div>
        </div>

        {/* Guarantor */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> জামিনদার (Guarantor)</h4>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>নাম</Label><Input value={form.guarantor_name} onChange={(e) => setForm({ ...form, guarantor_name: e.target.value })} /></div>
            <div><Label>মোবাইল</Label><Input value={form.guarantor_phone} onChange={(e) => setForm({ ...form, guarantor_phone: e.target.value })} /></div>
            <div><Label>NID</Label><Input value={form.guarantor_nid} onChange={(e) => setForm({ ...form, guarantor_nid: e.target.value })} /></div>
          </div>
        </div>

        <div><Label>নোট</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <DialogFooter>
          <Button type="submit" disabled={saving} className="w-full">সংরক্ষণ করুন</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ---------------- Person Detail (Bank Statement) ---------------- */
function PersonDetail({ person, balance, txs, onBack, onEdit, onDelete }: {
  person: Person; balance: number; txs: Tx[];
  onBack: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const fmt = useFmt();
  const qc = useQueryClient();
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [delTxId, setDelTxId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [txSearch, setTxSearch] = useState("");

  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    type: "deposit", amount: "", description: "",
    receipt_url: null as string | null,
  });
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (editTx) {
      setForm({
        date: editTx.date, time: editTx.time ?? "",
        type: editTx.type, amount: String(editTx.amount),
        description: editTx.description ?? "",
        receipt_url: editTx.receipt_url,
      });
    }
  }, [editTx]);

  const saveTx = useMutation({
    mutationFn: async () => {
      const payload = {
        person_id: person.id, date: form.date, time: form.time || null,
        type: form.type, amount: Number(form.amount),
        description: form.description || null, receipt_url: form.receipt_url || null,
      };
      if (editTx) {
        const { error } = await supabase.from("loan_transactions").update(payload).eq("id", editTx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loan_transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTx ? "আপডেট হয়েছে" : "যোগ হয়েছে");
      setEditTx(null); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["loan_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delTx = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ডিলিট হয়েছে"); setDelTxId(null); qc.invalidateQueries({ queryKey: ["loan_transactions"] }); },
  });

  const filteredTxs = txs.filter(t => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterFrom && t.date < filterFrom) return false;
    if (filterTo && t.date > filterTo) return false;
    if (txSearch && !(t.description ?? "").toLowerCase().includes(txSearch.toLowerCase())) return false;
    return true;
  });

  const sortedAsc = [...filteredTxs].sort((a, b) =>
    (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? ""))
  );
  let run = Number(person.opening_balance) || 0;
  const withRunning = sortedAsc.map(t => {
    run += txSign(t.type) * Number(t.amount);
    return { ...t, running: run };
  }).reverse();

  const totalDeposit = txs.filter(t => txSign(t.type) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdraw = txs.filter(t => txSign(t.type) < 0).reduce((s, t) => s + Number(t.amount), 0);
  const risk = riskLevel(balance);
  const sm = statusMeta(person.status);

  const loanAmt = Number(person.loan_amount) || 0;
  const rate = Number(person.interest_rate) || 0;
  const months = Number(person.tenure_months) || 0;
  const emi = calcEMI(loanAmt, rate, months);
  const totalPayable = emi * months;
  const totalInterest = totalPayable - loanAmt;
  const repaid = totalWithdraw; // outflows count as repayments
  const repaidPct = loanAmt > 0 ? Math.min(100, (repaid / loanAmt) * 100) : 0;
  const remaining = Math.max(0, loanAmt - repaid);

  // Accrued simple interest from opening_date until today on remaining principal
  const today = new Date().toISOString().slice(0, 10);
  const daysSinceOpen = person.opening_date ? Math.max(0, daysBetween(person.opening_date, today)) : 0;
  const accruedInterest = (remaining * rate / 100) * (daysSinceOpen / 365);

  const nextEmiDate = (() => {
    if (!person.emi_day) return null;
    const d = new Date();
    let day = person.emi_day;
    d.setDate(day);
    if (d < new Date()) d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const exportTxCsv = () => {
    const rows = [["Date", "Time", "Type", "Description", "Debit", "Credit", "Balance"]];
    for (const t of [...withRunning].reverse()) {
      const sign = txSign(t.type);
      rows.push([
        t.date, t.time ?? "", txLabel(t.type), t.description ?? "",
        sign < 0 ? String(t.amount) : "", sign > 0 ? String(t.amount) : "",
        String(t.running),
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${person.name}-statement-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const smsReminder = () => {
    if (!person.phone) { toast.error("মোবাইল নম্বর নেই"); return; }
    const text = `প্রিয় ${person.name}, আপনার ঋণ একাউন্টে বর্তমান বকেয়া ${fmt.bdt(Math.abs(balance))}। দ্রুত পরিশোধের অনুরোধ রইল। ধন্যবাদ।`;
    window.location.href = `sms:${person.phone}?body=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> ফেরত</Button>
        <div className="flex gap-2 flex-wrap">
          {person.phone && <a href={`tel:${person.phone}`}><Button variant="outline" size="sm"><Phone className="w-4 h-4 mr-1" /> কল</Button></a>}
          <Button variant="outline" size="sm" onClick={smsReminder}><MessageSquare className="w-4 h-4 mr-1" /> SMS রিমাইন্ডার</Button>
          <Button variant="outline" size="sm" onClick={exportTxCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-4 h-4 mr-1" /> এডিট</Button>
          <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="w-4 h-4 mr-1" /> ডিলিট</Button>
        </div>
      </div>

      {/* Bank-style profile card */}
      <Card className="p-0 overflow-hidden print-area">
        <div className="bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-5">
          <div className="flex items-start gap-4">
            <PersonAvatar person={person} size={72} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">{person.name}</h2>
                <Badge variant="secondary" className="text-[10px]">{sm.bn}</Badge>
                <Badge variant="secondary" className="text-[10px]">{risk.icon} {risk.label}</Badge>
                {person.due_date && (() => {
                  const d = daysBetween(today, person.due_date);
                  const lbl = d < 0 ? `${fmt.num(Math.abs(d))} দিন overdue` : d === 0 ? "আজ পরিশোধ" : `${fmt.num(d)} দিন বাকি`;
                  return <Badge variant="secondary" className={`text-[10px] ${d < 0 ? "bg-destructive text-destructive-foreground" : d <= 7 ? "bg-amber-500 text-white" : ""}`}>📅 {fmt.date(person.due_date)} · {lbl}</Badge>;
                })()}
              </div>
              {person.account_number && <div className="text-xs opacity-90 font-mono mt-1">A/C: {person.account_number}</div>}
              <div className="flex gap-3 flex-wrap text-xs opacity-90 mt-1">
                {person.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{person.phone}</span>}
                {person.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{person.address}</span>}
                {person.purpose && <span className="flex items-center gap-1">📌 {person.purpose}</span>}
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-primary-foreground/20 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs opacity-80">বর্তমান ব্যালেন্স</div>
              <div className="text-3xl font-bold tracking-tight">{fmt.bdt(Math.abs(balance))}</div>
              <div className="text-xs opacity-90">{balance > 0 ? "পাওনা" : balance < 0 ? "দেনা" : "সমান"}</div>
            </div>
            {loanAmt > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs opacity-90 mb-1">
                  <span>আদায় অগ্রগতি</span>
                  <span className="font-bold">{fmt.num(repaidPct.toFixed(1))}%</span>
                </div>
                <Progress value={repaidPct} className="h-2 bg-primary-foreground/20" />
                <div className="text-xs opacity-90 mt-1">{fmt.bdt(repaid)} / {fmt.bdt(loanAmt)}</div>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x">
          <div className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">ওপেনিং</div>
            <div className="font-bold text-sm">{fmt.bdt(Number(person.opening_balance))}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">মোট জমা</div>
            <div className="font-bold text-sm text-success">+{fmt.bdt(totalDeposit)}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground">মোট উত্তোলন</div>
            <div className="font-bold text-sm text-destructive">−{fmt.bdt(totalWithdraw)}</div>
          </div>
        </div>
        {person.nid_url && (
          <div className="p-3 border-t bg-muted/30 no-print">
            <div className="text-xs text-muted-foreground mb-1">NID / ডকুমেন্ট:</div>
            {person.nid_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
              ? <SignedImage path={person.nid_url} alt="NID" className="max-h-32 rounded border" />
              : <SignedLink path={person.nid_url} label="ডকুমেন্ট দেখুন" />}
          </div>
        )}
      </Card>

      {/* Loan Info + Guarantor */}
      {(loanAmt > 0 || person.guarantor_name) && (
        <div className="grid md:grid-cols-2 gap-4 print-area">
          {loanAmt > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> ঋণের বিবরণ</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="মূল ঋণ" value={fmt.bdt(loanAmt)} />
                <InfoRow label="সুদের হার" value={`${fmt.num(rate)}% বার্ষিক`} />
                <InfoRow label="মেয়াদ" value={`${fmt.num(months)} মাস`} />
                <InfoRow label="মাসিক EMI" value={fmt.bdt(emi)} accent="primary" />
                <InfoRow label="মোট পরিশোধযোগ্য" value={fmt.bdt(totalPayable)} />
                <InfoRow label="মোট সুদ" value={fmt.bdt(totalInterest)} />
                <InfoRow label="পরিশোধিত" value={fmt.bdt(repaid)} accent="success" />
                <InfoRow label="অবশিষ্ট মূলধন" value={fmt.bdt(remaining)} accent="destructive" />
                <InfoRow label="অর্জিত সুদ (এ পর্যন্ত)" value={fmt.bdt(accruedInterest)} />
                {nextEmiDate && <InfoRow label="পরবর্তী EMI তারিখ" value={fmt.date(nextEmiDate)} />}
              </div>
            </Card>
          )}
          {person.guarantor_name && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> জামিনদার</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="নাম" value={person.guarantor_name} />
                {person.guarantor_phone && <InfoRow label="মোবাইল" value={person.guarantor_phone} />}
                {person.guarantor_nid && <InfoRow label="NID" value={person.guarantor_nid} />}
              </div>
              {person.notes && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  <div className="font-medium mb-1">নোট</div>
                  <div className="whitespace-pre-wrap">{person.notes}</div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Transaction form */}
      <Card className={`p-4 no-print ${editTx ? "ring-2 ring-primary" : ""}`}>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          {editTx ? <><Pencil className="w-4 h-4" /> লেনদেন এডিট</> : <><Plus className="w-4 h-4" /> নতুন লেনদেন</>}
        </h3>
        <form onSubmit={(e) => { e.preventDefault(); saveTx.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><Label>সময়</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div><Label>ধরন</Label>
            <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
              value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TX_TYPES.map(t => <option key={t.v} value={t.v}>{t.bn}</option>)}
            </select>
          </div>
          <div><Label>পরিমাণ</Label>
            <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            {emi > 0 && form.type === "withdraw" && !form.amount && (
              <button type="button" className="text-[10px] text-primary mt-1 hover:underline"
                onClick={() => setForm({ ...form, amount: String(emi.toFixed(2)) })}>
                EMI ({fmt.bdt(emi)}) দিয়ে পূরণ করুন
              </button>
            )}
          </div>
          <div className="lg:col-span-2"><Label>বিবরণ / নোট</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="lg:col-span-3">
            <FileUploadField value={form.receipt_url} onChange={(v) => setForm({ ...form, receipt_url: v })} prefix="receipts" label="রিসিট ছবি" />
          </div>
          <div className="lg:col-span-3 flex gap-2 items-end">
            <Button type="submit" disabled={saveTx.isPending}>{editTx ? "আপডেট" : "যোগ করুন"}</Button>
            {editTx && <Button type="button" variant="outline" onClick={() => { setEditTx(null); setForm(emptyForm()); }}>বাতিল</Button>}
          </div>
        </form>
      </Card>

      {/* Filter bar */}
      <Card className="p-3 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select className="h-9 rounded-md border border-input px-3 text-sm bg-background"
            value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">সব ধরন</option>
            {TX_TYPES.map(t => <option key={t.v} value={t.v}>{t.bn}</option>)}
          </select>
          <Input type="date" className="w-auto h-9" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">থেকে</span>
          <Input type="date" className="w-auto h-9" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          <Input className="flex-1 min-w-[160px] h-9" placeholder="বিবরণে খুঁজুন" value={txSearch} onChange={(e) => setTxSearch(e.target.value)} />
        </div>
      </Card>

      {/* Statement */}
      <Card className="p-4 print-area">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">ব্যাংক স্টেটমেন্ট</h3>
          <span className="text-xs text-muted-foreground">{fmt.num(filteredTxs.length)} লেনদেন</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">তারিখ / সময়</th>
                <th className="p-2">বিবরণ</th>
                <th className="p-2 text-right">ডেবিট</th>
                <th className="p-2 text-right">ক্রেডিট</th>
                <th className="p-2 text-right">ব্যালেন্স</th>
                <th className="p-2 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {withRunning.map(t => {
                const meta = txMeta(t.type);
                const Icon = meta?.icon ?? FileText;
                const sign = txSign(t.type);
                return (
                  <tr key={t.id} className={`border-t hover:bg-muted/30 ${editTx?.id === t.id ? "bg-primary/5" : ""}`}>
                    <td className="p-2 whitespace-nowrap">
                      <div>{fmt.date(t.date)}</div>
                      {t.time && <div className="text-[10px] text-muted-foreground">{t.time.slice(0, 5)}</div>}
                    </td>
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 mt-0.5 ${meta?.color ?? ""}`} />
                        <div>
                          <div className="font-medium">{txLabel(t.type)}</div>
                          {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                          {t.receipt_url && <SignedImage path={t.receipt_url} alt="receipt" className="mt-1 w-16 h-16 object-cover rounded border no-print" />}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right text-destructive">{sign < 0 ? fmt.bdt(Number(t.amount)) : ""}</td>
                    <td className="p-2 text-right text-success">{sign > 0 ? fmt.bdt(Number(t.amount)) : ""}</td>
                    <td className="p-2 text-right font-semibold">{fmt.bdt(t.running)}</td>
                    <td className="p-2 no-print">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditTx(t)}><Pencil className="w-4 h-4 text-primary" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setDelTxId(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const ob = Number(person.opening_balance) || 0;
                return (
                  <tr className="border-t bg-primary/5 font-medium">
                    <td className="p-2 whitespace-nowrap">
                      <div>{person.opening_date ? fmt.date(person.opening_date) : "—"}</div>
                      <div className="text-[10px] text-muted-foreground">ওপেনিং</div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        <Wallet className="w-4 h-4 mt-0.5 text-primary" />
                        <div>
                          <div className="font-semibold">ওপেনিং ব্যালেন্স (Opening Balance)</div>
                          <div className="text-xs text-muted-foreground">একাউন্ট শুরুর ব্যালেন্স</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-right text-destructive">{ob < 0 ? fmt.bdt(Math.abs(ob)) : ""}</td>
                    <td className="p-2 text-right text-success">{ob > 0 ? fmt.bdt(ob) : ""}</td>
                    <td className="p-2 text-right font-bold">{fmt.bdt(ob)}</td>
                    <td className="p-2 no-print"></td>
                  </tr>
                );
              })()}
              {withRunning.length === 0 && Number(person.opening_balance) === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Signature blocks for print */}
        <div className="hidden print:grid grid-cols-3 gap-8 mt-12 pt-8 text-xs">
          <div className="text-center"><div className="border-t pt-1">প্রস্তুতকারী</div></div>
          <div className="text-center"><div className="border-t pt-1">যাচাইকারী</div></div>
          <div className="text-center"><div className="border-t pt-1">অনুমোদনকারী</div></div>
        </div>
      </Card>

      <AlertDialog open={!!delTxId} onOpenChange={(o) => !o && setDelTxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>লেনদেন ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এটি ফেরানো যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => delTxId && delTx.mutate(delTxId)}>ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: "primary" | "success" | "destructive" }) {
  const cls = accent === "primary" ? "text-primary" : accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "";
  return (
    <div className="flex items-center justify-between border-b border-dashed py-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

function SignedLink({ path, label }: { path: string; label: string }) {
  const url = useSignedUrl(path);
  if (!url) return <span className="text-xs text-muted-foreground">লোড হচ্ছে...</span>;
  return <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{label}</a>;
}
