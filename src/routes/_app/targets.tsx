import { createFileRoute, ClientOnly } from "@tanstack/react-router";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useFmt } from "@/lib/format";
import { toast } from "sonner";
import { Target, Plus, Trash2, Printer, Trophy, TrendingUp, Award, Pencil, X, Download, AlertTriangle, CheckCircle2, Calendar as CalendarIcon, Zap, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_app/targets")({ component: TargetsPage });

const CATEGORIES = [
  { id: "new_account", bn: "নতুন অ্যাকাউন্ট খোলা", en: "New Account Opening" },
  { id: "dps", bn: "DPS সংগ্রহ", en: "DPS Collection" },
  { id: "deposit", bn: "ডিপোজিট সংগ্রহ", en: "Deposit Collection" },
  { id: "loan_recovery", bn: "ঋণ আদায়", en: "Loan Recovery" },
  { id: "remittance", bn: "রেমিট্যান্স", en: "Remittance" },
  { id: "cash_deposit", bn: "ক্যাশ জমা", en: "Cash Deposit" },
  { id: "cash_withdrawal", bn: "ক্যাশ উত্তোলন", en: "Cash Withdrawal" },
  { id: "card_issue", bn: "কার্ড ইস্যু", en: "Card Issue" },
  { id: "check_book", bn: "চেক বই বিতরণ", en: "Check Book Delivery" },
  { id: "mobile_banking", bn: "মোবাইল ব্যাংকিং রেজি.", en: "Mobile Banking Reg." },
];

const ACCOUNT_TYPES = ["AWCA", "MSA", "MSSA", "MTDR", "MMPDSA", "SMS", "Farmers", "MHSA"];

const MONTHS_BN = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type TargetRow = { id: string; month: number; year: number; staff_name: string; target_category: string; account_type: string | null; target_amount: number; target_quantity: number; notes: string | null };
type Achievement = { id: string; date: string; staff_name: string; achievement_category: string; account_type: string | null; amount: number; quantity: number; remarks: string | null };

function TargetsPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: targets = [] } = useQuery({
    queryKey: ["monthly_targets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_targets" as any).select("*").order("year", { ascending: false }).order("month", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TargetRow[];
    },
  });
  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("achievements" as any).select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Achievement[];
    },
  });

  // -- Target form (insert + edit)
  const [tf, setTf] = useState({ month, year, staff_name: "", target_category: CATEGORIES[0].id, account_type: "", target_amount: 0, target_quantity: 0, notes: "" });
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const resetTf = () => { setTf({ month, year, staff_name: "", target_category: CATEGORIES[0].id, account_type: "", target_amount: 0, target_quantity: 0, notes: "" }); setEditTargetId(null); };
  const saveTarget = useMutation({
    mutationFn: async () => {
      if (!tf.staff_name) throw new Error(lang === "bn" ? "স্টাফ নাম দিন" : "Staff name required");
      const payload = { ...tf, account_type: tf.target_category === "new_account" ? (tf.account_type || null) : null };
      if (editTargetId) {
        const { error } = await supabase.from("monthly_targets" as any).update(payload).eq("id", editTargetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_targets" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monthly_targets"] }); toast.success(editTargetId ? t("updated") : (lang === "bn" ? "টার্গেট সেট হয়েছে" : "Target set")); resetTf(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delTarget = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("monthly_targets" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly_targets"] }),
  });
  const startEditTarget = (r: TargetRow) => {
    setEditTargetId(r.id);
    setTf({ month: r.month, year: r.year, staff_name: r.staff_name, target_category: r.target_category, account_type: r.account_type ?? "", target_amount: Number(r.target_amount), target_quantity: Number(r.target_quantity), notes: r.notes ?? "" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onDelTarget = (id: string) => { if (window.confirm(t("confirm_delete"))) delTarget.mutate(id); };

  // -- Achievement form (insert + edit)
  const [af, setAf] = useState({ date: new Date().toISOString().slice(0, 10), staff_name: "", achievement_category: CATEGORIES[0].id, account_type: "", amount: 0, quantity: 0, remarks: "" });
  const [editAchId, setEditAchId] = useState<string | null>(null);
  const resetAf = () => { setAf({ date: new Date().toISOString().slice(0, 10), staff_name: "", achievement_category: CATEGORIES[0].id, account_type: "", amount: 0, quantity: 0, remarks: "" }); setEditAchId(null); };
  const saveAch = useMutation({
    mutationFn: async () => {
      if (!af.staff_name) throw new Error(lang === "bn" ? "স্টাফ নাম দিন" : "Staff name required");
      const payload = { ...af, account_type: af.achievement_category === "new_account" ? (af.account_type || null) : null };
      if (editAchId) {
        const { error } = await supabase.from("achievements" as any).update(payload).eq("id", editAchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("achievements" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["achievements"] }); toast.success(editAchId ? t("updated") : (lang === "bn" ? "অর্জন এন্ট্রি হয়েছে" : "Achievement saved")); resetAf(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delAch = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("achievements" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["achievements"] }),
  });
  const startEditAch = (r: Achievement) => {
    setEditAchId(r.id);
    setAf({ date: r.date, staff_name: r.staff_name, achievement_category: r.achievement_category, account_type: r.account_type ?? "", amount: Number(r.amount), quantity: Number(r.quantity), remarks: r.remarks ?? "" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onDelAch = (id: string) => { if (window.confirm(t("confirm_delete"))) delAch.mutate(id); };

  // -- Compute progress per category for selected month/year
  const progress = useMemo(() => {
    const monthTargets = targets.filter((t) => t.year === year && t.month === month);
    const monthAch = achievements.filter((a) => { const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() + 1 === month; });
    return CATEGORIES.map((c) => {
      const tg = monthTargets.filter((t) => t.target_category === c.id).reduce((s, t) => ({ amount: s.amount + Number(t.target_amount), qty: s.qty + Number(t.target_quantity) }), { amount: 0, qty: 0 });
      const ac = monthAch.filter((a) => a.achievement_category === c.id).reduce((s, a) => ({ amount: s.amount + Number(a.amount), qty: s.qty + Number(a.quantity) }), { amount: 0, qty: 0 });
      const pct = tg.amount > 0 ? Math.min(100, (ac.amount / tg.amount) * 100) : tg.qty > 0 ? Math.min(100, (ac.qty / tg.qty) * 100) : 0;
      return { ...c, tg, ac, pct };
    });
  }, [targets, achievements, year, month]);

  // -- Staff ranking
  const ranking = useMemo(() => {
    const monthAch = achievements.filter((a) => { const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() + 1 === month; });
    const map: Record<string, { amount: number; qty: number; count: number }> = {};
    for (const a of monthAch) {
      if (!map[a.staff_name]) map[a.staff_name] = { amount: 0, qty: 0, count: 0 };
      map[a.staff_name].amount += Number(a.amount);
      map[a.staff_name].qty += Number(a.quantity);
      map[a.staff_name].count++;
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v, score: v.amount + v.qty * 1000 })).sort((a, b) => b.score - a.score);
  }, [achievements, year, month]);

  // -- Yearly chart
  const yearlyChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const tg = targets.filter((t) => t.year === year && t.month === m).reduce((s, t) => s + Number(t.target_amount), 0);
      const ac = achievements.filter((a) => { const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() + 1 === m; }).reduce((s, a) => s + Number(a.amount), 0);
      return { month: lang === "bn" ? MONTHS_BN[i] : MONTHS_EN[i], target: tg, achievement: ac };
    });
  }, [targets, achievements, year, lang]);

  const totalTarget = progress.reduce((s, p) => s + p.tg.amount, 0);
  const totalAch = progress.reduce((s, p) => s + p.ac.amount, 0);

  // --- Smart metrics ---
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const dayOfMonth = isCurrentMonth ? todayDate.getDate() : daysInMonth;
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);
  const monthProgressPct = (dayOfMonth / daysInMonth) * 100;
  const overallPct = totalTarget > 0 ? (totalAch / totalTarget) * 100 : 0;
  const forecast = isCurrentMonth && dayOfMonth > 0 ? (totalAch / dayOfMonth) * daysInMonth : totalAch;
  const requiredPace = daysLeft > 0 ? Math.max(0, (totalTarget - totalAch) / daysLeft) : 0;
  const gap = Math.max(0, totalTarget - totalAch);

  const onTrackCount = progress.filter((p) => p.tg.amount > 0 && p.pct >= monthProgressPct - 5).length;
  const atRiskCount = progress.filter((p) => p.tg.amount > 0 && p.pct < monthProgressPct - 15).length;
  const achievedCount = progress.filter((p) => p.tg.amount > 0 && p.pct >= 100).length;
  const activeCatCount = progress.filter((p) => p.tg.amount > 0 || p.tg.qty > 0).length;

  // Previous month for MoM comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTotalAch = useMemo(() => achievements.filter((a) => { const d = new Date(a.date); return d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth; }).reduce((s, a) => s + Number(a.amount), 0), [achievements, prevMonth, prevYear]);
  const momGrowth = prevTotalAch > 0 ? ((totalAch - prevTotalAch) / prevTotalAch) * 100 : 0;

  // Daily trend (cumulative achievement vs straight-line target)
  const dailyTrend = useMemo(() => {
    const arr: { day: number; cum: number; pace: number }[] = [];
    let cum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cum += achievements.filter((a) => a.date === dayStr).reduce((s, a) => s + Number(a.amount), 0);
      arr.push({ day: d, cum, pace: (totalTarget / daysInMonth) * d });
    }
    return arr;
  }, [achievements, year, month, daysInMonth, totalTarget]);

  // Staff x Category heatmap data
  const staffCatMatrix = useMemo(() => {
    const monthAch = achievements.filter((a) => { const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() + 1 === month; });
    const staffs = Array.from(new Set(monthAch.map((a) => a.staff_name)));
    return staffs.map((s) => {
      const row: any = { staff: s };
      let total = 0;
      CATEGORIES.forEach((c) => {
        const v = monthAch.filter((a) => a.staff_name === s && a.achievement_category === c.id).reduce((sum, a) => sum + Number(a.amount), 0);
        row[c.id] = v; total += v;
      });
      row._total = total;
      return row;
    }).sort((a, b) => b._total - a._total);
  }, [achievements, year, month]);

  const pieData = progress.filter((p) => p.ac.amount > 0).map((p) => ({ name: lang === "bn" ? p.bn : p.en, value: p.ac.amount }));
  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

  function exportCSV() {
    const headers = ["Category", "Target Amount", "Achieved Amount", "Gap", "Achievement %", "Target Qty", "Achieved Qty"];
    const rows = progress.map((p) => [lang === "bn" ? p.bn : p.en, p.tg.amount, p.ac.amount, Math.max(0, p.tg.amount - p.ac.amount), Math.round(p.pct), p.tg.qty, p.ac.qty]);
    rows.push(["TOTAL", totalTarget, totalAch, gap, Math.round(overallPct), 0, 0]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `target_${MONTHS_EN[month - 1]}_${year}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const lbl = (c: typeof CATEGORIES[number]) => (lang === "bn" ? c.bn : c.en);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Target className="w-7 h-7 text-primary" />{lang === "bn" ? "মাসিক টার্গেট ও অর্জন" : "Monthly Target & Achievement"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "টার্গেট সেট করুন, অর্জন এন্ট্রি দিন, প্রগ্রেস দেখুন ও প্রিন্ট করুন" : "Set targets, log achievements, track progress & print"}</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
        </div>
      </div>

      <div className="flex gap-2 no-print">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS_EN.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{lang === "bn" ? MONTHS_BN[i] : m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Smart KPI Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "মোট টার্গেট" : "Total Target"}</div><div className="text-lg font-bold">৳{fmt.num(totalTarget)}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "অর্জন" : "Achieved"}</div><div className="text-lg font-bold text-green-600">৳{fmt.num(totalAch)}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "অবশিষ্ট" : "Gap"}</div><div className="text-lg font-bold text-orange-600">৳{fmt.num(gap)}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "অর্জন %" : "Achievement"}</div><div className={`text-lg font-bold ${overallPct >= 100 ? "text-green-600" : overallPct >= monthProgressPct ? "text-blue-600" : "text-red-600"}`}>{Math.round(overallPct)}%</div><Progress value={Math.min(100, overallPct)} className="h-1 mt-1" /></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground"><CalendarIcon className="w-3 h-3 inline" /> {lang === "bn" ? "দিন বাকি" : "Days Left"}</div><div className="text-lg font-bold">{daysLeft}/{daysInMonth}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground"><Zap className="w-3 h-3 inline" /> {lang === "bn" ? "দৈনিক প্রয়োজন" : "Daily Need"}</div><div className="text-lg font-bold text-violet-600">৳{fmt.num(Math.round(requiredPace))}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground"><TrendingUp className="w-3 h-3 inline" /> {lang === "bn" ? "পূর্বাভাস" : "Forecast"}</div><div className={`text-lg font-bold ${forecast >= totalTarget ? "text-green-600" : "text-amber-600"}`}>৳{fmt.num(Math.round(forecast))}</div></Card>
        <Card className="p-3"><div className="text-[10px] text-muted-foreground"><Activity className="w-3 h-3 inline" /> MoM</div><div className={`text-lg font-bold ${momGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>{momGrowth >= 0 ? "+" : ""}{Math.round(momGrowth)}%</div></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3 border-green-200 bg-green-50/50 dark:bg-green-950/20"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {lang === "bn" ? "১০০% অর্জিত" : "Achieved 100%"}</div><div className="text-xl font-bold text-green-700">{achievedCount}/{activeCatCount}</div></Card>
        <Card className="p-3 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"><div className="text-xs text-muted-foreground">📈 {lang === "bn" ? "অন-ট্র্যাক" : "On-Track"}</div><div className="text-xl font-bold text-blue-700">{onTrackCount}</div></Card>
        <Card className="p-3 border-red-200 bg-red-50/50 dark:bg-red-950/20"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-600" /> {lang === "bn" ? "ঝুঁকিতে" : "At-Risk"}</div><div className="text-xl font-bold text-red-700">{atRiskCount}</div></Card>
        <Card className="p-3 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"><div className="text-xs text-muted-foreground"><Trophy className="w-3 h-3 inline text-amber-600" /> {lang === "bn" ? "টপ পারফর্মার" : "Top Performer"}</div><div className="text-base font-bold text-amber-700 truncate">{ranking[0]?.name || "—"}</div></Card>
      </div>

      <Tabs defaultValue="setup">
        <TabsList className="no-print flex-wrap h-auto">
          <TabsTrigger value="setup">{lang === "bn" ? "টার্গেট সেটাপ" : "Target Setup"}</TabsTrigger>
          <TabsTrigger value="achieve">{lang === "bn" ? "অর্জন এন্ট্রি" : "Achievement Entry"}</TabsTrigger>
          <TabsTrigger value="progress">{lang === "bn" ? "প্রগ্রেস" : "Progress"}</TabsTrigger>
          <TabsTrigger value="analytics">📊 {lang === "bn" ? "অ্যানালিটিক্স" : "Analytics"}</TabsTrigger>
          <TabsTrigger value="report">{lang === "bn" ? "মাসিক রিপোর্ট" : "Monthly Report"}</TabsTrigger>
          <TabsTrigger value="yearly">{lang === "bn" ? "বার্ষিক রিপোর্ট" : "Yearly Report"}</TabsTrigger>
          <TabsTrigger value="rank">{lang === "bn" ? "স্টাফ র‍্যাঙ্কিং" : "Staff Ranking"}</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-bold mb-3">{lang === "bn" ? "নতুন টার্গেট সেটাপ" : "Setup New Target"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><Label>{lang === "bn" ? "মাস" : "Month"}</Label><Select value={String(tf.month)} onValueChange={(v) => setTf({ ...tf, month: Number(v) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTHS_EN.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{lang === "bn" ? MONTHS_BN[i] : m}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>{lang === "bn" ? "বছর" : "Year"}</Label><Input type="number" value={tf.year} onChange={(e) => setTf({ ...tf, year: Number(e.target.value) })} /></div>
              <div><Label>{lang === "bn" ? "স্টাফ নাম *" : "Staff Name *"}</Label><Input value={tf.staff_name} onChange={(e) => setTf({ ...tf, staff_name: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "টার্গেট ক্যাটাগরি" : "Target Category"}</Label><Select value={tf.target_category} onValueChange={(v) => setTf({ ...tf, target_category: v, account_type: v === "new_account" ? tf.account_type : "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{lbl(c)}</SelectItem>)}</SelectContent></Select></div>
              {tf.target_category === "new_account" && (
                <div><Label>{lang === "bn" ? "অ্যাকাউন্ট টাইপ" : "Account Type"}</Label><Select value={tf.account_type || "__all"} onValueChange={(v) => setTf({ ...tf, account_type: v === "__all" ? "" : v })}><SelectTrigger><SelectValue placeholder={lang === "bn" ? "সব" : "All"} /></SelectTrigger><SelectContent><SelectItem value="__all">{lang === "bn" ? "সব টাইপ (সাধারণ)" : "All types (general)"}</SelectItem>{ACCOUNT_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
              )}
              <div><Label>{lang === "bn" ? "টার্গেট পরিমাণ (৳)" : "Target Amount (৳)"}</Label><Input type="number" value={tf.target_amount} onChange={(e) => setTf({ ...tf, target_amount: Number(e.target.value) })} /></div>
              <div><Label>{lang === "bn" ? "টার্গেট সংখ্যা" : "Target Quantity"}</Label><Input type="number" value={tf.target_quantity} onChange={(e) => setTf({ ...tf, target_quantity: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "মন্তব্য" : "Notes"}</Label><Textarea rows={2} value={tf.notes} onChange={(e) => setTf({ ...tf, notes: e.target.value })} /></div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => saveTarget.mutate()}>{editTargetId ? <><Pencil className="w-4 h-4 mr-1" />{t("update")}</> : <><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "সংরক্ষণ" : "Save"}</>}</Button>
              {editTargetId && <Button variant="outline" onClick={resetTf}><X className="w-4 h-4 mr-1" />{t("cancel_edit")}</Button>}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{lang === "bn" ? "মাস/বছর" : "Month/Year"}</TableHead><TableHead>{lang === "bn" ? "স্টাফ" : "Staff"}</TableHead><TableHead>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</TableHead><TableHead>{lang === "bn" ? "টাইপ" : "Type"}</TableHead><TableHead>{lang === "bn" ? "পরিমাণ" : "Amount"}</TableHead><TableHead>{lang === "bn" ? "সংখ্যা" : "Quantity"}</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{targets.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো টার্গেট নেই" : "No targets"}</TableCell></TableRow>}
                {targets.map((tr, i) => (<TableRow key={tr.id} className={editTargetId === tr.id ? "bg-primary/5" : ""}><TableCell>{i + 1}</TableCell><TableCell>{MONTHS_EN[tr.month - 1]} {tr.year}</TableCell><TableCell>{tr.staff_name}</TableCell><TableCell>{lbl(CATEGORIES.find((c) => c.id === tr.target_category) || CATEGORIES[0])}</TableCell><TableCell>{tr.account_type || "-"}</TableCell><TableCell>{fmt.num(tr.target_amount)}</TableCell><TableCell>{tr.target_quantity}</TableCell><TableCell><div className="flex gap-1 justify-end"><Button size="icon" variant="ghost" onClick={() => startEditTarget(tr)}><Pencil className="w-4 h-4 text-primary" /></Button><Button size="icon" variant="ghost" onClick={() => onDelTarget(tr.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></TableCell></TableRow>))}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>

        <TabsContent value="achieve" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-bold mb-3">{lang === "bn" ? "নতুন অর্জন এন্ট্রি" : "New Achievement Entry"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><Label>{lang === "bn" ? "তারিখ" : "Date"}</Label><Input type="date" value={af.date} onChange={(e) => setAf({ ...af, date: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "স্টাফ *" : "Staff *"}</Label><Input value={af.staff_name} onChange={(e) => setAf({ ...af, staff_name: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</Label><Select value={af.achievement_category} onValueChange={(v) => setAf({ ...af, achievement_category: v, account_type: v === "new_account" ? af.account_type : "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{lbl(c)}</SelectItem>)}</SelectContent></Select></div>
              {af.achievement_category === "new_account" && (
                <div><Label>{lang === "bn" ? "অ্যাকাউন্ট টাইপ" : "Account Type"}</Label><Select value={af.account_type || "__all"} onValueChange={(v) => setAf({ ...af, account_type: v === "__all" ? "" : v })}><SelectTrigger><SelectValue placeholder={lang === "bn" ? "সব" : "All"} /></SelectTrigger><SelectContent><SelectItem value="__all">{lang === "bn" ? "সব টাইপ" : "All types"}</SelectItem>{ACCOUNT_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
              )}
              <div><Label>{lang === "bn" ? "পরিমাণ (৳)" : "Amount (৳)"}</Label><Input type="number" value={af.amount} onChange={(e) => setAf({ ...af, amount: Number(e.target.value) })} /></div>
              <div><Label>{lang === "bn" ? "সংখ্যা" : "Quantity"}</Label><Input type="number" value={af.quantity} onChange={(e) => setAf({ ...af, quantity: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "মন্তব্য" : "Remarks"}</Label><Textarea rows={2} value={af.remarks} onChange={(e) => setAf({ ...af, remarks: e.target.value })} /></div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => saveAch.mutate()}>{editAchId ? <><Pencil className="w-4 h-4 mr-1" />{t("update")}</> : <><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "সংরক্ষণ" : "Save"}</>}</Button>
              {editAchId && <Button variant="outline" onClick={resetAf}><X className="w-4 h-4 mr-1" />{t("cancel_edit")}</Button>}
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead><TableHead>{lang === "bn" ? "স্টাফ" : "Staff"}</TableHead><TableHead>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</TableHead><TableHead>{lang === "bn" ? "টাইপ" : "Type"}</TableHead><TableHead>{lang === "bn" ? "পরিমাণ" : "Amount"}</TableHead><TableHead>{lang === "bn" ? "সংখ্যা" : "Qty"}</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{achievements.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো অর্জন নেই" : "No achievements"}</TableCell></TableRow>}
                {achievements.slice(0, 50).map((a, i) => (<TableRow key={a.id} className={editAchId === a.id ? "bg-primary/5" : ""}><TableCell>{i + 1}</TableCell><TableCell>{a.date}</TableCell><TableCell>{a.staff_name}</TableCell><TableCell>{lbl(CATEGORIES.find((c) => c.id === a.achievement_category) || CATEGORIES[0])}</TableCell><TableCell>{a.account_type || "-"}</TableCell><TableCell>{fmt.num(a.amount)}</TableCell><TableCell>{a.quantity}</TableCell><TableCell><div className="flex gap-1 justify-end"><Button size="icon" variant="ghost" onClick={() => startEditAch(a)}><Pencil className="w-4 h-4 text-primary" /></Button><Button size="icon" variant="ghost" onClick={() => onDelAch(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></div></TableCell></TableRow>))}
              </TableBody>
            </Table></div>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট টার্গেট" : "Total Target"}</div><div className="text-2xl font-bold">৳ {fmt.num(totalTarget)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট অর্জন" : "Total Achievement"}</div><div className="text-2xl font-bold text-green-600">৳ {fmt.num(totalAch)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "অর্জন %" : "Achievement %"}</div><div className="text-2xl font-bold text-primary">{totalTarget > 0 ? Math.round((totalAch / totalTarget) * 100) : 0}%</div></Card>
          </div>
          <Card className="p-4 space-y-4">
            {progress.map((p) => {
              const qtyPct = p.tg.qty > 0 ? Math.min(100, (p.ac.qty / p.tg.qty) * 100) : 0;
              return (
                <div key={p.id} className="space-y-2 border-b last:border-b-0 pb-3 last:pb-0">
                  <div className="font-semibold text-sm">{lbl(p)}</div>
                  {p.tg.amount > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{lang === "bn" ? "পরিমাণ" : "Amount"}</span>
                        <span>৳ {fmt.num(p.ac.amount)} / ৳ {fmt.num(p.tg.amount)} <strong className="text-primary">({Math.round(p.pct)}%)</strong></span>
                      </div>
                      <Progress value={p.pct} />
                    </div>
                  )}
                  {p.tg.qty > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{lang === "bn" ? "সংখ্যা" : "Quantity"}</span>
                        <span>{fmt.num(p.ac.qty)} / {fmt.num(p.tg.qty)} <strong className="text-primary">({Math.round(qtyPct)}%)</strong></span>
                      </div>
                      <Progress value={qtyPct} />
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          {/* New Account: Account-type breakdown */}
          {(() => {
            const monthTargets = targets.filter((tr) => tr.year === year && tr.month === month && tr.target_category === "new_account");
            const monthAch = achievements.filter((a) => { const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() + 1 === month && a.achievement_category === "new_account"; });
            if (monthTargets.length === 0 && monthAch.length === 0) return null;
            const rows = ACCOUNT_TYPES.map((typ) => {
              const tg = monthTargets.filter((tr) => (tr.account_type || "") === typ).reduce((s, tr) => ({ amount: s.amount + Number(tr.target_amount), qty: s.qty + Number(tr.target_quantity) }), { amount: 0, qty: 0 });
              const ac = monthAch.filter((a) => (a.account_type || "") === typ).reduce((s, a) => ({ amount: s.amount + Number(a.amount), qty: s.qty + Number(a.quantity) }), { amount: 0, qty: 0 });
              return { typ, tg, ac };
            }).filter((r) => r.tg.qty > 0 || r.tg.amount > 0 || r.ac.qty > 0 || r.ac.amount > 0);
            if (rows.length === 0) return null;
            return (
              <Card className="p-4">
                <h3 className="font-bold mb-3 text-sm">{lang === "bn" ? "নতুন অ্যাকাউন্ট — টাইপ অনুযায়ী" : "New Account — by Type"}</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>{lang === "bn" ? "টাইপ" : "Type"}</TableHead><TableHead className="text-right">{lang === "bn" ? "টার্গেট সংখ্যা" : "Target Qty"}</TableHead><TableHead className="text-right">{lang === "bn" ? "অর্জন সংখ্যা" : "Achieved Qty"}</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const pct = r.tg.qty > 0 ? Math.min(100, (r.ac.qty / r.tg.qty) * 100) : 0;
                        return (
                          <TableRow key={r.typ}>
                            <TableCell className="font-medium">{r.typ}</TableCell>
                            <TableCell className="text-right">{fmt.num(r.tg.qty)}</TableCell>
                            <TableCell className="text-right">{fmt.num(r.ac.qty)}</TableCell>
                            <TableCell className="text-right"><Badge variant={pct >= 100 ? "default" : "outline"} className={pct >= 100 ? "bg-green-600" : ""}>{Math.round(pct)}%</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card className="overflow-hidden print-area">
            <div className="p-4 text-center border-b">
              <div className="font-bold text-lg">{t("bankName")}</div>
              <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
              <div className="font-semibold mt-2">{lang === "bn" ? "মাসিক পারফরম্যান্স রিপোর্ট" : "Monthly Performance Report"} — {MONTHS_EN[month - 1]} {year}</div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</TableHead><TableHead className="text-right">{lang === "bn" ? "টার্গেট" : "Target"}</TableHead><TableHead className="text-right">{lang === "bn" ? "অর্জন" : "Achievement"}</TableHead><TableHead className="text-right">{lang === "bn" ? "অবশিষ্ট" : "Remaining"}</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
              <TableBody>
                {progress.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>{i + 1}</TableCell><TableCell>{lbl(p)}</TableCell>
                    <TableCell className="text-right">{fmt.num(p.tg.amount)}</TableCell>
                    <TableCell className="text-right">{fmt.num(p.ac.amount)}</TableCell>
                    <TableCell className="text-right">{fmt.num(Math.max(0, p.tg.amount - p.ac.amount))}</TableCell>
                    <TableCell className="text-right font-semibold">{Math.round(p.pct)}%</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2"><TableCell colSpan={2}>{lang === "bn" ? "মোট" : "Total"}</TableCell><TableCell className="text-right">{fmt.num(totalTarget)}</TableCell><TableCell className="text-right">{fmt.num(totalAch)}</TableCell><TableCell className="text-right">{fmt.num(Math.max(0, totalTarget - totalAch))}</TableCell><TableCell className="text-right">{totalTarget > 0 ? Math.round((totalAch / totalTarget) * 100) : 0}%</TableCell></TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="yearly" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-bold mb-3">{lang === "bn" ? "বার্ষিক টার্গেট vs অর্জন" : "Yearly Target vs Achievement"} — {year}</h3>
            <ClientOnly fallback={<div className="h-72" />}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                    <Bar dataKey="target" fill="#94a3b8" name={lang === "bn" ? "টার্গেট" : "Target"} />
                    <Bar dataKey="achievement" fill="#10b981" name={lang === "bn" ? "অর্জন" : "Achievement"} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ClientOnly>
          </Card>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>{lang === "bn" ? "মাস" : "Month"}</TableHead><TableHead className="text-right">{lang === "bn" ? "টার্গেট" : "Target"}</TableHead><TableHead className="text-right">{lang === "bn" ? "অর্জন" : "Achievement"}</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
              <TableBody>
                {yearlyChart.map((m) => (
                  <TableRow key={m.month}><TableCell>{m.month}</TableCell><TableCell className="text-right">{fmt.num(m.target)}</TableCell><TableCell className="text-right">{fmt.num(m.achievement)}</TableCell><TableCell className="text-right">{m.target > 0 ? Math.round((m.achievement / m.target) * 100) : 0}%</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="rank" className="space-y-4">
          <Card className="overflow-hidden print-area">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />{lang === "bn" ? "স্টাফ র‍্যাঙ্কিং" : "Staff Ranking"} — {MONTHS_EN[month - 1]} {year}</h3>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>{lang === "bn" ? "র‍্যাঙ্ক" : "Rank"}</TableHead><TableHead>{lang === "bn" ? "স্টাফ" : "Staff"}</TableHead><TableHead className="text-right">{lang === "bn" ? "এন্ট্রি" : "Entries"}</TableHead><TableHead className="text-right">{lang === "bn" ? "পরিমাণ" : "Amount"}</TableHead><TableHead className="text-right">{lang === "bn" ? "সংখ্যা" : "Qty"}</TableHead><TableHead>{lang === "bn" ? "ব্যাজ" : "Badge"}</TableHead></TableRow></TableHeader>
              <TableBody>
                {ranking.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো ডাটা নেই" : "No data"}</TableCell></TableRow>}
                {ranking.map((r, i) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-bold">{i + 1}</TableCell><TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{fmt.num(r.amount)}</TableCell><TableCell className="text-right">{r.qty}</TableCell>
                    <TableCell>{i === 0 ? <Badge className="bg-amber-500"><Award className="w-3 h-3 mr-1" />Top Performer</Badge> : i === 1 ? <Badge className="bg-slate-400">2nd</Badge> : i === 2 ? <Badge className="bg-orange-700">3rd</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
