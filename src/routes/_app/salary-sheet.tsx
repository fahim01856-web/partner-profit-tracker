import { BankLogo } from "@/components/BankLogo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFmt, monthsOf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { amountInWords } from "@/lib/amount-words";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Save, Search, CheckCircle2, Clock, Download, TrendingUp, TrendingDown, Minus, Trophy, Wallet, Users, BadgeCheck, AlertTriangle, Sparkles, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { StaffPhoto } from "@/components/StaffPhoto";

export const Route = createFileRoute("/_app/salary-sheet")({ component: SalarySheetPage });

type Staff = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  monthly_salary: number;
  joining_date: string | null;
  active: boolean;
  photo_url?: string | null;
  nid?: string | null;
};

type Salary = {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  base_salary: number;
  deductions: number;
  bonus: number;
  allowance: number;
  working_days: number;
  net_paid: number;
  payment_status: string;
  paid_on: string | null;
};

type RowDraft = {
  base_salary: number;
  bonus: number;
  allowance: number;
  deductions: number;
  working_days: number;
};

const now = new Date();

function SalarySheetPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [search, setSearch] = useState("");
  const monthNames = monthsOf(lang);

  const { data: staff = [] } = useQuery({
    queryKey: ["ss-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff").select("*").eq("active", true).order("sort_order").order("name");
      if (error) throw error;
      return data as Staff[];
    },
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["ss-salaries", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salaries").select("*").eq("month", month).eq("year", year);
      if (error) throw error;
      return data as Salary[];
    },
  });

  // Previous month salaries for MoM comparison
  const prevPeriod = useMemo(() => {
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    return { m, y };
  }, [month, year]);

  const { data: prevSalaries = [] } = useQuery({
    queryKey: ["ss-salaries-prev", prevPeriod.m, prevPeriod.y],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salaries").select("*").eq("month", prevPeriod.m).eq("year", prevPeriod.y);
      if (error) throw error;
      return data as Salary[];
    },
  });

  // Local edit buffer keyed by staff_id
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  const getRow = (s: Staff): RowDraft => {
    if (drafts[s.id]) return drafts[s.id];
    const existing = salaries.find((x) => x.staff_id === s.id);
    return {
      base_salary: Number(existing?.base_salary ?? s.monthly_salary),
      bonus: Number(existing?.bonus ?? 0),
      allowance: Number(existing?.allowance ?? 0),
      deductions: Number(existing?.deductions ?? 0),
      working_days: Number(existing?.working_days ?? 30),
    };
  };

  const setField = (id: string, field: keyof RowDraft, value: number) => {
    setDrafts((p) => ({ ...p, [id]: { ...getRowSnapshot(id), [field]: value } }));
  };
  const getRowSnapshot = (id: string): RowDraft => {
    if (drafts[id]) return drafts[id];
    const s = staff.find((x) => x.id === id);
    if (!s) return { base_salary: 0, bonus: 0, allowance: 0, deductions: 0, working_days: 30 };
    return getRow(s);
  };

  const computeNet = (r: RowDraft) =>
    Number(r.base_salary || 0) + Number(r.bonus || 0) + Number(r.allowance || 0) - Number(r.deductions || 0);

  const saveRow = useMutation({
    mutationFn: async (p: { staff_id: string; row: RowDraft; status?: string }) => {
      const net = computeNet(p.row);
      const existing = salaries.find((x) => x.staff_id === p.staff_id);
      const { error } = await supabase.from("salaries").upsert({
        staff_id: p.staff_id, month, year,
        base_salary: p.row.base_salary,
        bonus: p.row.bonus,
        allowance: p.row.allowance,
        deductions: p.row.deductions,
        working_days: p.row.working_days,
        net_paid: net,
        payment_status: p.status ?? existing?.payment_status ?? "pending",
        paid_on: (p.status ?? existing?.payment_status) === "paid"
          ? (existing?.paid_on ?? new Date().toISOString().slice(0, 10))
          : null,
      }, { onConflict: "staff_id,month,year" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      setDrafts((p) => { const n = { ...p }; delete n[vars.staff_id]; return n; });
      qc.invalidateQueries({ queryKey: ["ss-salaries", month, year] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePaid = (s: Staff) => {
    const row = getRowSnapshot(s.id);
    const existing = salaries.find((x) => x.staff_id === s.id);
    const status = existing?.payment_status === "paid" ? "pending" : "paid";
    saveRow.mutate({ staff_id: s.id, row, status });
    toast.success(status === "paid" ? t("ss_mark_paid") : t("ss_mark_pending"));
  };

  const saveAll = async () => {
    const ids = Object.keys(drafts);
    if (ids.length === 0) return;
    for (const id of ids) {
      await saveRow.mutateAsync({ staff_id: id, row: drafts[id] });
    }
    toast.success(t("salary_saved"));
  };

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.position ?? "").toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q)
    );
  }, [staff, search]);

  // Totals
  const totals = useMemo(() => {
    let basic = 0, bonus = 0, allowance = 0, ded = 0, net = 0;
    filtered.forEach((s) => {
      const r = getRow(s);
      basic += Number(r.base_salary || 0);
      bonus += Number(r.bonus || 0);
      allowance += Number(r.allowance || 0);
      ded += Number(r.deductions || 0);
      net += computeNet(r);
    });
    return { basic, bonus, allowance, ded, net };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, drafts, salaries]);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - 2 + i);
  }, []);

  const reportDate = fmt.date(new Date());
  const periodLabel = `${monthNames[month - 1]} ${fmt.num(year)}`;

  const initials = (name: string) =>
    name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  // Smart analytics
  const analytics = useMemo(() => {
    const rows = filtered.map((s) => {
      const r = getRow(s);
      const existing = salaries.find((x) => x.staff_id === s.id);
      return { staff: s, net: computeNet(r), status: existing?.payment_status ?? "pending", paidOn: existing?.paid_on ?? null };
    });
    const paidCount = rows.filter((x) => x.status === "paid").length;
    const pendingCount = rows.length - paidCount;
    const paidAmount = rows.filter((x) => x.status === "paid").reduce((a, x) => a + x.net, 0);
    const pendingAmount = totals.net - paidAmount;
    const avg = rows.length ? totals.net / rows.length : 0;
    const prevTotal = prevSalaries.reduce((a, x) => a + Number(x.net_paid || 0), 0);
    const momPct = prevTotal > 0 ? ((totals.net - prevTotal) / prevTotal) * 100 : 0;
    const progress = rows.length ? Math.round((paidCount / rows.length) * 100) : 0;
    const bonusRecipients = rows.filter((x) => Number(getRow(x.staff).bonus) > 0).length;
    const deductionCount = rows.filter((x) => Number(getRow(x.staff).deductions) > 0).length;
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyCost = totals.net / daysInMonth;
    const bonusRatio = totals.net > 0 ? (totals.bonus / totals.net) * 100 : 0;
    const deductionRatio = (totals.basic + totals.bonus + totals.allowance) > 0
      ? (totals.ded / (totals.basic + totals.bonus + totals.allowance)) * 100 : 0;
    const trend = prevTotal > 0 ? totals.net / prevTotal : 1;
    const forecast = totals.net * (trend > 0 ? trend : 1);
    const coverage = totals.net > 0 ? (paidAmount / totals.net) * 100 : 0;
    const totalDays = rows.reduce((a, x) => a + Number(getRow(x.staff).working_days || 0), 0);
    const avgDays = rows.length ? totalDays / rows.length : 0;
    const netPerDay = totalDays > 0 ? totals.net / totalDays : 0;
    return { paidCount, pendingCount, paidAmount, pendingAmount, avg, prevTotal, momPct, progress, bonusRecipients, deductionCount, dailyCost, bonusRatio, deductionRatio, forecast, coverage, avgDays, netPerDay };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, drafts, salaries, prevSalaries, totals]);

  const exportCSV = () => {
    const headers = ["SL", "Name", "Designation", "Phone", "Working Days", "Basic", "Bonus", "Allowance", "Deduction", "Net", "Status"];
    const lines = [headers.join(",")];
    filtered.forEach((s, i) => {
      const r = getRow(s);
      const existing = salaries.find((x) => x.staff_id === s.id);
      lines.push([
        i + 1, `"${s.name}"`, `"${s.position ?? ""}"`, s.phone ?? "",
        r.working_days, r.base_salary, r.bonus, r.allowance, r.deductions,
        computeNet(r), existing?.payment_status ?? "pending",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `salary-sheet-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const markAllPaid = async () => {
    const pending = filtered.filter((s) => {
      const ex = salaries.find((x) => x.staff_id === s.id);
      return (ex?.payment_status ?? "pending") !== "paid";
    });
    if (pending.length === 0) { toast.info("All already paid"); return; }
    for (const s of pending) {
      await saveRow.mutateAsync({ staff_id: s.id, row: getRowSnapshot(s.id), status: "paid" });
    }
    toast.success(`Marked ${pending.length} as paid`);
  };

  return (
    <div className="space-y-6">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } }`}</style>
      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("ss_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("ss_sub")} — {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">{t("pp_month")}</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm block"
              value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">{t("pp_year")}</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm block"
              value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{fmt.num(y)}</option>)}
            </select>
          </div>
          <div className="relative">
            <Label className="text-xs">{t("ss_search")}</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pl-8 w-56" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("ss_search")} />
            </div>
          </div>
          <Button variant="secondary" onClick={saveAll} disabled={Object.keys(drafts).length === 0}>
            <Save className="w-4 h-4 mr-1" /> {t("ss_save_all")} ({fmt.num(Object.keys(drafts).length)})
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" onClick={markAllPaid} className="border-success/40 text-success hover:bg-success/10">
            <BadgeCheck className="w-4 h-4 mr-1" /> Mark All Paid
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> {t("ss_print_sheet")}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <SummaryCard label={t("ss_total_employees")} value={fmt.num(filtered.length)} />
        <SummaryCard label={t("ss_total_basic")} value={fmt.bdt(totals.basic)} />
        <SummaryCard label={t("ss_total_bonus")} value={fmt.bdt(totals.bonus)} accent="text-success" />
        <SummaryCard label={t("ss_total_allowance")} value={fmt.bdt(totals.allowance)} />
        <SummaryCard label={t("ss_total_deduction")} value={fmt.bdt(totals.ded)} accent="text-destructive" />
        <SummaryCard label={t("ss_grand_total")} value={fmt.bdt(totals.net)} accent="text-primary" />
      </div>

      {/* Smart Analytics Panel */}
      <div className="no-print grid grid-cols-1 gap-4">
        {/* Payment Progress */}
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Payment Progress — {periodLabel}</h3>
            </div>
            <span className="text-xs font-bold text-primary">{fmt.num(analytics.progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-success to-primary transition-all" style={{ width: `${analytics.progress}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniMetric icon={<BadgeCheck className="w-4 h-4" />} label="Paid" value={fmt.num(analytics.paidCount)} sub={fmt.bdt(analytics.paidAmount)} tone="success" />
            <MiniMetric icon={<Clock className="w-4 h-4" />} label="Pending" value={fmt.num(analytics.pendingCount)} sub={fmt.bdt(analytics.pendingAmount)} tone="warn" />
            <MiniMetric icon={<Wallet className="w-4 h-4" />} label="Avg / Staff" value={fmt.bdt(analytics.avg)} tone="default" />
            <MiniMetric
              icon={analytics.momPct > 0 ? <TrendingUp className="w-4 h-4" /> : analytics.momPct < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              label="vs Last Month"
              value={`${analytics.momPct > 0 ? "+" : ""}${analytics.momPct.toFixed(1)}%`}
              sub={fmt.bdt(analytics.prevTotal)}
              tone={analytics.momPct > 0 ? "success" : analytics.momPct < 0 ? "danger" : "default"}
            />
          </div>
        </Card>

        {/* Smart Insights — payroll health */}
        <Card className="p-4 bg-gradient-to-br from-accent/30 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Smart Insights</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <InsightChip icon={<Wallet className="w-3.5 h-3.5 text-primary" />} label="Daily Payroll Cost" value={fmt.bdt(analytics.dailyCost)} />
            <InsightChip icon={<Sparkles className="w-3.5 h-3.5 text-success" />} label="Bonus Ratio" value={`${analytics.bonusRatio.toFixed(1)}%`} />
            <InsightChip icon={<AlertTriangle className="w-3.5 h-3.5 text-destructive" />} label="Deduction Ratio" value={`${analytics.deductionRatio.toFixed(1)}%`} />
            <InsightChip icon={<TrendingUp className="w-3.5 h-3.5 text-primary" />} label="Next Month Forecast" value={fmt.bdt(analytics.forecast)} />
            <InsightChip icon={<BadgeCheck className="w-3.5 h-3.5 text-success" />} label="Payout Coverage" value={`${analytics.coverage.toFixed(0)}%`} />
            <InsightChip icon={<Clock className="w-3.5 h-3.5 text-amber-600" />} label="Pending Payout" value={fmt.bdt(analytics.pendingAmount)} />
            <InsightChip icon={<Calendar className="w-3.5 h-3.5 text-primary" />} label="Avg Working Days" value={analytics.avgDays.toFixed(1)} />
            <InsightChip icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />} label="Net / Working Day" value={fmt.bdt(analytics.netPerDay)} />
          </div>
        </Card>
      </div>



      {/* A4 Print Sheet */}
      <div className="print-area">
        <div className="mx-auto bg-white text-black border print:border-0 shadow-sm print:shadow-none p-5 print:p-6"
          style={{ maxWidth: "297mm", minHeight: "210mm" }}>
          {/* Header */}
          <div className="border-b-2 border-black pb-3 mb-3 flex items-center gap-4">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center">
              <BankLogo className="w-full h-full" />
            </div>
            <div className="flex-1 text-center">
              <div className="text-base font-semibold">Islami Bank Bangladesh PLC</div>
              <div className="text-xl font-extrabold tracking-wide">ISLAMI BANK AGENT BANKING</div>
              <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
              <div className="text-xs">Fakir Bazar Outlet, Burichong, Cumilla</div>
            </div>
            <div className="text-right text-xs leading-5 shrink-0">
              <div><strong>{t("date")}:</strong> {reportDate}</div>
              <div><strong>{t("pp_month")}:</strong> {periodLabel}</div>
            </div>
          </div>

          <div className="text-center mb-3">
            <div className="inline-block border-2 border-black px-5 py-1 text-base font-extrabold uppercase tracking-wide">
              {t("ss_title")} — {periodLabel}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border border-black border-collapse">
              <thead>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                  {[
                    t("ss_sl"), t("ss_photo"), t("ss_emp_name"), t("ss_emp_id"),
                    t("ss_mobile"), t("ss_joining"), t("ss_designation"),
                    t("ss_working_days"), t("ss_basic"), t("ss_bonus"),
                    t("ss_allowance"), t("ss_deduction"), t("ss_net"),
                    t("ss_status"), t("ss_signature"),
                  ].map((h, i) => (
                    <th key={i} className="border border-black p-1 text-center font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="border border-black p-4 text-center text-muted-foreground">{t("ss_no_staff")}</td></tr>
                )}
                {filtered.map((s, idx) => {
                  const r = getRow(s);
                  const net = computeNet(r);
                  const existing = salaries.find((x) => x.staff_id === s.id);
                  const status = existing?.payment_status ?? "pending";
                  const isDirty = !!drafts[s.id];
                  return (
                    <tr key={s.id} className={cn("border-t hover:bg-muted/40 print:hover:bg-transparent", isDirty && "bg-accent/20")}>
                      <td className="border border-black p-1 text-center">{fmt.num(idx + 1)}</td>
                      <td className="border border-black p-1 text-center">
                        <div className="mx-auto w-8 h-8">
                          <StaffPhoto path={s.photo_url} name={s.name} className="w-8 h-8 rounded-full object-cover border bg-muted" />
                        </div>
                      </td>
                      <td className="border border-black p-1 font-semibold whitespace-nowrap">{s.name}</td>
                      <td className="border border-black p-1 text-center font-mono">{s.nid ?? "—"}</td>
                      <td className="border border-black p-1 text-center whitespace-nowrap">{s.phone ?? "—"}</td>
                      <td className="border border-black p-1 text-center whitespace-nowrap">{s.joining_date ? fmt.date(s.joining_date) : "—"}</td>
                      <td className="border border-black p-1 whitespace-nowrap">{s.position ?? "—"}</td>
                      <td className="border border-black p-0.5">
                        <Input type="number" value={r.working_days} onChange={(e) => setField(s.id, "working_days", Number(e.target.value))}
                          className="h-7 text-center text-[11px] print:border-0 print:shadow-none print:bg-transparent print:p-0" />
                      </td>
                      <td className="border border-black p-0.5">
                        <Input type="number" value={r.base_salary} onChange={(e) => setField(s.id, "base_salary", Number(e.target.value))}
                          className="h-7 text-right text-[11px] print:border-0 print:shadow-none print:bg-transparent print:p-0" />
                      </td>
                      <td className="border border-black p-0.5">
                        <Input type="number" value={r.bonus} onChange={(e) => setField(s.id, "bonus", Number(e.target.value))}
                          className="h-7 text-right text-[11px] print:border-0 print:shadow-none print:bg-transparent print:p-0" />
                      </td>
                      <td className="border border-black p-0.5">
                        <Input type="number" value={r.allowance} onChange={(e) => setField(s.id, "allowance", Number(e.target.value))}
                          className="h-7 text-right text-[11px] print:border-0 print:shadow-none print:bg-transparent print:p-0" />
                      </td>
                      <td className="border border-black p-0.5">
                        <Input type="number" value={r.deductions} onChange={(e) => setField(s.id, "deductions", Number(e.target.value))}
                          className="h-7 text-right text-[11px] print:border-0 print:shadow-none print:bg-transparent print:p-0" />
                      </td>
                      <td className="border border-black p-1 text-right font-bold whitespace-nowrap">{fmt.bdt(net)}</td>
                      <td className="border border-black p-1 text-center">
                        <button onClick={() => togglePaid(s)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
                            status === "paid"
                              ? "bg-success/15 text-success border border-success/40"
                              : "bg-destructive/10 text-destructive border border-destructive/30"
                          )}
                          title={status === "paid" ? t("ss_mark_pending") : t("ss_mark_paid")}>
                          {status === "paid" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {status === "paid" ? t("ss_paid") : t("ss_pending")}
                        </button>
                      </td>
                      <td className="border border-black p-1" style={{ minWidth: 70 }}>&nbsp;</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                  <td className="border border-black p-1 text-right" colSpan={8}>{t("ss_grand_total")}</td>
                  <td className="border border-black p-1 text-right">{fmt.bdt(totals.basic)}</td>
                  <td className="border border-black p-1 text-right">{fmt.bdt(totals.bonus)}</td>
                  <td className="border border-black p-1 text-right">{fmt.bdt(totals.allowance)}</td>
                  <td className="border border-black p-1 text-right">{fmt.bdt(totals.ded)}</td>
                  <td className="border border-black p-1 text-right text-sm">{fmt.bdt(totals.net)}</td>
                  <td className="border border-black p-1" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in words */}
          <div className="mt-3 border border-black p-2 text-sm">
            <strong>{t("ss_amount_words")}:</strong>{" "}
            <span className="italic">{amountInWords(totals.net, lang)}</span>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-16 text-center text-xs">
            <div><div className="border-t border-black pt-1 font-semibold">{t("ss_prepared_by")}</div></div>
            <div><div className="border-t border-black pt-1 font-semibold">{t("ss_checked_by")}</div></div>
            <div><div className="border-t border-black pt-1 font-semibold">{t("ss_approved_by")}</div></div>
          </div>

          <div className="mt-4 pt-2 border-t border-black text-[10px] text-center text-muted-foreground">
            ISLAMI BANK AGENT BANKING — M/S FEED HOUSE (121/11), Fakir Bazar, Burichong, Cumilla · {reportDate}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold", accent ?? "text-foreground")}>{value}</div>
    </Card>
  );
}

function MiniMetric({ icon, label, value, sub, tone = "default" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "default" | "success" | "warn" | "danger" }) {
  const toneCls =
    tone === "success" ? "text-success border-success/30 bg-success/5" :
    tone === "warn" ? "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/10" :
    tone === "danger" ? "text-destructive border-destructive/30 bg-destructive/5" :
    "text-foreground border-border bg-muted/40";
  return (
    <div className={cn("rounded-lg border p-2.5", toneCls)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">{icon}{label}</div>
      <div className="text-base font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function InsightChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-2">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xs font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

