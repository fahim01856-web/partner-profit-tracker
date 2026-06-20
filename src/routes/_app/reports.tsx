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
  FileCheck2, AlertTriangle, CheckCircle2, Clock, UserX, TrendingDown,
} from "lucide-react";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

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
          <TabsTrigger value="tin" className="gap-1.5"><FileCheck2 className="w-4 h-4" /> {lang === "bn" ? "টিন ই-রিটার্ন" : "TIN E-Return"}</TabsTrigger>
          <TabsTrigger value="inactive" className="gap-1.5"><UserX className="w-4 h-4" /> {lang === "bn" ? "ইনএক্টিভ একাউন্ট" : "Inactive Accounts"}</TabsTrigger>
          <TabsTrigger value="center" className="gap-1.5"><FolderOpen className="w-4 h-4" /> {lang === "bn" ? "রিপোর্ট সেন্টার" : "Report Center"}</TabsTrigger>
        </TabsList>

        <TabsContent value="ie"><IncomeExpenditureTab /></TabsContent>
        <TabsContent value="remit"><RemittanceTab /></TabsContent>
        <TabsContent value="ao"><AccountOpeningTab /></TabsContent>
        <TabsContent value="tin"><TinEReturnTab /></TabsContent>
        <TabsContent value="inactive"><InactiveAccountsTab /></TabsContent>
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
                <YearChart year={year} matrix={yearMatrix} />
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
    { to: "/agent-bank-investment" as const, label: t("nav_investment"), desc: lang === "bn" ? "এজেন্ট ব্যাংকে বিনিয়োগের তালিকা" : "Agent bank investments list", icon: TrendingUp },
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

/* =====================================================================
 * 4) TIN E-Return Tracker
 * ===================================================================== */
type TinEReturn = {
  id: string;
  customer_name: string;
  account_number: string | null;
  tin_number: string | null;
  submitted_date: string;
  expiry_date: string;
  note: string | null;
};

