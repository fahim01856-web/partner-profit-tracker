import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useI18n } from "@/lib/i18n";
import { useFmt, monthsOf } from "@/lib/format";
import { toast } from "sonner";
import {
  ShieldCheck, Plus, Eye, Trash2, AlertTriangle, CheckCircle2, Clock,
  Calendar, Search, FileBarChart, TrendingUp, ListChecks, Pencil, X,
} from "lucide-react";

export const Route = createFileRoute("/_app/audit-report/")({ component: AuditReportListPage });

const AUDIT_TYPES = [
  { v: "internal", bn: "অভ্যন্তরীণ অডিট", en: "Internal Audit" },
  { v: "head_office", bn: "হেড অফিস অডিট", en: "Head Office Audit" },
  { v: "regulatory", bn: "নিয়ন্ত্রক অডিট", en: "Regulatory Audit" },
  { v: "external", bn: "বাহ্যিক", en: "External" },
  { v: "surprise", bn: "আকস্মিক", en: "Surprise" },
  { v: "compliance", bn: "কমপ্লায়েন্স", en: "Compliance" },
];
const typeLabel = (v: string, lang: "bn" | "en") => AUDIT_TYPES.find(x => x.v === v)?.[lang] || v;

const CHECK_KEYS = ["cash", "voucher", "document", "pending", "attendance", "salary", "signature", "kyc", "loan", "inventory"] as const;

