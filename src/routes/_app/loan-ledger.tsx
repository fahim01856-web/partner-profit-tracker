import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
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
  TrendingUp, TrendingDown, Image as ImageIcon, Filter,
} from "lucide-react";

export const Route = createFileRoute("/_app/loan-ledger")({ component: LoanLedgerPage });

type Person = {
  id: string; name: string; phone: string | null; address: string | null;
  opening_balance: number; notes: string | null;
  photo_url: string | null; nid_url: string | null; account_number: string | null;
  opening_date: string | null;
};
type Tx = {
  id: string; person_id: string; date: string; time: string | null;
  type: string; amount: number; description: string | null; receipt_url: string | null;
};

const TX_TYPES = [
  { v: "deposit", bn: "জমা (Deposit)", sign: +1, color: "text-success", icon: ArrowDownCircle },
  { v: "withdraw", bn: "উত্তোলন (Withdraw)", sign: -1, color: "text-destructive", icon: ArrowUpCircle },
  { v: "transfer", bn: "ট্রান্সফার (Transfer)", sign: -1, color: "text-amber-600", icon: ArrowRightLeft },
];
// Backward-compat for old types
const LEGACY_MAP: Record<string, number> = {
  loan_out: +1, loan_in: -1, payment_in: -1, payment_out: +1, interest: +1, adjustment: +1,
};
const txMeta = (v: string) => TX_TYPES.find(t => t.v === v);
const txSign = (v: string) => txMeta(v)?.sign ?? LEGACY_MAP[v] ?? 1;
const txLabel = (v: string) => txMeta(v)?.bn ?? v;

const BUCKET = "loan-ledger";

