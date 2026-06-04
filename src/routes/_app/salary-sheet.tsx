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
import { Printer, Save, Search, CheckCircle2, Clock } from "lucide-react";
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

      {/* A4 Print Sheet */}
      <div className="print-area">
        <div className="mx-auto bg-white text-black border print:border-0 shadow-sm print:shadow-none p-5 print:p-6"
          style={{ maxWidth: "297mm", minHeight: "210mm" }}>
          {/* Header */}
          <div className="border-b-2 border-black pb-3 mb-3 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center font-bold text-lg shrink-0" style={{ background: "var(--gradient-gold)" }}>
              IB
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
                        <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "var(--gradient-primary)" }}>
                          {initials(s.name)}
                        </div>
                      </td>
                      <td className="border border-black p-1 font-semibold whitespace-nowrap">{s.name}</td>
                      <td className="border border-black p-1 text-center font-mono">{s.id.slice(0, 6).toUpperCase()}</td>
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