function AuditReportListPage() {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const now = new Date();
  const months = monthsOf(lang);

  const [filterMonth, setFilterMonth] = useState<number | "">("");
  const [filterYear, setFilterYear] = useState<number | "">(now.getFullYear());
  const [filterAuditor, setFilterAuditor] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // approved / pending
  const [showNew, setShowNew] = useState(false);
  const emptyForm = () => ({
    audit_date: now.toISOString().slice(0, 10),
    auditor_name: "",
    audit_type: "internal",
    period_start: "",
    period_end: "",
    reference_number: "",
    remarks: "",
  });
  const [form, setForm] = useState(emptyForm());

  const { data: reports = [] } = useQuery({
    queryKey: ["audit_reports", filterMonth, filterYear, filterAuditor, filterType, filterStatus],
    queryFn: async () => {
      let q = supabase.from("audit_reports")
        .select("*, audit_findings(id, status, deadline), audit_tasks(id, status, due_date)")
        .order("audit_date", { ascending: false });
      if (filterYear) {
        const ys = `${filterYear}-01-01`, ye = `${filterYear}-12-31`;
        q = q.gte("audit_date", ys).lte("audit_date", ye);
      }
      if (filterMonth && filterYear) {
        const m = String(filterMonth).padStart(2, "0");
        const start = `${filterYear}-${m}-01`;
        const end = new Date(Number(filterYear), Number(filterMonth), 0).toISOString().slice(0, 10);
        q = q.gte("audit_date", start).lte("audit_date", end);
      }
      if (filterAuditor) q = q.ilike("auditor_name", `%${filterAuditor}%`);
      if (filterType) q = q.eq("audit_type", filterType);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data as any[]) || [];
      if (filterStatus === "approved") rows = rows.filter(r => !!r.approved_by);
      if (filterStatus === "pending") rows = rows.filter(r => !r.approved_by);
      return rows;
    },
  });

  const stats = useMemo(() => {
    let totalFindings = 0, pendingFindings = 0, completedFindings = 0;
    let overdueTasks = 0, totalChecks = 0, passedChecks = 0;
    const today = new Date().toISOString().slice(0, 10);
    reports.forEach((r: any) => {
      (r.audit_findings || []).forEach((f: any) => {
        totalFindings++;
        if (f.status === "completed") completedFindings++; else pendingFindings++;
      });
      (r.audit_tasks || []).forEach((t: any) => {
        if (t.status !== "completed" && t.due_date && t.due_date < today) overdueTasks++;
      });
      CHECK_KEYS.forEach(k => {
        const s = r[`${k}_check_status`];
        if (s) { totalChecks++; if (s === "pass" || s === "ok") passedChecks++; }
      });
    });
    const compliance = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;
    return { totalReports: reports.length, totalFindings, pendingFindings, completedFindings, overdueTasks, compliance };
  }, [reports]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.auditor_name.trim()) throw new Error(lang === "bn" ? "অডিটরের নাম দিন" : "Auditor name required");
      const { data, error } = await supabase.from("audit_reports").insert({
        audit_date: form.audit_date,
        auditor_name: form.auditor_name.trim(),
        audit_type: form.audit_type,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        reference_number: form.reference_number || null,
        remarks: form.remarks || null,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "অডিট তৈরি হয়েছে" : "Audit created");
      setShowNew(false); setForm(emptyForm());
      qc.invalidateQueries({ queryKey: ["audit_reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audit_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted"); qc.invalidateQueries({ queryKey: ["audit_reports"] }); },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {lang === "bn" ? "অডিট ও কমপ্লায়েন্স ম্যানেজমেন্ট" : "Audit & Compliance Management"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn" ? "অডিট তৈরি, ইস্যু ট্র্যাকিং, টাস্ক ম্যানেজমেন্ট ও কমপ্লায়েন্স স্কোর" : "Audit creation, issue tracking, task management & compliance scoring"}
          </p>
        </div>
        <Button onClick={() => setShowNew(s => !s)}>
          <Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন অডিট" : "New Audit"}
        </Button>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <DashCard icon={<FileBarChart className="w-4 h-4" />} label={lang === "bn" ? "মোট অডিট" : "Total Audits"} value={fmt.num(stats.totalReports)} color="blue" />
        <DashCard icon={<AlertTriangle className="w-4 h-4" />} label={lang === "bn" ? "মোট ইস্যু" : "Total Findings"} value={fmt.num(stats.totalFindings)} color="amber" />
        <DashCard icon={<Clock className="w-4 h-4" />} label={lang === "bn" ? "পেন্ডিং ইস্যু" : "Pending Issues"} value={fmt.num(stats.pendingFindings)} color="orange" />
        <DashCard icon={<CheckCircle2 className="w-4 h-4" />} label={lang === "bn" ? "সম্পন্ন ইস্যু" : "Completed Issues"} value={fmt.num(stats.completedFindings)} color="green" />
        <DashCard icon={<AlertTriangle className="w-4 h-4" />} label={lang === "bn" ? "ওভারডিউ টাস্ক" : "Overdue Tasks"} value={fmt.num(stats.overdueTasks)} color="red" />
        <DashCard icon={<TrendingUp className="w-4 h-4" />} label={lang === "bn" ? "কমপ্লায়েন্স স্কোর" : "Compliance Score"} value={`${fmt.num(stats.compliance)}%`} color="primary" extra={<Progress value={stats.compliance} className="h-1.5 mt-1.5" />} />
      </div>

      {/* New audit form */}
      {showNew && (
        <Card className="p-5 ring-2 ring-primary">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />{lang === "bn" ? "নতুন অডিট তথ্য" : "New Audit Information"}</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}><X className="w-4 h-4" /></Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><Label>{lang === "bn" ? "অডিট তারিখ" : "Audit Date"} *</Label>
              <Input type="date" required value={form.audit_date} onChange={e => setForm({ ...form, audit_date: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "অডিটরের নাম" : "Auditor Name"} *</Label>
              <Input required value={form.auditor_name} onChange={e => setForm({ ...form, auditor_name: e.target.value })} maxLength={100} /></div>
            <div><Label>{lang === "bn" ? "অডিটের ধরন" : "Audit Type"}</Label>
              <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.audit_type} onChange={e => setForm({ ...form, audit_type: e.target.value })}>
                {AUDIT_TYPES.map(t => <option key={t.v} value={t.v}>{lang === "bn" ? t.bn : t.en}</option>)}
              </select>
            </div>
            <div><Label>{lang === "bn" ? "পিরিয়ড শুরু" : "Period Start"}</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "পিরিয়ড শেষ" : "Period End"}</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "রেফারেন্স নম্বর" : "Reference Number"}</Label>
              <Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="AUD-2026-001" maxLength={50} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "মন্তব্য" : "Remarks"}</Label>
              <Textarea rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} maxLength={2000} /></div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <Button type="submit" disabled={create.isPending}>{lang === "bn" ? "তৈরি করুন" : "Create"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>{lang === "bn" ? "বাতিল" : "Cancel"}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><Label className="text-xs flex items-center gap-1"><Search className="w-3 h-3" />{lang === "bn" ? "মাস" : "Month"}</Label>
            <select className="h-9 border rounded-md px-2 text-sm bg-background" value={filterMonth} onChange={e => setFilterMonth(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{lang === "bn" ? "সব" : "All"}</option>
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
            <Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(e.target.value ? Number(e.target.value) : "")} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "অডিটর" : "Auditor"}</Label>
            <Input className="w-48" placeholder={lang === "bn" ? "নাম দিয়ে খুঁজুন" : "Search by name"} value={filterAuditor} onChange={e => setFilterAuditor(e.target.value)} /></div>
          <div><Label className="text-xs">{lang === "bn" ? "ধরন" : "Type"}</Label>
            <select className="h-9 border rounded-md px-2 text-sm bg-background" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">{lang === "bn" ? "সব" : "All"}</option>
              {AUDIT_TYPES.map(t => <option key={t.v} value={t.v}>{lang === "bn" ? t.bn : t.en}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">{lang === "bn" ? "অবস্থা" : "Status"}</Label>
            <select className="h-9 border rounded-md px-2 text-sm bg-background" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{lang === "bn" ? "সব" : "All"}</option>
              <option value="approved">{lang === "bn" ? "অনুমোদিত" : "Approved"}</option>
              <option value="pending">{lang === "bn" ? "পেন্ডিং" : "Pending"}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Reports list */}
      <div className="space-y-3">
        {reports.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            {lang === "bn" ? "কোনো অডিট রিপোর্ট পাওয়া যায়নি" : "No audit reports found"}
          </Card>
        )}
        {reports.map((r: any) => {
          const findings = r.audit_findings || [];
          const tasks = r.audit_tasks || [];
          const totalFindings = findings.length;
          const pendingFindings = findings.filter((f: any) => f.status !== "completed").length;
          const completedTasks = tasks.filter((t: any) => t.status === "completed").length;
          const pendingTasks = tasks.length - completedTasks;
          let pass = 0, total = 0;
          CHECK_KEYS.forEach(k => {
            const s = r[`${k}_check_status`];
            if (s) { total++; if (s === "pass" || s === "ok") pass++; }
          });
          const compliance = total ? Math.round((pass / total) * 100) : 0;
          return (
            <Card key={r.id} className="p-4 hover:border-primary transition-colors">
              <div className="grid md:grid-cols-[1fr_auto] gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">{typeLabel(r.audit_type, lang)}</Badge>
                    {r.reference_number && <Badge variant="secondary" className="font-mono text-xs">#{r.reference_number}</Badge>}
                    <span className="font-semibold">{r.auditor_name}</span>
                    {r.approved_by ? <Badge className="bg-green-600">{lang === "bn" ? "অনুমোদিত" : "Approved"}</Badge> :
                      <Badge variant="outline" className="text-amber-700 border-amber-300">{lang === "bn" ? "পেন্ডিং" : "Pending"}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmt.date(r.audit_date)}</span>
                    {r.period_start && r.period_end && (
                      <span>{lang === "bn" ? "পিরিয়ড:" : "Period:"} {fmt.date(r.period_start)} → {fmt.date(r.period_end)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <MetricBox icon={<AlertTriangle className="w-3 h-3" />} label={lang === "bn" ? "ইস্যু" : "Findings"} value={`${fmt.num(pendingFindings)}/${fmt.num(totalFindings)}`} color={pendingFindings > 0 ? "amber" : "green"} />
                    <MetricBox icon={<ListChecks className="w-3 h-3" />} label={lang === "bn" ? "পেন্ডিং টাস্ক" : "Pending Tasks"} value={fmt.num(pendingTasks)} color={pendingTasks > 0 ? "orange" : "green"} />
                    <MetricBox icon={<CheckCircle2 className="w-3 h-3" />} label={lang === "bn" ? "সম্পন্ন টাস্ক" : "Done Tasks"} value={fmt.num(completedTasks)} color="green" />
                    <MetricBox icon={<TrendingUp className="w-3 h-3" />} label={lang === "bn" ? "স্কোর" : "Score"} value={`${fmt.num(compliance)}%`} color={compliance >= 80 ? "green" : compliance >= 50 ? "amber" : "red"} />
                  </div>
                  {r.remarks && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.remarks}</p>}
                </div>
                <div className="flex md:flex-col gap-2 md:w-32">
                  <Button asChild size="sm" className="flex-1 md:w-full">
                    <Link to="/audit-report/$id" params={{ id: r.id }}><Eye className="w-4 h-4 mr-1" />{lang === "bn" ? "বিস্তারিত" : "Details"}</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="md:w-full">
                    <Link to="/audit-report/$id" params={{ id: r.id }}><Pencil className="w-4 h-4 mr-1" />{lang === "bn" ? "এডিট" : "Edit"}</Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="md:w-full" onClick={() => { if (window.confirm(lang === "bn" ? "নিশ্চিত?" : "Confirm delete?")) del.mutate(r.id); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DashCard({ icon, label, value, color, extra }: { icon: React.ReactNode; label: string; value: string; color: string; extra?: React.ReactNode }) {
  const colors: any = {
    blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 text-blue-900 dark:text-blue-100",
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-900 dark:text-amber-100",
    orange: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 text-orange-900 dark:text-orange-100",
    green: "bg-green-50 dark:bg-green-950/30 border-green-200 text-green-900 dark:text-green-100",
    red: "bg-red-50 dark:bg-red-950/30 border-red-200 text-red-900 dark:text-red-100",
    primary: "bg-primary/10 border-primary/30 text-primary",
  };
  return (
    <Card className={`p-3 border ${colors[color]}`}>
      <div className="flex items-center gap-1 text-xs opacity-80">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {extra}
    </Card>
  );
}

function MetricBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: any = {
    green: "text-green-700 bg-green-50 dark:bg-green-950/30",
    amber: "text-amber-700 bg-amber-50 dark:bg-amber-950/30",
    orange: "text-orange-700 bg-orange-50 dark:bg-orange-950/30",
    red: "text-red-700 bg-red-50 dark:bg-red-950/30",
  };
  return (
    <div className={`rounded-md px-2 py-1.5 ${colors[color]}`}>
      <div className="text-[10px] flex items-center gap-1 opacity-80">{icon}{label}</div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
}
