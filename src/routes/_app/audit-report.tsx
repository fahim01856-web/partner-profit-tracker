import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BankLogo } from "@/components/BankLogo";
import { useI18n } from "@/lib/i18n";
import { useFmt, monthRange, monthsOf } from "@/lib/format";
import {
  Printer, ShieldCheck, FileBarChart, Users, Wallet, Receipt,
  Banknote, AlertTriangle, CheckCircle2, BookOpen, Boxes, FileSignature, ClipboardList
} from "lucide-react";

export const Route = createFileRoute("/_app/audit-report")({ component: AuditReportPage });

function AuditReportPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [auditorName, setAuditorName] = useState("");
  const [auditDate, setAuditDate] = useState(now.toISOString().slice(0, 10));

  const { start, end } = useMemo(() => monthRange(year, month), [year, month]);

  // Aggregate queries
  const { data: expenses = [] } = useQuery({
    queryKey: ["audit-exp", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*")
        .gte("expense_date", start).lte("expense_date", end);
      if (error) throw error; return data as any[];
    },
  });

  const { data: deposits = [] } = useQuery({
    queryKey: ["audit-dep", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_deposits").select("*")
        .gte("deposit_date", start).lte("deposit_date", end);
      if (error) throw error; return data as any[];
    },
  });

  const { data: cashBook = [] } = useQuery({
    queryKey: ["audit-cb", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_book_entries").select("*")
        .gte("entry_date", start).lte("entry_date", end);
      if (error) throw error; return data as any[];
    },
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["audit-sal", year, month],
    queryFn: async () => {
      const { data, error } = await supabase.from("salaries").select("*")
        .eq("year", year).eq("month", month);
      if (error) throw error; return data as any[];
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["audit-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*");
      if (error) throw error; return data as any[];
    },
  });

  const { data: investments = [] } = useQuery({
    queryKey: ["audit-inv", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_bank_investments").select("*")
        .gte("investment_date", start).lte("investment_date", end);
      if (error) throw error; return data as any[];
    },
  });

  const { data: pending = [] } = useQuery({
    queryKey: ["audit-pending"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pending_works").select("*")
        .neq("status", "completed");
      if (error) throw error; return data as any[];
    },
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["audit-loans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_persons").select("*");
      if (error) throw error; return data as any[];
    },
  });

  const { data: signatures = [] } = useQuery({
    queryKey: ["audit-sig"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signature_cards").select("id, account_no, account_name, created_at");
      if (error) throw error; return data as any[];
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["audit-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_receipts").select("*");
      if (error) throw error; return data as any[];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["audit-att", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*")
        .gte("attendance_date", start).lte("attendance_date", end);
      if (error) throw error; return data as any[];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["audit-docs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("id, title, expiry_date, category_id");
      if (error) throw error; return data as any[];
    },
  });

  // Totals
  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalDeposit = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalSalary = salaries.reduce((s, x) => s + Number(x.net_amount || x.gross_amount || 0), 0);
  const totalInvest = investments.reduce((s, x) => s + Number(x.amount || 0), 0);
  const cashIn = cashBook.filter(c => c.entry_type === "in" || c.entry_type === "credit").reduce((s, c) => s + Number(c.amount || 0), 0);
  const cashOut = cashBook.filter(c => c.entry_type === "out" || c.entry_type === "debit").reduce((s, c) => s + Number(c.amount || 0), 0);
  const cashBalance = cashIn - cashOut;

  // Compliance checks
  const today = new Date();
  const expiringDocs = docs.filter((d: any) => {
    if (!d.expiry_date) return false;
    const exp = new Date(d.expiry_date);
    const days = (exp.getTime() - today.getTime()) / 86400000;
    return days < 30;
  });
  const unapprovedExpenses = expenses.filter((e: any) => !e.approved_by);
  const overduePending = pending.filter((p: any) => p.due_date && new Date(p.due_date) < today);
  const activeLoans = loans.filter((l: any) => Number(l.outstanding_amount || 0) > 0);

  const checks = [
    { label: lang === "bn" ? "মাসিক রিপোর্ট প্রস্তুত" : "Monthly report prepared", ok: true },
    { label: lang === "bn" ? "ক্যাশ বুক ব্যালেন্স মিল" : "Cash book balance reconciled", ok: cashBalance >= 0 },
    { label: lang === "bn" ? "সব খরচ অনুমোদিত" : "All expenses approved", ok: unapprovedExpenses.length === 0 },
    { label: lang === "bn" ? "ডকুমেন্ট মেয়াদ ঠিক আছে" : "No documents expiring soon", ok: expiringDocs.length === 0 },
    { label: lang === "bn" ? "পেন্ডিং কাজ সময়মতো" : "No overdue pending works", ok: overduePending.length === 0 },
    { label: lang === "bn" ? "স্টাফ হাজিরা রেকর্ডকৃত" : "Staff attendance recorded", ok: attendance.length > 0 },
    { label: lang === "bn" ? "বেতন প্রদান সম্পন্ন" : "Salaries processed", ok: salaries.length > 0 },
    { label: lang === "bn" ? "সিগনেচার কার্ড সংরক্ষিত" : "Signature cards on file", ok: signatures.length > 0 },
  ];
  const passed = checks.filter(c => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);

  const months = monthsOf(lang);

  return (
    <div className="space-y-6">
      {/* Controls — hidden on print */}
      <div className="no-print flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {lang === "bn" ? "অডিট ও কমপ্লায়েন্স রিপোর্ট" : "Audit & Compliance Report"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn"
              ? "এজেন্ট ব্যাংকিং অফিসের জন্য সম্পূর্ণ অডিট রিপোর্ট — সকল লেনদেন, কমপ্লায়েন্স চেক ও স্কোর"
              : "Complete audit report for agent banking office — all transactions, compliance checks & score"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">{lang === "bn" ? "মাস" : "Month"}</Label>
            <select className="h-9 border rounded-md px-2 text-sm bg-background"
              value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
            <Input type="number" className="w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "অডিটর" : "Auditor"}</Label>
            <Input className="w-48" value={auditorName} onChange={e => setAuditorName(e.target.value)} placeholder={lang === "bn" ? "অডিটরের নাম" : "Auditor name"} />
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "তারিখ" : "Date"}</Label>
            <Input type="date" className="w-40" value={auditDate} onChange={e => setAuditDate(e.target.value)} />
          </div>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
        </div>
      </div>

      {/* Printable */}
      <div className="bg-card border rounded-lg p-6 sm:p-8 print:border-0 print:shadow-none space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-white border p-1"><BankLogo className="w-full h-full" /></div>
            <div>
              <div className="font-bold text-lg">{t("bankName")}</div>
              <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
              <div className="text-xs text-muted-foreground">{t("inCharge")}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-base">{lang === "bn" ? "অডিট ও কমপ্লায়েন্স রিপোর্ট" : "Audit & Compliance Report"}</div>
            <div className="text-sm">{months[month - 1]} {fmt.num(year)}</div>
            <div className="text-xs text-muted-foreground">{lang === "bn" ? "তারিখ:" : "Date:"} {fmt.date(auditDate)}</div>
          </div>
        </div>

        {/* Compliance score */}
        <Card className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{lang === "bn" ? "কমপ্লায়েন্স স্কোর" : "Compliance Score"}</div>
              <div className="text-4xl font-bold mt-1">
                <span className={score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600"}>
                  {fmt.num(score)}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {fmt.num(passed)}/{fmt.num(checks.length)} {lang === "bn" ? "টি চেক পাশ" : "checks passed"}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-w-[280px]">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                  <span className={c.ok ? "" : "text-red-600 font-medium"}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Financial summary */}
        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2"><FileBarChart className="w-4 h-4" />
            {lang === "bn" ? "আর্থিক সারসংক্ষেপ" : "Financial Summary"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox icon={<Banknote className="w-4 h-4" />} label={lang === "bn" ? "মোট জমা" : "Total Deposits"} value={fmt.bdt(totalDeposit)} sub={`${fmt.num(deposits.length)} ${lang === "bn" ? "এন্ট্রি" : "entries"}`} />
            <StatBox icon={<Receipt className="w-4 h-4" />} label={lang === "bn" ? "মোট খরচ" : "Total Expenses"} value={fmt.bdt(totalExpense)} sub={`${fmt.num(expenses.length)} ${lang === "bn" ? "ভাউচার" : "vouchers"}`} />
            <StatBox icon={<Wallet className="w-4 h-4" />} label={lang === "bn" ? "মোট বেতন" : "Total Salary"} value={fmt.bdt(totalSalary)} sub={`${fmt.num(salaries.length)} ${lang === "bn" ? "জন" : "staff"}`} />
            <StatBox icon={<BookOpen className="w-4 h-4" />} label={lang === "bn" ? "ক্যাশ ব্যালেন্স" : "Cash Balance"} value={fmt.bdt(cashBalance)} sub={`${lang === "bn" ? "ইন" : "In"} ${fmt.bdt(cashIn)} • ${lang === "bn" ? "আউট" : "Out"} ${fmt.bdt(cashOut)}`} />
          </div>
        </section>

        {/* Operations */}
        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4" />
            {lang === "bn" ? "অপারেশনাল সারসংক্ষেপ" : "Operational Summary"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox icon={<Users className="w-4 h-4" />} label={lang === "bn" ? "মোট স্টাফ" : "Total Staff"} value={fmt.num(staff.length)} />
            <StatBox icon={<FileSignature className="w-4 h-4" />} label={lang === "bn" ? "সিগনেচার কার্ড" : "Signature Cards"} value={fmt.num(signatures.length)} />
            <StatBox icon={<Boxes className="w-4 h-4" />} label={lang === "bn" ? "ইনভেন্টরি রিসিট" : "Inventory Receipts"} value={fmt.num(inventory.length)} />
            <StatBox icon={<ClipboardList className="w-4 h-4" />} label={lang === "bn" ? "এক্টিভ ঋণ" : "Active Loans"} value={fmt.num(activeLoans.length)} sub={fmt.bdt(activeLoans.reduce((s, l) => s + Number(l.outstanding_amount || 0), 0))} />
          </div>
        </section>

        {/* Findings */}
        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            {lang === "bn" ? "অডিট অবজারভেশন ও ফাইন্ডিংস" : "Audit Observations & Findings"}
          </h2>
          <div className="space-y-3">
            <Finding ok={unapprovedExpenses.length === 0}
              title={lang === "bn" ? "অননুমোদিত খরচ ভাউচার" : "Unapproved Expense Vouchers"}
              count={unapprovedExpenses.length}
              detail={unapprovedExpenses.slice(0, 5).map((e: any) => `${e.voucher_no || e.id} — ${fmt.bdt(Number(e.amount))}`).join(", ")} />
            <Finding ok={expiringDocs.length === 0}
              title={lang === "bn" ? "৩০ দিনের মধ্যে মেয়াদ শেষ হচ্ছে এমন ডকুমেন্ট" : "Documents expiring within 30 days"}
              count={expiringDocs.length}
              detail={expiringDocs.slice(0, 5).map((d: any) => `${d.title} (${d.expiry_date})`).join(", ")} />
            <Finding ok={overduePending.length === 0}
              title={lang === "bn" ? "মেয়াদোত্তীর্ণ পেন্ডিং কাজ" : "Overdue Pending Works"}
              count={overduePending.length}
              detail={overduePending.slice(0, 5).map((p: any) => p.title || p.description).join(", ")} />
          </div>
        </section>

        {/* Transaction listing */}
        <section>
          <h2 className="font-bold mb-3">{lang === "bn" ? "খরচ ভাউচার তালিকা" : "Expense Voucher Register"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead className="bg-muted">
                <tr>
                  <th className="border p-1.5 text-left">{lang === "bn" ? "ক্রম" : "SL"}</th>
                  <th className="border p-1.5 text-left">{lang === "bn" ? "তারিখ" : "Date"}</th>
                  <th className="border p-1.5 text-left">{lang === "bn" ? "ভাউচার নং" : "Voucher No"}</th>
                  <th className="border p-1.5 text-left">{lang === "bn" ? "বিবরণ" : "Description"}</th>
                  <th className="border p-1.5 text-right">{lang === "bn" ? "টাকা" : "Amount"}</th>
                  <th className="border p-1.5 text-left">{lang === "bn" ? "অনুমোদন" : "Approved"}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={6} className="border p-3 text-center text-muted-foreground">
                    {lang === "bn" ? "কোনো ভাউচার নেই" : "No vouchers"}
                  </td></tr>
                )}
                {expenses.map((e: any, i: number) => (
                  <tr key={e.id}>
                    <td className="border p-1.5">{fmt.num(i + 1)}</td>
                    <td className="border p-1.5">{fmt.date(e.expense_date)}</td>
                    <td className="border p-1.5">{e.voucher_no || "—"}</td>
                    <td className="border p-1.5">{e.description || e.purpose || "—"}</td>
                    <td className="border p-1.5 text-right">{fmt.bdt(Number(e.amount))}</td>
                    <td className="border p-1.5">{e.approved_by || <span className="text-red-600">{lang === "bn" ? "অননুমোদিত" : "Unapproved"}</span>}</td>
                  </tr>
                ))}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="bg-muted font-semibold">
                  <tr>
                    <td className="border p-1.5" colSpan={4}>{lang === "bn" ? "মোট" : "Total"}</td>
                    <td className="border p-1.5 text-right">{fmt.bdt(totalExpense)}</td>
                    <td className="border p-1.5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* Auditor sign-off */}
        <section className="pt-8">
          <div className="grid grid-cols-3 gap-8 text-center text-sm">
            <div>
              <div className="border-t pt-2">{lang === "bn" ? "প্রস্তুতকারী" : "Prepared By"}</div>
              <div className="text-xs text-muted-foreground">{t("inCharge")}</div>
            </div>
            <div>
              <div className="border-t pt-2">{lang === "bn" ? "অনুমোদনকারী" : "Approved By"}</div>
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "ম্যানেজমেন্ট" : "Management"}</div>
            </div>
            <div>
              <div className="border-t pt-2">{lang === "bn" ? "অডিটর" : "Auditor"}</div>
              <div className="text-xs text-muted-foreground">{auditorName || (lang === "bn" ? "অডিটরের নাম" : "Auditor name")}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold mt-1 break-words">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Finding({ ok, title, count, detail }: { ok: boolean; title: string; count: number; detail?: string }) {
  return (
    <div className={`border rounded-md p-3 ${ok ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-red-50 dark:bg-red-950/20 border-red-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm flex items-center gap-2">
          {ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
          {title}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${ok ? "bg-green-200 text-green-900" : "bg-red-200 text-red-900"}`}>
          {count}
        </span>
      </div>
      {!ok && detail && <div className="text-xs text-muted-foreground mt-1.5 pl-6">{detail}</div>}
    </div>
  );
}
