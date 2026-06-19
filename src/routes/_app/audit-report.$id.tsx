import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BankLogo } from "@/components/BankLogo";
import { useI18n } from "@/lib/i18n";
import { useFmt } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft, Printer, Save, Plus, Trash2, AlertTriangle, CheckCircle2,
  FileCheck, ClipboardList, ShieldCheck, FileText, Pencil, LayoutDashboard,
  FolderOpen, Upload, Eye,
} from "lucide-react";

const AUDIT_TABS = ["overview", "info", "findings", "tasks", "checks", "documents", "signoff"] as const;
type AuditTab = (typeof AUDIT_TABS)[number];
const normalizeTab = (tab: unknown): AuditTab => AUDIT_TABS.includes(tab as AuditTab) ? tab as AuditTab : "overview";

export const Route = createFileRoute("/_app/audit-report/$id")({
  validateSearch: (search) => ({ tab: normalizeTab(search.tab) }),
  component: AuditReportDetailPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-8 max-w-xl mx-auto text-center space-y-3">
      <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
      <h2 className="font-semibold text-lg">অডিট রিপোর্ট লোড করা যায়নি</h2>
      <p className="text-sm text-muted-foreground break-all">{error?.message || "Unknown error"}</p>
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={() => reset()}>আবার চেষ্টা</Button>
        <Button asChild><a href="/audit-report"><ArrowLeft className="w-4 h-4 mr-1" />ফিরে যান</a></Button>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center space-y-3">
      <p className="text-muted-foreground">এই অডিট রিপোর্ট পাওয়া যায়নি।</p>
      <Button asChild><a href="/audit-report"><ArrowLeft className="w-4 h-4 mr-1" />ফিরে যান</a></Button>
    </div>
  ),
});

/* --------------------- constants --------------------- */
const STATUS_OPTIONS = ["ok", "warning", "fail"] as const;
const statusColor: Record<string, string> = {
  ok: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/30 dark:text-green-100",
  warning: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-100",
  fail: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-100",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-100",
  completed: "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-100",
};
const statusLabel = (s: string, lang: "bn" | "en") => {
  const map: any = {
    bn: { ok: "পাস", pass: "পাস", warning: "সতর্ক", fail: "ব্যর্থ", pending: "পেন্ডিং", in_progress: "চলমান", completed: "সম্পন্ন" },
    en: { ok: "Pass", pass: "Pass", warning: "Warning", fail: "Failed", pending: "Pending", in_progress: "In Progress", completed: "Completed" },
  };
  return map[lang][s] || s;
};
const riskColor: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-red-200 text-red-900",
};
const priorityColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const CHECK_FIELDS = [
  { key: "cash", labelBn: "ক্যাশ ব্যালেন্স ভেরিফিকেশন", labelEn: "Cash Balance Verification" },
  { key: "voucher", labelBn: "ভাউচার অনুমোদন", labelEn: "Expense Voucher Approval" },
  { key: "document", labelBn: "ডকুমেন্ট মেয়াদ চেক", labelEn: "Document Expiry Check" },
  { key: "pending", labelBn: "পেন্ডিং টাস্ক চেক", labelEn: "Pending Task Check" },
  { key: "attendance", labelBn: "হাজিরা চেক", labelEn: "Employee Attendance Check" },
  { key: "salary", labelBn: "বেতন পরিশোধ চেক", labelEn: "Salary Payment Check" },
  { key: "signature", labelBn: "সিগনেচার কার্ড চেক", labelEn: "Signature Card Check" },
  { key: "kyc", labelBn: "KYC কমপ্লায়েন্স", labelEn: "KYC Compliance Check" },
  { key: "loan", labelBn: "ঋণ কমপ্লায়েন্স", labelEn: "Loan Compliance Check" },
  { key: "inventory", labelBn: "ইনভেন্টরি চেক", labelEn: "Inventory Check" },
];

const AUDIT_TYPES = [
  { v: "internal", bn: "অভ্যন্তরীণ অডিট", en: "Internal Audit" },
  { v: "head_office", bn: "হেড অফিস অডিট", en: "Head Office Audit" },
  { v: "regulatory", bn: "নিয়ন্ত্রক অডিট", en: "Regulatory Audit" },
  { v: "external", bn: "বাহ্যিক", en: "External" },
  { v: "surprise", bn: "আকস্মিক", en: "Surprise" },
  { v: "compliance", bn: "কমপ্লায়েন্স", en: "Compliance" },
];

const FINDING_CATEGORIES = ["Cash", "Expense", "KYC", "Document", "Loan", "HR", "Inventory", "Other"];

