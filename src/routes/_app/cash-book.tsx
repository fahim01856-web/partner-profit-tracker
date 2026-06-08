import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  BookOpen, Plus, Trash2, Pencil, Printer, Save, TrendingUp,
  TrendingDown, Wallet, Banknote, FileSpreadsheet, Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_app/cash-book")({ component: CashBookPage });

type Entry = { id: string; date: string; entry_type: "in" | "out"; description: string; amount: number };
type Opening = { date: string; opening_balance: number; is_manual: boolean };

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const dt = new Date(d); dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
};

function CashBookPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [date, setDate] = useState(todayStr());
  const [form, setForm] = useState({
    id: null as string | null,
    entry_type: "in" as "in" | "out",
    description: "",
    amount: "",
  });
  const [manualOpen, setManualOpen] = useState("");
  const [investInput, setInvestInput] = useState("");

  // Total investment (app_settings key=total_investment)
  const { data: investment = 0 } = useQuery({
    queryKey: ["app_settings", "total_investment"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "total_investment").maybeSingle();
      return data ? Number((data.value as any)?.amount ?? 0) : 0;
    },
  });

  // Today entries
  const { data: entries = [] } = useQuery({
    queryKey: ["cash_book_entries", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_book_entries").select("*").eq("date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  // Opening row for date
  const { data: openingRow } = useQuery({
    queryKey: ["cash_book_opening", date],
    queryFn: async () => {
      const { data } = await supabase.from("cash_book_opening").select("*").eq("date", date).maybeSingle();
      return data as Opening | null;
    },
  });

  // Prior day closing (auto opening)
  const { data: priorClosing = 0 } = useQuery({
    queryKey: ["cash_book_prior_closing", date],
    queryFn: async () => {
      const { data: open } = await supabase.from("cash_book_opening").select("*").lt("date", date).order("date", { ascending: false }).limit(1);
      const startDate = open?.[0]?.date ?? null;
      const startBal = open?.[0] ? Number(open[0].opening_balance) : 0;
      let q = supabase.from("cash_book_entries").select("entry_type,amount,date").lt("date", date);
      if (startDate) q = q.gte("date", startDate);
      const { data: rows } = await q;
      let bal = startBal;
      (rows ?? []).forEach((r: any) => { bal += r.entry_type === "in" ? Number(r.amount) : -Number(r.amount); });
      return bal;
    },
  });

  const isManual = !!openingRow?.is_manual;
  const opening = openingRow ? Number(openingRow.opening_balance) : priorClosing;
  const cashIn = entries.filter((e) => e.entry_type === "in").reduce((s, e) => s + Number(e.amount), 0);
  const cashOut = entries.filter((e) => e.entry_type === "out").reduce((s, e) => s + Number(e.amount), 0);
  const closing = opening + cashIn - cashOut;
  const cashInHand = investment - closing;

  // Mutations
  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount || 0);
      if (!form.description.trim()) throw new Error(lang === "bn" ? "বিবরণ লিখুন" : "Description required");
      if (amount <= 0) throw new Error(lang === "bn" ? "পরিমাণ লিখুন" : "Amount required");
      const payload = { date, entry_type: form.entry_type, description: form.description.trim(), amount };
      if (form.id) {
        const { error } = await supabase.from("cash_book_entries").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cash_book_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_entries"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      qc.invalidateQueries({ queryKey: ["cash_book_history"] });
      toast.success(t("save") + " ✓");
      setForm({ id: null, entry_type: form.entry_type, description: "", amount: "" });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_book_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_entries"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      qc.invalidateQueries({ queryKey: ["cash_book_history"] });
      toast.success(t("deleted"));
    },
  });

  const toggleManual = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        const val = openingRow ? Number(openingRow.opening_balance) : priorClosing;
        const { error } = await supabase.from("cash_book_opening")
          .upsert({ date, opening_balance: val, is_manual: true }, { onConflict: "date" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cash_book_opening").delete().eq("date", date);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_opening"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      qc.invalidateQueries({ queryKey: ["cash_book_history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveManualOpening = useMutation({
    mutationFn: async () => {
      const val = Number(manualOpen || 0);
      const { error } = await supabase.from("cash_book_opening")
        .upsert({ date, opening_balance: val, is_manual: true }, { onConflict: "date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_opening"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      qc.invalidateQueries({ queryKey: ["cash_book_history"] });
      toast.success(t("save") + " ✓");
      setManualOpen("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveInvestment = useMutation({
    mutationFn: async () => {
      const val = Number(investInput || 0);
      if (val < 0) throw new Error("Invalid");
      const { error } = await supabase.from("app_settings")
        .upsert({ key: "total_investment", value: { amount: val } }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings", "total_investment"] });
      toast.success(t("save") + " ✓");
      setInvestInput("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (e: Entry) => setForm({ id: e.id, entry_type: e.entry_type, description: e.description, amount: String(e.amount) });

  const printPage = () => window.print();
  const exportCSV = (rows: any[], filename: string) => {
    const csv = rows.map((r) => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> {lang === "bn" ? "দৈনিক ক্যাশ বুক" : "Daily Cash Book"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "প্রফেশনাল এজেন্ট ব্যাংকিং ক্যাশ ব্যবস্থাপনা" : "Professional agent banking cash management"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printPage}><Printer className="w-4 h-4" /> {t("print")}</Button>
        </div>
      </div>

      {/* Total Investment editable */}
      <Card className="p-4 no-print bg-gradient-to-br from-primary/5 to-transparent">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <Label className="flex items-center gap-1.5 text-primary"><Banknote className="w-4 h-4" /> {lang === "bn" ? "মোট বিনিয়োগ (Total Investment)" : "Total Investment"}</Label>
            <div className="flex gap-2 mt-1">
              <Input type="number" step="0.01" placeholder={fmt.bdt(investment)} value={investInput} onChange={(e) => setInvestInput(e.target.value)} />
              <Button onClick={() => saveInvestment.mutate()} disabled={!investInput || saveInvestment.isPending}><Save className="w-4 h-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{lang === "bn" ? "এই ফিল্ড যেকোনো সময় পরিবর্তন করা যাবে" : "Editable anytime; affects Cash in Hand calculation"}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{lang === "bn" ? "বর্তমান" : "Current"}</div>
            <div className="text-2xl font-bold text-primary">{fmt.bdt(investment)}</div>
          </div>
        </div>
      </Card>

      {/* Date + Manual Override */}
      <Card className="p-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {t("date")}</Label>
            <div className="flex gap-2 mt-1">
              <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))}>‹</Button>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))}>›</Button>
            </div>
          </div>

          <div>
            <Label className="flex items-center justify-between">
              <span>{lang === "bn" ? "ম্যানুয়াল ওপেনিং" : "Manual Opening Override"}</span>
              <Switch checked={isManual} onCheckedChange={(v) => toggleManual.mutate(v)} />
            </Label>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isManual
                ? (lang === "bn" ? "ম্যানুয়াল মোড — নিজে ওপেনিং সেট করুন" : "Manual mode — set opening yourself")
                : (lang === "bn" ? "অটো — আগের দিনের ক্লোজিং নেওয়া হবে" : "Auto — uses previous day's closing")}
            </p>
          </div>

          {isManual && (
            <div>
              <Label>{lang === "bn" ? "ওপেনিং ব্যালেন্স" : "Opening Balance"}</Label>
              <div className="flex gap-2 mt-1">
                <Input type="number" step="0.01" placeholder={String(opening)} value={manualOpen} onChange={(e) => setManualOpen(e.target.value)} />
                <Button onClick={() => saveManualOpening.mutate()} disabled={!manualOpen}><Save className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label={lang === "bn" ? "ওপেনিং" : "Opening"} value={fmt.bdt(opening)} icon={<Wallet className="w-4 h-4" />} />
        <Stat label={lang === "bn" ? "ক্যাশ ইন" : "Cash In"} value={fmt.bdt(cashIn)} icon={<TrendingUp className="w-4 h-4" />} accent="text-emerald-600" />
        <Stat label={lang === "bn" ? "ক্যাশ আউট" : "Cash Out"} value={fmt.bdt(cashOut)} icon={<TrendingDown className="w-4 h-4" />} accent="text-red-600" />
        <Stat label={lang === "bn" ? "ক্লোজিং" : "Settlement Closing"} value={fmt.bdt(closing)} icon={<Wallet className="w-4 h-4" />} accent="text-primary" />
        <Stat label={lang === "bn" ? "হাতে নগদ" : "Cash in Hand"} value={fmt.bdt(cashInHand)} icon={<Banknote className="w-4 h-4" />} accent={cashInHand < 0 ? "text-red-600" : "text-amber-600"} />
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-auto no-print">
          <TabsTrigger value="today">{lang === "bn" ? "আজ" : "Today"}</TabsTrigger>
          <TabsTrigger value="daily">{lang === "bn" ? "দৈনিক ইতিহাস" : "Daily History"}</TabsTrigger>
          <TabsTrigger value="monthly">{lang === "bn" ? "মাসিক" : "Monthly"}</TabsTrigger>
        </TabsList>

        {/* Today tab */}
        <TabsContent value="today" className="space-y-4">
          <Card className="p-4 no-print">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> {form.id ? t("edit") : (lang === "bn" ? "নতুন এন্ট্রি" : "New Entry")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>{lang === "bn" ? "ধরন" : "Type"}</Label>
                <Select value={form.entry_type} onValueChange={(v: any) => setForm({ ...form, entry_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">{lang === "bn" ? "ক্যাশ ইন" : "Cash In"}</SelectItem>
                    <SelectItem value="out">{lang === "bn" ? "ক্যাশ আউট" : "Cash Out"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>{t("description")}</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>{t("amountBDT")}</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3 sticky bottom-0">
              {form.id && <Button variant="outline" onClick={() => setForm({ id: null, entry_type: "in", description: "", amount: "" })}>{t("cancel_edit")}</Button>}
              <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="w-4 h-4" /> {form.id ? t("update") : t("save")}</Button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden print-area">
            <div className="p-3 border-b font-semibold">
              {lang === "bn" ? "দৈনিক ক্যাশ বুক — " : "Daily Cash Book — "}{fmt.date(date)}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>{t("description")}</TableHead>
                    <TableHead className="text-right">{lang === "bn" ? "ক্যাশ ইন" : "Cash In"}</TableHead>
                    <TableHead className="text-right">{lang === "bn" ? "ক্যাশ আউট" : "Cash Out"}</TableHead>
                    <TableHead className="text-right no-print">{t("edit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">{lang === "bn" ? "ওপেনিং ব্যালেন্স" : "Opening Balance"}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt.bdt(opening)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="no-print"></TableCell>
                  </TableRow>
                  {entries.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noEntries")}</TableCell></TableRow>
                  )}
                  {entries.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-center">{fmt.num(i + 1)}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="text-right text-emerald-700">{e.entry_type === "in" ? fmt.bdt(e.amount) : ""}</TableCell>
                      <TableCell className="text-right text-red-700">{e.entry_type === "out" ? fmt.bdt(e.amount) : ""}</TableCell>
                      <TableCell className="text-right no-print">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) del.mutate(e.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>{lang === "bn" ? "মোট" : "Total"}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmt.bdt(cashIn)}</TableCell>
                    <TableCell className="text-right text-red-700">{fmt.bdt(cashOut)}</TableCell>
                    <TableCell className="no-print"></TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell colSpan={2}>{lang === "bn" ? "ক্লোজিং ব্যালেন্স" : "Closing Balance"}</TableCell>
                    <TableCell colSpan={2} className="text-right text-primary">{fmt.bdt(closing)}</TableCell>
                    <TableCell className="no-print"></TableCell>
                  </TableRow>
                  <TableRow className="bg-amber-500/10 font-bold">
                    <TableCell colSpan={2}>{lang === "bn" ? "হাতে নগদ" : "Cash in Hand"}</TableCell>
                    <TableCell colSpan={2} className="text-right text-amber-700">{fmt.bdt(cashInHand)}</TableCell>
                    <TableCell className="no-print"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="daily"><DailyHistory investment={investment} exportCSV={exportCSV} /></TabsContent>
        <TabsContent value="monthly"><MonthlyHistory investment={investment} exportCSV={exportCSV} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <Card className="p-3 md:p-4">
      <div className="text-[11px] md:text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</div>
      <div className={`text-base md:text-lg font-bold mt-1 ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}

/* ===================== Daily History ===================== */

function DailyHistory({ investment, exportCSV }: { investment: number; exportCSV: (rows: any[], f: string) => void }) {
  const { lang, t } = useI18n();
  const fmt = useFmt();
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayStr());

  const { data } = useQuery({
    queryKey: ["cash_book_history", from, to],
    queryFn: async () => {
      const [{ data: ent }, { data: ops }] = await Promise.all([
        supabase.from("cash_book_entries").select("*").gte("date", from).lte("date", to),
        supabase.from("cash_book_opening").select("*").lte("date", to).order("date", { ascending: true }),
      ]);
      // Build daily map
      const dates = new Set<string>();
      (ent ?? []).forEach((e: any) => dates.add(e.date));
      (ops ?? []).forEach((o: any) => { if (o.date >= from && o.date <= to) dates.add(o.date); });
      const sorted = [...dates].sort();

      // Compute running opening for each day:
      // For day D, opening = manual override if present; else previous day's closing.
      // Need carry-forward across the whole range. Start with the most recent opening <= from.
      const opByDate = new Map<string, Opening>();
      (ops ?? []).forEach((o: any) => opByDate.set(o.date, o));
      const entriesAll = (ent ?? []) as Entry[];
      const sumByDate = new Map<string, { in: number; out: number }>();
      entriesAll.forEach((e) => {
        const cur = sumByDate.get(e.date) ?? { in: 0, out: 0 };
        if (e.entry_type === "in") cur.in += Number(e.amount); else cur.out += Number(e.amount);
        sumByDate.set(e.date, cur);
      });

      // Establish initial carry: balance at start of `from`
      const beforeOpening = (ops ?? []).filter((o: any) => o.date < from).slice(-1)[0];
      let carry = beforeOpening ? Number(beforeOpening.opening_balance) : 0;
      if (beforeOpening) {
        const { data: midRows } = await supabase.from("cash_book_entries")
          .select("entry_type,amount,date").gte("date", beforeOpening.date).lt("date", from);
        (midRows ?? []).forEach((r: any) => { carry += r.entry_type === "in" ? Number(r.amount) : -Number(r.amount); });
      } else {
        const { data: midRows } = await supabase.from("cash_book_entries")
          .select("entry_type,amount,date").lt("date", from);
        (midRows ?? []).forEach((r: any) => { carry += r.entry_type === "in" ? Number(r.amount) : -Number(r.amount); });
      }

      const rows = sorted.map((d) => {
        const op = opByDate.get(d);
        const opening = op ? Number(op.opening_balance) : carry;
        const sums = sumByDate.get(d) ?? { in: 0, out: 0 };
        const closing = opening + sums.in - sums.out;
        carry = closing;
        return { date: d, opening, in: sums.in, out: sums.out, closing, cashInHand: investment - closing };
      });
      return rows;
    },
  });

  const rows = data ?? [];
  const handleExport = () => {
    const header = ["Date", "Opening", "Cash In", "Cash Out", "Closing", "Cash in Hand"];
    const body = rows.map((r) => [r.date, r.opening, r.in, r.out, r.closing, r.cashInHand]);
    exportCSV([header, ...body], `cash-book-${from}_to_${to}.csv`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>{lang === "bn" ? "থেকে" : "From"}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>{lang === "bn" ? "পর্যন্ত" : "To"}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={handleExport}><FileSpreadsheet className="w-4 h-4" /> CSV</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> {useI18n().t("print")}</Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden print-area">
        <div className="p-3 border-b font-semibold">
          {lang === "bn" ? "দৈনিক ইতিহাস" : "Daily History"} — {fmt.date(from)} → {fmt.date(to)}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "ওপেনিং" : "Opening"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "ক্যাশ ইন" : "Cash In"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "ক্যাশ আউট" : "Cash Out"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "ক্লোজিং" : "Closing"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "হাতে নগদ" : "In Hand"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{lang === "bn" ? "কোনো রেকর্ড নেই" : "No records"}</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.date}>
                  <TableCell>{fmt.date(r.date)}</TableCell>
                  <TableCell className="text-right">{fmt.bdt(r.opening)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{fmt.bdt(r.in)}</TableCell>
                  <TableCell className="text-right text-red-700">{fmt.bdt(r.out)}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{fmt.bdt(r.closing)}</TableCell>
                  <TableCell className="text-right text-amber-700">{fmt.bdt(r.cashInHand)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ===================== Monthly History ===================== */

function MonthlyHistory({ investment, exportCSV }: { investment: number; exportCSV: (rows: any[], f: string) => void }) {
  const { lang, t } = useI18n();
  const fmt = useFmt();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data } = useQuery({
    queryKey: ["cash_book_history", start, end, "monthly"],
    queryFn: async () => {
      const [{ data: ent }, { data: ops }] = await Promise.all([
        supabase.from("cash_book_entries").select("entry_type,amount,date").gte("date", start).lte("date", end),
        supabase.from("cash_book_opening").select("*").lte("date", end).order("date", { ascending: true }),
      ]);
      const totalIn = (ent ?? []).filter((r: any) => r.entry_type === "in").reduce((s: number, r: any) => s + Number(r.amount), 0);
      const totalOut = (ent ?? []).filter((r: any) => r.entry_type === "out").reduce((s: number, r: any) => s + Number(r.amount), 0);

      // Opening for first day of month
      const before = (ops ?? []).filter((o: any) => o.date < start).slice(-1)[0];
      let openingMonth = before ? Number(before.opening_balance) : 0;
      if (before) {
        const { data: mid } = await supabase.from("cash_book_entries")
          .select("entry_type,amount").gte("date", before.date).lt("date", start);
        (mid ?? []).forEach((r: any) => { openingMonth += r.entry_type === "in" ? Number(r.amount) : -Number(r.amount); });
      } else {
        const { data: mid } = await supabase.from("cash_book_entries").select("entry_type,amount").lt("date", start);
        (mid ?? []).forEach((r: any) => { openingMonth += r.entry_type === "in" ? Number(r.amount) : -Number(r.amount); });
      }
      const monthFirstOverride = (ops ?? []).find((o: any) => o.date === start);
      if (monthFirstOverride) openingMonth = Number(monthFirstOverride.opening_balance);

      // Daily closings for average
      const days = new Set<string>(); (ent ?? []).forEach((e: any) => days.add(e.date));
      const sums = new Map<string, { in: number; out: number }>();
      (ent ?? []).forEach((e: any) => {
        const c = sums.get(e.date) ?? { in: 0, out: 0 };
        if (e.entry_type === "in") c.in += Number(e.amount); else c.out += Number(e.amount);
        sums.set(e.date, c);
      });
      const opByDate = new Map<string, any>(); (ops ?? []).forEach((o: any) => opByDate.set(o.date, o));
      const sortedDays = [...days].sort();
      let carry = openingMonth;
      const closings: number[] = [];
      sortedDays.forEach((d) => {
        const op = opByDate.get(d);
        const opening = op ? Number(op.opening_balance) : carry;
        const s = sums.get(d) ?? { in: 0, out: 0 };
        const closing = opening + s.in - s.out;
        closings.push(closing);
        carry = closing;
      });
      const closingMonth = openingMonth + totalIn - totalOut;
      const avg = closings.length ? closings.reduce((a, b) => a + b, 0) / closings.length : closingMonth;
      return { openingMonth, totalIn, totalOut, closingMonth, avg, cashInHand: investment - closingMonth };
    },
  });

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);
  const handleExport = () => {
    if (!data) return;
    const header = ["Month", "Opening", "Total Cash In", "Total Cash Out", "Closing", "Cash in Hand", "Avg Daily Balance"];
    const body = [[`${fmt.months[month - 1]} ${year}`, data.openingMonth, data.totalIn, data.totalOut, data.closingMonth, data.cashInHand, Math.round(data.avg)]];
    exportCSV([header, ...body], `cash-book-monthly-${year}-${month}.csv`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>{lang === "bn" ? "বছর" : "Year"}</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{fmt.num(y)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>{lang === "bn" ? "মাস" : "Month"}</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{fmt.months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="outline" onClick={handleExport}><FileSpreadsheet className="w-4 h-4" /> CSV</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("print")}</Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden print-area">
        <div className="p-3 border-b font-semibold">
          {lang === "bn" ? "মাসিক সারসংক্ষেপ" : "Monthly Summary"} — {fmt.months[month - 1]} {fmt.num(year)}
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label={lang === "bn" ? "মাসের ওপেনিং" : "Opening"} value={fmt.bdt(data?.openingMonth ?? 0)} icon={<Wallet className="w-4 h-4" />} />
          <Stat label={lang === "bn" ? "মোট ক্যাশ ইন" : "Total Cash In"} value={fmt.bdt(data?.totalIn ?? 0)} icon={<TrendingUp className="w-4 h-4" />} accent="text-emerald-600" />
          <Stat label={lang === "bn" ? "মোট ক্যাশ আউট" : "Total Cash Out"} value={fmt.bdt(data?.totalOut ?? 0)} icon={<TrendingDown className="w-4 h-4" />} accent="text-red-600" />
          <Stat label={lang === "bn" ? "ক্লোজিং" : "Closing"} value={fmt.bdt(data?.closingMonth ?? 0)} icon={<Wallet className="w-4 h-4" />} accent="text-primary" />
          <Stat label={lang === "bn" ? "হাতে নগদ" : "Cash in Hand"} value={fmt.bdt(data?.cashInHand ?? 0)} icon={<Banknote className="w-4 h-4" />} accent="text-amber-600" />
          <Stat label={lang === "bn" ? "গড় দৈনিক ব্যালেন্স" : "Avg Daily Balance"} value={fmt.bdt(Math.round(data?.avg ?? 0))} icon={<Wallet className="w-4 h-4" />} />
        </div>
      </Card>
    </div>
  );
}
