import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFmt, fmtBDT, monthRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { analyzeBusiness, askBusiness } from "@/lib/bi-dashboard.functions";
import {
  Brain, Sparkles, TrendingUp, TrendingDown, Wallet, AlertTriangle,
  Lightbulb, RefreshCw, Send, Target, Users, Package, ClipboardList,
  Activity, Loader2, MessageSquare, ShieldAlert, Gauge, Printer,
  Crown, ShieldCheck, FileCheck2, HeartPulse, Bell, Building2, Banknote,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/bi-dashboard")({ component: BIDashboard });

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

function BIDashboard() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const now = new Date();
  const analyzeFn = useServerFn(analyzeBusiness);
  const askFn = useServerFn(askBusiness);

  const { data: metrics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["bi-metrics"],
    queryFn: async () => {
      // 6 months ending at PREVIOUS month (finalized data)
      const months: { year: number; month: number; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` });
      }
      const prevMonth = months[5];
      const firstStart = monthRange(months[0].year, months[0].month).start;
      const lastEnd = monthRange(months[5].year, months[5].month).end;

      const ninetyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString().slice(0, 10);
      const todayStr = now.toISOString().slice(0, 10);

      const [mri, mp, exp, expCats, staff, tasks, pending, assets, loan, deposits, remit, accts, payments, attendance, targets,
             cashEntries, cashOpening, kyc, perf, invest, audits, auditChecks] = await Promise.all([
        supabase.from("monthly_report_items").select("year,month,amount,item_type"),
        supabase.from("monthly_profits").select("*"),
        supabase.from("expenses").select("amount,category_id,date").gte("date", firstStart).lte("date", lastEnd),
        supabase.from("expense_categories").select("id,name_bn,name_en"),
        supabase.from("staff").select("id,name,status,position"),
        supabase.from("tasks").select("id,status,priority,due_date"),
        supabase.from("pending_works").select("id,status,priority"),
        supabase.from("agent_bank_assets").select("name,quantity"),
        supabase.from("loan_persons").select("id,status,loan_amount,opening_balance"),
        supabase.from("daily_deposits").select("date,amount").gte("date", firstStart).lte("date", lastEnd),
        supabase.from("remittance_entries").select("date,amount,quantity").gte("date", firstStart).lte("date", lastEnd),
        supabase.from("account_opening_entries").select("year,month,num_accounts"),
        supabase.from("upcoming_payments").select("amount,status,due_date"),
        supabase.from("attendance").select("date,status").gte("date", firstStart).lte("date", lastEnd),
        supabase.from("monthly_targets").select("year,month,target_category,target_amount,target_quantity,staff_name,status,deadline,priority").eq("year", prevMonth.year).eq("month", prevMonth.month),
        supabase.from("cash_book_entries").select("date,entry_type,amount").gte("date", ninetyDaysAgo).lte("date", todayStr),
        supabase.from("cash_book_opening").select("date,opening_balance").order("date", { ascending: false }).limit(1),
        supabase.from("kyc_profiles").select("id,customer_name,status,risk_level,monthly_income"),
        supabase.from("staff_performance").select("staff_id,rating,review_date").order("review_date", { ascending: false }),
        supabase.from("agent_bank_investments").select("amount,type"),
        supabase.from("audit_reports").select("id,audit_date,auditor_name,audit_type,reference_number").order("audit_date", { ascending: false }).limit(5),
        supabase.from("audit_compliance_checks").select("audit_report_id,status,title"),
      ]);

      const trend = months.map((m) => {
        const inc = (mri.data ?? []).filter((r: any) => r.year === m.year && r.month === m.month && r.item_type === "income").reduce((s, r: any) => s + Number(r.amount), 0);
        const expense = (mri.data ?? []).filter((r: any) => r.year === m.year && r.month === m.month && r.item_type === "expense").reduce((s, r: any) => s + Number(r.amount), 0);
        return { label: m.label, income: inc, expense, profit: inc - expense };
      });

      const catMap = new Map((expCats.data ?? []).map((c: any) => [c.id, lang === "bn" ? c.name_bn : (c.name_en ?? c.name_bn)]));
      const expByCat = new Map<string, number>();
      (exp.data ?? []).forEach((e: any) => {
        const k = catMap.get(e.category_id) ?? "Other";
        expByCat.set(k, (expByCat.get(k) ?? 0) + Number(e.amount));
      });
      const expensePie = [...expByCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

      const curMonthIdx = trend.length - 1; // previous (last finalized) month
      const prevMonthIdx = curMonthIdx - 1; // month before that
      const cur = trend[curMonthIdx];
      const prev = trend[prevMonthIdx];
      const manualProfitRow = (mp.data ?? []).find((x: any) => x.year === prevMonth.year && x.month === prevMonth.month);
      if (manualProfitRow) cur.profit = Number(manualProfitRow.total_profit);
      const incomeChange = prev?.income ? ((cur.income - prev.income) / prev.income) * 100 : 0;
      const expenseChange = prev?.expense ? ((cur.expense - prev.expense) / prev.expense) * 100 : 0;
      const profitChange = prev?.profit ? ((cur.profit - prev.profit) / Math.abs(prev.profit)) * 100 : 0;
      const margin = cur.income ? (cur.profit / cur.income) * 100 : 0;

      // Targets for previous month
      const targetIncome = (targets.data ?? []).filter((r: any) => /income|deposit|revenue|আয়|ডিপোজিট/i.test(r.target_category)).reduce((s: number, r: any) => s + Number(r.target_amount ?? 0), 0);
      const targetProfit = (targets.data ?? []).filter((r: any) => /profit|মুনাফা|লাভ/i.test(r.target_category)).reduce((s: number, r: any) => s + Number(r.target_amount ?? 0), 0);
      const totalTargetAmount = (targets.data ?? []).reduce((s: number, r: any) => s + Number(r.target_amount ?? 0), 0);
      const requiredProfit = targetProfit > 0 ? targetProfit : Math.max(0, cur.expense * 0.25); // fallback: 25% over expense
      const profitGapPct = requiredProfit > 0 ? ((requiredProfit - cur.profit) / requiredProfit) * 100 : 0;

      const activeStaff = (staff.data ?? []).filter((s: any) => (s.status ?? "active") === "active").length;
      const openTasks = (tasks.data ?? []).filter((t: any) => t.status !== "done" && t.status !== "completed").length;
      const highPriorityTasks = (tasks.data ?? []).filter((t: any) => (t.priority === "high" || t.priority === "urgent") && t.status !== "done" && t.status !== "completed").length;
      const overdueTasks = (tasks.data ?? []).filter((t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "done" && t.status !== "completed").length;
      const openPending = (pending.data ?? []).filter((p: any) => p.status !== "done").length;
      const lowStock = (assets.data ?? []).filter((a: any) => Number(a.quantity) <= 2).length;
      const outOfStock = (assets.data ?? []).filter((a: any) => Number(a.quantity) === 0).length;
      const activeLoans = (loan.data ?? []).filter((l: any) => (l.status ?? "active") === "active").length;
      const overduePayments = (payments.data ?? []).filter((p: any) => p.status !== "paid" && p.due_date && new Date(p.due_date) < now).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const upcomingDue = (payments.data ?? []).filter((p: any) => p.status !== "paid").reduce((s: number, p: any) => s + Number(p.amount), 0);

      const depositTrend = months.map((m) => {
        const { start, end } = monthRange(m.year, m.month);
        const sum = (deposits.data ?? []).filter((d: any) => d.date >= start && d.date <= end).reduce((s: number, d: any) => s + Number(d.amount), 0);
        return { label: m.label, deposit: sum };
      });

      const remitTrend = months.map((m) => {
        const { start, end } = monthRange(m.year, m.month);
        const rows = (remit.data ?? []).filter((r: any) => r.date >= start && r.date <= end);
        return {
          label: m.label,
          amount: rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0),
          count: rows.reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0),
        };
      });

      const acctsTrend = months.map((m) => ({
        label: m.label,
        accounts: (accts.data ?? []).filter((a: any) => a.year === m.year && a.month === m.month).reduce((s: number, a: any) => s + Number(a.num_accounts ?? 0), 0),
      }));

      const attDays = new Map<string, { present: number; absent: number; leave: number }>();
      (attendance.data ?? []).forEach((a: any) => {
        const r = attDays.get(a.date) ?? { present: 0, absent: 0, leave: 0 };
        if (a.status === "present") r.present++;
        else if (a.status === "absent") r.absent++;
        else if (a.status === "leave") r.leave++;
        attDays.set(a.date, r);
      });
      const totalPresent = [...attDays.values()].reduce((s, r) => s + r.present, 0);
      const totalAbsent = [...attDays.values()].reduce((s, r) => s + r.absent, 0);
      const attendanceRate = totalPresent + totalAbsent ? (totalPresent / (totalPresent + totalAbsent)) * 100 : 0;

      // === New: Total business value, deposit growth, cash position, customers/VIP, compliance, staff ranking ===
      const totalDeposits6m = (deposits.data ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);
      const totalRemit6m = (remit.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
      const totalInvestment = (invest.data ?? []).reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
      const totalLoanOutstanding = (loan.data ?? []).reduce((s: number, l: any) => s + Number(l.loan_amount ?? l.opening_balance ?? 0), 0);
      const totalBusinessValue = totalDeposits6m + totalRemit6m + totalInvestment + totalLoanOutstanding;

      const lastDep = depositTrend[depositTrend.length - 1]?.deposit ?? 0;
      const prevDep = depositTrend[depositTrend.length - 2]?.deposit ?? 0;
      const depositGrowth = prevDep ? ((lastDep - prevDep) / prevDep) * 100 : 0;

      const openBal = Number((cashOpening.data ?? [])[0]?.opening_balance ?? 0);
      const cashIn = (cashEntries.data ?? []).filter((c: any) => c.entry_type === "in" || c.entry_type === "credit" || c.entry_type === "deposit").reduce((s: number, c: any) => s + Number(c.amount), 0);
      const cashOut = (cashEntries.data ?? []).filter((c: any) => c.entry_type === "out" || c.entry_type === "debit" || c.entry_type === "withdraw").reduce((s: number, c: any) => s + Number(c.amount), 0);
      const cashPosition = openBal + cashIn - cashOut;

      const customers = kyc.data ?? [];
      const totalCustomers = customers.length;
      const vipCustomers = customers.filter((k: any) => Number(k.monthly_income ?? 0) >= 50000 || k.risk_level === "high").length;
      const customerBusinessValue = customers.reduce((s: number, k: any) => s + Number(k.monthly_income ?? 0), 0) * 12;

      // Staff ranking — avg rating per staff
      const ratingMap = new Map<string, { sum: number; n: number }>();
      (perf.data ?? []).forEach((p: any) => {
        const r = ratingMap.get(p.staff_id) ?? { sum: 0, n: 0 };
        r.sum += Number(p.rating ?? 0); r.n += 1; ratingMap.set(p.staff_id, r);
      });
      const staffNameMap = new Map((staff.data ?? []).map((s: any) => [s.id, s.name]));
      const staffRanking = [...ratingMap.entries()]
        .map(([id, r]) => ({ name: staffNameMap.get(id) ?? "—", rating: r.sum / r.n, reviews: r.n }))
        .sort((a, b) => b.rating - a.rating).slice(0, 5);

      // Compliance score from latest audit
      const latestAudit = (audits.data ?? [])[0];
      const latestChecks = latestAudit ? (auditChecks.data ?? []).filter((c: any) => c.audit_report_id === latestAudit.id) : [];
      const okChecks = latestChecks.filter((c: any) => c.status === "ok").length;
      const complianceScore = latestChecks.length ? Math.round((okChecks / latestChecks.length) * 100) : 0;

      // Expense control: % vs income
      const expenseRatio = cur.income ? (cur.expense / cur.income) * 100 : 0;

      // Future prediction — simple linear projection from trend
      const trendProfits = trend.map(t => t.profit);
      const avgProfit = trendProfits.reduce((a, b) => a + b, 0) / (trendProfits.length || 1);
      const lastProfit = trendProfits[trendProfits.length - 1] ?? 0;
      const projectedNext = Math.round(avgProfit * 0.4 + lastProfit * 0.6);
      const projectedYear = Math.round(avgProfit * 12);

      // Business Health Score (0-100)
      const healthScore = Math.max(0, Math.min(100, Math.round(
        (margin > 0 ? Math.min(margin, 30) * 1.5 : 0) +
        (attendanceRate * 0.2) +
        (complianceScore * 0.2) +
        (overdueTasks === 0 ? 10 : 0) +
        (outOfStock === 0 ? 5 : 0) +
        (overduePayments === 0 ? 10 : 0) +
        (cur.profit > 0 ? 10 : 0)
      )));

      // Smart Alerts
      const smartAlerts: { level: "high" | "medium" | "low"; text: string }[] = [];
      if (overduePayments > 0) smartAlerts.push({ level: "high", text: lang === "bn" ? `ওভারডিউ পেমেন্ট: ${fmtBDT(overduePayments, lang)} — দ্রুত আদায় করুন` : `Overdue payments: ${fmtBDT(overduePayments, lang)} — collect now` });
      if (outOfStock > 0) smartAlerts.push({ level: "high", text: lang === "bn" ? `${outOfStock} আইটেম স্টক শেষ — রিঅর্ডার দিন` : `${outOfStock} items out of stock — reorder` });
      if (overdueTasks > 0) smartAlerts.push({ level: "medium", text: lang === "bn" ? `${overdueTasks} টাস্ক ওভারডিউ` : `${overdueTasks} tasks overdue` });
      if (cur.profit < requiredProfit) smartAlerts.push({ level: "medium", text: lang === "bn" ? `মুনাফা টার্গেট থেকে কম` : `Profit below target` });
      if (expenseRatio > 80) smartAlerts.push({ level: "high", text: lang === "bn" ? `ব্যয় আয়ের ${expenseRatio.toFixed(0)}% — নিয়ন্ত্রণ দরকার` : `Expense is ${expenseRatio.toFixed(0)}% of income — control needed` });
      if (attendanceRate < 80) smartAlerts.push({ level: "medium", text: lang === "bn" ? `হাজিরার হার ${attendanceRate.toFixed(0)}% — স্টাফদের সাথে কথা বলুন` : `Attendance ${attendanceRate.toFixed(0)}% — review staff` });
      if (complianceScore < 70 && latestChecks.length) smartAlerts.push({ level: "high", text: lang === "bn" ? `কমপ্লায়েন্স স্কোর কম (${complianceScore}%)` : `Compliance score low (${complianceScore}%)` });
      if (smartAlerts.length === 0) smartAlerts.push({ level: "low", text: lang === "bn" ? "সব ঠিকঠাক চলছে ✓" : "All systems healthy ✓" });

      return {
        trend, expensePie, depositTrend, remitTrend, acctsTrend,
        cur, prev, incomeChange, expenseChange, profitChange, margin,
        activeStaff, openTasks, highPriorityTasks, overdueTasks, openPending,
        lowStock, outOfStock, activeLoans, overduePayments, upcomingDue,
        attendanceRate,
        prevMonth,
        targetIncome, targetProfit, totalTargetAmount, requiredProfit, profitGapPct,
        targetCount: (targets.data ?? []).length,
        manualProfit: manualProfitRow ?? null,
        totalBusinessValue, totalDeposits6m, totalRemit6m, totalInvestment, totalLoanOutstanding,
        depositGrowth, cashPosition, totalCustomers, vipCustomers, customerBusinessValue,
        staffRanking, complianceScore, latestAudit, latestChecks: latestChecks.length,
        expenseRatio, projectedNext, projectedYear, healthScore, smartAlerts,
        auditCount: (audits.data ?? []).length,
        recentAudits: audits.data ?? [],
      };
    },
  });

  const summary = useMemo(() => {
    if (!metrics) return null;
    return {
      current_month: { income: metrics.cur.income, expense: metrics.cur.expense, profit: metrics.cur.profit, margin_pct: metrics.margin },
      previous_month: { income: metrics.prev?.income, expense: metrics.prev?.expense, profit: metrics.prev?.profit },
      changes_pct: { income: metrics.incomeChange, expense: metrics.expenseChange, profit: metrics.profitChange },
      six_month_trend: metrics.trend,
      top_expenses: metrics.expensePie,
      operations: {
        active_staff: metrics.activeStaff,
        attendance_rate_pct: metrics.attendanceRate,
        open_tasks: metrics.openTasks,
        high_priority_tasks: metrics.highPriorityTasks,
        overdue_tasks: metrics.overdueTasks,
        pending_works: metrics.openPending,
        active_loans: metrics.activeLoans,
        low_stock_items: metrics.lowStock,
        out_of_stock_items: metrics.outOfStock,
        overdue_payments_amount: metrics.overduePayments,
        upcoming_payments_amount: metrics.upcomingDue,
      },
    };
  }, [metrics]);

  const analyze = useMutation({
    mutationFn: async () => analyzeFn({ data: { lang, metrics: summary! } }),
  });

  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const askMut = useMutation({
    mutationFn: async (q: string) => askFn({ data: { lang, question: q, metrics: summary! } }),
    onSuccess: (res, q) => setChat((c) => [...c, { q, a: res.answer }]),
  });

  const presetQs = lang === "bn"
    ? ["এই মাসে কোথায় বেশি খরচ হচ্ছে?", "মুনাফা বাড়ানোর ৩টি উপায়?", "কোন ঝুঁকিগুলো এখনই দেখা দরকার?", "পরের মাসের পূর্বাভাস কী?"]
    : ["Where are we overspending this month?", "Top 3 ways to grow profit?", "Which risks need attention now?", "What's next month's forecast?"];

  if (isLoading || !metrics) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const ai = analyze.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            {lang === "bn" ? "AI বিজনেস ইন্টেলিজেন্স" : "AI Business Intelligence"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn"
              ? `গত মাসের (${metrics.prevMonth.month}/${metrics.prevMonth.year}) ফাইনাল ডেটার উপর স্মার্ট বিশ্লেষণ`
              : `Smart analytics on previous month's (${metrics.prevMonth.month}/${metrics.prevMonth.year}) finalized data`}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "PDF এক্সপোর্ট" : "Export PDF"}
          </Button>
          <Button size="sm" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
            {analyze.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {lang === "bn" ? "AI বিশ্লেষণ করুন" : "Run AI Analysis"}
          </Button>
        </div>
      </div>

      {/* Hero — Total Business Value, Health Score, Cash Position */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-indigo-600/20 to-purple-500/10 border-indigo-500/30 md:col-span-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="w-4 h-4" /> {lang === "bn" ? "মোট বিজনেস ভ্যালু" : "Total Business Value"}</div>
          <div className="text-3xl font-bold mt-1">{fmtBDT(metrics.totalBusinessValue, lang)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {lang === "bn" ? "ডিপোজিট + রেমিট + বিনিয়োগ + ঋণ" : "Deposits + Remittance + Investment + Loans"}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3 text-[10px]">
            <div><div className="text-muted-foreground">{lang === "bn" ? "ডিপোজিট" : "Deposits"}</div><div className="font-semibold">{fmtBDT(metrics.totalDeposits6m, lang)}</div></div>
            <div><div className="text-muted-foreground">{lang === "bn" ? "রেমিট" : "Remit"}</div><div className="font-semibold">{fmtBDT(metrics.totalRemit6m, lang)}</div></div>
            <div><div className="text-muted-foreground">{lang === "bn" ? "বিনিয়োগ" : "Invest"}</div><div className="font-semibold">{fmtBDT(metrics.totalInvestment, lang)}</div></div>
            <div><div className="text-muted-foreground">{lang === "bn" ? "ঋণ" : "Loans"}</div><div className="font-semibold">{fmtBDT(metrics.totalLoanOutstanding, lang)}</div></div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><HeartPulse className="w-4 h-4" /> {lang === "bn" ? "বিজনেস হেলথ স্কোর" : "Business Health Score"}</div>
          <div className="text-4xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{metrics.healthScore}<span className="text-base text-muted-foreground">/100</span></div>
          <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" style={{ width: `${metrics.healthScore}%` }} /></div>
          <div className="text-[11px] text-muted-foreground mt-1">{metrics.healthScore >= 75 ? (lang === "bn" ? "উত্তম" : "Excellent") : metrics.healthScore >= 50 ? (lang === "bn" ? "মাঝারি" : "Moderate") : (lang === "bn" ? "মনোযোগ দরকার" : "Needs attention")}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border-cyan-500/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Banknote className="w-4 h-4" /> {lang === "bn" ? "ক্যাশ পজিশন" : "Cash Position"}</div>
          <div className="text-2xl font-bold mt-1">{fmtBDT(metrics.cashPosition, lang)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{lang === "bn" ? "ক্যাশ বুক — বর্তমান ব্যালেন্স" : "Cash book — current balance"}</div>
          <div className={`text-[11px] font-semibold mt-2 ${metrics.depositGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {metrics.depositGrowth >= 0 ? "▲" : "▼"} {Math.abs(metrics.depositGrowth).toFixed(1)}% {lang === "bn" ? "ডিপোজিট গ্রোথ" : "deposit growth"}
          </div>
        </Card>
      </div>

      {/* Smart Alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3"><Bell className="w-5 h-5 text-amber-500" /><h3 className="font-semibold">{lang === "bn" ? "স্মার্ট অ্যালার্ট" : "Smart Alerts"}</h3></div>
        <div className="grid sm:grid-cols-2 gap-2">
          {metrics.smartAlerts.map((a: any, i: number) => (
            <div key={i} className={`flex items-start gap-2 p-2 rounded-md border ${a.level === "high" ? "bg-red-500/10 border-red-500/30" : a.level === "medium" ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
              <Badge variant={a.level === "high" ? "destructive" : a.level === "medium" ? "default" : "secondary"} className="capitalize text-[10px]">{a.level}</Badge>
              <div className="text-xs leading-relaxed">{a.text}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* KPI Grid — Previous Month */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="w-5 h-5" />} label={lang === "bn" ? "গত মাসের আয়" : "Prev Month Income"} value={fmtBDT(metrics.cur.income, lang)} change={metrics.incomeChange} tone="green" />
        <Kpi icon={<TrendingDown className="w-5 h-5" />} label={lang === "bn" ? "গত মাসের ব্যয়" : "Prev Month Expense"} value={fmtBDT(metrics.cur.expense, lang)} change={metrics.expenseChange} tone="red" invertChange />
        <Kpi icon={<Wallet className="w-5 h-5" />} label={lang === "bn" ? "নিট মুনাফা" : "Net Profit"} value={fmtBDT(metrics.cur.profit, lang)} change={metrics.profitChange} tone={metrics.cur.profit >= 0 ? "green" : "red"} />
        <Kpi icon={<Gauge className="w-5 h-5" />} label={lang === "bn" ? "মুনাফা মার্জিন" : "Profit Margin"} value={`${fmt.num(metrics.margin.toFixed(1))}%`} tone="blue" />
        <Kpi icon={<Target className="w-5 h-5" />} label={lang === "bn" ? "প্রয়োজনীয় মুনাফা" : "Required Profit"} value={fmtBDT(metrics.requiredProfit, lang)} sub={metrics.targetProfit > 0 ? (lang === "bn" ? "টার্গেট থেকে" : "from target") : (lang === "bn" ? "প্রাক্কলিত (ব্যয়ের ২৫%)" : "est. 25% over expense")} tone={metrics.cur.profit >= metrics.requiredProfit ? "green" : "amber"} />
        <Kpi icon={<Target className="w-5 h-5" />} label={lang === "bn" ? "মাসিক টার্গেট" : "Monthly Targets"} value={fmtBDT(metrics.totalTargetAmount, lang)} sub={`${fmt.num(metrics.targetCount)} ${lang === "bn" ? "এন্ট্রি" : "entries"}`} tone="blue" />
        <Kpi icon={<Users className="w-5 h-5" />} label={lang === "bn" ? "সক্রিয় স্টাফ" : "Active Staff"} value={fmt.num(metrics.activeStaff)} sub={`${fmt.num(metrics.attendanceRate.toFixed(0))}% ${lang === "bn" ? "হাজিরা" : "attendance"}`} tone="blue" />
        <Kpi icon={<ClipboardList className="w-5 h-5" />} label={lang === "bn" ? "ওপেন টাস্ক" : "Open Tasks"} value={fmt.num(metrics.openTasks)} sub={`${fmt.num(metrics.overdueTasks)} ${lang === "bn" ? "ওভারডিউ" : "overdue"}`} tone={metrics.overdueTasks > 0 ? "amber" : "blue"} />
        <Kpi icon={<Package className="w-5 h-5" />} label={lang === "bn" ? "লো স্টক" : "Low Stock"} value={fmt.num(metrics.lowStock)} sub={`${fmt.num(metrics.outOfStock)} ${lang === "bn" ? "শেষ" : "out"}`} tone={metrics.outOfStock > 0 ? "red" : "amber"} />
        <Kpi icon={<AlertTriangle className="w-5 h-5" />} label={lang === "bn" ? "ওভারডিউ পেমেন্ট" : "Overdue Payments"} value={fmtBDT(metrics.overduePayments, lang)} tone={metrics.overduePayments > 0 ? "red" : "green"} />
      </div>

      {/* Profit Gap / Business Renewal hint */}
      {metrics.requiredProfit > 0 && (
        <Card className="p-4 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border-amber-500/30">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/15"><Target className="w-5 h-5 text-amber-600" /></div>
            <div className="flex-1">
              <div className="font-semibold">{lang === "bn" ? "ব্যবসা রিনিউ / বৃদ্ধির গাইড" : "Business Renewal / Growth Guide"}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {metrics.cur.profit >= metrics.requiredProfit
                  ? (lang === "bn"
                    ? `✓ মুনাফা টার্গেট অর্জিত। আগামী মাসে বিনিয়োগ ও নতুন অ্যাকাউন্ট ওপেনিং বাড়িয়ে আরও বৃদ্ধি করুন।`
                    : `✓ Profit target met. Grow further by boosting investments & new account openings.`)
                  : (lang === "bn"
                    ? `আরও ${fmtBDT(metrics.requiredProfit - metrics.cur.profit, lang)} মুনাফা দরকার (${fmt.num(Math.abs(metrics.profitGapPct).toFixed(0))}% ঘাটতি)। ব্যয় কমান, রেমিটেন্স/ডিপোজিট বাড়ান, পেন্ডিং পেমেন্ট আদায় করুন।`
                    : `Need ${fmtBDT(metrics.requiredProfit - metrics.cur.profit, lang)} more profit (${fmt.num(Math.abs(metrics.profitGapPct).toFixed(0))}% gap). Cut expenses, boost remittance/deposits, collect overdue payments.`)}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* AI Insight Panel */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent border-primary/30">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/15"><Sparkles className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            <h2 className="font-semibold">{lang === "bn" ? "AI বিজনেস ইনসাইট" : "AI Business Insights"}</h2>
            <p className="text-xs text-muted-foreground">{lang === "bn" ? "Lovable AI দ্বারা তৈরি" : "Powered by Lovable AI"}</p>
          </div>
          {ai && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{fmt.num(ai.score ?? 0)}</div>
              <div className="text-[10px] text-muted-foreground">{lang === "bn" ? "হেলথ স্কোর" : "Health Score"}</div>
            </div>
          )}
        </div>
        {analyze.isPending && <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />{lang === "bn" ? "বিশ্লেষণ চলছে..." : "Analyzing..."}</div>}
        {analyze.isError && <div className="text-sm text-destructive">{(analyze.error as Error).message}</div>}
        {!ai && !analyze.isPending && (
          <div className="text-sm text-muted-foreground py-4">
            {lang === "bn" ? "AI বিশ্লেষণ চালু করতে উপরের বাটনে ক্লিক করুন।" : "Click 'Run AI Analysis' above to generate insights."}
          </div>
        )}
        {ai && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-background/60 border">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1">{lang === "bn" ? "সহজ ভাষায় সারাংশ" : "Plain-language summary"}</div>
              <p className="text-sm leading-relaxed">{ai.summary}</p>
            </div>

            {/* Simple 5-panel breakdown */}
            <div className="grid md:grid-cols-2 gap-3">
              <SimpleList
                title={lang === "bn" ? "এই মাসের সমস্যা" : "Problems this month"}
                items={ai.problems}
                tone="red"
                icon={<AlertTriangle className="w-4 h-4" />}
                emptyText={lang === "bn" ? "কোনো বড় সমস্যা নেই" : "No major problems"}
              />
              <SimpleList
                title={lang === "bn" ? "এখনই সমাধান করুন" : "Fix right now"}
                items={ai.quick_fixes}
                tone="amber"
                icon={<Target className="w-4 h-4" />}
                emptyText={lang === "bn" ? "এখনই করার কিছু নেই" : "Nothing urgent"}
              />
              <SimpleList
                title={lang === "bn" ? "যা ডেভেলপ করা দরকার" : "What to develop"}
                items={ai.develop}
                tone="blue"
                icon={<Lightbulb className="w-4 h-4" />}
                emptyText={lang === "bn" ? "—" : "—"}
              />
              <SimpleList
                title={lang === "bn" ? "ভবিষ্যতে যা বাড়াবেন (➕)" : "Future plus (➕ add)"}
                items={ai.future_plus}
                tone="green"
                icon={<TrendingUp className="w-4 h-4" />}
                emptyText="—"
              />
              <SimpleList
                title={lang === "bn" ? "ভবিষ্যতে যা কমাবেন (➖)" : "Future minus (➖ cut)"}
                items={ai.future_minus}
                tone="red"
                icon={<TrendingDown className="w-4 h-4" />}
                emptyText="—"
              />
              {ai.forecast && (
                <div className="p-3 rounded-lg border bg-purple-500/10 border-purple-500/30">
                  <div className="flex items-center gap-2 mb-1 text-sm font-semibold"><Activity className="w-4 h-4 text-purple-600" />{lang === "bn" ? "পরের মাসের পূর্বাভাস" : "Next month forecast"}</div>
                  <p className="text-sm leading-relaxed">{ai.forecast}</p>
                </div>
              )}
            </div>

            {ai.risks?.length > 0 && (
              <Section title={lang === "bn" ? "ঝুঁকি ও সতর্কতা" : "Risks & Alerts"} icon={<ShieldAlert className="w-4 h-4" />}>
                <div className="space-y-2">
                  {ai.risks.map((r: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-background/60 border">
                      <Badge variant={r.severity === "high" ? "destructive" : r.severity === "medium" ? "default" : "secondary"} className="capitalize">{r.severity}</Badge>
                      <div className="text-sm"><div className="font-medium">{r.title}</div><div className="text-muted-foreground text-xs">{r.detail}</div></div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </Card>

      {/* Compliance, Audit, Target Tracking, Expense Control, Future Prediction */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><div className="text-sm font-semibold">{lang === "bn" ? "কমপ্লায়েন্স স্কোর" : "Compliance Score"}</div></div>
          <div className="text-3xl font-bold">{metrics.complianceScore}%</div>
          <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden"><div className={`h-full ${metrics.complianceScore >= 80 ? "bg-emerald-500" : metrics.complianceScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${metrics.complianceScore}%` }} /></div>
          <div className="text-[11px] text-muted-foreground mt-1">{metrics.latestChecks} {lang === "bn" ? "সর্বশেষ চেক" : "checks in latest audit"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><FileCheck2 className="w-5 h-5 text-indigo-500" /><div className="text-sm font-semibold">{lang === "bn" ? "অডিট স্ট্যাটাস" : "Audit Status"}</div></div>
          <div className="text-sm font-medium">{metrics.latestAudit?.audit_type ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">{metrics.latestAudit?.audit_date ?? "—"} • {metrics.latestAudit?.auditor_name ?? "—"}</div>
          <div className="text-[11px] mt-1">{metrics.auditCount} {lang === "bn" ? "সাম্প্রতিক রিপোর্ট" : "recent reports"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Target className="w-5 h-5 text-blue-500" /><div className="text-sm font-semibold">{lang === "bn" ? "টার্গেট ট্র্যাকিং" : "Target Tracking"}</div></div>
          <div className="text-sm">{lang === "bn" ? "মুনাফা" : "Profit"}: <b>{Math.min(100, Math.round((metrics.cur.profit / Math.max(1, metrics.requiredProfit)) * 100))}%</b></div>
          <div className="text-sm">{lang === "bn" ? "আয়" : "Income"}: <b>{metrics.targetIncome > 0 ? Math.min(100, Math.round((metrics.cur.income / metrics.targetIncome) * 100)) : 0}%</b></div>
          <div className="text-[11px] text-muted-foreground mt-1">{metrics.targetCount} {lang === "bn" ? "টার্গেট এন্ট্রি" : "target entries"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Gauge className="w-5 h-5 text-red-500" /><div className="text-sm font-semibold">{lang === "bn" ? "ব্যয় নিয়ন্ত্রণ" : "Expense Control"}</div></div>
          <div className="text-3xl font-bold">{metrics.expenseRatio.toFixed(0)}%</div>
          <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "আয়ের শতকরা ব্যয়" : "of income spent"}</div>
          <div className={`text-[11px] font-semibold mt-1 ${metrics.expenseRatio > 80 ? "text-red-600" : metrics.expenseRatio > 60 ? "text-amber-600" : "text-emerald-600"}`}>
            {metrics.expenseRatio > 80 ? (lang === "bn" ? "ঝুঁকিপূর্ণ" : "High risk") : metrics.expenseRatio > 60 ? (lang === "bn" ? "সতর্ক" : "Caution") : (lang === "bn" ? "ভালো" : "Healthy")}
          </div>
        </Card>
      </div>

      {/* Customers, VIP, Staff Ranking, AI Prediction */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Crown className="w-5 h-5 text-amber-500" /><h3 className="font-semibold">{lang === "bn" ? "গ্রাহক ও VIP বিশ্লেষণ" : "Customer & VIP Analysis"}</h3></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-md bg-muted/50"><div className="text-2xl font-bold">{fmt.num(metrics.totalCustomers)}</div><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "মোট গ্রাহক" : "Total Customers"}</div></div>
            <div className="p-3 rounded-md bg-amber-500/10"><div className="text-2xl font-bold text-amber-600">{fmt.num(metrics.vipCustomers)}</div><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "VIP গ্রাহক" : "VIP Customers"}</div></div>
            <div className="p-3 rounded-md bg-emerald-500/10"><div className="text-sm font-bold text-emerald-600">{fmtBDT(metrics.customerBusinessValue, lang)}</div><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "বার্ষিক ভ্যালু" : "Yearly Value"}</div></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-blue-500" /><h3 className="font-semibold">{lang === "bn" ? "স্টাফ এফিসিয়েন্সি র‌্যাঙ্কিং" : "Staff Efficiency Ranking"}</h3></div>
          {metrics.staffRanking.length === 0 ? (
            <div className="text-xs text-muted-foreground">{lang === "bn" ? "এখনো পারফরম্যান্স রিভিউ নেই" : "No performance reviews yet"}</div>
          ) : (
            <div className="space-y-1.5">
              {metrics.staffRanking.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>{s.name}</div>
                  <div className="flex items-center gap-2"><span className="font-semibold">{s.rating.toFixed(1)}</span><span className="text-[10px] text-muted-foreground">★ ({s.reviews})</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-4 md:col-span-2 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/30">
          <div className="flex items-center gap-2 mb-3"><Brain className="w-5 h-5 text-purple-500" /><h3 className="font-semibold">{lang === "bn" ? "AI ফিউচার প্রেডিকশন" : "AI Future Prediction"}</h3></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "এ মাসে প্রজেক্টেড মুনাফা" : "Projected next-month profit"}</div><div className="text-lg font-bold">{fmtBDT(metrics.projectedNext, lang)}</div></div>
            <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "বার্ষিক প্রজেক্টেড মুনাফা" : "Projected yearly profit"}</div><div className="text-lg font-bold">{fmtBDT(metrics.projectedYear, lang)}</div></div>
            <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "ডিপোজিট গ্রোথ" : "Deposit growth"}</div><div className={`text-lg font-bold ${metrics.depositGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>{metrics.depositGrowth.toFixed(1)}%</div></div>
            <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "ঝুঁকি লেভেল" : "Risk level"}</div><div className={`text-lg font-bold ${metrics.smartAlerts.some((a:any)=>a.level==="high") ? "text-red-600" : metrics.smartAlerts.some((a:any)=>a.level==="medium") ? "text-amber-600" : "text-emerald-600"}`}>{metrics.smartAlerts.some((a:any)=>a.level==="high") ? (lang==="bn"?"উচ্চ":"High") : metrics.smartAlerts.some((a:any)=>a.level==="medium") ? (lang==="bn"?"মাঝারি":"Medium") : (lang==="bn"?"নিম্ন":"Low")}</div></div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">{lang === "bn" ? "৬-মাসের গড় ও সর্বশেষ মাসের ওজনযুক্ত পূর্বাভাস। 'AI বিশ্লেষণ করুন' বাটনে আরও বিস্তারিত পান।" : "Weighted forecast from 6-month average + last month. Click 'Run AI Analysis' for deeper insight."}</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "৬ মাসের আয়-ব্যয়-মুনাফা" : "6-Month Income / Expense / Profit"}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={metrics.trend}>
              <defs>
                <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.6} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#gInc)" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#gExp)" />
              <Area type="monotone" dataKey="profit" stroke="#6366f1" fill="url(#gPro)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "ব্যয়ের শীর্ষ ক্যাটাগরি" : "Top Expense Categories"}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={metrics.expensePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {metrics.expensePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "দৈনিক ডিপোজিট (মাসিক যোগফল)" : "Daily Deposits (Monthly Sum)"}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.depositTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip /><Bar dataKey="deposit" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "রেমিটেন্স ও নতুন অ্যাকাউন্ট" : "Remittance & New Accounts"}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.remitTrend.map((r, i) => ({ ...r, accounts: metrics.acctsTrend[i]?.accounts ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name={lang === "bn" ? "রেমিট সংখ্যা" : "Remit count"} fill="#a855f7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="accounts" name={lang === "bn" ? "নতুন অ্যাকাউন্ট" : "New accounts"} fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* AI Chat */}
      <Card className="p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><MessageSquare className="w-5 h-5 text-primary" />{lang === "bn" ? "AI কে জিজ্ঞেস করুন" : "Ask AI Anything"}</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {presetQs.map((q) => (
            <button key={q} onClick={() => { setQuestion(q); askMut.mutate(q); }} className="text-xs px-3 py-1.5 rounded-full border bg-muted hover:bg-muted/80 transition">{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (question.trim()) askMut.mutate(question); }} className="flex gap-2">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={lang === "bn" ? "আপনার ব্যবসায়িক প্রশ্ন লিখুন..." : "Ask a business question..."} />
          <Button type="submit" disabled={askMut.isPending || !question.trim()}>
            {askMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        {chat.length > 0 && (
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
            {chat.slice().reverse().map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Q: {c.q}</div>
                <div className="text-sm whitespace-pre-wrap p-3 rounded-md bg-muted/50 border">{c.a}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Feature Guide */}
      <Card className="p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3"><Lightbulb className="w-5 h-5 text-amber-500" />{lang === "bn" ? "ফিচার গাইড — কোনটা কী, কেন দরকার" : "Feature Guide — What & Why"}</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {(lang === "bn" ? [
            ["গত মাসের আয়", "মাসিক রিপোর্ট থেকে গত মাসের মোট আয়। নতুন বিনিয়োগ/সঞ্চয় প্ল্যান করতে দেখুন।"],
            ["গত মাসের ব্যয়", "অপারেশনাল খরচ। কোথায় কমানো যায় বুঝতে পাই চার্ট দেখুন।"],
            ["নিট মুনাফা", "আয় − ব্যয়। ম্যানুয়াল এন্ট্রি থাকলে সেটি প্রাধান্য পায়।"],
            ["মুনাফা মার্জিন", "মুনাফা ÷ আয় × ১০০। ১৫–২৫% সুস্থ ব্যবসার সূচক।"],
            ["প্রয়োজনীয় মুনাফা", "টার্গেট থেকে নেওয়া; না থাকলে ব্যয়ের ২৫% হিসাবে অনুমান।"],
            ["মাসিক টার্গেট", "মাসিক টার্গেট পেজের যোগফল — প্রতিটি স্টাফ/ক্যাটাগরির লক্ষ্য।"],
            ["সক্রিয় স্টাফ ও হাজিরা", "চলমান কর্মী সংখ্যা ও তাদের ৬-মাসের হাজিরার হার।"],
            ["ওপেন টাস্ক / ওভারডিউ", "টাস্ক ম্যানেজমেন্টে অসমাপ্ত ও সময় পেরিয়ে যাওয়া কাজ।"],
            ["লো স্টক", "ইনভেন্টরির ≤২ পিস আইটেম — দ্রুত রিঅর্ডার দরকার।"],
            ["ওভারডিউ পেমেন্ট", "আসন্ন পেমেন্টে যেগুলো ডিউ ডেট পার করেছে — দ্রুত আদায় করুন।"],
            ["৬-মাসের ট্রেন্ড", "আয়/ব্যয়/মুনাফার গতি — বৃদ্ধি না কমছে দেখুন।"],
            ["টপ ব্যয় ক্যাটাগরি", "কোন খাতে বেশি খরচ — কমানোর সুযোগ চিহ্নিত করুন।"],
            ["AI বিজনেস ইনসাইট", "Lovable AI আপনার ডেটা বিশ্লেষণ করে সারাংশ, ঝুঁকি, সুপারিশ ও হেলথ স্কোর দেয়।"],
            ["AI কে জিজ্ঞেস করুন", "ব্যবসা সংক্রান্ত যেকোনো প্রশ্ন বাংলায় করুন — তাৎক্ষণিক উত্তর।"],
            ["ব্যবসা রিনিউ গাইড", "টার্গেটের সাথে তুলনা করে কত মুনাফা ঘাটতি ও কীভাবে পূরণ করবেন তা জানায়।"],
          ] : [
            ["Prev Month Income", "Total income from monthly report — basis for planning new investments."],
            ["Prev Month Expense", "Operational spend. Use the pie chart to spot cuts."],
            ["Net Profit", "Income − Expense. Manual monthly profit entry overrides if present."],
            ["Profit Margin", "Profit ÷ Income × 100. 15–25% is healthy."],
            ["Required Profit", "From monthly targets; if none, estimated as 25% above expense."],
            ["Monthly Targets", "Sum of all monthly target entries per staff/category."],
            ["Active Staff & Attendance", "Active employees and 6-month attendance rate."],
            ["Open Tasks / Overdue", "Unfinished tasks; overdue means past due date."],
            ["Low Stock", "Inventory items with ≤2 pcs — reorder soon."],
            ["Overdue Payments", "Upcoming payments past their due date — collect now."],
            ["6-Month Trend", "Income/expense/profit trajectory — see growth direction."],
            ["Top Expense Categories", "Where you spend most — find cut opportunities."],
            ["AI Business Insights", "Lovable AI analyzes your data → summary, risks, recommendations, health score."],
            ["Ask AI Anything", "Ask any business question — instant answer in your language."],
            ["Business Renewal Guide", "Compares profit to target and tells you the gap & how to close it."],
          ]).map(([title, desc]) => (
            <div key={title} className="p-3 rounded-lg border bg-muted/30">
              <div className="font-semibold text-sm mb-0.5">{title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, change, sub, tone = "blue", invertChange = false }: {
  icon: React.ReactNode; label: string; value: string; change?: number; sub?: string;
  tone?: "green" | "red" | "blue" | "amber"; invertChange?: boolean;
}) {
  const toneCls = {
    green: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400",
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
  }[tone];
  const showChange = typeof change === "number" && isFinite(change) && change !== 0;
  const positive = invertChange ? change! < 0 : change! > 0;
  return (
    <Card className={`p-4 bg-gradient-to-br ${toneCls} border-0`}>
      <div className="flex items-center justify-between mb-2">
        <div className="opacity-80">{icon}</div>
        {showChange && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${positive ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-red-500/20 text-red-700 dark:text-red-300"}`}>
            {change! > 0 ? "▲" : "▼"} {Math.abs(change!).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-bold mt-0.5 text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">{icon}{title}</div>
      {children}
    </div>
  );
}
