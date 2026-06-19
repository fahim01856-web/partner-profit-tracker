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
import { useI18n } from "@/lib/i18n";
import { useFmt, monthsOf } from "@/lib/format";
import { toast } from "sonner";
import {
  ShieldCheck, Plus, FileText, Eye, Trash2, AlertTriangle, CheckCircle2,
  Calendar, User, Search,
} from "lucide-react";

export const Route = createFileRoute("/_app/audit-report")({ component: AuditReportListPage });

function AuditReportListPage() {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const now = new Date();
  const months = monthsOf(lang);

  const [filterMonth, setFilterMonth] = useState<number | "">("");
  const [filterYear, setFilterYear] = useState<number | "">(now.getFullYear());
  const [filterAuditor, setFilterAuditor] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    audit_date: now.toISOString().slice(0, 10),
    auditor_name: "",
    audit_type: "internal",
    period_start: "",
    period_end: "",
    remarks: "",
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["audit_reports", filterMonth, filterYear, filterAuditor],
    queryFn: async () => {
      let q = supabase.from("audit_reports").select("*, audit_findings(id, status), audit_tasks(id, status)")
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
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.auditor_name.trim()) throw new Error(lang === "bn" ? "অডিটরের নাম দিন" : "Auditor name required");
      const { data, error } = await supabase.from("audit_reports").insert({
        audit_date: form.audit_date,
        auditor_name: form.auditor_name.trim(),
        audit_type: form.audit_type,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        remarks: form.remarks || null,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "অডিট রিপোর্ট তৈরি হয়েছে" : "Audit report created");
      setShowNew(false);
      setForm({ ...form, auditor_name: "", remarks: "" });
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {lang === "bn" ? "অডিট ও কমপ্লায়েন্স ম্যানেজমেন্ট" : "Audit & Compliance Management"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn"
              ? "নতুন অডিট তৈরি, ইস্যু এন্ট্রি, কমপ্লায়েন্স চেক, পেন্ডিং ট্যাস্ক ও সাইন-অফ"
              : "Create audits, log issues, run compliance checks, track tasks & sign-off"}
          </p>
        </div>
        <Button onClick={() => setShowNew(s => !s)}>
          <Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন অডিট" : "New Audit"}
        </Button>
      </div>

      {/* New audit form */}
      {showNew && (
        <Card className="p-5 ring-2 ring-primary">
          <h2 className="font-semibold mb-3">{lang === "bn" ? "নতুন অডিট তথ্য" : "New Audit Information"}</h2>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><Label>{lang === "bn" ? "অডিট তারিখ" : "Audit Date"} *</Label>
              <Input type="date" required value={form.audit_date} onChange={e => setForm({ ...form, audit_date: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "অডিটরের নাম" : "Auditor Name"} *</Label>
              <Input required value={form.auditor_name} onChange={e => setForm({ ...form, auditor_name: e.target.value })} maxLength={100} /></div>
            <div><Label>{lang === "bn" ? "অডিটের ধরন" : "Audit Type"}</Label>
              <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.audit_type} onChange={e => setForm({ ...form, audit_type: e.target.value })}>
                <option value="internal">{lang === "bn" ? "অভ্যন্তরীণ" : "Internal"}</option>
                <option value="external">{lang === "bn" ? "বাহ্যিক" : "External"}</option>
                <option value="surprise">{lang === "bn" ? "আকস্মিক" : "Surprise"}</option>
                <option value="compliance">{lang === "bn" ? "কমপ্লায়েন্স" : "Compliance"}</option>
                <option value="financial">{lang === "bn" ? "আর্থিক" : "Financial"}</option>
              </select>
            </div>
            <div><Label>{lang === "bn" ? "পিরিয়ড শুরু" : "Period Start"}</Label>
              <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "পিরিয়ড শেষ" : "Period End"}</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} /></div>
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
          const openFindings = (r.audit_findings || []).filter((f: any) => f.status !== "completed").length;
          const totalFindings = (r.audit_findings || []).length;
          const openTasks = (r.audit_tasks || []).filter((t: any) => t.status !== "completed").length;
          const totalTasks = (r.audit_tasks || []).length;
          return (
            <Card key={r.id} className="p-4 hover:border-primary transition-colors">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">{r.audit_type}</Badge>
                    <span className="font-semibold">{r.auditor_name}</span>
                    {r.approved_by && <Badge className="bg-green-600">{lang === "bn" ? "অনুমোদিত" : "Approved"}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmt.date(r.audit_date)}</span>
                    {r.period_start && r.period_end && (
                      <span>{lang === "bn" ? "পিরিয়ড:" : "Period:"} {fmt.date(r.period_start)} → {fmt.date(r.period_end)}</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant={openFindings > 0 ? "destructive" : "secondary"}>
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {fmt.num(openFindings)}/{fmt.num(totalFindings)} {lang === "bn" ? "ওপেন ইস্যু" : "open issues"}
                    </Badge>
                    <Badge variant={openTasks > 0 ? "default" : "secondary"}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {fmt.num(openTasks)}/{fmt.num(totalTasks)} {lang === "bn" ? "ওপেন ট্যাস্ক" : "open tasks"}
                    </Badge>
                  </div>
                  {r.remarks && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.remarks}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Button asChild size="sm">
                    <Link to="/audit-report/$id" params={{ id: r.id }}><Eye className="w-4 h-4 mr-1" />{lang === "bn" ? "খুলুন" : "Open"}</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(lang === "bn" ? "নিশ্চিত?" : "Confirm delete?")) del.mutate(r.id); }}>
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
