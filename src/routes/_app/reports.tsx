import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFmt, monthsOf } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileBarChart, Globe2, BookPlus, FolderOpen,
  Plus, Trash2, Printer, Download, FileSpreadsheet,
  Handshake, TrendingUp, Receipt, Wallet, Pencil, Save, X,
} from "lucide-react";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const now = new Date();
const ACCOUNT_TYPES = ["AWCA", "MSA", "MSSA", "MTDR", "MMPDSA", "MHSA", "MFSA", "SMSA"] as const;

/* ------------- Helpers ------------- */
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ===================================================================== */
function ReportsPage() {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <FileBarChart className="w-7 h-7 text-primary" /> {t("nav_reports")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "bn" ? "সকল রিপোর্ট ও প্রিন্ট-যোগ্য তথ্যসমূহ এক জায়গায়" : "All bank reports & printable statements in one place"}
        </p>
      </div>

      <Tabs defaultValue="ie" className="w-full">
        <TabsList className="no-print flex flex-wrap h-auto p-1 gap-1 bg-muted">
          <TabsTrigger value="ie" className="gap-1.5"><FileBarChart className="w-4 h-4" /> {lang === "bn" ? "আয়-ব্যয় রেজিস্টার" : "Income & Expenditure"}</TabsTrigger>
          <TabsTrigger value="remit" className="gap-1.5"><Globe2 className="w-4 h-4" /> {lang === "bn" ? "ফরেন রেমিট্যান্স" : "Foreign Remittance"}</TabsTrigger>
          <TabsTrigger value="ao" className="gap-1.5"><BookPlus className="w-4 h-4" /> {lang === "bn" ? "একাউন্ট ওপেনিং" : "Account Opening"}</TabsTrigger>
          <TabsTrigger value="center" className="gap-1.5"><FolderOpen className="w-4 h-4" /> {lang === "bn" ? "রিপোর্ট সেন্টার" : "Report Center"}</TabsTrigger>
        </TabsList>

        <TabsContent value="ie"><IncomeExpenditureTab /></TabsContent>
        <TabsContent value="remit"><RemittanceTab /></TabsContent>
        <TabsContent value="ao"><AccountOpeningTab /></TabsContent>
        <TabsContent value="center"><ReportCenterTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* =====================================================================
 * 1) Monthly Income & Expenditure Register
 * ===================================================================== */