/* --------------------- main page --------------------- */
function AuditReportDetailPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["audit_report", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    retry: false,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (error) return (
    <div className="p-8 max-w-xl mx-auto text-center space-y-3">
      <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
      <h2 className="font-semibold">লোড করা যায়নি</h2>
      <p className="text-sm text-muted-foreground break-all">{(error as any)?.message}</p>
      <Button onClick={() => navigate({ to: "/audit-report" })}><ArrowLeft className="w-4 h-4 mr-1" />ফিরে যান</Button>
    </div>
  );
  if (!report) return (
    <div className="p-8 text-center space-y-3">
      <p className="text-muted-foreground">এই রিপোর্ট পাওয়া যায়নি বা ডিলিট করা হয়েছে।</p>
      <Button onClick={() => navigate({ to: "/audit-report" })}><ArrowLeft className="w-4 h-4 mr-1" />ফিরে যান</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between no-print gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/audit-report" })}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {lang === "bn" ? "ফিরে যান" : "Back"}
        </Button>
        <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট / PDF" : "Print / PDF"}</Button>
      </div>

      {/* Print header */}
      <div className="hidden print:flex items-center justify-between border-b pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-white border p-1"><BankLogo className="w-full h-full" /></div>
          <div>
            <div className="font-bold">{t("bankName")}</div>
            <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold">{lang === "bn" ? "অডিট ও কমপ্লায়েন্স রিপোর্ট" : "Audit & Compliance Report"}</div>
          <div className="text-sm">{fmt.date(report.audit_date)} • {report.auditor_name}</div>
          {report.reference_number && <div className="text-xs font-mono">Ref: {report.reference_number}</div>}
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(nextTab) => navigate({ to: "/audit-report/$id", params: { id }, search: { tab: normalizeTab(nextTab) } })}
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto justify-start w-full gap-1 no-print">
          <TabsTrigger value="overview"><LayoutDashboard className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "সারাংশ" : "Overview"}</TabsTrigger>
          <TabsTrigger value="info"><FileText className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "তথ্য" : "Info"}</TabsTrigger>
          <TabsTrigger value="findings"><AlertTriangle className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "ইস্যু" : "Findings"}</TabsTrigger>
          <TabsTrigger value="tasks"><ClipboardList className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "টাস্ক" : "Tasks"}</TabsTrigger>
          <TabsTrigger value="checks"><ShieldCheck className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "কমপ্লায়েন্স" : "Compliance"}</TabsTrigger>
          <TabsTrigger value="documents"><FolderOpen className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "ডকুমেন্ট" : "Documents"}</TabsTrigger>
          <TabsTrigger value="signoff"><Pencil className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "অনুমোদন" : "Approval"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab report={report} reportId={id} /></TabsContent>
        <TabsContent value="info"><InfoTab report={report} qc={qc} /></TabsContent>
        <TabsContent value="findings" className="print:block"><FindingsTab reportId={id} /></TabsContent>
        <TabsContent value="tasks" className="print:block"><TasksTab reportId={id} /></TabsContent>
        <TabsContent value="checks" className="print:block"><ChecksTab report={report} qc={qc} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab reportId={id} /></TabsContent>
        <TabsContent value="signoff" className="print:block"><SignOffTab report={report} qc={qc} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------- Overview --------------------- */
