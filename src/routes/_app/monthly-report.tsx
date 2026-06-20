import { BankLogo } from "@/components/BankLogo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFmt, monthsOf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer, Save, Copy, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ClientOnly } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/monthly-report")({ component: MonthlyReportPage });

type Item = {
  id: string;
  month: number;
  year: number;
  item_type: "income" | "expense";
  sl_no: number;
  description: string;
  amount: number;
};

const now = new Date();

function MonthlyReportPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [sheetNo, setSheetNo] = useState<string>("");

  const { data: items = [] } = useQuery({
    queryKey: ["mri", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_report_items")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("item_type", { ascending: true })
        .order("sl_no", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
  });

  // All items for current + previous year for analytics
  const { data: allItems = [] } = useQuery({
    queryKey: ["mri-all", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_report_items")
        .select("month, year, item_type, amount")
        .in("year", [year, year - 1]);
      if (error) throw error;
      return data as Pick<Item, "month" | "year" | "item_type" | "amount">[];
    },
  });

  // Local edit buffer (so admins can type freely and save)
  const [draft, setDraft] = useState<Record<string, { description: string; amount: string }>>({});

  const incomes = items.filter((i) => i.item_type === "income");
  const expenses = items.filter((i) => i.item_type === "expense");

  const totalIncome = incomes.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const netProfit = totalIncome - totalExpense;

  const addRow = useMutation({
    mutationFn: async (type: "income" | "expense") => {
      const rows = type === "income" ? incomes : expenses;
      const sl = (rows[rows.length - 1]?.sl_no ?? 0) + 1;
      const { error } = await supabase.from("monthly_report_items").insert({
        month, year, item_type: type, sl_no: sl, description: "", amount: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mri", year, month] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRow = useMutation({
    mutationFn: async (row: Item) => {
      const d = draft[row.id];
      const desc = d?.description ?? row.description;
      const amt = d?.amount !== undefined ? Number(d.amount) : Number(row.amount);
      const { error } = await supabase
        .from("monthly_report_items")
        .update({ description: desc, amount: Number.isFinite(amt) ? amt : 0 })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: (_d, row) => {
      setDraft((p) => { const n = { ...p }; delete n[row.id]; return n; });
      toast.success(t("mr_saved"));
      qc.invalidateQueries({ queryKey: ["mri", year, month] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_report_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mri", year, month] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      // copy all items from current month into the next month
      const target = new Date(year, month, 1);
      const ty = target.getFullYear();
      const tm = target.getMonth() + 1;
      const payload = items.map((i) => ({
        month: tm, year: ty, item_type: i.item_type, sl_no: i.sl_no,
        description: i.description, amount: i.amount,
      }));
      if (payload.length === 0) throw new Error(t("mr_nothing_to_copy"));
      const { error } = await supabase.from("monthly_report_items").insert(payload);
      if (error) throw error;
      return { ty, tm };
    },
    onSuccess: ({ ty, tm }) => {
      toast.success(t("mr_duplicated"));
      setYear(ty); setMonth(tm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Load only descriptions (with amount=0) from the most recent previous month that has entries
  const loadTemplateMutation = useMutation({
    mutationFn: async () => {
      // find the most recent (year, month) before the current selection that has entries
      const { data, error } = await supabase
        .from("monthly_report_items")
        .select("month, year, item_type, sl_no, description")
        .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(t("mr_no_template"));
      const latestYear = data[0].year;
      const latestMonth = data[0].month;
      const source = data.filter((r) => r.year === latestYear && r.month === latestMonth);
      if (source.length === 0) throw new Error(t("mr_no_template"));
      const payload = source.map((i) => ({
        month, year, item_type: i.item_type, sl_no: i.sl_no,
        description: i.description, amount: 0,
      }));
      const { error: insErr } = await supabase.from("monthly_report_items").insert(payload);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success(t("mr_template_loaded"));
      qc.invalidateQueries({ queryKey: ["mri", year, month] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const years = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - 2 + i);
  }, []);
  const monthNames = monthsOf(lang);

  const reportDate = fmt.date(new Date());
  const monthLabel = `${monthNames[month - 1]} ${fmt.num(year)}`;

  // Quick-add buffers (type description + amount → Enter/Add inserts into table below)
  const [quickInc, setQuickInc] = useState({ description: "", amount: "" });
  const [quickExp, setQuickExp] = useState({ description: "", amount: "" });

  const quickAdd = useMutation({
    mutationFn: async ({ type, description, amount }: { type: "income" | "expense"; description: string; amount: string }) => {
      const desc = description.trim();
      if (!desc) throw new Error(lang === "bn" ? "বিবরণ লিখুন" : "Enter description");
      const amt = Number(amount);
      const rows = type === "income" ? incomes : expenses;
      const sl = (rows[rows.length - 1]?.sl_no ?? 0) + 1;
      const { error } = await supabase.from("monthly_report_items").insert({
        month, year, item_type: type, sl_no: sl, description: desc, amount: Number.isFinite(amt) ? amt : 0,
      });
      if (error) throw error;
      return type;
    },
    onSuccess: (type) => {
      if (type === "income") setQuickInc({ description: "", amount: "" });
      else setQuickExp({ description: "", amount: "" });
      qc.invalidateQueries({ queryKey: ["mri", year, month] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderRow = (row: Item) => {
    const d = draft[row.id];
    return (
      <tr key={row.id} className="border-t">
        <td className="border border-black p-1 text-center align-middle w-10">{fmt.num(row.sl_no)}</td>
        <td className="border border-black p-1 align-middle">
          <Textarea
            className="min-h-[28px] h-auto py-1 text-[11px] leading-snug print:border-0 print:shadow-none print:bg-transparent print:p-0 print:min-h-0 resize-none w-full"
            rows={1}
            value={d?.description ?? row.description}
            onChange={(e) => setDraft((p) => ({ ...p, [row.id]: { description: e.target.value, amount: p[row.id]?.amount ?? String(row.amount) } }))}
            onBlur={() => { if (draft[row.id]) updateRow.mutate(row); }}
          />
        </td>
        <td className="border border-black p-1 align-middle">
          <Input
            type="number" step="0.01"
            className="h-7 text-right text-xs px-1 print:border-0 print:shadow-none print:bg-transparent print:p-0"
            value={d?.amount ?? String(row.amount)}
            onChange={(e) => setDraft((p) => ({ ...p, [row.id]: { description: p[row.id]?.description ?? row.description, amount: e.target.value } }))}
            onBlur={() => { if (draft[row.id]) updateRow.mutate(row); }}
          />
        </td>
        <td className="border border-black p-1 w-10 no-print text-center">
          <Button size="sm" variant="ghost" onClick={() => delRow.mutate(row.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar (hidden in print) */}
      <div className="no-print flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("mr_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("mr_sub")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">{t("pp_month")}</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">{t("pp_year")}</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{fmt.num(y)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">{t("mr_sheet_no")}</Label>
            <Input className="h-9 w-28" value={sheetNo} onChange={(e) => setSheetNo(e.target.value)} placeholder="001" />
          </div>
          <Button variant="outline" onClick={() => loadTemplateMutation.mutate()} disabled={loadTemplateMutation.isPending}>
            <Copy className="w-4 h-4 mr-1" /> {t("mr_load_template")}
          </Button>
          <Button variant="outline" onClick={() => duplicateMutation.mutate()}>
            <Copy className="w-4 h-4 mr-1" /> {t("mr_duplicate")}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> {t("mr_print")}
          </Button>
        </div>
      </div>

      {/* Empty-month template hint */}
      {items.length === 0 && (
        <Card className="p-4 no-print border-dashed flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">{t("mr_auto_template_hint")}</div>
          <Button size="sm" onClick={() => loadTemplateMutation.mutate()} disabled={loadTemplateMutation.isPending}>
            <Copy className="w-4 h-4 mr-1" /> {t("mr_load_template")}
          </Button>
        </Card>
      )}

      {/* Dashboard summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("mr_total_income")}</div>
          <div className="text-2xl font-bold text-success">{fmt.bdt(totalIncome)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("mr_total_expense")}</div>
          <div className="text-2xl font-bold text-destructive">{fmt.bdt(totalExpense)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("mr_net_profit")}</div>
          <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(netProfit)}</div>
        </Card>
      </div>

      {/* Profit Analytics */}
      {(() => {
        const profitByMonth = (yr: number) => {
          const arr = Array.from({ length: 12 }, () => ({ inc: 0, exp: 0 }));
          for (const it of allItems) {
            if (it.year !== yr) continue;
            const idx = it.month - 1;
            if (idx < 0 || idx > 11) continue;
            if (it.item_type === "income") arr[idx].inc += Number(it.amount);
            else arr[idx].exp += Number(it.amount);
          }
          return arr.map((v) => v.inc - v.exp);
        };
        const cur = profitByMonth(year);
        const prev = profitByMonth(year - 1);
        // Shift by one: "This Month" = previous completed month (profit lands next month)
        const thisIdxRaw = month - 2; // month is 1..12, so prev month index is month-2
        const thisYearArr = thisIdxRaw < 0 ? prev : cur;
        const thisMonthIdx = (thisIdxRaw + 12) % 12;
        const thisMonthProfit = thisYearArr[thisMonthIdx];
        const lastIdxRaw = month - 3;
        const lastYearArr = lastIdxRaw < 0 ? prev : cur;
        const lastMonthIdx = (lastIdxRaw + 12) % 12;
        const lastMonthProfit = lastYearArr[lastMonthIdx];
        const change = lastMonthProfit === 0 ? 0 : ((thisMonthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100;
        const thisMonthName = monthNames[thisMonthIdx];
        const lastMonthName = monthNames[lastMonthIdx];
        const yearlyTotal = cur.reduce((s, v) => s + v, 0);
        const activeIdx = cur.map((v, i) => ({ v, i })).filter((x) => x.v !== 0);
        const hasActive = activeIdx.length > 0;
        let maxIdx = 0, minIdx = 0;
        if (hasActive) {
          maxIdx = activeIdx[0].i; minIdx = activeIdx[0].i;
          for (const { v, i } of activeIdx) {
            if (v > cur[maxIdx]) maxIdx = i;
            if (v < cur[minIdx]) minIdx = i;
          }
        }
        const avgProfit = hasActive ? yearlyTotal / activeIdx.length : 0;
        const positiveMonths = cur.filter((v) => v > 0).length;
        const negativeMonths = cur.filter((v) => v < 0).length;
        const prevYearTotal = prev.reduce((s, v) => s + v, 0);
        const yoyChange = prevYearTotal === 0 ? 0 : ((yearlyTotal - prevYearTotal) / Math.abs(prevYearTotal)) * 100;
        const momDiff = thisMonthProfit - lastMonthProfit;
        const monthDiffs = cur.map((v, i) => {
          const prevV = i === 0 ? prev[11] : cur[i - 1];
          return { month: monthNames[i], profit: v, diff: v - prevV };
        });
        const chartData = cur.map((v, i) => ({ month: monthNames[i], thisYear: v, lastYear: prev[i], diff: monthDiffs[i].diff }));
        const hasAny = cur.some((v) => v !== 0) || prev.some((v) => v !== 0);
        return (
          <div className="space-y-3 no-print">
            <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />{lang === "bn" ? "লাভ বিশ্লেষণ" : "Profit Analytics"}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? `${thisMonthName} মাসের লাভ` : `${thisMonthName} Profit`}</div><div className={`text-lg font-bold ${thisMonthProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(thisMonthProfit)}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? `${lastMonthName} মাসের লাভ` : `${lastMonthName} Profit`}</div><div className={`text-lg font-bold ${lastMonthProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(lastMonthProfit)}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? `পরিবর্তন (${lastMonthName}→${thisMonthName})` : `Change (${lastMonthName}→${thisMonthName})`}</div><div className={`text-lg font-bold flex items-center gap-1 ${change >= 0 ? "text-success" : "text-destructive"}`}>{change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{change.toFixed(1)}%</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? `পার্থক্য (${lastMonthName}→${thisMonthName})` : `Diff (${lastMonthName}→${thisMonthName})`}</div><div className={`text-lg font-bold flex items-center gap-1 ${momDiff >= 0 ? "text-success" : "text-destructive"}`}>{momDiff >= 0 ? "+" : ""}{fmt.bdt(momDiff)}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "গড় মাসিক লাভ" : "Average Profit"}</div><div className={`text-lg font-bold ${avgProfit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(avgProfit)}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "বার্ষিক মোট" : "Yearly Total"} ({fmt.num(year)})</div><div className={`text-lg font-bold ${yearlyTotal >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(yearlyTotal)}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "বার্ষিক পরিবর্তন (YoY)" : "Change (YoY)"}</div><div className={`text-lg font-bold flex items-center gap-1 ${yoyChange >= 0 ? "text-success" : "text-destructive"}`}>{yoyChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{yoyChange.toFixed(1)}%</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "সর্বোচ্চ লাভের মাস" : "Highest Profit Month"}</div><div className="text-sm font-bold">{hasActive ? monthNames[maxIdx] : "—"}</div><div className="text-xs text-success">{hasActive ? fmt.bdt(cur[maxIdx]) : ""}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "সর্বনিম্ন লাভের মাস" : "Lowest Profit Month"}</div><div className="text-sm font-bold">{hasActive ? monthNames[minIdx] : "—"}</div><div className="text-xs text-destructive">{hasActive ? fmt.bdt(cur[minIdx]) : ""}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "লাভজনক মাস" : "Profitable Months"}</div><div className="text-lg font-bold text-success">{fmt.num(positiveMonths)} / {fmt.num(12)}</div></Card>
              <Card className="p-3"><div className="text-[10px] text-muted-foreground">{lang === "bn" ? "লোকসানের মাস" : "Loss Months"}</div><div className="text-lg font-bold text-destructive">{fmt.num(negativeMonths)} / {fmt.num(12)}</div></Card>
            </div>
            {hasAny && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "বার্ষিক তুলনা" : "Yearly Comparison"} — {fmt.num(year - 1)} vs {fmt.num(year)}</h3>
                <ClientOnly fallback={<div className="h-64" />}>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmt.bdt(v)} />
                        <Legend />
                        <Bar dataKey="lastYear" fill="#94a3b8" name={String(year - 1)} />
                        <Bar dataKey="thisYear" fill="#10b981" name={String(year)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ClientOnly>
              </Card>
            )}


            {hasAny && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "মাসভিত্তিক পার্থক্য" : "Month-over-Month Difference"} ({fmt.num(year)})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b text-left"><th className="py-1.5 pr-2">{lang === "bn" ? "মাস" : "Month"}</th><th className="py-1.5 pr-2 text-right">{lang === "bn" ? "লাভ" : "Profit"}</th><th className="py-1.5 pr-2 text-right">{lang === "bn" ? "পার্থক্য" : "Diff"}</th><th className="py-1.5 text-right">%</th></tr></thead>
                    <tbody>
                      {monthDiffs.map((m, i) => {
                        const prevV = i === 0 ? prev[11] : cur[i - 1];
                        const pct = prevV === 0 ? 0 : (m.diff / Math.abs(prevV)) * 100;
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 pr-2">{m.month}</td>
                            <td className={`py-1.5 pr-2 text-right ${m.profit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(m.profit)}</td>
                            <td className={`py-1.5 pr-2 text-right ${m.diff >= 0 ? "text-success" : "text-destructive"}`}>{m.diff >= 0 ? "+" : ""}{fmt.bdt(m.diff)}</td>
                            <td className={`py-1.5 text-right ${m.diff >= 0 ? "text-success" : "text-destructive"}`}>{prevV === 0 ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* A4 Print Sheet */}
      <div className="print-area">
        <div className="mx-auto bg-white text-black border print:border-0 shadow-sm print:shadow-none p-6 print:p-8" style={{ maxWidth: "210mm", minHeight: "297mm" }}>
          {/* Header */}
          <div className="border-b-2 border-black pb-3 mb-4 flex items-center gap-4">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center">
              <BankLogo className="w-full h-full" />
            </div>
            <div className="flex-1 text-center">
              <div className="text-xl font-extrabold tracking-wide">ISLAMI BANK AGENT BANKING</div>
              <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
              <div className="text-sm">Fakir Bazar Outlet, Burichong, Cumilla</div>
            </div>
            <div className="text-right text-xs leading-5 shrink-0">
              <div><strong>{t("mr_sheet_no")}:</strong> {sheetNo || "—"}</div>
              <div><strong>{t("date")}:</strong> {reportDate}</div>
            </div>
          </div>

          {/* Period title */}
          <div className="text-center mb-3">
            <div className="inline-block border border-black px-4 py-1 text-base font-bold uppercase">
              Monthly Income & Expense Statement — {monthNames[month - 1]} {year}
            </div>
          </div>

          {/* Side-by-side: Income | Expense */}
          <div className="grid grid-cols-2 gap-4">

            {/* Income */}
            <div>
              {/* Quick-add (income) */}
              <div className="no-print mb-2 flex gap-1">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder={lang === "bn" ? "আয়ের বিবরণ লিখুন…" : "Income description…"}
                  value={quickInc.description}
                  onChange={(e) => setQuickInc((p) => ({ ...p, description: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") quickAdd.mutate({ type: "income", ...quickInc }); }}
                />
                <Input
                  className="h-8 text-xs w-24 text-right"
                  type="number" step="0.01" placeholder="0"
                  value={quickInc.amount}
                  onChange={(e) => setQuickInc((p) => ({ ...p, amount: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") quickAdd.mutate({ type: "income", ...quickInc }); }}
                />
                <Button size="sm" onClick={() => quickAdd.mutate({ type: "income", ...quickInc })} disabled={quickAdd.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <table className="w-full text-sm border border-black border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col />
                  <col style={{ width: "90px" }} />
                  <col className="no-print" style={{ width: "36px" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                    <th className="border border-black p-1 text-center">Sl</th>
                    <th className="border border-black p-1 text-left">{t("mr_income_desc")}</th>
                    <th className="border border-black p-1 text-right">{t("amount")}</th>
                    <th className="border border-black p-1 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.length === 0 && (
                    <tr><td colSpan={4} className="border border-black p-3 text-center text-muted-foreground">{t("noEntries")}</td></tr>
                  )}
                  {incomes.map(renderRow)}
                  {Array.from({ length: Math.max(0, 8 - incomes.length) }).map((_, i) => (
                    <tr key={`fi-${i}`} className="border-t print:h-7">
                      <td className="border border-black p-1">&nbsp;</td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1 no-print"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                    <td className="border border-black p-1 text-right" colSpan={2}>{t("mr_total_income")}</td>
                    <td className="border border-black p-1 text-right">{fmt.bdt(totalIncome)}</td>
                    <td className="border border-black p-1 no-print"></td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-2 no-print">
                <Button size="sm" variant="outline" onClick={() => addRow.mutate("income")}>
                  <Plus className="w-4 h-4 mr-1" /> {t("mr_add_income")}
                </Button>
              </div>
            </div>

            {/* Expense */}
            <div>
              {/* Quick-add (expense) */}
              <div className="no-print mb-2 flex gap-1">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder={lang === "bn" ? "ব্যয়ের বিবরণ লিখুন…" : "Expense description…"}
                  value={quickExp.description}
                  onChange={(e) => setQuickExp((p) => ({ ...p, description: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") quickAdd.mutate({ type: "expense", ...quickExp }); }}
                />
                <Input
                  className="h-8 text-xs w-24 text-right"
                  type="number" step="0.01" placeholder="0"
                  value={quickExp.amount}
                  onChange={(e) => setQuickExp((p) => ({ ...p, amount: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") quickAdd.mutate({ type: "expense", ...quickExp }); }}
                />
                <Button size="sm" onClick={() => quickAdd.mutate({ type: "expense", ...quickExp })} disabled={quickAdd.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <table className="w-full text-sm border border-black border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "36px" }} />
                  <col />
                  <col style={{ width: "90px" }} />
                  <col className="no-print" style={{ width: "36px" }} />
                </colgroup>
                <thead>
                  <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                    <th className="border border-black p-1 text-center">Sl</th>
                    <th className="border border-black p-1 text-left">{t("mr_expense_desc")}</th>
                    <th className="border border-black p-1 text-right">{t("amount")}</th>
                    <th className="border border-black p-1 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan={4} className="border border-black p-3 text-center text-muted-foreground">{t("noEntries")}</td></tr>
                  )}
                  {expenses.map(renderRow)}
                  {Array.from({ length: Math.max(0, 8 - expenses.length) }).map((_, i) => (
                    <tr key={`fe-${i}`} className="border-t print:h-7">
                      <td className="border border-black p-1">&nbsp;</td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1 no-print"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                    <td className="border border-black p-1 text-right" colSpan={2}>{t("mr_total_expense")}</td>
                    <td className="border border-black p-1 text-right">{fmt.bdt(totalExpense)}</td>
                    <td className="border border-black p-1 no-print"></td>
                  </tr>
                </tfoot>
              </table>
              <div className="mt-2 no-print">
                <Button size="sm" variant="outline" onClick={() => addRow.mutate("expense")}>
                  <Plus className="w-4 h-4 mr-1" /> {t("mr_add_expense")}
                </Button>
              </div>
            </div>
          </div>

          {/* Profit summary */}
          <div className="mt-6 border-2 border-black">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="p-2 border-b border-black"><strong>{t("mr_total_income")}</strong></td>
                  <td className="p-2 border-b border-black text-right font-semibold">{fmt.bdt(totalIncome)}</td>
                </tr>
                <tr>
                  <td className="p-2 border-b border-black"><strong>(-) {t("mr_total_expense")}</strong></td>
                  <td className="p-2 border-b border-black text-right font-semibold">{fmt.bdt(totalExpense)}</td>
                </tr>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                  <td className="p-2 text-base"><strong>{t("mr_net_profit")} ({monthLabel})</strong></td>
                  <td className={`p-2 text-right text-lg font-extrabold ${netProfit < 0 ? "text-destructive" : ""}`}>{fmt.bdt(netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-14 text-center text-xs">
            <div><div className="border-t border-black pt-1">{t("mr_prepared_by")}</div></div>
            <div><div className="border-t border-black pt-1">{t("mr_checked_by")}</div></div>
            <div><div className="border-t border-black pt-1">{t("approvedBy")}</div></div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-2 border-t border-black text-[10px] text-center text-muted-foreground">
            ISLAMI BANK AGENT BANKING — M/S FEED HOUSE (121/11), Fakir Bazar, Burichong, Cumilla · {reportDate}
          </div>
        </div>
      </div>

      {/* Save-all helper */}
      <div className="no-print flex justify-end">
        <Button variant="secondary" disabled={Object.keys(draft).length === 0}
          onClick={() => {
            const ids = Object.keys(draft);
            ids.forEach((id) => {
              const row = items.find((i) => i.id === id);
              if (row) updateRow.mutate(row);
            });
          }}>
          <Save className="w-4 h-4 mr-1" /> {t("mr_save_all")} ({fmt.num(Object.keys(draft).length)})
        </Button>
      </div>
    </div>
  );
}
