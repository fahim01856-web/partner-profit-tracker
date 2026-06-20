import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Printer, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet,
  ArrowUp, ArrowDown, Minus, FileDown, BarChart3, Calendar, Save,
  Sparkles, Trophy, Flame, Target, Activity, CalendarDays, Zap,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, Area, AreaChart, RadialBarChart, RadialBar, PolarAngleAxis,
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

  const today = new Date();
  const [tab, setTab] = useState("add");

  const [form, setForm] = useState({
    id: null as string | null,
    date: todayStr(),
    amount: "" as string,
    note: "",
  });

  // Filters shared by history/diff/monthly tabs
  const [fMonth, setFMonth] = useState<string>(String(today.getMonth() + 1));
  const [fYear, setFYear] = useState<string>(String(today.getFullYear()));

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
      const payload = { date: form.date, amount, note: form.note || null, submitted_by: null };
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
      setForm({ id: null, date: todayStr(), amount: "", note: "" });
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

  // Asc sorted for diff calc
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

  // Filter by month/year
  const periodFiltered = useMemo(() => {
    return all.filter((d) => {
      const dt = new Date(d.date);
      if (fYear !== "all" && dt.getFullYear() !== Number(fYear)) return false;
      if (fMonth !== "all" && dt.getMonth() + 1 !== Number(fMonth)) return false;
      return true;
    });
  }, [all, fMonth, fYear]);

  // Dashboard analytics
  const tStr = todayStr();
  const yStr = ymd(new Date(Date.now() - 86400000));
  const todayDep = all.find((d) => d.date === tStr)?.amount ?? 0;
  const yestDep = all.find((d) => d.date === yStr)?.amount ?? 0;
  const todayVsYest = todayDep - yestDep;
  const todayVsYestPct = yestDep > 0 ? (todayVsYest / yestDep) * 100 : 0;

  const monthlyTotal = periodFiltered.reduce((s, d) => s + Number(d.amount), 0);
  const highest = periodFiltered.reduce<Deposit | null>((h, d) => (!h || d.amount > h.amount ? d : h), null);
  const lowest = periodFiltered.reduce<Deposit | null>((l, d) => (!l || d.amount < l.amount ? d : l), null);
  const avg = periodFiltered.length ? monthlyTotal / periodFiltered.length : 0;

  const highestEver = all.reduce<Deposit | null>((h, d) => (!h || d.amount > h.amount ? d : h), null);
  const lowestEver = all.reduce<Deposit | null>((l, d) => (!l || d.amount < l.amount ? d : l), null);

  // Chart data (asc within period)
  const chartData = useMemo(
    () =>
      [...periodFiltered]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
          date: d.date.slice(5),
          amount: Number(d.amount),
          diff: diffMap.get(d.id) ?? 0,
        })),
    [periodFiltered, diffMap],
  );

  // Yearly aggregate
  const yearlyData = useMemo(() => {
    const map = new Map<number, { total: number; days: number }>();
    all.forEach((d) => {
      const m = new Date(d.date).getMonth();
      const cur = map.get(m) ?? { total: 0, days: 0 };
      if (new Date(d.date).getFullYear() === Number(fYear === "all" ? today.getFullYear() : fYear)) {
        cur.total += Number(d.amount);
        cur.days += 1;
        map.set(m, cur);
      }
    });
    const months = lang === "bn"
      ? ["জান","ফেব","মার্চ","এপ্রি","মে","জুন","জুল","আগ","সেপ্ট","অক্টো","নভে","ডিসে"]
      : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months.map((label, i) => ({
      label,
      total: map.get(i)?.total ?? 0,
      avg: map.get(i)?.days ? (map.get(i)!.total / map.get(i)!.days) : 0,
    }));
  }, [all, fYear, lang]);

  // ===== SMART INSIGHTS =====
  const insights = useMemo(() => {
    const totalEver = all.reduce((s, d) => s + Number(d.amount), 0);
    const curY = today.getFullYear(), curM = today.getMonth();
    const inMonth = (d: Deposit, y: number, m: number) => {
      const dt = new Date(d.date);
      return dt.getFullYear() === y && dt.getMonth() === m;
    };
    const thisMonth = all.filter((d) => inMonth(d, curY, curM));
    const lastMonthDt = new Date(curY, curM - 1, 1);
    const lastMonth = all.filter((d) => inMonth(d, lastMonthDt.getFullYear(), lastMonthDt.getMonth()));
    const thisTotal = thisMonth.reduce((s, d) => s + Number(d.amount), 0);
    const lastTotal = lastMonth.reduce((s, d) => s + Number(d.amount), 0);
    const momPct = lastTotal > 0 ? ((thisTotal - lastTotal) / lastTotal) * 100 : 0;

    // Weekday performance
    const wd = [0, 1, 2, 3, 4, 5, 6].map(() => ({ total: 0, count: 0 }));
    all.forEach((d) => {
      const w = new Date(d.date).getDay();
      wd[w].total += Number(d.amount); wd[w].count += 1;
    });
    const wdNames = lang === "bn"
      ? ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"]
      : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const wdData = wd.map((x, i) => ({ day: wdNames[i], avg: x.count ? x.total / x.count : 0, total: x.total }));
    const bestWd = wdData.reduce((b, c) => (c.avg > b.avg ? c : b), wdData[0]);
    const worstWd = wdData.filter((x) => x.total > 0).reduce((b, c) => (c.avg < b.avg ? c : b), wdData.find((x) => x.total > 0) ?? wdData[0]);

    // Growth streak (consecutive growing days, asc order)
    let curStreak = 0, bestStreak = 0;
    for (let i = 1; i < ascSorted.length; i++) {
      if (ascSorted[i].amount > ascSorted[i - 1].amount) { curStreak += 1; bestStreak = Math.max(bestStreak, curStreak); }
      else curStreak = 0;
    }
    // Trailing streak from end
    let trailing = 0;
    for (let i = ascSorted.length - 1; i > 0; i--) {
      if (ascSorted[i].amount > ascSorted[i - 1].amount) trailing += 1; else break;
    }

    // Projected month total
    const todayDay = today.getDate();
    const daysInMonth = new Date(curY, curM + 1, 0).getDate();
    const dailyAvgThisMonth = thisMonth.length ? thisTotal / thisMonth.length : 0;
    const projected = dailyAvgThisMonth * daysInMonth;

    // Volatility = stddev / mean
    const amounts = all.map((d) => Number(d.amount));
    const mean = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
    const variance = amounts.length ? amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length : 0;
    const stddev = Math.sqrt(variance);
    const volatility = mean > 0 ? (stddev / mean) * 100 : 0;
    const consistency = Math.max(0, Math.min(100, 100 - volatility));

    // Median
    const sortedAmt = [...amounts].sort((a, b) => a - b);
    const median = sortedAmt.length
      ? (sortedAmt.length % 2 ? sortedAmt[(sortedAmt.length - 1) / 2]
        : (sortedAmt[sortedAmt.length / 2 - 1] + sortedAmt[sortedAmt.length / 2]) / 2)
      : 0;

    // Top 5 days
    const top5 = [...all].sort((a, b) => b.amount - a.amount).slice(0, 5);

    // Up vs down days
    let ups = 0, downs = 0, flats = 0;
    diffMap.forEach((v) => { if (v == null) return; if (v > 0) ups += 1; else if (v < 0) downs += 1; else flats += 1; });

    return {
      totalEver, thisTotal, lastTotal, momPct,
      wdData, bestWd, worstWd,
      bestStreak, trailing,
      projected, daysInMonth, todayDay, dailyAvgThisMonth,
      volatility, consistency, median,
      top5, ups, downs, flats,
    };
  }, [all, ascSorted, diffMap, lang]);


  const exportCSV = () => {
    const rows = [
      [t("date"), t("dd_amount"), t("dd_diff"), t("dd_status"), t("note")],
      ...periodFiltered.map((d) => {
        const diff = diffMap.get(d.id);
        return [
          d.date, d.amount, diff ?? "",
          diff == null ? "—" : diff > 0 ? "Increased" : diff < 0 ? "Decreased" : "Same",
          d.note ?? "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `total-deposit-${fYear}-${fMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (d: Deposit) => {
    setForm({ id: d.id, date: d.date, amount: String(d.amount), note: d.note ?? "" });
    setTab("add");
  };

  const months = lang === "bn"
    ? ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"]
    : ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const years = useMemo(() => {
    const set = new Set<number>([today.getFullYear()]);
    all.forEach((d) => set.add(new Date(d.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [all]);

  const DiffCell = ({ diff }: { diff: number | null }) => {
    if (diff == null) return <span className="text-muted-foreground">—</span>;
    if (diff === 0)
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Minus className="w-3.5 h-3.5" /> {fmt.bdt(0)}
        </span>
      );
    const up = diff > 0;
    return (
      <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
        {up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
        {up ? "+" : "-"} {fmt.bdt(Math.abs(diff))}
      </span>
    );
  };

  const StatusBadge = ({ diff }: { diff: number | null }) => {
    if (diff == null)
      return <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">—</span>;
    if (diff > 0)
      return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{t("dd_increased")}</span>;
    if (diff < 0)
      return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{t("dd_decreased")}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{t("dd_normal")}</span>;
  };

  const PctCell = ({ id, amount }: { id: string; amount: number }) => {
    const diff = diffMap.get(id);
    if (diff == null) return <span className="text-muted-foreground">—</span>;
    const prev = amount - diff;
    if (prev <= 0) return <span className="text-muted-foreground">—</span>;
    const pct = (diff / prev) * 100;
    const up = pct >= 0;
    return (
      <span className={`font-medium ${up ? "text-emerald-600" : "text-red-600"}`}>
        {up ? "+" : ""}{pct.toFixed(2)}%
      </span>
    );
  };

  const FiltersBar = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      <div className="flex items-end gap-2">
        <Button variant="outline" className="w-full" onClick={() => { setFMonth(String(today.getMonth() + 1)); setFYear(String(today.getFullYear())); }}>
          {t("dd_clear")}
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <Button variant="outline" className="w-full" onClick={exportCSV}>
          <FileDown className="w-4 h-4" /> CSV
        </Button>
      </div>
    </div>
  );

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
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> {t("print")}
          </Button>
        </div>
      </div>

      {/* ===== GORGEOUS HERO BANNER ===== */}
      <Card className="relative overflow-hidden border-0 text-white shadow-xl no-print"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, #6366f1 50%, #8b5cf6 100%)" }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.3) 0, transparent 40%)",
        }} />
        <div className="relative p-5 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
              <Sparkles className="w-4 h-4" /> {lang === "bn" ? "মোট ডিপোজিট পজিশন" : "Total Deposit Position"}
            </div>
            <div className="text-3xl md:text-5xl font-extrabold mt-2 tracking-tight">{fmt.bdt(insights.totalEver)}</div>
            <div className="text-xs opacity-90 mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> {fmt.num(all.length)} {lang === "bn" ? "এন্ট্রি" : "entries"}</span>
              <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" /> {fmt.num(insights.trailing)} {lang === "bn" ? "দিন বৃদ্ধি" : "day growth streak"}</span>
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider opacity-90">{lang === "bn" ? "এই মাস" : "This Month"}</div>
            <div className="text-xl font-bold mt-1">{fmt.bdt(insights.thisTotal)}</div>
            <div className={`text-[11px] mt-1 inline-flex items-center gap-1 ${insights.momPct >= 0 ? "" : ""}`}>
              {insights.momPct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(insights.momPct).toFixed(1)}% {lang === "bn" ? "vs গত মাস" : "vs last month"}
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider opacity-90 inline-flex items-center gap-1"><Target className="w-3 h-3" /> {lang === "bn" ? "প্রজেকশন" : "Projection"}</div>
            <div className="text-xl font-bold mt-1">{fmt.bdt(insights.projected)}</div>
            <div className="text-[11px] opacity-90 mt-1">{fmt.num(insights.todayDay)}/{fmt.num(insights.daysInMonth)} {lang === "bn" ? "দিন" : "days"}</div>
          </div>
        </div>
      </Card>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <StatCard label={t("dd_today")} value={fmt.bdt(todayDep)} icon={<Calendar className="w-4 h-4" />} accent="text-primary" />
        <StatCard label={t("dd_yesterday")} value={fmt.bdt(yestDep)} icon={<Calendar className="w-4 h-4" />} />
        <StatCard
          label={t("dd_diff_today")}
          value={`${todayVsYest >= 0 ? "+" : "-"} ${fmt.bdt(Math.abs(todayVsYest))}`}
          icon={todayVsYest >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          accent={todayVsYest >= 0 ? "text-emerald-600" : "text-red-600"}
          sub={yestDep > 0 ? `${todayVsYestPct >= 0 ? "+" : ""}${todayVsYestPct.toFixed(2)}%` : ""}
        />
        <StatCard label={t("dd_highest_ever")} value={fmt.bdt(highestEver?.amount ?? 0)} sub={highestEver?.date ?? ""} icon={<TrendingUp className="w-4 h-4" />} accent="text-emerald-600" />
        <StatCard label={t("dd_lowest_ever")} value={fmt.bdt(lowestEver?.amount ?? 0)} sub={lowestEver?.date ?? ""} icon={<TrendingDown className="w-4 h-4" />} accent="text-red-600" />
        <StatCard label={t("dd_avg_daily")} value={fmt.bdt(avg)} icon={<BarChart3 className="w-4 h-4" />} accent="text-primary" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="no-print">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="add">{t("dd_tab_add")}</TabsTrigger>
          <TabsTrigger value="history">{t("dd_tab_history")}</TabsTrigger>
          <TabsTrigger value="diff">{t("dd_tab_diff")}</TabsTrigger>
          <TabsTrigger value="monthly">{t("dd_tab_monthly")}</TabsTrigger>
          <TabsTrigger value="yearly">{t("dd_tab_yearly")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("dd_tab_analytics")}</TabsTrigger>
          <TabsTrigger value="insights"><Sparkles className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "স্মার্ট ইনসাইট" : "Smart Insights"}</TabsTrigger>
          <TabsTrigger value="print">{t("dd_tab_print")}</TabsTrigger>
        </TabsList>


        {/* ADD */}
        <TabsContent value="add" className="mt-4">
          <Card className="p-5 max-w-2xl">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              {form.id ? t("edit") : t("dd_tab_add")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{t("date")}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>{t("dd_amount")} (৳)</Label>
                <Input type="number" step="0.01" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>{t("note")} ({lang === "bn" ? "ঐচ্ছিক" : "Optional"})</Label>
                <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              {form.id && (
                <Button variant="outline" onClick={() => setForm({ id: null, date: todayStr(), amount: "", note: "" })}>
                  {t("cancel")}
                </Button>
              )}
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="w-4 h-4" /> {t("save")}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <Card className="p-4"><FiltersBar /></Card>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">{t("dd_amount")}</TableHead>
                    <TableHead>{t("note")}</TableHead>
                    <TableHead className="text-right">{t("edit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodFiltered.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("noEntries")}</TableCell></TableRow>
                  )}
                  {periodFiltered.map((d, i) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmt.num(i + 1)}</TableCell>
                      <TableCell>{fmt.date(d.date)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt.bdt(d.amount)}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{d.note || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(d.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* DIFFERENCE REPORT */}
        <TabsContent value="diff" className="mt-4 space-y-4">
          <Card className="p-4"><FiltersBar /></Card>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">{t("dd_amount")}</TableHead>
                    <TableHead className="text-right">{t("dd_diff")}</TableHead>
                    <TableHead className="text-right">{t("dd_pct_change")}</TableHead>
                    <TableHead>{t("dd_status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodFiltered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noEntries")}</TableCell></TableRow>
                  )}
                  {periodFiltered.map((d, i) => {
                    const diff = diffMap.get(d.id) ?? null;
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{fmt.num(i + 1)}</TableCell>
                        <TableCell>{fmt.date(d.date)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt.bdt(d.amount)}</TableCell>
                        <TableCell className="text-right"><DiffCell diff={diff} /></TableCell>
                        <TableCell className="text-right"><PctCell id={d.id} amount={d.amount} /></TableCell>
                        <TableCell><StatusBadge diff={diff} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* MONTHLY REPORT */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          <Card className="p-4"><FiltersBar /></Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={t("dd_monthly_total")} value={fmt.bdt(monthlyTotal)} accent="text-primary" icon={<BarChart3 className="w-4 h-4" />} />
            <StatCard label={t("dd_avg_daily")} value={fmt.bdt(avg)} />
            <StatCard label={t("dd_highest")} value={fmt.bdt(highest?.amount ?? 0)} sub={highest?.date ?? ""} accent="text-emerald-600" />
            <StatCard label={t("dd_lowest")} value={fmt.bdt(lowest?.amount ?? 0)} sub={lowest?.date ?? ""} accent="text-red-600" />
          </div>
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> {t("dd_chart_trend")}</h3>
            <ClientOnly fallback={<div className="h-64" />}>
              <ResponsiveContainer width="100%" height={280}>
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
        </TabsContent>

        {/* YEARLY REPORT */}
        <TabsContent value="yearly" className="mt-4 space-y-4">
          <Card className="p-4"><FiltersBar /></Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-3">{t("dd_tab_yearly")} — {fmt.num(Number(fYear === "all" ? today.getFullYear() : fYear))}</h3>
            <ClientOnly fallback={<div className="h-64" />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => fmt.bdt(Number(v))} />
                  <Legend />
                  <Bar dataKey="total" name={t("dd_total")} fill="hsl(var(--primary))" />
                  <Bar dataKey="avg" name={t("dd_avg")} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </Card>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dd_filter_month")}</TableHead>
                    <TableHead className="text-right">{t("dd_total")}</TableHead>
                    <TableHead className="text-right">{t("dd_avg")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearlyData.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt.bdt(r.total)}</TableCell>
                      <TableCell className="text-right">{fmt.bdt(r.avg)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <Card className="p-4"><FiltersBar /></Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> {t("dd_chart_trend")}</h3>
              <ClientOnly fallback={<div className="h-64" />}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt.bdt(Number(v))} />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
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
                    <Bar dataKey="diff">
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.diff >= 0 ? "#10b981" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </Card>
          </div>
        </TabsContent>

        {/* PRINT */}
        {/* SMART INSIGHTS */}
        <TabsContent value="insights" className="mt-4 space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <GradientStat icon={<Flame className="w-4 h-4" />} label={lang === "bn" ? "বর্তমান স্ট্রিক" : "Current Streak"} value={`${fmt.num(insights.trailing)} ${lang === "bn" ? "দিন" : "days"}`} from="#f97316" to="#ef4444" />
            <GradientStat icon={<Trophy className="w-4 h-4" />} label={lang === "bn" ? "সেরা স্ট্রিক" : "Best Streak"} value={`${fmt.num(insights.bestStreak)} ${lang === "bn" ? "দিন" : "days"}`} from="#eab308" to="#f59e0b" />
            <GradientStat icon={<Zap className="w-4 h-4" />} label={lang === "bn" ? "কনসিস্টেন্সি" : "Consistency"} value={`${insights.consistency.toFixed(0)}%`} from="#10b981" to="#06b6d4" />
            <GradientStat icon={<Activity className="w-4 h-4" />} label={lang === "bn" ? "মিডিয়ান" : "Median"} value={fmt.bdt(insights.median)} from="#8b5cf6" to="#ec4899" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekday performance */}
            <Card className="p-4 lg:col-span-2">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />{lang === "bn" ? "সাপ্তাহিক পারফরমেন্স" : "Weekday Performance (Avg)"}</h3>
              <ClientOnly fallback={<div className="h-64" />}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={insights.wdData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt.bdt(Number(v))} />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {insights.wdData.map((d, i) => (
                        <Cell key={i} fill={d.day === insights.bestWd.day ? "#10b981" : d.day === insights.worstWd.day ? "#ef4444" : "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="p-2 rounded bg-emerald-50 text-emerald-700">
                  <Trophy className="w-3 h-3 inline mr-1" />{lang === "bn" ? "সেরা দিন:" : "Best:"} <b>{insights.bestWd.day}</b> · {fmt.bdt(insights.bestWd.avg)}
                </div>
                <div className="p-2 rounded bg-red-50 text-red-700">
                  <TrendingDown className="w-3 h-3 inline mr-1" />{lang === "bn" ? "দুর্বল দিন:" : "Weakest:"} <b>{insights.worstWd.day}</b> · {fmt.bdt(insights.worstWd.avg)}
                </div>
              </div>
            </Card>

            {/* Consistency gauge */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />{lang === "bn" ? "ধারাবাহিকতা স্কোর" : "Consistency Score"}</h3>
              <ClientOnly fallback={<div className="h-64" />}>
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart innerRadius="65%" outerRadius="100%" data={[{ name: "x", value: insights.consistency, fill: insights.consistency > 70 ? "#10b981" : insights.consistency > 40 ? "#f59e0b" : "#ef4444" }]} startAngle={210} endAngle={-30}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={20} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </ClientOnly>
              <div className="text-center -mt-24 mb-16">
                <div className="text-3xl font-extrabold">{insights.consistency.toFixed(0)}<span className="text-sm">%</span></div>
                <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "ভোলাটিলিটি" : "Volatility"} {insights.volatility.toFixed(1)}%</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cumulative deposit area */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />{lang === "bn" ? "ক্রমবর্ধমান ডিপোজিট" : "Cumulative Deposit"}</h3>
              <ClientOnly fallback={<div className="h-64" />}>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={(() => {
                    let cum = 0;
                    return ascSorted.slice(-60).map((d) => { cum += Number(d.amount); return { date: d.date.slice(5), cum }; });
                  })()}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => fmt.bdt(Number(v))} />
                    <Area type="monotone" dataKey="cum" stroke="hsl(var(--primary))" fill="url(#cumGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ClientOnly>
            </Card>

            {/* Top 5 days */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" />{lang === "bn" ? "সেরা ৫ দিন" : "Top 5 Days"}</h3>
              <div className="space-y-2">
                {insights.top5.map((d, i) => {
                  const max = insights.top5[0]?.amount || 1;
                  const pct = (Number(d.amount) / max) * 100;
                  const medals = ["🥇", "🥈", "🥉", "4", "5"];
                  return (
                    <div key={d.id} className="flex items-center gap-3">
                      <div className="w-7 text-center text-lg">{medals[i]}</div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{fmt.date(d.date)}</span>
                          <span className="font-bold">{fmt.bdt(d.amount)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #f59e0b, #ef4444)" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {insights.top5.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">{t("noEntries")}</div>}
              </div>
            </Card>
          </div>

          {/* Up/Down/Flat days summary */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />{lang === "bn" ? "দৈনিক পরিবর্তনের বিশ্লেষণ" : "Daily Movement Analysis"}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20">
                <div className="text-xs text-emerald-700 flex items-center gap-1"><ArrowUp className="w-3 h-3" />{lang === "bn" ? "বৃদ্ধির দিন" : "Up Days"}</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">{fmt.num(insights.ups)}</div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20">
                <div className="text-xs text-red-700 flex items-center gap-1"><ArrowDown className="w-3 h-3" />{lang === "bn" ? "কমে যাওয়া" : "Down Days"}</div>
                <div className="text-2xl font-bold text-red-600 mt-1">{fmt.num(insights.downs)}</div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-muted to-transparent border">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" />{lang === "bn" ? "অপরিবর্তিত" : "Flat"}</div>
                <div className="text-2xl font-bold mt-1">{fmt.num(insights.flats)}</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="print" className="mt-4 space-y-4">

          <Card className="p-4"><FiltersBar /></Card>
          <div className="flex gap-2">
            <Button onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("print")} (PDF)</Button>
            <Button variant="outline" onClick={exportCSV}><FileDown className="w-4 h-4" /> Excel/CSV</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Printable section (always rendered for print) */}
      <Card className="p-0 overflow-hidden print:shadow-none print:border-0 print-area hidden print:block">
        <div className="p-6 text-center border-b">
          <h1 className="text-xl font-bold">{t("bankName")}</h1>
          <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          <h2 className="text-lg font-semibold mt-2">{t("dd_title")}</h2>
          <div className="text-sm text-muted-foreground">
            {fMonth !== "all" ? months[Number(fMonth) - 1] : t("dd_all")} {fYear !== "all" ? fmt.num(Number(fYear)) : ""}
          </div>
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
                <TableHead>{t("note")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodFiltered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noEntries")}</TableCell></TableRow>
              )}
              {periodFiltered.map((d, i) => {
                const diff = diffMap.get(d.id) ?? null;
                return (
                  <TableRow key={d.id}>
                    <TableCell>{fmt.num(i + 1)}</TableCell>
                    <TableCell>{fmt.date(d.date)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt.bdt(d.amount)}</TableCell>
                    <TableCell className="text-right"><DiffCell diff={diff} /></TableCell>
                    <TableCell><StatusBadge diff={diff} /></TableCell>
                    <TableCell className="max-w-[200px] truncate">{d.note || "—"}</TableCell>
                  </TableRow>
                );
              })}
              {periodFiltered.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2}>{t("dd_total")}</TableCell>
                  <TableCell className="text-right">{fmt.bdt(monthlyTotal)}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function GradientStat({ icon, label, value, from, to }: { icon: React.ReactNode; label: string; value: string; from: string; to: string }) {
  return (
    <Card className="p-3 text-white border-0 shadow-md relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <div className="text-[11px] uppercase tracking-wider opacity-90 flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-xl font-extrabold mt-1">{value}</div>
    </Card>
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