function LoanLedgerPage() {
  const fmt = useFmt();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [delConfirmId, setDelConfirmId] = useState<string | null>(null);

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
    for (const p of persons) bal.set(p.id, Number(p.opening_balance) || 0);
    for (const t of allTx) {
      bal.set(t.person_id, (bal.get(t.person_id) ?? 0) + txSign(t.type) * Number(t.amount));
      txCount.set(t.person_id, (txCount.get(t.person_id) ?? 0) + 1);
      const prev = lastDate.get(t.person_id);
      if (!prev || t.date > prev) lastDate.set(t.person_id, t.date);
    }
    return { bal, lastDate, txCount };
  }, [persons, allTx]);

  const filtered = persons.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
    || (p.phone ?? "").includes(search)
    || (p.account_number ?? "").includes(search)
  );

  const totalReceivable = useMemo(() => {
    let r = 0; stats.bal.forEach(v => { if (v > 0) r += v; }); return r;
  }, [stats]);
  const totalPayable = useMemo(() => {
    let r = 0; stats.bal.forEach(v => { if (v < 0) r += -v; }); return r;
  }, [stats]);

  const savePerson = useMutation({
    mutationFn: async (p: Partial<Person> & { id?: string }) => {
      const payload = {
        name: p.name ?? "", phone: p.phone || null, address: p.address || null,
        opening_balance: Number(p.opening_balance) || 0, notes: p.notes || null,
        photo_url: p.photo_url || null, nid_url: p.nid_url || null,
        account_number: p.account_number || null,
        opening_date: p.opening_date || new Date().toISOString().slice(0, 10),
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
      const { error } = await supabase.from("loan_persons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ডিলিট হয়েছে");
      setSelectedId(null); setDelConfirmId(null);
      qc.invalidateQueries({ queryKey: ["loan_persons"] });
      qc.invalidateQueries({ queryKey: ["loan_transactions"] });
    },
  });

  if (selectedId) {
    const person = persons.find(p => p.id === selectedId);
    if (!person) { setSelectedId(null); return null; }
    return <PersonDetail
      person={person}
      balance={stats.bal.get(person.id) ?? 0}
      txs={allTx.filter(t => t.person_id === person.id)}
      onBack={() => setSelectedId(null)}
      onEdit={() => { setEditingPerson(person); setPersonDialogOpen(true); }}
      onDelete={() => setDelConfirmId(person.id)}
    />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ঋণ খতিয়ান (Loan Ledger)</h1>
          <p className="text-sm text-muted-foreground">প্রতিটি ব্যক্তির ব্যাংক-স্টাইল হিসাব</p>
        </div>
        <Dialog open={personDialogOpen} onOpenChange={(o) => { setPersonDialogOpen(o); if (!o) setEditingPerson(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPerson(null)} size="lg" className="shadow-md">
              <Plus className="w-4 h-4 mr-2" /> নতুন একাউন্ট খুলুন
            </Button>
          </DialogTrigger>
          <PersonDialog
            initial={editingPerson}
            onSave={(p) => savePerson.mutate(p)}
            saving={savePerson.isPending}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-5 h-5" />} label="মোট একাউন্ট" value={fmt.num(persons.length)} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-success" />} label="মোট পাওনা" value={fmt.bdt(totalReceivable)} accent="success" />
        <StatCard icon={<TrendingDown className="w-5 h-5 text-destructive" />} label="মোট দেনা" value={fmt.bdt(totalPayable)} accent="destructive" />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="নেট ব্যালেন্স" value={fmt.bdt(totalReceivable - totalPayable)} />
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 h-11" placeholder="নাম, মোবাইল বা একাউন্ট নম্বর দিয়ে খুঁজুন" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => {
            const bal = stats.bal.get(p.id) ?? 0;
            const count = stats.txCount.get(p.id) ?? 0;
            const last = stats.lastDate.get(p.id);
            const risk = riskLevel(bal);
            return (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className="text-left rounded-xl border bg-card hover:shadow-lg hover:border-primary/40 transition-all p-4 group">
                <div className="flex items-start gap-3">
                  <PersonAvatar person={p} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold truncate">{p.name}</div>
                      <Badge variant="outline" className={risk.cls}>{risk.icon} {risk.label}</Badge>
                    </div>
                    {p.account_number && <div className="text-xs text-muted-foreground font-mono mt-0.5">A/C: {p.account_number}</div>}
                    {p.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{p.phone}</div>}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">বর্তমান ব্যালেন্স</div>
                    <div className={`font-bold text-base ${bal > 0 ? "text-success" : bal < 0 ? "text-destructive" : ""}`}>
                      {fmt.bdt(Math.abs(bal))}
                    </div>
                    <div className="text-[10px]">{bal > 0 ? "পাওনা" : bal < 0 ? "দেনা" : "সমান"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">লেনদেন</div>
                    <div className="font-semibold">{fmt.num(count)} টি</div>
                    {last && <div className="text-[10px] text-muted-foreground">শেষ: {fmt.date(last)}</div>}
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

      <AlertDialog open={!!delConfirmId} onOpenChange={(o) => !o && setDelConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>একাউন্ট ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই ব্যক্তির সকল লেনদেনসহ পুরো হিসাব মুছে যাবে। এটি ফেরানো যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => delConfirmId && deletePerson.mutate(delConfirmId)}>ডিলিট</AlertDialogAction>
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "success" | "destructive" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`text-lg font-bold ${accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
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
  const [form, setForm] = useState({
    name: initial?.name ?? "", phone: initial?.phone ?? "", address: initial?.address ?? "",
    account_number: initial?.account_number ?? "",
    opening_balance: String(initial?.opening_balance ?? 0),
    notes: initial?.notes ?? "",
    photo_url: initial?.photo_url ?? null as string | null,
    nid_url: initial?.nid_url ?? null as string | null,
  });
  useEffect(() => {
    setForm({
      name: initial?.name ?? "", phone: initial?.phone ?? "", address: initial?.address ?? "",
      account_number: initial?.account_number ?? "",
      opening_balance: String(initial?.opening_balance ?? 0),
      notes: initial?.notes ?? "",
      photo_url: initial?.photo_url ?? null, nid_url: initial?.nid_url ?? null,
    });
  }, [initial]);

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "একাউন্ট এডিট" : "নতুন একাউন্ট"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ id: initial?.id, ...form, opening_balance: Number(form.opening_balance) }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FileUploadField value={form.photo_url} onChange={(v) => setForm({ ...form, photo_url: v })} prefix="photos" label="ছবি" />
          <FileUploadField value={form.nid_url} onChange={(v) => setForm({ ...form, nid_url: v })} prefix="nid" label="NID / ডকুমেন্ট" accept="image/*,.pdf" preview={form.nid_url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? true : false} />
        </div>
        <div><Label>নাম *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>মোবাইল</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>একাউন্ট নম্বর</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
        </div>
        <div><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>ওপেনিং ব্যালেন্স <span className="text-xs text-muted-foreground">(+ পাওনা, − দেনা)</span></Label>
          <Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> ফেরত</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> PDF / Print</Button>
          <Button variant="outline" onClick={onEdit}><Pencil className="w-4 h-4 mr-2" /> এডিট</Button>
          <Button variant="destructive" onClick={onDelete}><Trash2 className="w-4 h-4 mr-2" /> ডিলিট</Button>
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
                <Badge variant="secondary" className="text-[10px]">{risk.icon} {risk.label}</Badge>
              </div>
              {person.account_number && <div className="text-xs opacity-90 font-mono mt-1">A/C: {person.account_number}</div>}
              <div className="flex gap-3 flex-wrap text-xs opacity-90 mt-1">
                {person.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{person.phone}</span>}
                {person.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{person.address}</span>}
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-primary-foreground/20">
            <div className="text-xs opacity-80">বর্তমান ব্যালেন্স</div>
            <div className="text-3xl font-bold tracking-tight">{fmt.bdt(Math.abs(balance))}</div>
            <div className="text-xs opacity-90">{balance > 0 ? "পাওনা" : balance < 0 ? "দেনা" : "সমান"}</div>
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
          <div><Label>পরিমাণ</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
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
              {withRunning.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>}
            </tbody>
          </table>
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

function SignedLink({ path, label }: { path: string; label: string }) {
  const url = useSignedUrl(path);
  if (!url) return <span className="text-xs text-muted-foreground">লোড হচ্ছে...</span>;
  return <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{label}</a>;
}
