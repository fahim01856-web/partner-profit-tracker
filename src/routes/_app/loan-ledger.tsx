import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useFmt } from "@/lib/format";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, FileDown, ArrowLeft, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/_app/loan-ledger")({ component: LoanLedgerPage });

type Person = {
  id: string; name: string; phone: string | null; address: string | null;
  opening_balance: number; notes: string | null;
};
type Tx = {
  id: string; person_id: string; date: string; type: string;
  amount: number; description: string | null;
};

const TX_TYPES = [
  { v: "loan_out", bn: "ঋণ প্রদান (Loan Out)", sign: +1 },
  { v: "loan_in", bn: "ঋণ গ্রহণ (Loan In)", sign: -1 },
  { v: "payment_in", bn: "কিস্তি/আদায় (Payment In)", sign: -1 },
  { v: "payment_out", bn: "পরিশোধ (Payment Out)", sign: +1 },
  { v: "interest", bn: "ইন্টারেস্ট/মুনাফা", sign: +1 },
  { v: "adjustment", bn: "সমন্বয় (Adjustment)", sign: +1 },
];
const typeLabel = (v: string) => TX_TYPES.find(t => t.v === v)?.bn ?? v;
const typeSign = (v: string) => TX_TYPES.find(t => t.v === v)?.sign ?? 1;

function LoanLedgerPage() {
  const fmt = useFmt();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

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
      const { data, error } = await supabase.from("loan_transactions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of persons) map.set(p.id, Number(p.opening_balance) || 0);
    for (const t of allTx) {
      map.set(t.person_id, (map.get(t.person_id) ?? 0) + typeSign(t.type) * Number(t.amount));
    }
    return map;
  }, [persons, allTx]);

  const filteredPersons = persons.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.phone ?? "").includes(search)
  );

  const totalReceivable = useMemo(() => {
    let r = 0;
    balances.forEach(v => { if (v > 0) r += v; });
    return r;
  }, [balances]);
  const totalPayable = useMemo(() => {
    let r = 0;
    balances.forEach(v => { if (v < 0) r += -v; });
    return r;
  }, [balances]);

  const savePerson = useMutation({
    mutationFn: async (p: Partial<Person> & { id?: string }) => {
      const payload = {
        name: p.name ?? "",
        phone: p.phone || null, address: p.address || null,
        opening_balance: Number(p.opening_balance) || 0, notes: p.notes || null,
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
      toast.success("সেভ হয়েছে");
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
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["loan_persons"] });
      qc.invalidateQueries({ queryKey: ["loan_transactions"] });
    },
  });

  if (selectedId) {
    const person = persons.find(p => p.id === selectedId);
    if (!person) { setSelectedId(null); return null; }
    return <PersonDetail
      person={person}
      balance={balances.get(person.id) ?? 0}
      txs={allTx.filter(t => t.person_id === person.id)}
      onBack={() => setSelectedId(null)}
      onEdit={() => { setEditingPerson(person); setPersonDialogOpen(true); }}
      onDelete={() => { if (confirm("এই ব্যক্তি ও সব লেনদেন ডিলিট করবেন?")) deletePerson.mutate(person.id); }}
    />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">ঋণ খতিয়ান (Loan Ledger)</h1>
          <p className="text-sm text-muted-foreground">ব্যক্তি অনুযায়ী ঋণ ও আদায়ের হিসাব</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><FileDown className="w-4 h-4 mr-2" /> Print</Button>
          <Dialog open={personDialogOpen} onOpenChange={(o) => { setPersonDialogOpen(o); if (!o) setEditingPerson(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingPerson(null)}><Plus className="w-4 h-4 mr-2" /> নতুন ব্যক্তি</Button>
            </DialogTrigger>
            <PersonDialog
              initial={editingPerson}
              onSave={(p) => savePerson.mutate(p)}
              saving={savePerson.isPending}
            />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-5 h-5" />} label="মোট ব্যক্তি" value={fmt.num(persons.length)} />
        <StatCard icon={<Wallet className="w-5 h-5 text-success" />} label="মোট পাওনা" value={fmt.bdt(totalReceivable)} accent="success" />
        <StatCard icon={<Wallet className="w-5 h-5 text-destructive" />} label="মোট দেনা" value={fmt.bdt(totalPayable)} accent="destructive" />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="নেট ব্যালেন্স" value={fmt.bdt(totalReceivable - totalPayable)} />
      </div>

      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="নাম বা মোবাইল দিয়ে খুঁজুন" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">নাম</th>
                <th className="p-2">মোবাইল</th>
                <th className="p-2">ঠিকানা</th>
                <th className="p-2 text-right">ব্যালেন্স</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPersons.map(p => {
                const bal = balances.get(p.id) ?? 0;
                return (
                  <tr key={p.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedId(p.id)}>
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2">{p.phone ?? "-"}</td>
                    <td className="p-2 text-muted-foreground">{p.address ?? "-"}</td>
                    <td className={`p-2 text-right font-semibold ${bal > 0 ? "text-success" : bal < 0 ? "text-destructive" : ""}`}>
                      {fmt.bdt(Math.abs(bal))} {bal > 0 ? "পাওনা" : bal < 0 ? "দেনা" : ""}
                    </td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>বিস্তারিত →</Button>
                    </td>
                  </tr>
                );
              })}
              {filteredPersons.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">কোনো ব্যক্তি নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
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

function PersonDialog({ initial, onSave, saving }: { initial: Person | null; onSave: (p: Partial<Person> & { id?: string }) => void; saving: boolean }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    opening_balance: String(initial?.opening_balance ?? 0),
    notes: initial?.notes ?? "",
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "ব্যক্তি এডিট" : "নতুন ব্যক্তি"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ id: initial?.id, ...form, opening_balance: Number(form.opening_balance) }); }} className="space-y-3">
        <div><Label>নাম *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>মোবাইল</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>ওপেনিং ব্যালেন্স</Label><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} /></div>
        </div>
        <div><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>নোট</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <p className="text-xs text-muted-foreground">ধনাত্মক ওপেনিং = পাওনা, ঋণাত্মক = দেনা</p>
        <Button type="submit" disabled={saving} className="w-full">সেভ করুন</Button>
      </form>
    </DialogContent>
  );
}