function daysBetween(from: Date, to: Date) {
  const ms = to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

function TinEReturnTab() {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "soon" | "expired">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_name: "", account_number: "", tin_number: "",
    submitted_date: new Date().toISOString().slice(0, 10),
    expiry_date: "", note: "",
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["tin-ereturns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tin_ereturns").select("*")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data as TinEReturn[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.customer_name || !form.submitted_date || !form.expiry_date) {
        throw new Error(lang === "bn" ? "নাম, সাবমিট ও মেয়াদ তারিখ আবশ্যক" : "Name, submitted & expiry date required");
      }
      const payload = {
        customer_name: form.customer_name,
        account_number: form.account_number || null,
        tin_number: form.tin_number || null,
        submitted_date: form.submitted_date,
        expiry_date: form.expiry_date,
        note: form.note || null,
      };
      if (editingId) {
        const { error } = await supabase.from("tin_ereturns").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tin_ereturns").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? (lang === "bn" ? "আপডেট হয়েছে" : "Updated") : (lang === "bn" ? "যোগ হয়েছে" : "Added"));
      setEditingId(null);
      setForm({ customer_name: "", account_number: "", tin_number: "", submitted_date: new Date().toISOString().slice(0, 10), expiry_date: "", note: "" });
      qc.invalidateQueries({ queryKey: ["tin-ereturns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tin_ereturns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
      qc.invalidateQueries({ queryKey: ["tin-ereturns"] });
    },
  });

  const startEdit = (r: TinEReturn) => {
    setEditingId(r.id);
    setForm({
      customer_name: r.customer_name,
      account_number: r.account_number ?? "",
      tin_number: r.tin_number ?? "",
      submitted_date: r.submitted_date,
      expiry_date: r.expiry_date,
      note: r.note ?? "",
    });
  };

  const today = new Date();
  const enriched = rows.map((r) => {
    const days = daysBetween(new Date(), new Date(r.expiry_date));
    let status: "active" | "soon" | "expired" = "active";
    if (days < 0) status = "expired";
    else if (days <= 30) status = "soon";
    return { ...r, daysLeft: days, status };
  });

  const filtered = enriched.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!(
        r.customer_name.toLowerCase().includes(s) ||
        (r.account_number ?? "").toLowerCase().includes(s) ||
        (r.tin_number ?? "").toLowerCase().includes(s)
      )) return false;
    }
    return true;
  });

  const stats = {
    total: enriched.length,
    active: enriched.filter((r) => r.status === "active").length,
    soon: enriched.filter((r) => r.status === "soon").length,
    expired: enriched.filter((r) => r.status === "expired").length,
  };

  const exportCSV = () => {
    const header = ["Customer", "Account No", "TIN", "Submitted", "Expiry", "Days Left", "Status", "Note"];
    const body = filtered.map((r) => [
      r.customer_name, r.account_number ?? "", r.tin_number ?? "",
      r.submitted_date, r.expiry_date, r.daysLeft, r.status, r.note ?? "",
    ]);
    downloadCSV(`tin-ereturn-${today.toISOString().slice(0, 10)}.csv`, [header, ...body]);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট ই-রিটার্ন" : "Total E-Returns"}</div>
              <div className="text-2xl font-bold">{fmt.num(stats.total)}</div>
            </div>
            <FileCheck2 className="w-8 h-8 text-primary opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-success">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "সক্রিয়" : "Active"}</div>
              <div className="text-2xl font-bold text-success">{fmt.num(stats.active)}</div>
            </div>
            <CheckCircle2 className="w-8 h-8 text-success opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-warning">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "৩০ দিনের মধ্যে" : "Expiring in 30 days"}</div>
              <div className="text-2xl font-bold text-warning">{fmt.num(stats.soon)}</div>
            </div>
            <Clock className="w-8 h-8 text-warning opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-destructive">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "মেয়াদ শেষ" : "Expired"}</div>
              <div className="text-2xl font-bold text-destructive">{fmt.num(stats.expired)}</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-destructive opacity-70" />
          </div>
        </Card>
      </div>

      {/* Entry form */}
      <Card className="p-4 no-print">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {editingId
            ? (lang === "bn" ? "ই-রিটার্ন এডিট" : "Edit E-Return")
            : (lang === "bn" ? "নতুন ই-রিটার্ন এন্ট্রি" : "New E-Return Entry")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label className="text-xs">{lang === "bn" ? "কাস্টমারের নাম *" : "Customer Name *"}</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "একাউন্ট নাম্বার" : "Account Number"}</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "টিন নাম্বার" : "TIN Number"}</Label><Input value={form.tin_number} onChange={(e) => setForm({ ...form, tin_number: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "সাবমিটেড ডেট *" : "Submitted Date *"}</Label><Input type="date" value={form.submitted_date} onChange={(e) => setForm({ ...form, submitted_date: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "মেয়াদ শেষ ডেট *" : "Expiry Date *"}</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "মন্তব্য" : "Note"}</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {editingId && (
            <Button variant="outline" onClick={() => { setEditingId(null); setForm({ customer_name: "", account_number: "", tin_number: "", submitted_date: new Date().toISOString().slice(0, 10), expiry_date: "", note: "" }); }}>
              <X className="w-4 h-4 mr-1" /> {lang === "bn" ? "বাতিল" : "Cancel"}
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {editingId ? <Save className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {editingId ? (lang === "bn" ? "সংরক্ষণ" : "Save") : (lang === "bn" ? "যোগ করুন" : "Add")}
          </Button>
        </div>
      </Card>

      {/* Filter bar */}
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-end gap-2 justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">{lang === "bn" ? "অনুসন্ধান" : "Search"}</Label>
              <Input className="h-9 w-56" placeholder={lang === "bn" ? "নাম / একাউন্ট / টিন…" : "name / account / TIN…"} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="all">{lang === "bn" ? "সব" : "All"}</option>
                <option value="active">{lang === "bn" ? "সক্রিয়" : "Active"}</option>
                <option value="soon">{lang === "bn" ? "৩০ দিনে শেষ" : "Expiring soon"}</option>
                <option value="expired">{lang === "bn" ? "মেয়াদ শেষ" : "Expired"}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="print-area">
        <Card className="p-4 sm:p-6 print:shadow-none print:border-0 bg-white text-black">
          <div className="border-b-2 border-black pb-3 mb-4 text-center">
            <div className="text-xl font-extrabold">ISLAMI BANK AGENT BANKING</div>
            <div className="text-base font-bold">M/S FEED HOUSE (121/11)</div>
            <div className="inline-block mt-2 border border-black px-3 py-0.5 text-sm font-bold uppercase">
              TIN E-Return Register
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-black border-collapse">
              <thead>
                <tr className="bg-[oklch(0.93_0.04_155)] print:bg-gray-100">
                  <th className="border border-black p-1.5">#</th>
                  <th className="border border-black p-1.5 text-left">{lang === "bn" ? "কাস্টমার" : "Customer"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "একাউন্ট" : "Account"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "টিন" : "TIN"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "সাবমিট" : "Submitted"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "মেয়াদ শেষ" : "Expiry"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "বাকি দিন" : "Days Left"}</th>
                  <th className="border border-black p-1.5">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                  <th className="border border-black p-1.5 no-print">{lang === "bn" ? "অ্যাকশন" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="border border-black p-6 text-center text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</td></tr>
                ) : filtered.map((r, i) => {
                  const statusColor =
                    r.status === "expired" ? "bg-destructive/15 text-destructive" :
                    r.status === "soon" ? "bg-warning/15 text-warning-foreground" :
                    "bg-success/15 text-success";
                  const statusLabel =
                    r.status === "expired" ? (lang === "bn" ? "মেয়াদ শেষ" : "Expired") :
                    r.status === "soon" ? (lang === "bn" ? "শীঘ্রই শেষ" : "Expiring soon") :
                    (lang === "bn" ? "সক্রিয়" : "Active");
                  const daysText =
                    r.daysLeft < 0
                      ? (lang === "bn" ? `${fmt.num(Math.abs(r.daysLeft))} দিন আগে শেষ` : `${Math.abs(r.daysLeft)} days ago`)
                      : (lang === "bn" ? `${fmt.num(r.daysLeft)} দিন বাকি` : `${r.daysLeft} days left`);
                  return (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="border border-black p-1.5 text-center">{fmt.num(i + 1)}</td>
                      <td className="border border-black p-1.5 font-medium">{r.customer_name}</td>
                      <td className="border border-black p-1.5 text-center">{r.account_number || "—"}</td>
                      <td className="border border-black p-1.5 text-center">{r.tin_number || "—"}</td>
                      <td className="border border-black p-1.5 text-center">{r.submitted_date}</td>
                      <td className="border border-black p-1.5 text-center font-semibold">{r.expiry_date}</td>
                      <td className={`border border-black p-1.5 text-center font-bold ${r.status === "expired" ? "text-destructive" : r.status === "soon" ? "text-warning" : "text-success"}`}>{daysText}</td>
                      <td className="border border-black p-1.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                      </td>
                      <td className="border border-black p-1.5 text-center no-print">
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(lang === "bn" ? "নিশ্চিত?" : "Sure?")) del.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============== Inactive Accounts Tab ============== */
type InactiveCat = "inoperative" | "irregular" | "dormant" | "zero_balance";
type InactiveEntry = { id: string; category: InactiveCat; entry_date: string; count: number; note: string | null; created_at: string };

const INACTIVE_CATS: { key: InactiveCat; bn: string; en: string; icon: any; color: string }[] = [
  { key: "inoperative", bn: "ইনঅপারেটিভ একাউন্ট", en: "Inoperative Account", icon: Clock, color: "text-amber-600" },
  { key: "irregular", bn: "ইরেগুলার একাউন্ট", en: "Irregular Account", icon: AlertTriangle, color: "text-orange-600" },
  { key: "dormant", bn: "ডরমেন্ট একাউন্ট", en: "Dormant Account", icon: UserX, color: "text-rose-600" },
  { key: "zero_balance", bn: "জিরো ব্যালেন্স একাউন্ট", en: "Zero Balance Account", icon: Wallet, color: "text-slate-600" },
];

function InactiveAccountsTab() {
  const { lang } = useI18n();
  const qc = useQueryClient();
  const [cat, setCat] = useState<InactiveCat>("inoperative");
  const [form, setForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), count: "", note: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ["inactive_account_entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inactive_account_entries" as any).select("*").order("entry_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InactiveEntry[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { category: cat, entry_date: form.entry_date, count: Number(form.count) || 0, note: form.note || null };
      if (editingId) {
        const { error } = await supabase.from("inactive_account_entries" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inactive_account_entries" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inactive_account_entries"] });
      toast.success(lang === "bn" ? "সংরক্ষণ হয়েছে" : "Saved");
      setForm({ entry_date: new Date().toISOString().slice(0, 10), count: "", note: "" });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inactive_account_entries" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inactive_account_entries"] }); toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted"); },
  });

  const latestByCat = useMemo(() => {
    const m: Record<string, InactiveEntry | undefined> = {};
    for (const c of INACTIVE_CATS) m[c.key] = entries.find((e) => e.category === c.key);
    return m;
  }, [entries]);

  const filtered = useMemo(() => entries.filter((e) => e.category === cat), [entries, cat]);
  const chartData = useMemo(() => [...filtered].reverse().map((e) => ({ date: e.entry_date, count: e.count })), [filtered]);

  const trend = useMemo(() => {
    if (filtered.length < 2) return null;
    const diff = filtered[0].count - filtered[1].count;
    return { diff, prev: filtered[1] };
  }, [filtered]);

  return (
    <div className="space-y-4 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {INACTIVE_CATS.map((c) => {
          const Icon = c.icon;
          const latest = latestByCat[c.key];
          const active = cat === c.key;
          return (
            <button key={c.key} onClick={() => { setCat(c.key); setEditingId(null); }}
              className={`text-left p-4 rounded-lg border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${c.color}`} />
                <span className="text-2xl font-bold">{latest?.count ?? 0}</span>
              </div>
              <div className="text-sm font-medium">{lang === "bn" ? c.bn : c.en}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {latest ? (lang === "bn" ? `সর্বশেষ: ${latest.entry_date}` : `Last: ${latest.entry_date}`) : (lang === "bn" ? "কোন এন্ট্রি নেই" : "No entries")}
              </div>
            </button>
          );
        })}
      </div>

      {/* Entry form */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">
            {editingId ? (lang === "bn" ? "এন্ট্রি সম্পাদনা" : "Edit Entry") : (lang === "bn" ? "নতুন এন্ট্রি" : "New Entry")} — {lang === "bn" ? INACTIVE_CATS.find((c) => c.key === cat)!.bn : INACTIVE_CATS.find((c) => c.key === cat)!.en}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>{lang === "bn" ? "তারিখ" : "Date"}</Label>
            <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
          </div>
          <div>
            <Label>{lang === "bn" ? "একাউন্ট সংখ্যা" : "Account Count"}</Label>
            <Input type="number" min="0" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} placeholder="0" />
          </div>
          <div className="md:col-span-2">
            <Label>{lang === "bn" ? "নোট (ঐচ্ছিক)" : "Note (optional)"}</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={lang === "bn" ? "মন্তব্য..." : "Remarks..."} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.count}>
            <Save className="w-4 h-4 mr-1" /> {editingId ? (lang === "bn" ? "আপডেট" : "Update") : (lang === "bn" ? "সংরক্ষণ" : "Save")}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={() => { setEditingId(null); setForm({ entry_date: new Date().toISOString().slice(0, 10), count: "", note: "" }); }}>
              <X className="w-4 h-4 mr-1" /> {lang === "bn" ? "বাতিল" : "Cancel"}
            </Button>
          )}
        </div>
      </Card>

      {/* Trend */}
      {trend && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            {trend.diff > 0 ? <TrendingUp className="w-5 h-5 text-rose-600" /> : trend.diff < 0 ? <TrendingDown className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
            <span className="text-sm">
              {lang === "bn" ? "পূর্ববর্তী এন্ট্রি থেকে" : "Change from previous"} ({trend.prev.entry_date}):{" "}
              <strong className={trend.diff > 0 ? "text-rose-600" : trend.diff < 0 ? "text-emerald-600" : ""}>
                {trend.diff > 0 ? "+" : ""}{trend.diff}
              </strong>
            </span>
          </div>
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 text-sm">{lang === "bn" ? "ট্রেন্ড গ্রাফ" : "Trend Chart"}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* History table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{lang === "bn" ? "ইতিহাস" : "History"}</h3>
          <Button size="sm" variant="outline" onClick={() => {
            const rows: (string | number)[][] = [["Date", "Count", "Note"]];
            filtered.forEach((e) => rows.push([e.entry_date, e.count, e.note || ""]));
            downloadCSV(`inactive-${cat}.csv`, rows);
          }}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">{lang === "bn" ? "তারিখ" : "Date"}</th>
                <th className="px-3 py-2 text-right">{lang === "bn" ? "সংখ্যা" : "Count"}</th>
                <th className="px-3 py-2 text-right">{lang === "bn" ? "পরিবর্তন" : "Change"}</th>
                <th className="px-3 py-2 text-left">{lang === "bn" ? "নোট" : "Note"}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোন এন্ট্রি নেই" : "No entries yet"}</td></tr>
              )}
              {filtered.map((e, i) => {
                const next = filtered[i + 1];
                const diff = next ? e.count - next.count : null;
                return (
                  <tr key={e.id} className="border-b hover:bg-muted/40">
                    <td className="px-3 py-2">{e.entry_date}</td>
                    <td className="px-3 py-2 text-right font-semibold">{e.count}</td>
                    <td className="px-3 py-2 text-right">
                      {diff === null ? <span className="text-muted-foreground">—</span> :
                        diff > 0 ? <span className="text-rose-600">+{diff}</span> :
                        diff < 0 ? <span className="text-emerald-600">{diff}</span> :
                        <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{e.note || "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(e.id); setForm({ entry_date: e.entry_date, count: String(e.count), note: e.note || "" }); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(lang === "bn" ? "নিশ্চিত?" : "Delete?")) del.mutate(e.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