function OverviewTab({ report, reportId }: { report: any; reportId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();

  const { data: checks = [] } = useQuery({
    queryKey: ["audit_compliance_checks", reportId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_compliance_checks").select("id,status").eq("audit_report_id", reportId);
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: findings = [] } = useQuery({
    queryKey: ["audit_findings", reportId],
    queryFn: async () => (await supabase.from("audit_findings").select("*").eq("audit_report_id", reportId)).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["audit_tasks", reportId],
    queryFn: async () => (await supabase.from("audit_tasks").select("*").eq("audit_report_id", reportId)).data ?? [],
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pendingF = findings.filter((f: any) => f.status !== "completed").length;
    const completedF = findings.filter((f: any) => f.status === "completed").length;
    const overdueT = tasks.filter((t: any) => t.status !== "completed" && t.due_date && t.due_date < today).length;
    let pass = checks.filter((c: any) => c.status === "ok" || c.status === "pass").length;
    let total = checks.length;
    if (!total) {
      CHECK_FIELDS.forEach(f => {
        const s = report[`${f.key}_check_status`];
        if (s) { total++; if (s === "ok" || s === "pass") pass++; }
      });
    }
    return {
      pendingF, completedF, totalF: findings.length, overdueT,
      pendingT: tasks.filter((t: any) => t.status !== "completed").length,
      completedT: tasks.filter((t: any) => t.status === "completed").length,
      score: total ? Math.round((pass / total) * 100) : 0,
    };
  }, [checks, findings, tasks, report]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SumCard color="amber" icon={<AlertTriangle className="w-4 h-4" />} label={lang === "bn" ? "মোট ইস্যু" : "Total Findings"} value={fmt.num(stats.totalF)} />
        <SumCard color="orange" icon={<AlertTriangle className="w-4 h-4" />} label={lang === "bn" ? "পেন্ডিং" : "Pending"} value={fmt.num(stats.pendingF)} />
        <SumCard color="green" icon={<CheckCircle2 className="w-4 h-4" />} label={lang === "bn" ? "সম্পন্ন" : "Completed"} value={fmt.num(stats.completedF)} />
        <SumCard color="red" icon={<AlertTriangle className="w-4 h-4" />} label={lang === "bn" ? "ওভারডিউ টাস্ক" : "Overdue Tasks"} value={fmt.num(stats.overdueT)} />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" />{lang === "bn" ? "কমপ্লায়েন্স স্কোর" : "Compliance Score"}</h3>
          <span className={`text-3xl font-bold ${stats.score >= 80 ? "text-green-600" : stats.score >= 50 ? "text-amber-600" : "text-red-600"}`}>{stats.score}%</span>
        </div>
        <Progress value={stats.score} className="h-3" />
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />{lang === "bn" ? "ইস্যুর ঝুঁকি বিতরণ" : "Findings by Risk"}</h3>
          {["high", "medium", "low"].map(level => {
            const count = findings.filter((f: any) => f.risk_level === level).length;
            const pct = findings.length ? (count / findings.length) * 100 : 0;
            return (
              <div key={level} className="mb-2">
                <div className="flex justify-between text-xs mb-1"><span className="capitalize">{level}</span><span>{fmt.num(count)}</span></div>
                <Progress value={pct} className={`h-2 ${level === "high" ? "[&>div]:bg-red-500" : level === "medium" ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500"}`} />
              </div>
            );
          })}
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" />{lang === "bn" ? "টাস্ক অগ্রগতি" : "Task Progress"}</h3>
          <div className="space-y-2">
            <SumLine label={lang === "bn" ? "মোট টাস্ক" : "Total"} value={fmt.num(tasks.length)} />
            <SumLine label={lang === "bn" ? "পেন্ডিং" : "Pending"} value={fmt.num(stats.pendingT)} color="text-orange-600" />
            <SumLine label={lang === "bn" ? "সম্পন্ন" : "Completed"} value={fmt.num(stats.completedT)} color="text-green-600" />
            <SumLine label={lang === "bn" ? "ওভারডিউ" : "Overdue"} value={fmt.num(stats.overdueT)} color="text-red-600" />
          </div>
        </Card>
      </div>
    </div>
  );
}
function SumCard({ icon, label, value, color }: any) {
  const colors: any = {
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200",
    orange: "bg-orange-50 dark:bg-orange-950/30 border-orange-200",
    green: "bg-green-50 dark:bg-green-950/30 border-green-200",
    red: "bg-red-50 dark:bg-red-950/30 border-red-200",
  };
  return (
    <Card className={`p-3 border ${colors[color]}`}>
      <div className="flex items-center gap-1 text-xs">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
function SumLine({ label, value, color = "" }: { label: string; value: string; color?: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className={`font-semibold ${color}`}>{value}</span></div>;
}

/* --------------------- Info --------------------- */
function InfoTab({ report, qc }: { report: any; qc: any }) {
  const { lang } = useI18n();
  const [form, setForm] = useState({
    audit_date: report.audit_date, auditor_name: report.auditor_name,
    audit_type: report.audit_type, period_start: report.period_start || "",
    period_end: report.period_end || "", reference_number: report.reference_number || "",
    remarks: report.remarks || "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("audit_reports").update({
        ...form, period_start: form.period_start || null, period_end: form.period_end || null,
        reference_number: form.reference_number || null,
      }).eq("id", report.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "সংরক্ষিত" : "Saved"); qc.invalidateQueries({ queryKey: ["audit_report", report.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">{lang === "bn" ? "অডিট তথ্য" : "Audit Information"}</h3>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div><Label>{lang === "bn" ? "অডিট তারিখ" : "Audit Date"}</Label><Input type="date" value={form.audit_date} onChange={e => setForm({ ...form, audit_date: e.target.value })} /></div>
        <div><Label>{lang === "bn" ? "অডিটরের নাম" : "Auditor Name"}</Label><Input value={form.auditor_name} onChange={e => setForm({ ...form, auditor_name: e.target.value })} maxLength={100} /></div>
        <div><Label>{lang === "bn" ? "অডিটের ধরন" : "Audit Type"}</Label>
          <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.audit_type} onChange={e => setForm({ ...form, audit_type: e.target.value })}>
            {AUDIT_TYPES.map(t => <option key={t.v} value={t.v}>{lang === "bn" ? t.bn : t.en}</option>)}
          </select>
        </div>
        <div><Label>{lang === "bn" ? "পিরিয়ড শুরু" : "Period Start"}</Label><Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} /></div>
        <div><Label>{lang === "bn" ? "পিরিয়ড শেষ" : "Period End"}</Label><Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} /></div>
        <div><Label>{lang === "bn" ? "রেফারেন্স নম্বর" : "Reference Number"}</Label><Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="AUD-2026-001" maxLength={50} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "মন্তব্য" : "Remarks"}</Label><Textarea rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} maxLength={2000} /></div>
        <div><Button type="submit" disabled={save.isPending}><Save className="w-4 h-4 mr-1" />{lang === "bn" ? "সংরক্ষণ" : "Save"}</Button></div>
      </form>
    </Card>
  );
}

/* --------------------- Compliance Checks --------------------- */
function ChecksTab({ report, qc }: { report: any; qc: any }) {
  const { lang } = useI18n();
  const emptyForm = { title: "", status: "ok", note: "" };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit_compliance_checks", report.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_compliance_checks").select("*")
        .eq("audit_report_id", report.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const fallbackRows = useMemo(() => CHECK_FIELDS.map((f, index) => ({
    id: `legacy-${f.key}`,
    audit_report_id: report.id,
    title: lang === "bn" ? f.labelBn : f.labelEn,
    status: report[`${f.key}_check_status`] || "ok",
    note: report[`${f.key}_check_note`] || "",
    sort_order: (index + 1) * 10,
  })), [lang, report]);
  const displayRows = rows.length ? rows : fallbackRows;
  const score = displayRows.length ? Math.round((displayRows.filter((r: any) => r.status === "ok" || r.status === "pass").length / displayRows.length) * 100) : 0;

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };
  const refreshChecks = () => {
    qc.invalidateQueries({ queryKey: ["audit_compliance_checks", report.id] });
    qc.invalidateQueries({ queryKey: ["audit_report", report.id] });
    qc.invalidateQueries({ queryKey: ["audit_reports"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error(lang === "bn" ? "চেকের নাম দিন" : "Checklist title required");
      if (editingId?.startsWith("legacy-")) {
        const seedRows = fallbackRows.map((r: any) => ({ audit_report_id: report.id, title: r.title, status: r.status, note: r.note || null, sort_order: r.sort_order }));
        const { error: seedError } = await supabase.from("audit_compliance_checks").insert(seedRows);
        if (seedError) throw seedError;
        const { data: created, error: findError } = await supabase.from("audit_compliance_checks").select("id")
          .eq("audit_report_id", report.id).eq("sort_order", fallbackRows.find((r: any) => r.id === editingId)?.sort_order || 0).maybeSingle();
        if (findError) throw findError;
        if (created?.id) {
          const { error } = await supabase.from("audit_compliance_checks").update({
            title: form.title.trim(), status: form.status, note: form.note.trim() || null,
          }).eq("id", created.id);
          if (error) throw error;
        }
        return;
      }
      if (editingId) {
        const { error } = await supabase.from("audit_compliance_checks").update({
          title: form.title.trim(), status: form.status, note: form.note.trim() || null,
        }).eq("id", editingId);
        if (error) throw error;
        return;
      }
      const nextOrder = displayRows.reduce((max: number, row: any) => Math.max(max, Number(row.sort_order) || 0), 0) + 10;
      const { error } = await supabase.from("audit_compliance_checks").insert({
        audit_report_id: report.id, title: form.title.trim(), status: form.status, note: form.note.trim() || null, sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "চেকলিস্ট সংরক্ষিত" : "Checklist saved"); resetForm(); refreshChecks(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (id.startsWith("legacy-")) throw new Error(lang === "bn" ? "আগে এডিট/সংরক্ষণ করুন" : "Please save the checklist first");
      const { error } = await supabase.from("audit_compliance_checks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refreshChecks,
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith("legacy-")) throw new Error(lang === "bn" ? "আগে চেকলিস্ট সংরক্ষণ করুন" : "Please save the checklist first");
      const { error } = await supabase.from("audit_compliance_checks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted"); refreshChecks(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (row: any) => {
    setEditingId(row.id);
    setForm({ title: row.title || "", status: row.status || "ok", note: row.note || "" });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-semibold">{lang === "bn" ? "কমপ্লায়েন্স চেকলিস্ট" : "Compliance Checklist"}</h3>
            <p className="text-xs text-muted-foreground">{lang === "bn" ? "প্রতিটি চেক আলাদা রেকর্ড হিসেবে অ্যাড, এডিট ও ডিলিট করা যাবে" : "Add, edit, and delete each checklist item separately"}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{lang === "bn" ? "স্কোর" : "Score"}</div>
            <div className={`text-2xl font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>{score}%</div>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-12 gap-2 rounded-md border bg-muted/30 p-3 mb-4 no-print">
          <div className="sm:col-span-4"><Label>{lang === "bn" ? "চেকের নাম" : "Check Name"}</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={160} placeholder={lang === "bn" ? "যেমন: ক্যাশ ব্যালেন্স ভেরিফিকেশন" : "Example: Cash Balance Verification"} /></div>
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</Label><select className="w-full h-9 border rounded-md px-2 bg-background text-foreground text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map(o => <option key={o} value={o}>{statusLabel(o, lang)}</option>)}</select></div>
          <div className="sm:col-span-4"><Label>{lang === "bn" ? "নোট" : "Note"}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={500} placeholder={lang === "bn" ? "মন্তব্য" : "Comment"} /></div>
          <div className="sm:col-span-2 flex items-end gap-2"><Button type="submit" disabled={save.isPending} className="flex-1"><Save className="w-4 h-4 mr-1" />{editingId ? (lang === "bn" ? "আপডেট" : "Update") : (lang === "bn" ? "অ্যাড" : "Add")}</Button>{editingId && <Button type="button" variant="outline" size="icon" onClick={resetForm}><X className="w-4 h-4" /></Button>}</div>
        </form>

        <div className="space-y-2">
          {isLoading && <Card className="p-6 text-center text-muted-foreground">Loading...</Card>}
          {!isLoading && displayRows.length === 0 && <Card className="p-6 text-center text-muted-foreground">{lang === "bn" ? "কোনো চেক নেই" : "No checks"}</Card>}
          {!isLoading && displayRows.map((row: any) => {
            const s = row.status || "ok";
            return (
              <div key={row.id} className={`border rounded-md p-3 ${statusColor[s]}`}>
                <div className="grid sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4 font-medium text-sm flex items-center gap-2">
                    {s === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {row.title}
                  </div>
                  <div className="sm:col-span-2">
                    <select className="w-full h-8 border rounded-md px-2 bg-background text-foreground text-sm" value={s} onChange={e => updateStatus.mutate({ id: row.id, status: e.target.value })} disabled={row.id.startsWith("legacy-")}>{STATUS_OPTIONS.map(o => <option key={o} value={o}>{statusLabel(o, lang)}</option>)}</select>
                  </div>
                  <div className="sm:col-span-4 text-sm text-foreground/80">{row.note || <span className="text-muted-foreground">{lang === "bn" ? "নোট নেই" : "No note"}</span>}</div>
                  <div className="sm:col-span-2 flex justify-end gap-1 no-print">
                    <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row)}><Pencil className="w-4 h-4" /></Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { if (window.confirm(lang === "bn" ? "নিশ্চিতভাবে মুছবেন?" : "Delete this check?")) del.mutate(row.id); }} disabled={row.id.startsWith("legacy-")}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* --------------------- Findings --------------------- */
function FindingsTab({ reportId }: { reportId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const empty = {
    title: "", details: "", category: "Other", risk_level: "medium",
    recommendation: "", responsible_person: "", deadline: "",
    status: "pending", corrective_action: "",
  };
  const [form, setForm] = useState(empty);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["audit_findings", reportId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_findings").select("*")
        .eq("audit_report_id", reportId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error(lang === "bn" ? "শিরোনাম দিন" : "Title required");
      setUploading(true);
      let evidence_url: string | null = null, evidence_name: string | null = null;
      if (evidenceFile) {
        const ext = evidenceFile.name.split(".").pop() || "bin";
        const path = `audit/${reportId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, evidenceFile);
        if (upErr) throw upErr;
        evidence_url = path; evidence_name = evidenceFile.name;
      }
      const payload: any = {
        ...form,
        audit_report_id: reportId,
        deadline: form.deadline || null,
        resolved_date: form.status === "completed" ? new Date().toISOString().slice(0, 10) : null,
      };
      if (evidence_url) { payload.evidence_url = evidence_url; payload.evidence_name = evidence_name; }
      if (editingId) {
        const { error } = await supabase.from("audit_findings").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("audit_findings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "সংরক্ষিত" : "Saved");
      setForm(empty); setEvidenceFile(null); setEditingId(null); setShowForm(false);
      qc.invalidateQueries({ queryKey: ["audit_findings", reportId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const del = useMutation({
    mutationFn: async (fid: string) => { const { error } = await supabase.from("audit_findings").delete().eq("id", fid); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["audit_findings", reportId] }); },
  });

  const updStatus = useMutation({
    mutationFn: async ({ fid, status }: { fid: string; status: string }) => {
      const { error } = await supabase.from("audit_findings").update({
        status, resolved_date: status === "completed" ? new Date().toISOString().slice(0, 10) : null,
      }).eq("id", fid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit_findings", reportId] }),
  });

  const startEdit = (r: any) => {
    setEditingId(r.id); setShowForm(true);
    setForm({
      title: r.title, details: r.details || "", category: r.category, risk_level: r.risk_level,
      recommendation: r.recommendation || "", responsible_person: r.responsible_person || "",
      deadline: r.deadline || "", status: r.status, corrective_action: r.corrective_action || "",
    });
  };

  const openEvidence = async (url: string) => {
    if (url.startsWith("http")) { window.open(url, "_blank"); return; }
    const { data } = await supabase.storage.from("documents").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <h3 className="font-semibold">{lang === "bn" ? "অডিট ফাইন্ডিংস" : "Audit Findings"} ({fmt.num(rows.length)})</h3>
        <Button size="sm" onClick={() => { setShowForm(s => !s); setEditingId(null); setForm(empty); setEvidenceFile(null); }}>
          <Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন ইস্যু" : "Add Finding"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 ring-2 ring-primary no-print">
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "ইস্যু শিরোনাম" : "Finding Title"} *</Label>
              <Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={200} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "বিস্তারিত" : "Finding Details"}</Label>
              <Textarea rows={3} value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} maxLength={2000} /></div>
            <div><Label>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</Label>
              <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {FINDING_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>{lang === "bn" ? "ঝুঁকির মাত্রা" : "Risk Level"}</Label>
              <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.risk_level} onChange={e => setForm({ ...form, risk_level: e.target.value })}>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <div><Label>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</Label>
              <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="pending">{statusLabel("pending", lang)}</option>
                <option value="in_progress">{statusLabel("in_progress", lang)}</option>
                <option value="completed">{statusLabel("completed", lang)}</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "অডিটরের সুপারিশ" : "Auditor Recommendation"}</Label>
              <Textarea rows={2} value={form.recommendation} onChange={e => setForm({ ...form, recommendation: e.target.value })} maxLength={1000} /></div>
            <div><Label>{lang === "bn" ? "দায়িত্বপ্রাপ্ত" : "Responsible Person"}</Label>
              <Input value={form.responsible_person} onChange={e => setForm({ ...form, responsible_person: e.target.value })} maxLength={100} /></div>
            <div><Label>{lang === "bn" ? "ডেডলাইন" : "Due Date"}</Label>
              <Input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "প্রমাণপত্র (PDF/Image)" : "Evidence Upload"}</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={e => setEvidenceFile(e.target.files?.[0] || null)} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "সংশোধনমূলক ব্যবস্থা" : "Corrective Action"}</Label>
              <Textarea rows={2} value={form.corrective_action} onChange={e => setForm({ ...form, corrective_action: e.target.value })} maxLength={1000} /></div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <Button type="submit" disabled={uploading}><Save className="w-4 h-4 mr-1" />{editingId ? (lang === "bn" ? "আপডেট" : "Update") : (lang === "bn" ? "সংরক্ষণ" : "Save")}</Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(empty); setEvidenceFile(null); }}>{lang === "bn" ? "বাতিল" : "Cancel"}</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-2">
        {rows.length === 0 && <Card className="p-6 text-center text-muted-foreground">{lang === "bn" ? "কোনো ইস্যু নেই" : "No findings"}</Card>}
        {rows.map((r: any) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase ${riskColor[r.risk_level]}`}>{r.risk_level}</span>
                  <Badge variant="outline">{r.category}</Badge>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "in_progress" ? "secondary" : "destructive"}>
                    {statusLabel(r.status, lang)}
                  </Badge>
                </div>
                <div className="font-semibold">{r.title}</div>
                {r.details && <p className="text-sm text-muted-foreground mt-1">{r.details}</p>}
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                  {r.recommendation && <div><span className="font-semibold">{lang === "bn" ? "সুপারিশ:" : "Recommendation:"}</span> {r.recommendation}</div>}
                  {r.responsible_person && <div><span className="font-semibold">{lang === "bn" ? "দায়িত্বে:" : "Responsible:"}</span> {r.responsible_person}</div>}
                  {r.deadline && <div><span className="font-semibold">{lang === "bn" ? "ডেডলাইন:" : "Due:"}</span> {fmt.date(r.deadline)}</div>}
                  {r.resolved_date && <div><span className="font-semibold">{lang === "bn" ? "সম্পন্ন:" : "Resolved:"}</span> {fmt.date(r.resolved_date)}</div>}
                  {r.corrective_action && <div className="sm:col-span-2"><span className="font-semibold">{lang === "bn" ? "ব্যবস্থা:" : "Action:"}</span> {r.corrective_action}</div>}
                </div>
                {r.evidence_url && (
                  <Button size="sm" variant="outline" className="mt-2 no-print" onClick={() => openEvidence(r.evidence_url)}>
                    <FileCheck className="w-3 h-3 mr-1" />{r.evidence_name || "Evidence"}
                  </Button>
                )}
              </div>
              <div className="flex flex-col gap-1 no-print">
                <select className="h-7 text-xs border rounded px-1 bg-background"
                  value={r.status} onChange={e => updStatus.mutate({ fid: r.id, status: e.target.value })}>
                  <option value="pending">{statusLabel("pending", lang)}</option>
                  <option value="in_progress">{statusLabel("in_progress", lang)}</option>
                  <option value="completed">{statusLabel("completed", lang)}</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("?")) del.mutate(r.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------- Tasks --------------------- */
function TasksTab({ reportId }: { reportId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const empty = { task_name: "", assigned_to: "", due_date: "", priority: "medium", status: "pending", notes: "" };
  const [form, setForm] = useState(empty);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["audit_tasks", reportId],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_tasks").select("*")
        .eq("audit_report_id", reportId).order("due_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.task_name.trim()) throw new Error(lang === "bn" ? "কাজের নাম দিন" : "Task name required");
      setUploading(true);
      let attachment_url: string | null = null, attachment_name: string | null = null;
      if (attachFile) {
        const ext = attachFile.name.split(".").pop() || "bin";
        const path = `audit/${reportId}/tasks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, attachFile);
        if (upErr) throw upErr;
        attachment_url = path; attachment_name = attachFile.name;
      }
      const { error } = await supabase.from("audit_tasks").insert({
        audit_report_id: reportId, ...form,
        due_date: form.due_date || null, attachment_url, attachment_name,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "যোগ হয়েছে" : "Added"); setForm(empty); setAttachFile(null); qc.invalidateQueries({ queryKey: ["audit_tasks", reportId] }); },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const upd = useMutation({
    mutationFn: async ({ tid, patch }: { tid: string; patch: any }) => {
      const { error } = await supabase.from("audit_tasks").update(patch).eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit_tasks", reportId] }),
  });

  const del = useMutation({
    mutationFn: async (tid: string) => { const { error } = await supabase.from("audit_tasks").delete().eq("id", tid); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["audit_tasks", reportId] }); },
  });

  const openAttach = async (url: string) => {
    if (url.startsWith("http")) { window.open(url, "_blank"); return; }
    const { data } = await supabase.storage.from("documents").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" />{lang === "bn" ? "নতুন টাস্ক" : "New Task"}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "কাজের নাম" : "Task Name"} *</Label><Input required value={form.task_name} onChange={e => setForm({ ...form, task_name: e.target.value })} maxLength={200} /></div>
          <div><Label>{lang === "bn" ? "দায়িত্বপ্রাপ্ত" : "Assigned To"}</Label><Input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} maxLength={100} /></div>
          <div><Label>{lang === "bn" ? "ডেডলাইন" : "Deadline"}</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</Label>
            <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
          <div><Label>{lang === "bn" ? "অ্যাটাচমেন্ট" : "Attachment"}</Label><Input type="file" onChange={e => setAttachFile(e.target.files?.[0] || null)} /></div>
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "নোট" : "Notes"}</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} maxLength={500} /></div>
          <div className="flex items-end"><Button type="submit" disabled={uploading}>{lang === "bn" ? "যোগ করুন" : "Add Task"}</Button></div>
        </form>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-2 text-left">{lang === "bn" ? "কাজ" : "Task"}</th>
              <th className="p-2 text-left">{lang === "bn" ? "দায়িত্ব" : "Assigned"}</th>
              <th className="p-2 text-left">{lang === "bn" ? "ডেডলাইন" : "Deadline"}</th>
              <th className="p-2">{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</th>
              <th className="p-2">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
              <th className="p-2">{lang === "bn" ? "সম্পন্ন" : "Done"}</th>
              <th className="p-2 no-print">{lang === "bn" ? "ফাইল" : "File"}</th>
              <th className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{lang === "bn" ? "কোনো টাস্ক নেই" : "No tasks"}</td></tr>}
            {rows.map((r: any) => {
              const overdue = r.due_date && r.status !== "completed" && new Date(r.due_date) < new Date();
              return (
                <tr key={r.id} className={`border-t ${overdue ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                  <td className="p-2">
                    <div className="font-medium">{r.task_name}</div>
                    {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                    {r.completion_note && <div className="text-xs text-green-700 dark:text-green-400 mt-0.5">✓ {r.completion_note}</div>}
                  </td>
                  <td className="p-2">{r.assigned_to || "—"}</td>
                  <td className="p-2 text-xs">{r.due_date ? fmt.date(r.due_date) : "—"} {overdue && <span className="text-red-600 font-semibold">({lang === "bn" ? "অতিক্রান্ত" : "overdue"})</span>}</td>
                  <td className="p-2 text-center"><span className={`text-[10px] px-2 py-0.5 rounded font-medium ${priorityColor[r.priority]}`}>{r.priority}</span></td>
                  <td className="p-2">
                    <select className="h-7 text-xs border rounded px-1 bg-background no-print"
                      value={r.status} onChange={e => {
                        const status = e.target.value;
                        const patch: any = { status };
                        patch.completion_date = status === "completed" ? new Date().toISOString().slice(0, 10) : null;
                        upd.mutate({ tid: r.id, patch });
                      }}>
                      <option value="pending">{statusLabel("pending", lang)}</option>
                      <option value="in_progress">{statusLabel("in_progress", lang)}</option>
                      <option value="completed">{statusLabel("completed", lang)}</option>
                    </select>
                    <span className="hidden print:inline">{statusLabel(r.status, lang)}</span>
                  </td>
                  <td className="p-2 text-xs">{r.completion_date ? fmt.date(r.completion_date) : "—"}</td>
                  <td className="p-2 no-print">
                    {r.attachment_url ? (
                      <Button size="sm" variant="ghost" onClick={() => openAttach(r.attachment_url)}><Eye className="w-4 h-4" /></Button>
                    ) : "—"}
                  </td>
                  <td className="p-2 no-print">
                    <div className="flex gap-1">
                      {r.status === "completed" && !r.completion_note && (
                        <Button size="sm" variant="ghost" onClick={() => {
                          const note = window.prompt(lang === "bn" ? "সম্পন্ন নোট:" : "Completion note:");
                          if (note) upd.mutate({ tid: r.id, patch: { completion_note: note } });
                        }}><Pencil className="w-4 h-4" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------- Documents --------------------- */
function DocumentsTab({ reportId }: { reportId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [docType, setDocType] = useState("audit_report");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const docTypes = [
    { v: "audit_report", bn: "অডিট রিপোর্ট", en: "Audit Report" },
    { v: "auditor_document", bn: "অডিটর ডকুমেন্ট", en: "Auditor Document" },
    { v: "evidence", bn: "প্রমাণপত্র", en: "Evidence File" },
    { v: "supporting", bn: "সহায়ক ডকুমেন্ট", en: "Supporting Document" },
  ];

  const { data: rows = [] } = useQuery({
    queryKey: ["audit_docs", reportId],
    queryFn: async () => {
      // findings with evidence + tasks with attachments
      const [f, t] = await Promise.all([
        supabase.from("audit_findings").select("id,title,evidence_url,evidence_name,created_at").eq("audit_report_id", reportId).not("evidence_url", "is", null),
        supabase.from("audit_tasks").select("id,task_name,attachment_url,attachment_name,created_at").eq("audit_report_id", reportId).not("attachment_url", "is", null),
      ]);
      const docs = (await supabase.from("documents").select("*").eq("description", `audit:${reportId}`).order("created_at", { ascending: false })).data ?? [];
      return {
        findings: f.data ?? [],
        tasks: t.data ?? [],
        general: docs,
      };
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error(lang === "bn" ? "ফাইল ও শিরোনাম দিন" : "File and title required");
      setUploading(true);
      const ext = file.name.split(".").pop() || "bin";
      const path = `audit/${reportId}/docs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        title: title.trim(),
        category: docType,
        description: `audit:${reportId}`,
        file_url: path,
        file_name: file.name,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "আপলোড সম্পন্ন" : "Uploaded"); setTitle(""); setFile(null); qc.invalidateQueries({ queryKey: ["audit_docs", reportId] }); },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const del = useMutation({
    mutationFn: async (did: string) => { const { error } = await supabase.from("documents").delete().eq("id", did); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["audit_docs", reportId] }); },
  });

  const open = async (url: string) => {
    if (!url) return;
    if (url.startsWith("http")) { window.open(url, "_blank"); return; }
    const { data } = await supabase.storage.from("documents").createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const data: any = rows;
  const generalDocs = data?.general ?? [];
  const findingDocs = data?.findings ?? [];
  const taskDocs = data?.tasks ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Upload className="w-4 h-4" />{lang === "bn" ? "ডকুমেন্ট আপলোড" : "Upload Document"}</h3>
        <form onSubmit={e => { e.preventDefault(); upload.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "শিরোনাম" : "Title"} *</Label><Input required value={title} onChange={e => setTitle(e.target.value)} maxLength={200} /></div>
          <div><Label>{lang === "bn" ? "ধরন" : "Type"}</Label>
            <select className="w-full h-9 border rounded-md px-2 bg-background" value={docType} onChange={e => setDocType(e.target.value)}>
              {docTypes.map(d => <option key={d.v} value={d.v}>{lang === "bn" ? d.bn : d.en}</option>)}
            </select>
          </div>
          <div><Label>{lang === "bn" ? "ফাইল" : "File"} *</Label><Input type="file" required onChange={e => setFile(e.target.files?.[0] || null)} /></div>
          <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={uploading}>{uploading ? "..." : (lang === "bn" ? "আপলোড" : "Upload")}</Button></div>
        </form>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">{lang === "bn" ? "অডিট ডকুমেন্ট" : "Audit Documents"}</h3>
        {generalDocs.length === 0 ? <div className="text-sm text-muted-foreground">{lang === "bn" ? "কোনো ডকুমেন্ট নেই" : "No documents"}</div> :
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {generalDocs.map((d: any) => (
              <Card key={d.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Badge variant="outline" className="text-[10px] mb-1">{docTypes.find(x => x.v === d.category)?.[lang] || d.category}</Badge>
                    <div className="font-semibold text-sm truncate">{d.title}</div>
                    <div className="text-[10px] text-muted-foreground">{fmt.date(d.created_at)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => open(d.file_url)}><Eye className="w-3 h-3 mr-1" />{lang === "bn" ? "দেখুন" : "View"}</Button>
              </Card>
            ))}
          </div>
        }
      </Card>

      {findingDocs.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">{lang === "bn" ? "ফাইন্ডিং প্রমাণপত্র" : "Finding Evidence"}</h3>
          <div className="space-y-2">
            {findingDocs.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-2 border rounded-md">
                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{f.title}</div><div className="text-xs text-muted-foreground truncate">{f.evidence_name}</div></div>
                <Button size="sm" variant="outline" onClick={() => open(f.evidence_url)}><Eye className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {taskDocs.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">{lang === "bn" ? "টাস্ক অ্যাটাচমেন্ট" : "Task Attachments"}</h3>
          <div className="space-y-2">
            {taskDocs.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 border rounded-md">
                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{t.task_name}</div><div className="text-xs text-muted-foreground truncate">{t.attachment_name}</div></div>
                <Button size="sm" variant="outline" onClick={() => open(t.attachment_url)}><Eye className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* --------------------- Sign-off --------------------- */
function SignOffTab({ report, qc }: { report: any; qc: any }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const [form, setForm] = useState({
    prepared_by: report.prepared_by || "",
    checked_by: report.checked_by || "",
    approved_by: report.approved_by || "",
    sign_date: report.sign_date || new Date().toISOString().slice(0, 10),
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("audit_reports").update(form).eq("id", report.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "সাইন-অফ সংরক্ষিত" : "Sign-off saved"); qc.invalidateQueries({ queryKey: ["audit_report", report.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">{lang === "bn" ? "অনুমোদন ও সাইন-অফ" : "Approval & Sign-off"}</h3>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 gap-3">
        <div><Label>{lang === "bn" ? "প্রস্তুতকারী" : "Prepared By"}</Label><Input value={form.prepared_by} onChange={e => setForm({ ...form, prepared_by: e.target.value })} maxLength={100} /></div>
        <div><Label>{lang === "bn" ? "যাচাইকারী" : "Checked By"}</Label><Input value={form.checked_by} onChange={e => setForm({ ...form, checked_by: e.target.value })} maxLength={100} /></div>
        <div><Label>{lang === "bn" ? "অনুমোদনকারী" : "Approved By"}</Label><Input value={form.approved_by} onChange={e => setForm({ ...form, approved_by: e.target.value })} maxLength={100} /></div>
        <div><Label>{lang === "bn" ? "তারিখ" : "Sign Date"}</Label><Input type="date" value={form.sign_date} onChange={e => setForm({ ...form, sign_date: e.target.value })} /></div>
        <div className="sm:col-span-2 no-print"><Button type="submit" disabled={save.isPending}><Save className="w-4 h-4 mr-1" />{lang === "bn" ? "সংরক্ষণ" : "Save"}</Button></div>
      </form>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 text-center text-sm">
        <div><div className="border-t border-foreground/40 pt-2 font-semibold">{form.prepared_by || "—"}</div><div className="text-xs text-muted-foreground">{lang === "bn" ? "প্রস্তুতকারী" : "Prepared By"}</div></div>
        <div><div className="border-t border-foreground/40 pt-2 font-semibold">{form.checked_by || "—"}</div><div className="text-xs text-muted-foreground">{lang === "bn" ? "যাচাইকারী" : "Checked By"}</div></div>
        <div><div className="border-t border-foreground/40 pt-2 font-semibold">{form.approved_by || "—"}</div><div className="text-xs text-muted-foreground">{lang === "bn" ? "অনুমোদনকারী" : "Approved By"}</div></div>
        <div><div className="border-t border-foreground/40 pt-2 font-semibold">{report.auditor_name}</div><div className="text-xs text-muted-foreground">{lang === "bn" ? "অডিটর স্বাক্ষর" : "Auditor Signature"}</div></div>
      </div>
      {form.sign_date && <div className="text-xs text-center text-muted-foreground mt-3">{lang === "bn" ? "তারিখ:" : "Date:"} {fmt.date(form.sign_date)}</div>}
    </Card>
  );
}