function IncomeExpenditureTab() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const monthNames = monthsOf(lang);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["mri-all", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_report_items").select("*").eq("year", year);
      if (error) throw error;
      return data as Array<{ month: number; item_type: string; amount: number; description: string }>;
    },
  });

  type Row = { month: number; income: number; expense: number; profit: number; remarks: string };
  const rows: Row[] = useMemo(() => {
    const map: Record<number, Row> = {};
    for (let m = 1; m <= 12; m++) map[m] = { month: m, income: 0, expense: 0, profit: 0, remarks: "" };
    items.forEach((it) => {
      const m = it.month;
      if (it.item_type === "income") map[m].income += Number(it.amount);
      else if (it.item_type === "expense") map[m].expense += Number(it.amount);
    });
    Object.values(map).forEach((r) => (r.profit = r.income - r.expense));
    return Object.values(map);
  }, [items]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return monthNames[r.month - 1].toLowerCase().includes(s) || String(r.month).includes(s);
  });

  const totals = filtered.reduce(
    (s, r) => ({ income: s.income + r.income, expense: s.expense + r.expense, profit: s.profit + r.profit }),
    { income: 0, expense: 0, profit: 0 },
  );

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  const exportCSV = () => {
    const header = ["Month", "Income (BDT)", "Expense (BDT)", "Profit (BDT)", "Remarks", "Approved By"];
    const body = filtered.map((r) => [
      monthNames[r.month - 1],
      Math.round(r.income), Math.round(r.expense), Math.round(r.profit),
      r.remarks, "Md. Fahim",
    ]);
    body.push(["TOTAL", Math.round(totals.income), Math.round(totals.expense), Math.round(totals.profit), "", ""]);
    downloadCSV(`income-expenditure-${year}.csv`, [header, ...body]);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h2 className="text-lg font-bold">{lang === "bn" ? "মাসিক আয়-ব্যয় রেজিস্টার" : "Monthly Income & Expenditure Register"}</h2>
            <p className="text-xs text-muted-foreground">{lang === "bn" ? "অটো টোটাল ও মুনাফা গণনা সহ" : "Auto totals & profit/loss calculation"}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{fmt.num(y)}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">{lang === "bn" ? "মাস খুঁজুন" : "Search month"}</Label>
              <Input className="h-9 w-40" placeholder={lang === "bn" ? "জানুয়ারি…" : "January…"}
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={exportCSV}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "প্রিন্ট / PDF" : "Print / PDF"}</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট আয়" : "Total Income"}</div><div className="text-2xl font-bold text-success">{fmt.bdt(totals.income)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট ব্যয়" : "Total Expense"}</div><div className="text-2xl font-bold text-destructive">{fmt.bdt(totals.expense)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "নিট মুনাফা/ক্ষতি" : "Net Profit/Loss"}</div><div className={`text-2xl font-bold ${totals.profit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt.bdt(totals.profit)}</div></Card>
      </div>

      {/* Printable register */}
      <div className="print-area">
        <Card className="p-4 sm:p-6 print:shadow-none print:border-0 bg-white text-black">
          <div className="border-b-2 border-black pb-3 mb-4 text-center">
            <div className="text-xl font-extrabold">ISLAMI BANK AGENT BANKING</div>
            <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
            <div className="text-sm">Fakir Bazar Outlet, Burichong, Cumilla</div>
            <div className="inline-block mt-2 border border-black px-3 py-0.5 text-sm font-bold uppercase">
              Monthly Income & Expenditure Register — {fmt.num(year)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-black border-collapse">
              <thead>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                  <th className="border border-black p-1.5">{lang === "bn" ? "মাস" : "Month"}</th>
                  <th className="border border-black p-1.5 text-right">{lang === "bn" ? "আয়" : "Income"}</th>
                  <th className="border border-black p-1.5 text-right">{lang === "bn" ? "ব্যয়" : "Expense"}</th>
                  <th className="border border-black p-1.5 text-right">{lang === "bn" ? "মুনাফা/ক্ষতি" : "Profit/Loss"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "মন্তব্য" : "Remarks"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "অনুমোদনকারী" : "Approved By"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.month} className="hover:bg-muted/40">
                    <td className="border border-black p-1.5 font-medium">{monthNames[r.month - 1]}</td>
                    <td className="border border-black p-1.5 text-right">{fmt.bdt(r.income)}</td>
                    <td className="border border-black p-1.5 text-right">{fmt.bdt(r.expense)}</td>
                    <td className={`border border-black p-1.5 text-right font-semibold ${r.profit < 0 ? "text-destructive" : ""}`}>{fmt.bdt(r.profit)}</td>
                    <td className="border border-black p-1.5 text-xs text-muted-foreground">—</td>
                    <td className="border border-black p-1.5 text-xs">Md. Fahim</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100 font-bold">
                  <td className="border border-black p-1.5">{lang === "bn" ? "মোট" : "Total"}</td>
                  <td className="border border-black p-1.5 text-right">{fmt.bdt(totals.income)}</td>
                  <td className="border border-black p-1.5 text-right">{fmt.bdt(totals.expense)}</td>
                  <td className="border border-black p-1.5 text-right">{fmt.bdt(totals.profit)}</td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-muted-foreground mt-3 no-print">
            {lang === "bn" ? "টিপ: মাসিক বিস্তারিত এন্ট্রি / এডিট করতে " : "Tip: To edit monthly line items use "}
            <Link to="/monthly-report" className="text-primary underline">{lang === "bn" ? "Monthly Report" : "Monthly Report"}</Link>
            {lang === "bn" ? " পেজ ব্যবহার করুন।" : " page."}
          </p>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
 * 2) Foreign Remittance Report
 * ===================================================================== */
type Remit = {
  id: string; date: string; branch: string | null; customer_name: string | null;
  remittance_type: string | null; quantity: number; amount: number; note: string | null;
};

function RemittanceTab() {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(0); // 0 = all
  const [search, setSearch] = useState("");
  const monthNames = monthsOf(lang);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    branch: "", customer_name: "", remittance_type: "", quantity: "1", amount: "",
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["remit", year],
    queryFn: async () => {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const { data, error } = await supabase
        .from("remittance_entries").select("*")
        .gte("date", start).lte("date", end)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Remit[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("remittance_entries").insert({
        date: form.date,
        branch: form.branch || null,
        customer_name: form.customer_name || null,
        remittance_type: form.remittance_type || null,
        quantity: Number(form.quantity) || 1,
        amount: Number(form.amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "এন্ট্রি যোগ হয়েছে" : "Entry added");
      setForm({ ...form, customer_name: "", amount: "", quantity: "1", remittance_type: "" });
      qc.invalidateQueries({ queryKey: ["remit", year] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("remittance_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["remit", year] }),
  });

  const filtered = rows.filter((r) => {
    if (month > 0 && new Date(r.date).getMonth() + 1 !== month) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(r.customer_name?.toLowerCase().includes(s) || r.branch?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const totalQty = filtered.reduce((s, r) => s + r.quantity, 0);
  const totalAmt = filtered.reduce((s, r) => s + Number(r.amount), 0);

  // Monthly summary
  const monthlySummary = useMemo(() => {
    const map: Record<number, { qty: number; amt: number }> = {};
    for (let m = 1; m <= 12; m++) map[m] = { qty: 0, amt: 0 };
    rows.forEach((r) => {
      const m = new Date(r.date).getMonth() + 1;
      map[m].qty += r.quantity;
      map[m].amt += Number(r.amount);
    });
    return map;
  }, [rows]);

  // Branch/customer-wise
  const groupBy = (key: "branch" | "customer_name") => {
    const m: Record<string, { qty: number; amt: number }> = {};
    filtered.forEach((r) => {
      const k = r[key] || "—";
      if (!m[k]) m[k] = { qty: 0, amt: 0 };
      m[k].qty += r.quantity;
      m[k].amt += Number(r.amount);
    });
    return m;
  };
  const branchWise = groupBy("branch");
  const customerWise = groupBy("customer_name");

  const exportCSV = () => {
    const header = ["Date", "Branch", "Customer", "Type", "Quantity", "Amount"];
    const body = filtered.map((r) => [r.date, r.branch ?? "", r.customer_name ?? "", r.remittance_type ?? "", r.quantity, Math.round(Number(r.amount))]);
    body.push(["TOTAL", "", "", "", totalQty, Math.round(totalAmt)]);
    downloadCSV(`foreign-remittance-${year}.csv`, [header, ...body]);
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-4">
      {/* Entry */}
      <Card className="p-4 no-print">
        <h2 className="text-lg font-bold mb-3">{lang === "bn" ? "দৈনিক রেমিট্যান্স এন্ট্রি" : "Daily Remittance Entry"}</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="col-span-2 md:col-span-1"><Label className="text-xs">{lang === "bn" ? "তারিখ" : "Date"}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "ব্রাঞ্চ" : "Branch"}</Label><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "কাস্টমার" : "Customer"}</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "ধরন" : "Type"}</Label><Input placeholder="MoneyGram, Western Union…" value={form.remittance_type} onChange={(e) => setForm({ ...form, remittance_type: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "সংখ্যা" : "Quantity"}</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "পরিমাণ (৳)" : "Amount (৳)"}</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4 mr-1" /> {lang === "bn" ? "এন্ট্রি যোগ করুন" : "Add Entry"}</Button>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-3 no-print flex flex-wrap items-end gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <div><Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{fmt.num(y)}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "মাস" : "Month"}</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              <option value={0}>{lang === "bn" ? "সব" : "All"}</option>
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "অনুসন্ধান" : "Search"}</Label>
            <Input className="h-9 w-44" placeholder={lang === "bn" ? "কাস্টমার / ব্রাঞ্চ" : "Customer / branch"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "প্রিন্ট / PDF" : "Print / PDF"}</Button>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট সংখ্যা" : "Total Quantity"}</div><div className="text-2xl font-bold">{fmt.num(totalQty)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট পরিমাণ" : "Total Amount"}</div><div className="text-2xl font-bold text-primary">{fmt.bdt(totalAmt)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "ব্রাঞ্চ সংখ্যা" : "Branches"}</div><div className="text-2xl font-bold">{fmt.num(Object.keys(branchWise).length)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "কাস্টমার" : "Customers"}</div><div className="text-2xl font-bold">{fmt.num(Object.keys(customerWise).length)}</div></Card>
      </div>

      {/* Printable list */}
      <div className="print-area">
        <Card className="p-4 sm:p-6 bg-white text-black print:shadow-none print:border-0">
          <div className="border-b-2 border-black pb-3 mb-4 text-center">
            <div className="text-xl font-extrabold">ISLAMI BANK AGENT BANKING</div>
            <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
            <div className="text-sm">Fakir Bazar Outlet, Burichong, Cumilla</div>
            <div className="inline-block mt-2 border border-black px-3 py-0.5 text-sm font-bold uppercase">
              Foreign Remittance Report — {month > 0 ? `${monthNames[month - 1]} ` : ""}{fmt.num(year)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-black border-collapse">
              <thead>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                  <th className="border border-black p-1.5">{lang === "bn" ? "তারিখ" : "Date"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "ব্রাঞ্চ" : "Branch"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "কাস্টমার" : "Customer"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "ধরন" : "Type"}</th>
                  <th className="border border-black p-1.5 text-right">{lang === "bn" ? "সংখ্যা" : "Qty"}</th>
                  <th className="border border-black p-1.5 text-right">{lang === "bn" ? "পরিমাণ" : "Amount"}</th>
                  <th className="border border-black p-1.5 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="border border-black p-4 text-center text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="border border-black p-1.5">{fmt.date(r.date)}</td>
                    <td className="border border-black p-1.5">{r.branch || "—"}</td>
                    <td className="border border-black p-1.5">{r.customer_name || "—"}</td>
                    <td className="border border-black p-1.5">{r.remittance_type || "—"}</td>
                    <td className="border border-black p-1.5 text-right">{fmt.num(r.quantity)}</td>
                    <td className="border border-black p-1.5 text-right">{fmt.bdt(Number(r.amount))}</td>
                    <td className="border border-black p-1.5 no-print">
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100 font-bold">
                  <td colSpan={4} className="border border-black p-1.5 text-right">{lang === "bn" ? "মোট" : "Total"}</td>
                  <td className="border border-black p-1.5 text-right">{fmt.num(totalQty)}</td>
                  <td className="border border-black p-1.5 text-right">{fmt.bdt(totalAmt)}</td>
                  <td className="border border-black no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Monthly summary */}
          <div className="mt-6">
            <div className="font-bold mb-1 text-sm">{lang === "bn" ? "মাসিক সারসংক্ষেপ" : "Monthly Summary"} — {fmt.num(year)}</div>
            <table className="w-full text-xs border border-black border-collapse">
              <thead><tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                <th className="border border-black p-1">{lang === "bn" ? "মাস" : "Month"}</th>
                <th className="border border-black p-1 text-right">{lang === "bn" ? "সংখ্যা" : "Qty"}</th>
                <th className="border border-black p-1 text-right">{lang === "bn" ? "পরিমাণ" : "Amount"}</th>
              </tr></thead>
              <tbody>
                {monthNames.map((mn, i) => (
                  <tr key={i}>
                    <td className="border border-black p-1">{mn}</td>
                    <td className="border border-black p-1 text-right">{fmt.num(monthlySummary[i + 1].qty)}</td>
                    <td className="border border-black p-1 text-right">{fmt.bdt(monthlySummary[i + 1].amt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-8 mt-10 text-center text-xs">
            <div className="border-t border-black pt-1">{lang === "bn" ? "প্রস্তুতকারী" : "Prepared by"}</div>
            <div className="border-t border-black pt-1">{lang === "bn" ? "যাচাইকারী" : "Checked by"}</div>
            <div className="border-t border-black pt-1">{lang === "bn" ? "অনুমোদনকারী" : "Approved by"}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* =====================================================================
 * 3) Account Opening Report
 * ===================================================================== */
type AOEntry = {
  id: string; date: string; month: number; year: number;
  account_type: string; num_accounts: number; opening_amount: number;
  officer_name: string | null; status: string; remarks: string | null;
};

function AccountOpeningTab() {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const monthNames = monthsOf(lang);

  const [tab, setTab] = useState<"entry" | "monthly" | "yearly">("entry");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    account_type: ACCOUNT_TYPES[0] as string,
    num_accounts: "1",
    opening_amount: "",
    officer_name: "",
    status: "active",
    remarks: "",
  });

  const { data: yearRows = [] } = useQuery({
    queryKey: ["ao", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_opening_entries").select("*").eq("year", year)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as AOEntry[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const d = new Date(form.date);
      const { error } = await supabase.from("account_opening_entries").insert({
        date: form.date,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        account_type: form.account_type,
        num_accounts: Number(form.num_accounts) || 0,
        opening_amount: Number(form.opening_amount) || 0,
        officer_name: form.officer_name || null,
        status: form.status,
        remarks: form.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "এন্ট্রি যোগ হয়েছে" : "Entry saved");
      setForm({ ...form, num_accounts: "1", opening_amount: "", remarks: "" });
      qc.invalidateQueries({ queryKey: ["ao", year] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_opening_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ao", year] }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("account_opening_entries").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ao", year] }),
  });

  // Editing
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ num_accounts: string; opening_amount: string }>({ num_accounts: "", opening_amount: "" });

  const update = useMutation({
    mutationFn: async (row: AOEntry) => {
      const { error } = await supabase.from("account_opening_entries").update({
        num_accounts: Number(editDraft.num_accounts) || 0,
        opening_amount: Number(editDraft.opening_amount) || 0,
      }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["ao", year] });
    },
  });

  const monthRows = yearRows.filter((r) => r.month === month && (!filterType || r.account_type === filterType) && (!search || r.account_type.toLowerCase().includes(search.toLowerCase()) || (r.officer_name?.toLowerCase().includes(search.toLowerCase()) ?? false)));

  const monthTotals = monthRows.reduce(
    (s, r) => ({ count: s.count + r.num_accounts, amt: s.amt + Number(r.opening_amount) }),
    { count: 0, amt: 0 },
  );

  // Yearly matrix: month x account_type
  const yearMatrix = useMemo(() => {
    const m: Record<number, Record<string, { count: number; amt: number }>> = {};
    for (let i = 1; i <= 12; i++) {
      m[i] = {};
      ACCOUNT_TYPES.forEach((t) => (m[i][t] = { count: 0, amt: 0 }));
    }
    yearRows.forEach((r) => {
      if (!m[r.month][r.account_type]) m[r.month][r.account_type] = { count: 0, amt: 0 };
      m[r.month][r.account_type].count += r.num_accounts;
      m[r.month][r.account_type].amt += Number(r.opening_amount);
    });
    return m;
  }, [yearRows]);

  const yearlyTotalCount = yearRows.reduce((s, r) => s + r.num_accounts, 0);
  const yearlyTotalAmt = yearRows.reduce((s, r) => s + Number(r.opening_amount), 0);
  const pendingCount = yearRows.filter((r) => r.status === "pending").reduce((s, r) => s + r.num_accounts, 0);

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  const exportCSV = () => {
    const header = ["Month", ...ACCOUNT_TYPES, "Total Count", "Total Amount"];
    const body = monthNames.map((mn, i) => {
      const m = i + 1;
      const cells = ACCOUNT_TYPES.map((t) => yearMatrix[m][t].count);
      const tc = cells.reduce((s, n) => s + n, 0);
      const ta = ACCOUNT_TYPES.reduce((s, t) => s + yearMatrix[m][t].amt, 0);
      return [mn, ...cells, tc, Math.round(ta)];
    });
    downloadCSV(`account-opening-${year}.csv`, [header, ...body]);
  };

  return (
    <div className="space-y-4">
      <Card className="p-2 no-print">
        <div className="flex flex-wrap gap-1">
          {([
            ["entry", lang === "bn" ? "মাসিক এন্ট্রি" : "Monthly Entry"],
            ["monthly", lang === "bn" ? "মাসিক ভিউ" : "Monthly View"],
            ["yearly", lang === "bn" ? "বার্ষিক রিপোর্ট" : "Yearly Report"],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-md text-sm ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {l}
            </button>
          ))}
        </div>
      </Card>

      {tab === "entry" && (
        <Card className="p-4 no-print">
          <h2 className="text-lg font-bold mb-3">{lang === "bn" ? "মাসিক একাউন্ট ওপেনিং এন্ট্রি" : "Monthly Account Opening Entry"}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><Label className="text-xs">{lang === "bn" ? "তারিখ" : "Date"}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label className="text-xs">{lang === "bn" ? "একাউন্ট টাইপ" : "Account Type"}</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">{lang === "bn" ? "একাউন্ট সংখ্যা" : "Number of Accounts"}</Label><Input type="number" value={form.num_accounts} onChange={(e) => setForm({ ...form, num_accounts: e.target.value })} /></div>
            <div><Label className="text-xs">{lang === "bn" ? "ওপেনিং অ্যামাউন্ট (৳)" : "Opening Amount (৳)"}</Label><Input type="number" value={form.opening_amount} onChange={(e) => setForm({ ...form, opening_amount: e.target.value })} /></div>
            <div><Label className="text-xs">{lang === "bn" ? "অফিসার নাম" : "Officer Name"}</Label><Input value={form.officer_name} onChange={(e) => setForm({ ...form, officer_name: e.target.value })} /></div>
            <div><Label className="text-xs">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">{lang === "bn" ? "অ্যাকটিভ" : "Active"}</option>
                <option value="pending">{lang === "bn" ? "পেন্ডিং" : "Pending"}</option>
              </select>
            </div>
            <div className="col-span-2"><Label className="text-xs">{lang === "bn" ? "মন্তব্য" : "Remarks"}</Label><Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4 mr-1" /> {lang === "bn" ? "সাবমিট" : "Submit"}</Button>
          </div>
        </Card>
      )}

      {tab === "monthly" && (
        <>
          <Card className="p-3 no-print flex flex-wrap items-end gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <div><Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{fmt.num(y)}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">{lang === "bn" ? "মাস" : "Month"}</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                  {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">{lang === "bn" ? "টাইপ" : "Type"}</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">{lang === "bn" ? "সব" : "All"}</option>
                  {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">{lang === "bn" ? "অনুসন্ধান" : "Search"}</Label>
                <Input className="h-9 w-40" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === "bn" ? "টাইপ / অফিসার" : "Type / officer"} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 no-print">
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট একাউন্ট" : "Total Accounts"}</div><div className="text-2xl font-bold">{fmt.num(monthTotals.count)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট ডিপোজিট" : "Total Deposit"}</div><div className="text-2xl font-bold text-primary">{fmt.bdt(monthTotals.amt)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "পেন্ডিং (এ বছর)" : "Pending (this year)"}</div><div className="text-2xl font-bold text-destructive">{fmt.num(pendingCount)}</div></Card>
          </div>

          <div className="print-area">
            <Card className="p-4 sm:p-6 bg-white text-black print:shadow-none print:border-0">
              <div className="border-b-2 border-black pb-3 mb-4 text-center">
                <div className="text-xl font-extrabold">ISLAMI BANK AGENT BANKING</div>
                <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
                <div className="inline-block mt-2 border border-black px-3 py-0.5 text-sm font-bold uppercase">
                  Account Opening — {monthNames[month - 1]} {fmt.num(year)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-black border-collapse">
                  <thead>
                    <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                      <th className="border border-black p-1.5">{lang === "bn" ? "তারিখ" : "Date"}</th>
                      <th className="border border-black p-1.5">{lang === "bn" ? "টাইপ" : "Type"}</th>
                      <th className="border border-black p-1.5 text-right">{lang === "bn" ? "সংখ্যা" : "Count"}</th>
                      <th className="border border-black p-1.5 text-right">{lang === "bn" ? "অ্যামাউন্ট" : "Amount"}</th>
                      <th className="border border-black p-1.5">{lang === "bn" ? "অফিসার" : "Officer"}</th>
                      <th className="border border-black p-1.5">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                      <th className="border border-black p-1.5 no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthRows.length === 0 && (
                      <tr><td colSpan={7} className="border border-black p-4 text-center text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</td></tr>
                    )}
                    {monthRows.map((r) => (
                      <tr key={r.id}>
                        <td className="border border-black p-1.5">{fmt.date(r.date)}</td>
                        <td className="border border-black p-1.5 font-semibold">{r.account_type}</td>
                        <td className="border border-black p-1.5 text-right">
                          {editing === r.id
                            ? <Input className="h-7 text-right" type="number" value={editDraft.num_accounts} onChange={(e) => setEditDraft({ ...editDraft, num_accounts: e.target.value })} />
                            : fmt.num(r.num_accounts)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {editing === r.id
                            ? <Input className="h-7 text-right" type="number" value={editDraft.opening_amount} onChange={(e) => setEditDraft({ ...editDraft, opening_amount: e.target.value })} />
                            : fmt.bdt(Number(r.opening_amount))}
                        </td>
                        <td className="border border-black p-1.5">{r.officer_name || "—"}</td>
                        <td className="border border-black p-1.5">
                          <button className={`px-2 py-0.5 rounded text-xs ${r.status === "pending" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}
                            onClick={() => setStatus.mutate({ id: r.id, status: r.status === "pending" ? "active" : "pending" })}>
                            {r.status === "pending" ? (lang === "bn" ? "পেন্ডিং" : "Pending") : (lang === "bn" ? "অ্যাকটিভ" : "Active")}
                          </button>
                        </td>
                        <td className="border border-black p-1.5 no-print">
                          <div className="flex gap-1 justify-end">
                            {editing === r.id ? (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => update.mutate(r)}><Save className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => { setEditing(r.id); setEditDraft({ num_accounts: String(r.num_accounts), opening_amount: String(r.opening_amount) }); }}><Pencil className="w-4 h-4" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100 font-bold">
                      <td colSpan={2} className="border border-black p-1.5 text-right">{lang === "bn" ? "মোট" : "Total"}</td>
                      <td className="border border-black p-1.5 text-right">{fmt.num(monthTotals.count)}</td>
                      <td className="border border-black p-1.5 text-right">{fmt.bdt(monthTotals.amt)}</td>
                      <td colSpan={2} className="border border-black"></td>
                      <td className="border border-black no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === "yearly" && (
        <>
          <Card className="p-3 no-print flex flex-wrap items-end gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              <div><Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{fmt.num(y)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCSV}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
              <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "প্রিন্ট / PDF" : "Print / PDF"}</Button>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 no-print">
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট বার্ষিক একাউন্ট" : "Total Yearly Accounts"}</div><div className="text-2xl font-bold">{fmt.num(yearlyTotalCount)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট ডিপোজিট" : "Total Deposit"}</div><div className="text-2xl font-bold text-primary">{fmt.bdt(yearlyTotalAmt)}</div></Card>
            <Card className="p-4"><div className="text-xs text-muted-foreground">{lang === "bn" ? "পেন্ডিং" : "Pending"}</div><div className="text-2xl font-bold text-destructive">{fmt.num(pendingCount)}</div></Card>
          </div>

          <div className="print-area">
            <Card className="p-4 sm:p-6 bg-white text-black print:shadow-none print:border-0">
              <div className="border-b-2 border-black pb-3 mb-4 text-center">
                <div className="text-xl font-extrabold">ISLAMI BANK AGENT BANKING</div>
                <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
                <div className="inline-block mt-2 border border-black px-3 py-0.5 text-sm font-bold uppercase">
                  Account Opening — Yearly Report {fmt.num(year)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-black border-collapse">
                  <thead>
                    <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                      <th className="border border-black p-1.5">{lang === "bn" ? "মাস" : "Month"}</th>
                      {ACCOUNT_TYPES.map((t) => <th key={t} className="border border-black p-1.5">{t}</th>)}
                      <th className="border border-black p-1.5 text-right">{lang === "bn" ? "মোট" : "Total"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthNames.map((mn, i) => {
                      const m = i + 1;
                      const counts = ACCOUNT_TYPES.map((t) => yearMatrix[m][t].count);
                      const total = counts.reduce((s, n) => s + n, 0);
                      return (
                        <tr key={m}>
                          <td className="border border-black p-1.5 font-medium">{mn}</td>
                          {counts.map((c, j) => <td key={j} className="border border-black p-1.5 text-center">{fmt.num(c)}</td>)}
                          <td className="border border-black p-1.5 text-right font-semibold">{fmt.num(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100 font-bold">
                      <td className="border border-black p-1.5">{lang === "bn" ? "মোট" : "Total"}</td>
                      {ACCOUNT_TYPES.map((t) => {
                        const total = Object.values(yearMatrix).reduce((s, m) => s + (m[t]?.count ?? 0), 0);
                        return <td key={t} className="border border-black p-1.5 text-center">{fmt.num(total)}</td>;
                      })}
                      <td className="border border-black p-1.5 text-right">{fmt.num(yearlyTotalCount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <ClientOnly fallback={<div className="h-48 grid place-items-center text-sm text-muted-foreground">Loading chart…</div>}>
                {() => <YearChart year={year} matrix={yearMatrix} />}
              </ClientOnly>

              <div className="grid grid-cols-3 gap-8 mt-10 text-center text-xs">
                <div className="border-t border-black pt-1">{lang === "bn" ? "প্রস্তুতকারী" : "Prepared by"}</div>
                <div className="border-t border-black pt-1">{lang === "bn" ? "যাচাইকারী" : "Checked by"}</div>
                <div className="border-t border-black pt-1">{lang === "bn" ? "অনুমোদনকারী" : "Approved by"}</div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function YearChart({ year, matrix }: { year: number; matrix: Record<number, Record<string, { count: number; amt: number }>> }) {
  // Lazy import recharts in client only
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } = require("recharts");
  const data = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const total = ACCOUNT_TYPES.reduce((s, t) => s + matrix[m][t].count, 0);
    return { month: monthsOf("en")[i].slice(0, 3), count: total };
  });
  return (
    <div className="mt-6 h-56 no-print">
      <div className="text-xs font-semibold mb-1">Yearly Growth — {year}</div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" /><YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="hsl(var(--primary))" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =====================================================================
 * 4) Report Center
 * ===================================================================== */
function ReportCenterTab() {
  const { lang, t } = useI18n();
  const items = [
    { to: "/monthly-report" as const, label: lang === "bn" ? "মাসিক আয়-ব্যয় রিপোর্ট" : "Monthly Income & Expense", icon: FileBarChart },
    { to: "/partners" as const, label: t("nav_partners"), desc: lang === "bn" ? "পার্টনার শেয়ার / প্রফিট ডিস্ট্রিবিউশন" : "Partner share & profit distribution", icon: Handshake },
    { to: "/income" as const, label: t("nav_income"), desc: lang === "bn" ? "মাসিক আয়ের তালিকা" : "Monthly income list", icon: TrendingUp },
    { to: "/expense" as const, label: t("nav_expense"), desc: lang === "bn" ? "ভাউচার তালিকা ও প্রিন্ট" : "Voucher list & print", icon: Receipt },
    { to: "/salary" as const, label: t("nav_salary"), desc: lang === "bn" ? "মাসিক বেতন প্রদান রিপোর্ট" : "Monthly salary report", icon: Wallet },
    { to: "/salary-sheet" as const, label: t("nav_salary_sheet"), desc: lang === "bn" ? "স্যালারি শীট প্রিন্ট" : "Salary sheet print", icon: FileBarChart },
  ];
  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <h2 className="text-lg font-bold flex items-center gap-2"><FolderOpen className="w-5 h-5 text-primary" /> {lang === "bn" ? "রিপোর্ট সেন্টার" : "Report Center"}</h2>
        <p className="text-xs text-muted-foreground mt-1">{lang === "bn" ? "সকল রিপোর্ট এক জায়গায় — সব গুলি PDF আকারে প্রিন্ট করা যায়।" : "All reports in one place — every report is printable as PDF."}</p>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((it) => (
          <Card key={it.to} className="p-4 flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0"><it.icon className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{it.label}</div>
              {it.desc && <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>}
              <div className="mt-2 flex gap-2">
                <Button asChild size="sm"><Link to={it.to}>{lang === "bn" ? "খুলুন" : "Open"}</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to={it.to}><Download className="w-3.5 h-3.5 mr-1" />PDF</Link></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