function PersonDetail({ person, balance, txs, onBack, onEdit, onDelete }: {
  person: Person; balance: number; txs: Tx[];
  onBack: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const fmt = useFmt();
  const qc = useQueryClient();
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "loan_out", amount: "", description: "",
  });

  const saveTx = useMutation({
    mutationFn: async () => {
      const payload = {
        person_id: person.id,
        date: form.date, type: form.type,
        amount: Number(form.amount), description: form.description || null,
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
      setEditTx(null);
      setForm({ date: new Date().toISOString().slice(0, 10), type: "loan_out", amount: "", description: "" });
      qc.invalidateQueries({ queryKey: ["loan_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delTx = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ডিলিট হয়েছে"); qc.invalidateQueries({ queryKey: ["loan_transactions"] }); },
  });

  const startEdit = (t: Tx) => {
    setEditTx(t);
    setForm({ date: t.date, type: t.type, amount: String(t.amount), description: t.description ?? "" });
  };

  // Running balance (oldest first)
  const sortedAsc = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  let run = Number(person.opening_balance) || 0;
  const withRunning = sortedAsc.map(t => {
    run += typeSign(t.type) * Number(t.amount);
    return { ...t, running: run };
  }).reverse();

  const totalIn = txs.filter(t => typeSign(t.type) < 0).reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = txs.filter(t => typeSign(t.type) > 0).reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> ফেরত</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><FileDown className="w-4 h-4 mr-2" /> Print</Button>
          <Button variant="outline" onClick={onEdit}><Pencil className="w-4 h-4 mr-2" /> এডিট</Button>
          <Button variant="destructive" onClick={onDelete}><Trash2 className="w-4 h-4 mr-2" /> ডিলিট</Button>
        </div>
      </div>

      <Card className="p-5 print-area">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold">{person.name}</h2>
            <p className="text-sm text-muted-foreground">{person.phone ?? "-"} • {person.address ?? "-"}</p>
            {person.notes && <p className="text-xs text-muted-foreground mt-1">{person.notes}</p>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">বর্তমান ব্যালেন্স</div>
            <div className={`text-2xl font-bold ${balance > 0 ? "text-success" : balance < 0 ? "text-destructive" : ""}`}>
              {fmt.bdt(Math.abs(balance))}
            </div>
            <div className="text-xs">{balance > 0 ? "পাওনা" : balance < 0 ? "দেনা" : "সমান"}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
          <div><div className="text-xs text-muted-foreground">ওপেনিং</div><div className="font-semibold">{fmt.bdt(Number(person.opening_balance))}</div></div>
          <div><div className="text-xs text-muted-foreground">মোট আদায়/গ্রহণ</div><div className="font-semibold text-success">{fmt.bdt(totalIn)}</div></div>
          <div><div className="text-xs text-muted-foreground">মোট প্রদান</div><div className="font-semibold text-destructive">{fmt.bdt(totalOut)}</div></div>
        </div>
      </Card>

      <Card className={`p-5 no-print ${editTx ? "ring-2 ring-primary" : ""}`}>
        <h3 className="font-semibold mb-3">{editTx ? "লেনদেন এডিট" : "নতুন লেনদেন"}</h3>
        <form onSubmit={(e) => { e.preventDefault(); saveTx.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><Label>ধরন</Label>
            <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TX_TYPES.map(t => <option key={t.v} value={t.v}>{t.bn}</option>)}
            </select>
          </div>
          <div><Label>পরিমাণ</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="lg:col-span-2"><Label>বিবরণ</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="lg:col-span-5 flex gap-2">
            <Button type="submit" disabled={saveTx.isPending}>{editTx ? "আপডেট" : "যোগ করুন"}</Button>
            {editTx && <Button type="button" variant="outline" onClick={() => { setEditTx(null); setForm({ date: new Date().toISOString().slice(0, 10), type: "loan_out", amount: "", description: "" }); }}>বাতিল</Button>}
          </div>
        </form>
      </Card>

      <Card className="p-5 print-area">
        <h3 className="font-semibold mb-3">লেনদেন ইতিহাস</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">তারিখ</th><th className="p-2">ধরন</th><th className="p-2">বিবরণ</th>
              <th className="p-2 text-right">পরিমাণ</th><th className="p-2 text-right">ব্যালেন্স</th><th className="p-2 no-print"></th>
            </tr></thead>
            <tbody>
              {withRunning.map(t => (
                <tr key={t.id} className={`border-t ${editTx?.id === t.id ? "bg-primary/5" : ""}`}>
                  <td className="p-2">{fmt.date(t.date)}</td>
                  <td className="p-2">{typeLabel(t.type)}</td>
                  <td className="p-2">{t.description}</td>
                  <td className={`p-2 text-right font-semibold ${typeSign(t.type) > 0 ? "text-success" : "text-destructive"}`}>
                    {typeSign(t.type) > 0 ? "+" : "-"}{fmt.bdt(Number(t.amount))}
                  </td>
                  <td className="p-2 text-right">{fmt.bdt(t.running)}</td>
                  <td className="p-2 no-print">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(t)}><Pencil className="w-4 h-4 text-primary" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট করবেন?")) delTx.mutate(t.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {withRunning.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
