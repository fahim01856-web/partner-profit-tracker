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
import { Plus, Trash2, Printer, Save, Copy } from "lucide-react";

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

  const renderRow = (row: Item) => {
    const d = draft[row.id];
    return (
      <tr key={row.id} className="border-t">
        <td className="p-2 text-center w-12">{fmt.num(row.sl_no)}</td>
        <td className="p-2">
          <Input
            className="h-8 print:border-0 print:shadow-none print:bg-transparent print:p-0"
            value={d?.description ?? row.description}
            onChange={(e) => setDraft((p) => ({ ...p, [row.id]: { description: e.target.value, amount: p[row.id]?.amount ?? String(row.amount) } }))}
            onBlur={() => { if (draft[row.id]) updateRow.mutate(row); }}
          />
        </td>
        <td className="p-2 w-40">
          <Input
            type="number" step="0.01"
            className="h-8 text-right print:border-0 print:shadow-none print:bg-transparent print:p-0"
            value={d?.amount ?? String(row.amount)}
            onChange={(e) => setDraft((p) => ({ ...p, [row.id]: { description: p[row.id]?.description ?? row.description, amount: e.target.value } }))}
            onBlur={() => { if (draft[row.id]) updateRow.mutate(row); }}
          />
        </td>
        <td className="p-2 w-10 no-print">
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

      {/* A4 Print Sheet */}
      <div className="print-area">
        <div className="mx-auto bg-white text-black border print:border-0 shadow-sm print:shadow-none p-6 print:p-8" style={{ maxWidth: "210mm", minHeight: "297mm" }}>
          {/* Header */}
          <div className="border-b-2 border-black pb-3 mb-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center font-bold text-lg shrink-0" style={{ background: "var(--gradient-gold)" }}>
              IB
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

          {/* Two-column tables: Income | Expense */}
          <div className="grid grid-cols-2 gap-4">
            {/* Income */}
            <div>
              <table className="w-full text-sm border border-black border-collapse">
                <thead>
                  <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                    <th className="border border-black p-1 w-10">Sl</th>
                    <th className="border border-black p-1 text-left">{t("mr_income_desc")}</th>
                    <th className="border border-black p-1 w-32 text-right">{t("amount")}</th>
                    <th className="border border-black p-1 w-10 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.length === 0 && (
                    <tr><td colSpan={4} className="border border-black p-3 text-center text-muted-foreground">{t("noEntries")}</td></tr>
                  )}
                  {incomes.map(renderRow)}
                  {/* Empty filler rows for paper look */}
                  {Array.from({ length: Math.max(0, 10 - incomes.length) }).map((_, i) => (
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
              <table className="w-full text-sm border border-black border-collapse">
                <thead>
                  <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                    <th className="border border-black p-1 w-10">Sl</th>
                    <th className="border border-black p-1 text-left">{t("mr_expense_desc")}</th>
                    <th className="border border-black p-1 w-32 text-right">{t("amount")}</th>
                    <th className="border border-black p-1 w-10 no-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan={4} className="border border-black p-3 text-center text-muted-foreground">{t("noEntries")}</td></tr>
                  )}
                  {expenses.map(renderRow)}
                  {Array.from({ length: Math.max(0, 10 - expenses.length) }).map((_, i) => (
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
