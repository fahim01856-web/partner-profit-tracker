import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Printer, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, Calendar,
  ArrowUp, ArrowDown, Minus, FileDown, BarChart3,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/daily-deposit")({ component: DailyDepositPage });

type Deposit = {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  submitted_by: string | null;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function DailyDepositPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    id: null as string | null,
    date: todayStr(),
    amount: "" as string,
    note: "",
    submitted_by: "",
  });
  const [showForm, setShowForm] = useState(false);

  // Filters
  const today = new Date();
  const [fMonth, setFMonth] = useState<string>(String(today.getMonth() + 1));
  const [fYear, setFYear] = useState<string>(String(today.getFullYear()));
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const { data: all = [] } = useQuery({
    queryKey: ["daily_deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_deposits")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Deposit[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount || 0);
      if (!form.date) throw new Error("Date required");
      if (amount < 0) throw new Error("Invalid amount");
      const payload = {
        date: form.date,
        amount,
        note: form.note || null,
        submitted_by: form.submitted_by || null,
      };
      if (form.id) {
        const { error } = await supabase.from("daily_deposits").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("daily_deposits").upsert(payload, { onConflict: "date" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_deposits"] });
      toast.success(t("dd_saved"));
      setForm({ id: null, date: todayStr(), amount: "", note: "", submitted_by: "" });
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_deposits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_deposits"] });
      toast.success(t("deleted"));
    },
  });

  // Sorted ascending by date for diff calc
  const ascSorted = useMemo(
    () => [...all].sort((a, b) => a.date.localeCompare(b.date)),
    [all],
  );

  const diffMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (let i = 0; i < ascSorted.length; i++) {
      m.set(ascSorted[i].id, i === 0 ? null : ascSorted[i].amount - ascSorted[i - 1].amount);
    }
    return m;
  }, [ascSorted]);

  // Apply filters
  const filtered = useMemo(() => {
    return all.filter((d) => {
      if (fFrom && d.date < fFrom) return false;
      if (fTo && d.date > fTo) return false;
      const dt = new Date(d.date);
      if (!fFrom && !fTo) {
        if (fYear !== "all" && dt.getFullYear() !== Number(fYear)) return false;
        if (fMonth !== "all" && dt.getMonth() + 1 !== Number(fMonth)) return false;
      }
      return true;
    });
  }, [all, fMonth, fYear, fFrom, fTo]);

  // Dashboard analytics
  const tStr = todayStr();
  const yStr = ymd(new Date(Date.now() - 86400000));
  const todayDep = all.find((d) => d.date === tStr)?.amount ?? 0;
  const yestDep = all.find((d) => d.date === yStr)?.amount ?? 0;
  const todayVsYest = todayDep - yestDep;
  const todayVsYestPct = yestDep > 0 ? (todayVsYest / yestDep) * 100 : 0;

  const monthFiltered = useMemo(
    () =>
      all.filter((d) => {
        const dt = new Date(d.date);
        return (
          dt.getFullYear() === Number(fYear === "all" ? today.getFullYear() : fYear) &&
          (fMonth === "all" || dt.getMonth() + 1 === Number(fMonth))
        );
      }),
    [all, fMonth, fYear],
  );

  const monthlyTotal = monthFiltered.reduce((s, d) => s + Number(d.amount), 0);
  const highest = monthFiltered.reduce<Deposit | null>((h, d) => (!h || d.amount > h.amount ? d : h), null);
  const lowest = monthFiltered.reduce<Deposit | null>((l, d) => (!l || d.amount < l.amount ? d : l), null);
  const avg = monthFiltered.length ? monthlyTotal / monthFiltered.length : 0;

  // Chart data (chronological)
  const chartData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
          date: d.date.slice(5),
          amount: Number(d.amount),
          diff: diffMap.get(d.id) ?? 0,
        })),
    [filtered, diffMap],
  );

  const exportCSV = () => {
    const rows = [
      [t("date"), t("dd_amount"), t("dd_diff"), t("dd_status"), t("note"), t("dd_submitted_by")],
      ...filtered.map((d) => {
        const diff = diffMap.get(d.id);
        return [
          d.date,
          d.amount,
          diff ?? "",
          diff == null ? "Normal" : diff > 0 ? "Increased" : diff < 0 ? "Decreased" : "Same",
          d.note ?? "",
          d.submitted_by ?? "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-deposit-${fYear}-${fMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (d: Deposit) => {
    setForm({
      id: d.id,
      date: d.date,
      amount: String(d.amount),
      note: d.note ?? "",
      submitted_by: d.submitted_by ?? "",
    });
    setShowForm(true);
  };

  const months = lang === "bn"
    ? ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"]
    : ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const years = useMemo(() => {
    const set = new Set<number>([today.getFullYear()]);
    all.forEach((d) => set.add(new Date(d.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [all]);

  const DiffBadge = ({ diff }: { diff: number | null }) => {
    if (diff == null) return <span className="text-muted-foreground">—</span>;
    if (diff === 0)
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Minus className="w-3.5 h-3.5" /> {fmt.bdt(0)}
        </span>
      );
    const up = diff > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}
      >
        {up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
        {up ? "+" : "-"} {fmt.bdt(Math.abs(diff))}
      </span>
    );
  };

  const StatusBadge = ({ diff }: { diff: number | null }) => {
    if (diff == null)
      return <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{t("dd_normal")}</span>;
    if (diff > 0)
      return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{t("dd_increased")}</span>;
    if (diff < 0)
      return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{t("dd_decreased")}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{t("dd_normal")}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> {t("dd_title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("dd_sub")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <FileDown className="w-4 h-4" /> {t("eatt_export_csv")}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> {t("print")}
          </Button>
          <Button onClick={() => { setForm({ id: null, date: todayStr(), amount: "", note: "", submitted_by: "" }); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> {t("dd_new")}
          </Button>
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <StatCard label={t("dd_today")} value={fmt.bdt(todayDep)} icon={<Calendar className="w-4 h-4" />} accent="text-primary" />
        <StatCard label={t("dd_yesterday")} value={fmt.bdt(yestDep)} icon={<Calendar className="w-4 h-4" />} />
        <StatCard
          label={t("dd_diff_today")}
          value={`${todayVsYest >= 0 ? "+" : "-"} ${fmt.bdt(Math.abs(todayVsYest))}`}
          icon={todayVsYest >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          accent={todayVsYest >= 0 ? "text-emerald-600" : "text-red-600"}
          sub={yestDep > 0 ? `${todayVsYestPct >= 0 ? "+" : ""}${todayVsYestPct.toFixed(1)}%` : ""}
        />
        <StatCard label={t("dd_monthly_total")} value={fmt.bdt(monthlyTotal)} icon={<BarChart3 className="w-4 h-4" />} accent="text-primary" />
        <StatCard label={t("dd_highest")} value={fmt.bdt(highest?.amount ?? 0)} sub={highest?.date ?? ""} icon={<TrendingUp className="w-4 h-4" />} accent="text-emerald-600" />
        <StatCard label={t("dd_lowest")} value={fmt.bdt(lowest?.amount ?? 0)} sub={lowest?.date ?? ""} icon={<TrendingDown className="w-4 h-4" />} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 no-print">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">{t("dd_avg_daily")}</div>
          <div className="text-2xl font-bold text-primary">{fmt.bdt(avg)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">{t("dd_entries_count")}</div>
          <div className="text-2xl font-bold">{fmt.num(monthFiltered.length)}</div>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-5 no-print">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{form.id ? t("edit") : t("dd_new")}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>✕</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>{t("date")}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>{t("dd_amount")}</Label>
              <Input type="number" step="0.01" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>{t("dd_submitted_by")}</Label>
              <Input value={form.submitted_by} onChange={(e) => setForm({ ...form, submitted_by: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("note")}</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t("delete")}</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Wallet className="w-4 h-4" /> {t("save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 no-print">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label>{t("dd_filter_month")}</Label>
            <Select value={fMonth} onValueChange={setFMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dd_all")}</SelectItem>
                {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("dd_filter_year")}</Label>
            <Select value={fYear} onValueChange={setFYear}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dd_all")}</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{fmt.num(y)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("dd_from")}</Label>
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("dd_to")}</Label>
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => { setFFrom(""); setFTo(""); setFMonth("all"); setFYear("all"); }}>
              {t("dd_clear")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> {t("dd_chart_trend")}</h3>
          <ClientOnly fallback={<div className="h-64" />}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt.bdt(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="amount" name={t("dd_amount")} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> {t("dd_chart_diff")}</h3>
          <ClientOnly fallback={<div className="h-64" />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmt.bdt(Number(v))} />
                <Bar dataKey="diff" name={t("dd_diff")}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.diff >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </Card>
      </div>

      {/* Report table - printable */}
      <Card className="p-0 overflow-hidden">
        <div className="hidden print:block p-6 text-center border-b">
          <h1 className="text-xl font-bold">{t("bankName")}</h1>
          <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          <h2 className="text-lg font-semibold mt-2">{t("dd_title")}</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead className="text-right">{t("dd_amount")}</TableHead>
                <TableHead className="text-right">{t("dd_diff")}</TableHead>
                <TableHead>{t("dd_status")}</TableHead>
                <TableHead>{t("dd_submitted_by")}</TableHead>
                <TableHead>{t("note")}</TableHead>
                <TableHead className="text-right no-print">{t("edit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("noEntries")}</TableCell></TableRow>
              )}
              {filtered.map((d, i) => {
                const diff = diffMap.get(d.id) ?? null;
                return (
                  <TableRow key={d.id}>
                    <TableCell>{fmt.num(i + 1)}</TableCell>
                    <TableCell>{fmt.date(d.date)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt.bdt(d.amount)}</TableCell>
                    <TableCell className="text-right"><DiffBadge diff={diff} /></TableCell>
                    <TableCell><StatusBadge diff={diff} /></TableCell>
                    <TableCell>{d.submitted_by || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{d.note || "—"}</TableCell>
                    <TableCell className="text-right no-print">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(d.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub, icon, accent = "" }: { label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className={`text-lg font-bold mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

// Need Cell import for bar coloring
import { Cell } from "recharts";
