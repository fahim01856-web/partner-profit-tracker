import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateAppTemplate } from "@/lib/app-template-ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Search, FileText, Printer, Download, Trash2, Edit3, Eye, Copy, Upload,
  CheckCircle2, Clock, XCircle, FileCheck2, Send, Files, LayoutGrid, FolderOpen,
  History as HistoryIcon, ShieldCheck, Sparkles,
} from "lucide-react";

const APPLICATION_TABS = ["dashboard", "applications", "templates", "customers"] as const;
type ApplicationTab = (typeof APPLICATION_TABS)[number];
const normalizeApplicationTab = (tab: unknown): ApplicationTab =>
  APPLICATION_TABS.includes(tab as ApplicationTab) ? (tab as ApplicationTab) : "dashboard";

export const Route = createFileRoute("/_app/applications")({ component: ApplicationsPage });

// ---------------- Constants ----------------
const DEFAULT_TEMPLATES: { name: string; category: string }[] = [
  { name: "Account Closing Application", category: "Account" },
  { name: "Account Opening Application", category: "Account" },
  { name: "Address Change Application", category: "Customer Info" },
  { name: "Mobile Number Change Application", category: "Customer Info" },
  { name: "Nominee Change Application", category: "Customer Info" },
  { name: "Signature Change Application", category: "Customer Info" },
  { name: "Account Type Change Application", category: "Account" },
  { name: "Customer Information Update", category: "Customer Info" },
  { name: "Loan Application", category: "Loan" },
  { name: "Cheque Book Request", category: "Service" },
  { name: "ATM Card Request", category: "Service" },
  { name: "Certificate Request", category: "Service" },
  { name: "Complaint Application", category: "Complaint" },
  { name: "RTGS Application", category: "Remittance" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-slate-500", icon: Edit3 },
  submitted: { label: "Submitted", color: "bg-blue-500", icon: Send },
  under_review: { label: "Under Review", color: "bg-amber-500", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-600", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-700", icon: FileCheck2 },
  rejected: { label: "Rejected", color: "bg-red-600", icon: XCircle },
};

const PLACEHOLDERS = [
  "customer_name", "father_name", "mother_name", "nid", "mobile", "address",
  "dob", "occupation", "account_number", "account_type", "branch_name",
  "opening_date", "balance", "date", "reason", "amount", "remarks",
];

// ---------------- Helpers ----------------
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeTemplateHtml(html: string) {
  return String(html || "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)[^>]*\/?\s*>/gi, "")
    .replace(/<\s*\/?\s*(html|head|body)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"]?)\s*javascript:[^\s>]*\2/gi, "");
}

function renderTemplate(html: string, fields: Record<string, any>) {
  return sanitizeTemplateHtml(html).replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (_, k) =>
    fields[k] != null && fields[k] !== "" ? escapeHtml(String(fields[k])) : `{{${k}}}`
  );
}

function documentPreviewSrcDoc(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8" />
    <style>body{margin:0;padding:16px;background:#fff;}img{max-width:100%;height:auto;}table{max-width:100%;border-collapse:collapse;}*{box-sizing:border-box;}</style>
    </head><body>${html}</body></html>`;
}

function buildDocumentHtml(opts: {
  bankName: string;
  outlet: string;
  bodyHtml: string;
  fields: Record<string, any>;
}) {
  const rendered = renderTemplate(opts.bodyHtml, opts.fields);
  return `
  <div style="font-family: 'SolaimanLipi', 'Noto Sans Bengali', Arial, sans-serif; max-width: 780px; margin: 0 auto; color:#0f172a;">
    <div style="text-align:center; border-bottom: 3px double #064e3b; padding-bottom:12px; margin-bottom:18px;">
      <div style="font-size:22px; font-weight:800; color:#064e3b;">${opts.bankName}</div>
      <div style="font-size:13px; color:#334155; margin-top:2px;">${opts.outlet}</div>
    </div>
    <div style="font-size:14px; line-height:1.9; white-space:pre-wrap;">${rendered}</div>
    <div style="margin-top:80px; display:flex; justify-content:flex-end; font-size:13px;">
      <div style="text-align:center;">
        <div style="border-top:1px solid #334155; padding-top:4px; min-width:200px;">অনুমোদনকারী</div>
      </div>
    </div>
    <div style="margin-top:24px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0; padding-top:8px;">
      Generated by: ফকিরবাজার এজেন্ট আউটলেট, ১২১/১১
    </div>
  </div>`;
}

function printHtml(html: string, title = "Application") {
  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) return toast.error("Pop-up blocked");
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>@media print{@page{margin:18mm}} body{margin:0;padding:24px;}</style>
    </head><body>${html}<script>window.onload=()=>{window.print();}</script></body></html>`);
  w.document.close();
}

function downloadDoc(html: string, filename: string) {
  const blob = new Blob([
    `<!doctype html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${filename}</title></head><body>${html}</body></html>`,
  ], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.doc`;
  a.click();
}

function extractPlaceholders(html: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html || ""))) set.add(m[1]);
  return Array.from(set);
}

function sanitizePlaceholderKey(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").replace(/^([0-9])/, "_$1");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isImageBodyTemplate(html: string) {
  return /data-image-template=["']true["']/i.test(html || "");
}

function createImageBodyHtml(imgSrc: string) {
  return `<div data-image-template="true" style="position:relative;width:100%;max-width:760px;margin:0 auto;padding:0;line-height:1;"><img src="${escapeHtml(imgSrc)}" alt="application" style="width:100%;height:auto;display:block;margin:0 auto;" /></div>`;
}

function createOverlayFieldHtml(key: string, index = 0) {
  const left = 8 + (index % 2) * 42;
  const top = 10 + Math.floor(index / 2) * 7;
  return `<span data-template-field="${key}" style="position:absolute;left:${left}%;top:${top}%;width:30%;min-height:18px;font-size:14px;line-height:1.35;color:#111827;white-space:pre-wrap;font-weight:600;">{{${key}}}</span>`;
}

function addOverlayFieldToImageTemplate(html: string, key: string) {
  if (!isImageBodyTemplate(html)) return `${html || ""}\n{{${key}}}`;
  if (extractPlaceholders(html).includes(key)) return html;
  const insertAt = html.lastIndexOf("</div>");
  const fieldHtml = createOverlayFieldHtml(key, extractPlaceholders(html).length);
  return insertAt >= 0 ? `${html.slice(0, insertAt)}${fieldHtml}${html.slice(insertAt)}` : `${html}${fieldHtml}`;
}

function mergeInlineStyle(style: string, patch: Record<string, string>) {
  const map: Record<string, string> = {};
  style.split(";").forEach((part) => {
    const [rawKey, ...rest] = part.split(":");
    const key = rawKey?.trim();
    if (key && rest.length) map[key] = rest.join(":").trim();
  });
  Object.assign(map, patch);
  return Object.entries(map).map(([k, val]) => `${k}:${val}`).join(";");
}

function getOverlayFieldStyle(html: string, key: string) {
  const re = new RegExp(`<span\\b(?=[^>]*data-template-field=["']${escapeRegExp(key)}["'])[^>]*style=["']([^"']*)["'][^>]*>`, "i");
  const style = re.exec(html || "")?.[1] || "";
  const read = (name: string, fallback: number) => {
    const m = new RegExp(`${name}\\s*:\\s*([0-9.]+)`, "i").exec(style);
    return m ? Number(m[1]) : fallback;
  };
  return { left: read("left", 8), top: read("top", 10), width: read("width", 30), fontSize: read("font-size", 14) };
}

function updateOverlayFieldStyle(html: string, key: string, patch: Record<string, string>) {
  const re = new RegExp(`(<span\\b(?=[^>]*data-template-field=["']${escapeRegExp(key)}["'])[^>]*style=["'])([^"']*)(["'][^>]*>)`, "i");
  return (html || "").replace(re, (_, start, style, end) => `${start}${mergeInlineStyle(style, patch)}${end}`);
}

function removePlaceholderFromHtml(html: string, key: string) {
  const overlayRe = new RegExp(`<span\\b(?=[^>]*data-template-field=["']${escapeRegExp(key)}["'])[^>]*>[\\s\\S]*?<\\/span>`, "gi");
  const phRe = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g");
  return (html || "").replace(overlayRe, "").replace(phRe, "");
}

async function copyHtmlAsText(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const text = tmp.innerText;
  try { await navigator.clipboard.writeText(text); toast.success("কপি করা হয়েছে"); }
  catch { toast.error("কপি করা গেল না"); }
}

function exportCsv(rows: any[], filename: string) {
  if (!rows.length) return toast.error("কোনো ডেটা নেই");
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ---------------- Main ----------------
function ApplicationsPage() {
  const [tab, setActiveTab] = useState<ApplicationTab>(() => (
    typeof window === "undefined" ? "dashboard" : normalizeApplicationTab(window.localStorage.getItem("application-management-tab"))
  ));

  const setTab = (nextTab: string) => {
    const normalized = normalizeApplicationTab(nextTab);
    setActiveTab(normalized);
    window.localStorage.setItem("application-management-tab", normalized);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-700" /> Application Management
          </h1>
          <p className="text-sm text-muted-foreground">টেমপ্লেট, ডকুমেন্ট অটোমেশন ও গ্রাহক ফাইলিং</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="dashboard"><LayoutGrid className="w-4 h-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="applications"><Files className="w-4 h-4 mr-1" /> Applications</TabsTrigger>
          <TabsTrigger value="templates"><Copy className="w-4 h-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="customers"><FolderOpen className="w-4 h-4 mr-1" /> Customer Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><DashboardTab onNav={setTab} /></TabsContent>
        <TabsContent value="applications" className="mt-4"><ApplicationsTab /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
        <TabsContent value="customers" className="mt-4"><CustomerDocsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Dashboard Tab ----------------
function DashboardTab({ onNav }: { onNav: (t: string) => void }) {
  const { data: apps = [] } = useQuery({
    queryKey: ["app_records"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("application_records").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: tpls = [] } = useQuery({
    queryKey: ["app_templates"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("application_templates").select("id,name,category,is_active");
      return data || [];
    },
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const stats = {
    total: apps.length,
    pending: apps.filter((a: any) => ["submitted", "under_review", "draft"].includes(a.status)).length,
    approved: apps.filter((a: any) => a.status === "approved").length,
    completed: apps.filter((a: any) => a.status === "completed").length,
    rejected: apps.filter((a: any) => a.status === "rejected").length,
    today: apps.filter((a: any) => (a.created_at || "").slice(0, 10) === todayKey).length,
    templates: tpls.length,
    activeTpl: tpls.filter((t: any) => t.is_active).length,
  };

  const recent = apps.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard title="মোট আবেদন" value={stats.total} icon={Files} color="text-emerald-700" />
        <StatCard title="পেন্ডিং" value={stats.pending} icon={Clock} color="text-amber-600" />
        <StatCard title="অনুমোদিত" value={stats.approved} icon={CheckCircle2} color="text-green-600" />
        <StatCard title="সম্পন্ন" value={stats.completed} icon={FileCheck2} color="text-emerald-600" />
        <StatCard title="প্রত্যাখ্যাত" value={stats.rejected} icon={XCircle} color="text-red-600" />
        <StatCard title="আজকের" value={stats.today} icon={Sparkles} color="text-blue-600" />
        <StatCard title="টেমপ্লেট" value={stats.templates} icon={Copy} color="text-purple-600" />
        <StatCard title="সক্রিয়" value={stats.activeTpl} icon={ShieldCheck} color="text-indigo-600" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold flex items-center gap-2"><HistoryIcon className="w-4 h-4" /> সাম্প্রতিক আবেদন</div>
          <Button size="sm" variant="outline" onClick={() => onNav("applications")}>সব দেখুন</Button>
        </div>
        <div className="space-y-2">
          {recent.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">এখনো কোনো আবেদন নেই</div>}
          {recent.map((a: any) => {
            const s = STATUS_META[a.status] || STATUS_META.draft;
            return (
              <div key={a.id} className="flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.customer_name} <span className="text-xs text-muted-foreground">· {a.application_type || "—"}</span></div>
                  <div className="text-[11px] text-muted-foreground">A/C: {a.account_number || "—"} · {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <Badge className={`${s.color} text-white text-[10px]`}>{s.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="p-3">
      <div className={`text-[11px] text-muted-foreground flex items-center gap-1`}><Icon className="w-3 h-3" /> {title}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}

// ---------------- Templates Tab ----------------
function TemplatesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [using, setUsing] = useState<any>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: tpls = [] } = useQuery({
    queryKey: ["app_templates_full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("application_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (t: any) => {
      const payload: any = {
        name: t.name, category: t.category, description: t.description,
        body_html: t.body_html || "", is_active: t.is_active ?? true,
        file_url: t.file_url ?? null, file_path: t.file_path ?? null,
        file_name: t.file_name ?? null, file_mime: t.file_mime ?? null, file_size: t.file_size ?? null,
      };
      if (t.id) {
        const { error } = await (supabase as any).from("application_templates").update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("application_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("সংরক্ষিত"); setEditing(null); qc.invalidateQueries({ queryKey: ["app_templates_full"] }); qc.invalidateQueries({ queryKey: ["app_templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("application_templates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ডিলিট হয়েছে"); qc.invalidateQueries({ queryKey: ["app_templates_full"] }); },
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const existing = new Set(tpls.map((t: any) => t.name));
      const rows = DEFAULT_TEMPLATES.filter((d) => !existing.has(d.name)).map((d) => ({
        name: d.name, category: d.category, body_html: defaultBody(d.name), is_active: true,
      }));
      if (rows.length === 0) return 0;
      const { error } = await (supabase as any).from("application_templates").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { toast.success(`${n} টেমপ্লেট যোগ হয়েছে`); qc.invalidateQueries({ queryKey: ["app_templates_full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = tpls.filter((t: any) => !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="টেমপ্লেট খুঁজুন" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button variant="outline" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
          <Sparkles className="w-4 h-4 mr-1" /> ডিফল্ট লোড
        </Button>
        <Button variant="secondary" onClick={() => setAiOpen(true)}>
          <Sparkles className="w-4 h-4 mr-1" /> AI দিয়ে তৈরি
        </Button>
        <Button onClick={() => setEditing({ name: "", category: "Custom", body_html: "", is_active: true })}>
          <Plus className="w-4 h-4 mr-1" /> নতুন টেমপ্লেট
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((t: any) => (
          <Card key={t.id} className="p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{t.name}</div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{t.category || "—"}</Badge>
                  {t.file_path && (
                    <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                      <FileText className="w-2.5 h-2.5 mr-0.5" />
                      {(t.file_mime || "").includes("pdf") ? "PDF" : (t.file_mime || "").includes("word") || (t.file_name || "").match(/\.docx?$/i) ? "DOCX" : "FILE"}
                    </Badge>
                  )}
                </div>
              </div>
              {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
            {t.description && <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{t.description}</div>}
            {t.file_name && (
              <div className="text-[11px] text-muted-foreground truncate mb-2 font-mono">📎 {t.file_name}</div>
            )}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <Button size="sm" variant="default" className="flex-1 bg-emerald-700 hover:bg-emerald-800" onClick={() => setUsing(t)}>
                <Eye className="w-3 h-3 mr-1" /> Use / Preview
              </Button>
              {t.file_path && (
                <Button size="sm" variant="secondary" onClick={async () => {
                  const { data, error } = await supabase.storage.from("application-attachments").createSignedUrl(t.file_path, 300);
                  if (error || !data?.signedUrl) { toast.error("ফাইল খোলা যাচ্ছে না"); return; }
                  window.open(data.signedUrl, "_blank");
                }} title="Attached file"><Download className="w-3 h-3" /></Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditing(t)} title="Edit"><Edit3 className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট করবেন?")) del.mutate(t.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-10 text-muted-foreground">কোনো টেমপ্লেট নেই — "ডিফল্ট লোড" চাপুন</div>}
      </div>

      {editing && <TemplateEditor value={editing} onClose={() => setEditing(null)} onSave={(v) => save.mutate(v)} />}
      {using && <TemplateQuickUse key={using.id || using.name} template={using} onClose={() => setUsing(null)} />}
      {aiOpen && <AiTemplateDialog onClose={() => setAiOpen(false)} onGenerated={(t) => { setAiOpen(false); setEditing({ ...t, is_active: true }); }} />}
    </div>
  );
}

function TemplateQuickUse({ template, onClose }: { template: any; onClose: () => void }) {
  const placeholders = useMemo(() => extractPlaceholders(template.body_html || ""), [template.body_html]);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { date: new Date().toLocaleDateString("bn-BD") };
    placeholders.forEach((p) => { if (!(p in init)) init[p] = ""; });
    return init;
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [matches, setMatches] = useState<any[]>([]);

  const findCustomer = async () => {
    if (!customerSearch.trim()) return;
    const q = customerSearch.trim();
    const { data } = await (supabase as any).from("application_records")
      .select("customer_name,customer_nid,customer_mobile,account_number,account_type,fields")
      .or(`customer_name.ilike.%${q}%,customer_nid.ilike.%${q}%,customer_mobile.ilike.%${q}%,account_number.ilike.%${q}%`)
      .limit(8);
    setMatches(data || []);
    if (!data?.length) toast.info("কোনো গ্রাহক পাওয়া যায়নি");
  };

  const applyCustomer = (c: any) => {
    setFields((f) => ({
      ...f,
      customer_name: c.customer_name || f.customer_name || "",
      nid: c.customer_nid || f.nid || "",
      mobile: c.customer_mobile || f.mobile || "",
      account_number: c.account_number || f.account_number || "",
      account_type: c.account_type || f.account_type || "",
      ...(c.fields || {}),
    }));
    setMatches([]);
    toast.success("গ্রাহক তথ্য লোড হয়েছে");
  };

  const html = useMemo(() => buildDocumentHtml({
    bankName: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি",
    outlet: "ফকিরবাজার এজেন্ট আউটলেট ১২১/১১, বুড়িচং, কুমিল্লা",
    bodyHtml: template.body_html || "",
    fields,
  }), [template, fields]);

  const openAttachment = async () => {
    if (!template.file_path) return;
    const { data, error } = await supabase.storage.from("application-attachments").createSignedUrl(template.file_path, 300);
    if (error || !data?.signedUrl) { toast.error("ফাইল খোলা যাচ্ছে না"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-700" /> {template.name}
            <Badge variant="outline" className="text-[10px]">{template.category}</Badge>
            {template.file_path && <Badge className="text-[10px] bg-emerald-600">📎 {template.file_name}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {/* Left: Dynamic variables */}
          <div className="space-y-3">
            <Card className="p-3 bg-blue-50/50 border-blue-200">
              <Label className="text-xs font-semibold flex items-center gap-1"><Search className="w-3 h-3" /> Auto-fill from existing customer</Label>
              <div className="flex gap-1 mt-1">
                <Input placeholder="নাম / NID / মোবাইল / A/C" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findCustomer()} className="h-8 text-xs" />
                <Button size="sm" variant="secondary" onClick={findCustomer}>খুঁজুন</Button>
              </div>
              {matches.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {matches.map((c, i) => (
                    <button key={i} onClick={() => applyCustomer(c)} className="w-full text-left text-xs border rounded p-1.5 hover:bg-blue-100 bg-white">
                      <div className="font-medium">{c.customer_name}</div>
                      <div className="text-[10px] text-muted-foreground">A/C: {c.account_number || "—"} · NID: {c.customer_nid || "—"}</div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <div>
              <Label className="text-xs font-semibold">Dynamic Variables ({placeholders.length})</Label>
              {placeholders.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">এই টেমপ্লেটে কোনো {`{{variable}}`} নেই।</div>
              ) : (
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {placeholders.map((p) => (
                    <div key={p}>
                      <Label className="text-[10px] text-muted-foreground">{`{{${p}}}`}</Label>
                      {["reason", "remarks", "address"].includes(p) ? (
                        <Textarea rows={2} value={fields[p] || ""} onChange={(e) => setFields((prev) => ({ ...prev, [p]: e.target.value }))} className="text-sm" />
                      ) : (
                        <Input value={fields[p] || ""} onChange={(e) => setFields((prev) => ({ ...prev, [p]: e.target.value }))} className="h-8 text-sm" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Live preview */}
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1"><Eye className="w-3 h-3" /> Live Preview</Label>
            <iframe
              title="Application live preview"
              srcDoc={documentPreviewSrcDoc(html)}
              sandbox=""
              className="bg-white border rounded mt-1 h-[60vh] w-full"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-wrap gap-2">
          {template.file_path && (
            <Button variant="outline" onClick={openAttachment}><FileText className="w-4 h-4 mr-1" /> Original File</Button>
          )}
          <Button variant="outline" onClick={() => copyHtmlAsText(html)}><Copy className="w-4 h-4 mr-1" /> Copy Text</Button>
          <Button variant="outline" onClick={() => downloadDoc(html, template.name || "Application")}><Download className="w-4 h-4 mr-1" /> Word</Button>
          <Button onClick={() => printHtml(html, template.name || "Application")} className="bg-emerald-700 hover:bg-emerald-800"><Printer className="w-4 h-4 mr-1" /> Print / PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AiTemplateDialog({ onClose, onGenerated }: { onClose: () => void; onGenerated: (t: any) => void }) {
  const [prompt, setPrompt] = useState("");
  const [pasted, setPasted] = useState("");
  const [image, setImage] = useState<string>("");
  const [imageName, setImageName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const gen = useServerFn(generateAppTemplate);

  const onPickImage = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("ছবি ৮MB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(String(reader.result || "")); setImageName(file.name); };
    reader.readAsDataURL(file);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); onPickImage(item.getAsFile()); }
  };

  const run = async () => {
    if (!prompt.trim() && !pasted.trim() && !image) { toast.error("বর্ণনা, আবেদন পেস্ট, অথবা ছবি দিন"); return; }
    setLoading(true);
    try {
      const out = await gen({ data: { prompt: prompt || undefined, pasted: pasted || undefined, image: image || undefined } });
      toast.success("AI টেমপ্লেট তৈরি হয়েছে");
      onGenerated(out);
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("429")) toast.error("AI rate limit — একটু পরে চেষ্টা করুন");
      else if (msg.includes("402")) toast.error("AI ক্রেডিট শেষ — Workspace → Usage এ যোগ করুন");
      else toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl" onPaste={onPaste}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI দিয়ে অ্যাপ্লিকেশন টেমপ্লেট তৈরি</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="rounded border-2 border-dashed border-primary/40 bg-primary/5 p-3">
            <Label className="text-sm font-semibold">📷 আবেদনের ছবি আপলোড করুন (হুবহু কপি হবে)</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input type="file" accept="image/*" onChange={(e) => onPickImage(e.target.files?.[0])} className="text-xs" />
              {image && <Button variant="outline" size="sm" onClick={() => { setImage(""); setImageName(""); }}>মুছুন</Button>}
            </div>
            {image && (
              <div className="mt-2">
                <div className="text-[11px] text-muted-foreground mb-1">✓ {imageName}</div>
                <img src={image} alt="preview" className="max-h-48 rounded border" />
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-2">💡 ছবি তুলে আপলোড করুন বা Ctrl+V দিয়ে পেস্ট করুন — AI হুবহু ১০০% সেম ফরম্যাটে টেবিল আকারে টেমপ্লেট বানাবে।</div>
          </div>
          <div>
            <Label>আবেদনের বর্ণনা / টপিক (ঐচ্ছিক)</Label>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="যেমন: মোবাইল নাম্বার পরিবর্তনের আবেদন" />
          </div>
          <div>
            <Label>অথবা পুরোনো আবেদন পেস্ট করুন (ঐচ্ছিক)</Label>
            <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={6} placeholder="এখানে যেকোনো আবেদনপত্র কপি-পেস্ট করুন..." className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>বাতিল</Button>
          <Button onClick={run} disabled={loading}>
            {loading ? "তৈরি হচ্ছে..." : <><Sparkles className="w-4 h-4 mr-1" /> Generate</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultBody(name: string) {
  if (name === "RTGS Application") return rtgsBody();
  const date = `{{date}}`;
  const header = `তারিখ: ${date}\n\nবরাবর,\nব্যবস্থাপক\nইসলামী ব্যাংক বাংলাদেশ পিএলসি\nএজেন্ট আউটলেট, ফকির বাজার, বুড়িচং\n\nবিষয়: ${name}\n\nজনাব,\n\n`;
  const footer = `\n\nঅতএব মহোদয়ের নিকট আমার বিনীত নিবেদন এই যে, উপরোক্ত বিষয়টি বিবেচনা করে প্রয়োজনীয় ব্যবস্থা গ্রহণে আপনার মর্জি হয়।\n\nনিবেদক,\n{{customer_name}}\nহিসাব নং: {{account_number}}\nএনআইডি: {{nid}}\nমোবাইল: {{mobile}}`;
  return header + `আমি {{customer_name}}, পিতা: {{father_name}}, ঠিকানা: {{address}}, আপনার ব্যাংকের একজন গ্রাহক। আমার হিসাব নম্বর {{account_number}} ({{account_type}})।\n\nকারণ: {{reason}}\n` + footer;
}

function rtgsBody() {
  const cell = `border:1px solid #000; padding:5px 6px; vertical-align:top;`;
  const lbl = `${cell} font-weight:600; width:18%;`;
  const val = `${cell} width:32%;`;
  const digit = `border:1px solid #000; width:22px; height:22px; text-align:center; font-family:monospace; padding:0;`;
  return `
<div style="font-family: 'Times New Roman', Arial, serif; font-size:13px; color:#000; line-height:1.35;">
  <div style="text-align:center; font-weight:700; font-style:italic; font-size:18px;">Islami Bank Bangladesh Limited</div>
  <div style="text-align:center; font-size:13px;">
    .......<span contenteditable="true">{{branch_name}}</span>....... Branch
  </div>
  <div style="text-align:center; text-decoration:underline; font-weight:700; font-style:italic; font-size:15px; margin:4px 0 10px;">Application Form for RTGS Transaction</div>

  <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
    <tr>
      <td style="vertical-align:top; padding:0;">
        <div><b>The Head of Branch / Manager</b></div>
        <div>Islami Bank Bangladesh Limited</div>
        <div>.{{outlet_name}} Branch</div>
        <div>Muhtaram</div>
        <div>Asslamu Alaikum.</div>
      </td>
      <td style="vertical-align:top; width:230px; padding:0;">
        <table style="border-collapse:collapse;">
          <tr>
            <td style="border:1px solid #000; padding:4px 8px;"><b>Date:</b></td>
            <td style="${digit} width:40px;">{{day}}</td>
            <td style="${digit} width:40px;">{{month}}</td>
            <td style="${digit} width:60px;">{{year}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="margin:8px 0;">Please remit the amount as per following particulars by debiting My/Our Account mentioned below including your service charge and government taxes if any, as applicable for such remittance.</div>

  <div style="font-weight:700; margin-top:6px;">Sender's / Originator's Details:</div>
  <table style="width:100%; border-collapse:collapse; border:1px solid #000;">
    <tr>
      <td style="${lbl}">Name / A/C Title</td>
      <td style="${cell}" colspan="3">{{sender_name}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Account No.</td>
      <td style="${val}">,{{sender_account}}</td>
      <td style="${lbl}">Cheque No. &amp; Date</td>
      <td style="${val}">{{cheque_no_date}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Contact Number</td>
      <td style="${val}">'{{sender_mobile}}</td>
      <td style="${lbl}">NID/Passport/Driv. License No.</td>
      <td style="${val}">{{sender_nid}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Address</td>
      <td style="${cell}" colspan="3">{{sender_address}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Purpose of Remittance</td>
      <td style="${val}">{{purpose}}</td>
      <td style="${lbl}">Source of Fund</td>
      <td style="${val}">{{source_of_fund}}</td>
    </tr>
  </table>

  <div style="font-weight:700; margin-top:8px;">Recever's / Beneficiary's Details:</div>
  <table style="width:100%; border-collapse:collapse; border:1px solid #000;">
    <tr>
      <td style="${lbl}">Name / A/C Title</td>
      <td style="${cell}" colspan="3">{{receiver_name}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Account No.</td>
      <td style="${cell}" colspan="2">,{{receiver_account}}</td>
      <td style="${cell} text-align:center; width:18%;" rowspan="2"><b>Amount</b><br/>TK.{{amount}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Contact Number</td>
      <td style="${cell}" colspan="2">'{{receiver_mobile}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Bank Name</td>
      <td style="${cell}" colspan="3">{{receiver_bank}}</td>
    </tr>
    <tr>
      <td style="${lbl}">Branch Name</td>
      <td style="${cell}">{{receiver_branch}}</td>
      <td style="${cell}">
        <table style="border-collapse:collapse; margin:0 auto;">
          <tr>
            <td style="border:none; padding:0 6px 0 0;"><b>Routing</b><br/><b>No.</b></td>
            <td style="${digit}">{{r1}}</td>
            <td style="${digit}">{{r2}}</td>
            <td style="${digit}">{{r3}}</td>
            <td style="${digit}">{{r4}}</td>
            <td style="${digit}">{{r5}}</td>
            <td style="${digit}">{{r6}}</td>
            <td style="${digit}">{{r7}}</td>
            <td style="${digit}">{{r8}}</td>
            <td style="${digit}">{{r9}}</td>
          </tr>
        </table>
      </td>
      <td style="${cell} text-align:center;"><b>Commission</b><br/>{{commission}}</td>
    </tr>
    <tr>
      <td style="${lbl}"><b>Total Amount</b><br/>(In words)</td>
      <td style="${cell}" colspan="2">{{total_in_words}}</td>
      <td style="${cell} text-align:center;"><b>VAT</b><br/>{{vat}}</td>
    </tr>
    <tr>
      <td style="${lbl}"></td>
      <td style="${cell}" colspan="2"></td>
      <td style="${cell} text-align:center;"><b>Total Tk.</b><br/>{{total_amount}}</td>
    </tr>
  </table>

  <div style="margin-top:10px;">I/we hereby declare that I/we have read and understood all the terms and conditions mentioned in overleaf and do hereby accept and agreed to all such terms and conditions in relation to the above transactions.</div>
  <div>Ma-assalam.</div>
  <div style="margin-top:14px;">Yours Faithfully,</div>

  <table style="width:100%; margin-top:40px; border-collapse:collapse;">
    <tr>
      <td style="width:33%; border-top:1px solid #000; text-align:center; padding-top:4px;">Applican/Customer's<br/><span style="font-size:11px;">Signature &amp; seal</span></td>
      <td style="width:33%; border-top:1px solid #000; text-align:center; padding-top:4px;"><sup>2nd</sup> applicant/Customer's<br/><span style="font-size:11px;">Signature &amp; seal (if joint)</span></td>
      <td style="width:33%; border-top:1px solid #000; text-align:center; padding-top:4px;">Signature verified by<br/><span style="font-size:11px;">(Use Seal with AS No.)<br/>Communicate with A/c Holder before Verification</span></td>
    </tr>
  </table>

  <div style="text-align:center; font-weight:700; text-decoration:underline; margin-top:16px;">For Bank use only</div>
  <table style="width:100%; margin-top:30px; border-collapse:collapse;">
    <tr>
      <td style="width:33%; border-top:1px solid #000; text-align:center; padding-top:4px;">Authorized Officer (Maker)<br/><span style="font-size:11px;">Signature &amp; AS No.</span></td>
      <td style="width:33%; border-top:1px solid #000; text-align:center; padding-top:4px;">Authorized Officer (Checker)<br/><span style="font-size:11px;">Signature &amp; AS No.</span></td>
      <td style="width:33%; border-top:1px solid #000; text-align:center; padding-top:4px;">Head Of Branch / Manager Operations</td>
    </tr>
  </table>

  <hr style="border:none; border-top:1px dashed #000; margin:18px 0;" />

  <div style="position:relative;">
    <div style="text-align:center; font-weight:700; text-decoration:underline;">Banker's Acknowledgment for RTGS Transaction</div>
    <div style="position:absolute; right:0; top:0;">Date {{ack_date}}.......</div>
  </div>
  <div style="margin-top:10px; line-height:2;">
    TK.{{total_amount}}.(In words: {{total_in_words}} ) on<br/>
    from Mr./Mrs./Ms..{{sender_initial}} .for transferring through RTGS System<br/>
    to.{{sender_name}}<br/>
    ,{{sender_account}}<br/>
    .Branch favoring Account Nam<br/>
    ,{{receiver_account}},{{receiver_name}}
  </div>

  <table style="width:100%; margin-top:40px; border-collapse:collapse;">
    <tr>
      <td style="width:50%; border-top:1px solid #000; text-align:center; padding-top:4px;">Signature of Customer</td>
      <td style="width:50%; border-top:1px solid #000; text-align:center; padding-top:4px;">Signature &amp; AS No. Of Authorized Officer</td>
    </tr>
  </table>
</div>`;
}


function TemplateEditor({ value, onClose, onSave }: { value: any; onClose: () => void; onSave: (v: any) => void }) {
  const [v, setV] = useState<any>(value);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [newPh, setNewPh] = useState("");
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiImgRef = useRef<HTMLInputElement>(null);

  const currentPhs = useMemo(() => extractPlaceholders(v.body_html || ""), [v.body_html]);

  const insertPh = (ph: string) => {
    const ta = taRef.current;
    const txt = `{{${ph}}}`;
    if (!ta) { setV((prev: any) => ({ ...prev, body_html: (prev.body_html || "") + txt })); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    setV({ ...v, body_html: (v.body_html || "").slice(0, start) + txt + (v.body_html || "").slice(end) });
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + txt.length, start + txt.length); }, 0);
  };

  const applyRename = (oldKey: string) => {
    const raw = (renameDraft[oldKey] ?? "").trim();
    const safe = sanitizePlaceholderKey(raw);
    if (!safe || safe === oldKey) { setRenameDraft((d) => { const n = { ...d }; delete n[oldKey]; return n; }); return; }
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(oldKey)}\\s*\\}\\}`, "g");
    const attrRe = new RegExp(`(data-template-field=["'])${escapeRegExp(oldKey)}(["'])`, "g");
    setV((prev: any) => ({ ...prev, body_html: (prev.body_html || "").replace(re, `{{${safe}}}`).replace(attrRe, `$1${safe}$2`) }));
    setRenameDraft((d) => { const n = { ...d }; delete n[oldKey]; return n; });
    toast.success(`{{${oldKey}}} → {{${safe}}}`);
  };

  const deletePh = (key: string) => {
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    setV((prev: any) => ({ ...prev, body_html: (prev.body_html || "").replace(re, "") }));
  };

  const addPh = () => {
    const safe = newPh.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!safe) return;
    insertPh(safe);
    setNewPh("");
  };

  const aiFromImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("শুধু ছবি (JPG/PNG) দিন। PDF হলে স্ক্রিনশট নিয়ে আপলোড করুন।"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("ছবি ৮MB এর কম হতে হবে"); return; }
    setAiBusy(true);
    try {
      // Upload to storage to get a stable URL (avoid huge data URLs in body_html)
      let imgSrc = "";
      try {
        const ext = file.name.split(".").pop() || "png";
        const path = `templates/img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("application-attachments").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: signed } = await supabase.storage.from("application-attachments").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        imgSrc = signed?.signedUrl || "";
      } catch {
        // fallback: inline data URL
        imgSrc = await new Promise<string>((res, rej) => {
          const r = new FileReader(); r.onload = () => res(String(r.result || "")); r.onerror = rej; r.readAsDataURL(file);
        });
      }
      // Directly embed the image as the body — no HTML/AI conversion
      const html = `<div style="text-align:center;margin:0;padding:0;"><img src="${imgSrc}" alt="application" style="max-width:100%;height:auto;display:block;margin:0 auto;" /></div>`;
      setV((prev: any) => ({ ...prev, body_html: html }));
      toast.success("ছবি হুবহু বডিতে যোগ হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "ছবি যোগ করা যায়নি");
    } finally { setAiBusy(false); }
  };


  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `templates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("application-attachments").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("application-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
      setV((prev: any) => ({ ...prev, file_path: path, file_url: signed?.signedUrl ?? null, file_name: file.name, file_mime: file.type, file_size: file.size }));
      toast.success("ফাইল আপলোড হয়েছে");
    } catch (e: any) { toast.error(e.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const removeFile = async () => {
    if (v.file_path) { try { await supabase.storage.from("application-attachments").remove([v.file_path]); } catch {} }
    setV({ ...v, file_path: null, file_url: null, file_name: null, file_mime: null, file_size: null });
  };

  const openFile = async () => {
    if (!v.file_path) return;
    const { data, error } = await supabase.storage.from("application-attachments").createSignedUrl(v.file_path, 300);
    if (error || !data?.signedUrl) { toast.error("ফাইল খোলা যাচ্ছে না"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{v.id ? "টেমপ্লেট সম্পাদনা" : "নতুন টেমপ্লেট"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          <div><Label>নাম *</Label><Input value={v.name || ""} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          <div><Label>ক্যাটাগরি</Label><Input value={v.category || ""} onChange={(e) => setV({ ...v, category: e.target.value })} placeholder="Account / Service / Loan ..." /></div>
          <div className="col-span-2"><Label>বিবরণ</Label><Input value={v.description || ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          <div className="col-span-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
            <Label className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> 📷 আবেদনের ছবি আপলোড করুন — হুবহু বডিতে বসবে</Label>
            <div className="flex items-center gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => aiImgRef.current?.click()} disabled={aiBusy}>
                {aiBusy ? "আপলোড হচ্ছে..." : <><Upload className="w-3.5 h-3.5 mr-1" /> ছবি দিন</>}
              </Button>
              <span className="text-[11px] text-muted-foreground">ছবিটি সরাসরি বডিতে দেখা যাবে — কোনো HTML কোড লিখতে হবে না।</span>

            </div>
            <input ref={aiImgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) aiFromImage(f); e.target.value = ""; }} />
          </div>

          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <Label>আবেদনের বডি (HTML — সরাসরি এডিট করতে পারেন)</Label>
              <div className="text-[10px] text-muted-foreground">প্লেসহোল্ডার: {`{{customer_name}}`} ...</div>
            </div>
            <Textarea ref={taRef} rows={14} value={v.body_html || ""} onChange={(e) => setV({ ...v, body_html: e.target.value })} className="font-mono text-sm" />
            <div className="flex flex-wrap gap-1 mt-2">
              {PLACEHOLDERS.map((p) => (
                <button key={p} type="button" onClick={() => insertPh(p)} className="text-[10px] px-2 py-0.5 rounded border hover:bg-muted">
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2 rounded-lg border bg-amber-50/40 p-3">
            <Label className="text-sm font-semibold">🏷️ এই টেমপ্লেটের ফিল্ডসমূহ ({currentPhs.length}) — নাম পরিবর্তন / মুছুন / যোগ করুন</Label>
            {currentPhs.length === 0 ? (
              <div className="text-xs text-muted-foreground mt-2">এখনো কোনো {`{{field}}`} নেই।</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {currentPhs.map((p) => (
                  <div key={p} className="flex items-center gap-1 bg-white rounded border px-1.5 py-1">
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">{`{{${p}}}`}</span>
                    <Input
                      value={renameDraft[p] ?? p}
                      onChange={(e) => setRenameDraft((d) => ({ ...d, [p]: e.target.value }))}
                      onBlur={() => { if (renameDraft[p] !== undefined && renameDraft[p] !== p) applyRename(p); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyRename(p); } }}
                      className="h-7 text-xs"
                      placeholder="new_name"
                    />
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deletePh(p)} title="মুছুন">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <Input value={newPh} onChange={(e) => setNewPh(e.target.value)} placeholder="নতুন ফিল্ড নাম (যেমন: new_mobile)" className="h-8 text-xs" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPh(); } }} />
              <Button type="button" size="sm" variant="secondary" onClick={addPh}>+ যোগ করুন</Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">নাম পরিবর্তন করলে বডিতে সকল জায়গায় অটো রিপ্লেস হবে।</div>
          </div>

          <div className="col-span-2 rounded-lg border-2 border-dashed p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-primary" /> ফাইল সংযুক্ত করুন (PDF / Word) — ঐচ্ছিক</Label>
              {v.file_path && (
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={openFile}><Eye className="w-3 h-3 mr-1" /> দেখুন</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={removeFile}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              )}
            </div>
            {v.file_path ? (
              <div className="text-xs flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded p-2">
                <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{v.file_name}</div>
                  <div className="text-[10px] text-muted-foreground">{v.file_mime} • {(((v.file_size || 0) / 1024) | 0)} KB</div>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>প্রতিস্থাপন</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="w-4 h-4 mr-1" /> {uploading ? "আপলোড হচ্ছে..." : "PDF / DOCX আপলোড"}
              </Button>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
            <div className="text-[10px] text-muted-foreground mt-1.5">💡 আপনার রেডি-মেইড আবেদন (PDF/Word) এখানে সেভ করুন — পরে যেকোনো গ্রাহকের জন্য Open করে শুধু পরিবর্তনীয় তথ্য বসিয়ে প্রিন্ট করতে পারবেন।</div>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input id="active" type="checkbox" checked={v.is_active ?? true} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
            <Label htmlFor="active">সক্রিয়</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button onClick={() => { if (!v.name) return toast.error("নাম দিন"); onSave(v); }}>সংরক্ষণ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Applications Tab ----------------
function ApplicationsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: apps = [] } = useQuery({
    queryKey: ["app_records_full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("application_records").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: tpls = [] } = useQuery({
    queryKey: ["app_templates"],
    queryFn: async () => { const { data } = await (supabase as any).from("application_templates").select("*").eq("is_active", true).order("name"); return data || []; },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("application_records").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ডিলিট হয়েছে"); qc.invalidateQueries({ queryKey: ["app_records_full"] }); qc.invalidateQueries({ queryKey: ["app_records"] }); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const patch: any = { status };
      if (status === "approved") { patch.approved_at = new Date().toISOString(); }
      const { error } = await (supabase as any).from("application_records").update(patch).eq("id", id);
      if (error) throw error;
      await (supabase as any).from("application_history").insert({ application_id: id, action: `status:${status}` });
    },
    onSuccess: () => { toast.success("Status আপডেট"); qc.invalidateQueries({ queryKey: ["app_records_full"] }); },
  });

  const types = useMemo(() => Array.from(new Set(apps.map((a: any) => a.application_type).filter(Boolean))), [apps]);
  const filtered = apps.filter((a: any) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (typeFilter !== "all" && a.application_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.customer_name?.toLowerCase().includes(q) || a.customer_nid?.includes(q) || a.customer_mobile?.includes(q) || a.account_number?.includes(q) || a.application_no?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="নাম / NID / মোবাইল / A/C / আবেদন নং" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {types.length > 0 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="টাইপ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব টাইপ</SelectItem>
                {types.map((t: any) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => exportCsv(filtered, "applications")}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button onClick={() => setEditing({ status: "draft", application_date: new Date().toISOString().slice(0, 10), fields: {} })}>
            <Plus className="w-4 h-4 mr-1" /> নতুন আবেদন
          </Button>
        </div>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded-md overflow-hidden">
          <thead className="bg-emerald-900 text-white text-xs">
            <tr>
              <th className="p-2 text-left">তারিখ</th>
              <th className="p-2 text-left">গ্রাহক</th>
              <th className="p-2 text-left">টাইপ</th>
              <th className="p-2 text-left">A/C</th>
              <th className="p-2 text-left">NID</th>
              <th className="p-2 text-left">মোবাইল</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a: any) => {
              const s = STATUS_META[a.status] || STATUS_META.draft;
              return (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">{a.application_date}</td>
                  <td className="p-2 font-medium">{a.customer_name}</td>
                  <td className="p-2">{a.application_type || "—"}</td>
                  <td className="p-2 font-mono text-xs">{a.account_number || "—"}</td>
                  <td className="p-2 font-mono text-xs">{a.customer_nid || "—"}</td>
                  <td className="p-2 font-mono text-xs">{a.customer_mobile || "—"}</td>
                  <td className="p-2"><Badge className={`${s.color} text-white text-[10px]`}>{s.label}</Badge></td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(a)} title="View body"><Eye className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(a)} title="Edit"><Edit3 className="w-3.5 h-3.5" /></Button>
                      <Select value={a.status} onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_META).map(([k, vv]) => <SelectItem key={k} value={k}>{vv.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট করবেন?")) del.mutate(a.id); }}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">কোনো আবেদন নেই</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <ApplicationEditor value={editing} templates={tpls} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["app_records_full"] }); qc.invalidateQueries({ queryKey: ["app_records"] }); }} />}
      {viewing && <ApplicationViewer record={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ---------------- Application Editor (huge feature) ----------------
function ApplicationEditor({ value, templates, onClose, onSaved }: any) {
  const [v, setV] = useState<any>(() => {
    const base = {
      customer_name: "", customer_nid: "", customer_mobile: "", account_number: "",
      account_type: "savings", application_type: "", application_date: new Date().toISOString().slice(0, 10),
      status: "draft", remarks: "", amount: "", reason: "", body_html: "",
    };
    return { ...base, ...value, fields: { ...(value?.fields || {}) } };
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [], refetch: refetchAtt } = useQuery({
    queryKey: ["app_attachments", v.id],
    queryFn: async () => {
      if (!v.id) return [];
      const { data } = await (supabase as any).from("application_attachments").select("*").eq("application_id", v.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!v.id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["app_history", v.id],
    queryFn: async () => {
      if (!v.id) return [];
      const { data } = await (supabase as any).from("application_history").select("*").eq("application_id", v.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!v.id,
  });

  const pickTemplate = (id: string) => {
    const t = templates.find((x: any) => x.id === id);
    if (!t) return;
    const phs = extractPlaceholders(t.body_html || "");
    const seeded: Record<string, string> = { ...(v.fields || {}) };
    phs.forEach((p) => { if (!(p in seeded)) seeded[p] = ""; });
    setV({ ...v, template_id: id, application_type: t.name, body_html: t.body_html, fields: seeded });
    toast.success(`টেমপ্লেট লোড — ${phs.length} টি ফিল্ড এডিট করুন`);
  };

  const templatePlaceholders = useMemo(() => extractPlaceholders(v.body_html || ""), [v.body_html]);


  const mergedFields = useMemo(() => {
    const defaults: Record<string, any> = {
      customer_name: v.customer_name, nid: v.customer_nid, mobile: v.customer_mobile,
      account_number: v.account_number, account_type: v.account_type,
      date: v.application_date, amount: v.amount, reason: v.reason, remarks: v.remarks,
    };
    const out: Record<string, any> = { ...defaults };
    // User-edited template fields ALWAYS win over auto-filled customer defaults
    for (const [k, val] of Object.entries(v.fields || {})) {
      if (val !== undefined && val !== null && val !== "") out[k] = val;
      else if (!(k in out)) out[k] = val;
    }
    return out;
  }, [v]);

  const save = useMutation({
    mutationFn: async (status?: string) => {
      const payload: any = {
        template_id: v.template_id || null,
        application_no: v.application_no || null,
        customer_name: v.customer_name, customer_nid: v.customer_nid || null,
        customer_mobile: v.customer_mobile || null, account_number: v.account_number || null,
        account_type: v.account_type || null, application_type: v.application_type || null,
        application_date: v.application_date, fields: v.fields, body_html: v.body_html || "",
        status: status || v.status, remarks: v.remarks || null,
        amount: v.amount ? Number(v.amount) : null, reason: v.reason || null,
      };
      if (v.id) {
        const { error } = await (supabase as any).from("application_records").update(payload).eq("id", v.id);
        if (error) throw error;
        await (supabase as any).from("application_history").insert({ application_id: v.id, action: "updated", snapshot: payload });
        return v.id;
      } else {
        const { data, error } = await (supabase as any).from("application_records").insert(payload).select().single();
        if (error) throw error;
        await (supabase as any).from("application_history").insert({ application_id: data.id, action: "created", snapshot: payload });
        return data.id;
      }
    },
    onSuccess: (id) => { toast.success("সংরক্ষিত"); setV({ ...v, id }); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!v.id) { await save.mutateAsync(undefined); }
      const id = v.id || (await (supabase as any).from("application_records").select("id").eq("customer_name", v.customer_name).order("created_at", { ascending: false }).limit(1)).data?.[0]?.id;
      if (!id) throw new Error("Save first");
      const path = `${id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("application-attachments").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("application-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
      await (supabase as any).from("application_attachments").insert({ application_id: id, title: file.name, file_path: path, file_url: signed?.signedUrl, mime_type: file.type, size_bytes: file.size });
    },
    onSuccess: () => { toast.success("Attached"); refetchAtt(); },
    onError: (e: any) => toast.error(e.message),
  });

  const previewHtml = buildDocumentHtml({ bankName: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি", outlet: "ফকিরবাজার এজেন্ট আউটলেট ১২১/১১, বুড়িচং, কুমিল্লা", bodyHtml: v.body_html, fields: mergedFields });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>{v.id ? "আবেদন সম্পাদনা" : "নতুন আবেদন"}</DialogTitle></DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">তথ্য</TabsTrigger>
            <TabsTrigger value="body">ডকুমেন্ট</TabsTrigger>
            <TabsTrigger value="attachments" disabled={!v.id}>সংযুক্তি</TabsTrigger>
            <TabsTrigger value="history" disabled={!v.id}>হিস্টোরি</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-3">
                <Label>টেমপ্লেট থেকে শুরু করুন</Label>
                <Select value={v.template_id || ""} onValueChange={pickTemplate}>
                  <SelectTrigger><SelectValue placeholder="-- টেমপ্লেট নির্বাচন --" /></SelectTrigger>
                  <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>গ্রাহকের নাম *</Label><Input value={v.customer_name} onChange={(e) => setV({ ...v, customer_name: e.target.value })} /></div>
              <div><Label>এনআইডি</Label><Input value={v.customer_nid || ""} onChange={(e) => setV({ ...v, customer_nid: e.target.value })} /></div>
              <div><Label>মোবাইল</Label><Input value={v.customer_mobile || ""} onChange={(e) => setV({ ...v, customer_mobile: e.target.value })} /></div>
              <div><Label>অ্যাকাউন্ট নম্বর</Label><Input value={v.account_number || ""} onChange={(e) => setV({ ...v, account_number: e.target.value })} /></div>
              <div><Label>অ্যাকাউন্ট টাইপ</Label>
                <Select value={v.account_type || "savings"} onValueChange={(val) => setV({ ...v, account_type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="dps">DPS</SelectItem>
                    <SelectItem value="fdr">FDR</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>আবেদনের ধরন</Label><Input value={v.application_type || ""} onChange={(e) => setV({ ...v, application_type: e.target.value })} /></div>
              <div><Label>তারিখ</Label><Input type="date" value={v.application_date} onChange={(e) => setV({ ...v, application_date: e.target.value })} /></div>
              <div><Label>পরিমাণ (Amount)</Label><Input type="number" value={v.amount || ""} onChange={(e) => setV({ ...v, amount: e.target.value })} /></div>
              <div><Label>স্ট্যাটাস</Label>
                <Select value={v.status} onValueChange={(val) => setV({ ...v, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_META).map(([k, vv]) => <SelectItem key={k} value={k}>{vv.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3"><Label>কারণ (Reason)</Label><Textarea rows={2} value={v.reason || ""} onChange={(e) => setV({ ...v, reason: e.target.value })} /></div>
              <div className="col-span-2 md:col-span-3"><Label>মন্তব্য</Label><Textarea rows={2} value={v.remarks || ""} onChange={(e) => setV({ ...v, remarks: e.target.value })} /></div>

              {/* Extra dynamic fields */}
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs text-muted-foreground">অতিরিক্ত তথ্য (ডকুমেন্টে {`{{father_name}}, {{mother_name}}, {{address}}, {{branch_name}}, {{opening_date}}, {{balance}}, {{dob}}, {{occupation}}`} হিসেবে আসবে)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {["father_name", "mother_name", "address", "branch_name", "opening_date", "balance", "dob", "occupation"].map((k) => (
                    <Input key={k} placeholder={k} value={v.fields?.[k] || ""} onChange={(e) => setV({ ...v, fields: { ...v.fields, [k]: e.target.value } })} />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="body" className="space-y-2 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left: placeholder field editors */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">টেমপ্লেট ফিল্ড ({templatePlaceholders.length}) — এডিট করলে ডানদিকে সাথে সাথে আপডেট হবে</Label>
                {templatePlaceholders.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 border rounded p-3 bg-muted/30">
                    এই টেমপ্লেটে কোনো {`{{variable}}`} নেই। নিচে raw HTML এডিট করুন অথবা উপরের "তথ্য" ট্যাব থেকে টেমপ্লেট বাছুন।
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 border rounded p-2 bg-muted/20">
                    {templatePlaceholders.map((p) => (
                      <div key={p}>
                        <Label className="text-[10px] text-muted-foreground">{`{{${p}}}`}</Label>
                        {["reason", "remarks", "address"].includes(p) ? (
                          <Textarea rows={2} value={v.fields?.[p] ?? mergedFields[p] ?? ""} onChange={(e) => setV({ ...v, fields: { ...v.fields, [p]: e.target.value } })} className="text-sm" />
                        ) : (
                          <Input value={v.fields?.[p] ?? mergedFields[p] ?? ""} onChange={(e) => setV({ ...v, fields: { ...v.fields, [p]: e.target.value } })} className="h-8 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">⚙️ Raw HTML এডিট করুন (অ্যাডভান্সড)</summary>
                  <Textarea rows={10} value={v.body_html || ""} onChange={(e) => setV({ ...v, body_html: e.target.value })} className="font-mono text-xs mt-2" />
                </details>
              </div>
              {/* Right: live preview */}
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1"><Eye className="w-3 h-3" /> লাইভ প্রিভিউ</Label>
                <iframe
                  title="App live preview"
                  srcDoc={documentPreviewSrcDoc(previewHtml)}
                  sandbox=""
                  className="bg-white border rounded mt-1 h-[60vh] w-full"
                />
              </div>
            </div>
          </TabsContent>


          <TabsContent value="attachments" className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}><Upload className="w-4 h-4 mr-1" /> ফাইল আপলোড</Button>
              <span className="text-xs text-muted-foreground">NID, ছবি, স্বাক্ষর, PDF ইত্যাদি</span>
            </div>
            <div className="space-y-2">
              {attachments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground">{a.mime_type} · {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : ""}</div>
                  </div>
                  {a.file_url && <a href={a.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">দেখুন</a>}
                </div>
              ))}
              {attachments.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো সংযুক্তি নেই</div>}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-2 max-h-[60vh] overflow-y-auto">
            {history.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো হিস্টোরি নেই</div>}
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between border-l-4 border-emerald-500 bg-muted/30 px-3 py-2 rounded">
                <div>
                  <div className="text-sm font-medium">{h.action}</div>
                  {h.note && <div className="text-xs text-muted-foreground">{h.note}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="w-4 h-4 mr-1" /> Preview</Button>
          <Button variant="outline" onClick={() => printHtml(previewHtml, v.application_type || "Application")}><Printer className="w-4 h-4 mr-1" /> Print / PDF</Button>
          <Button onClick={() => save.mutate(undefined)} disabled={!v.customer_name || save.isPending}>সংরক্ষণ</Button>
          <Button onClick={() => save.mutate("submitted")} disabled={!v.customer_name || save.isPending} className="bg-emerald-700 hover:bg-emerald-800">
            <Send className="w-4 h-4 mr-1" /> Save & Submit
          </Button>
        </DialogFooter>

        {previewOpen && (
          <Dialog open onOpenChange={() => setPreviewOpen(false)}>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>ডকুমেন্ট প্রিভিউ</DialogTitle></DialogHeader>
              <iframe
                title="Application document preview"
                srcDoc={documentPreviewSrcDoc(previewHtml)}
                sandbox=""
                className="bg-white rounded border h-[70vh] w-full"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>বন্ধ</Button>
                <Button onClick={() => printHtml(previewHtml, v.application_type || "Application")}><Printer className="w-4 h-4 mr-1" /> Print</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Application Viewer (read-only body) ----------------
function ApplicationViewer({ record, onClose }: any) {
  const mergedFields = useMemo(() => ({
    ...(record.fields || {}),
    customer_name: record.customer_name, nid: record.customer_nid, mobile: record.customer_mobile,
    account_number: record.account_number, account_type: record.account_type,
    date: record.application_date, amount: record.amount, reason: record.reason, remarks: record.remarks,
  }), [record]);
  const html = buildDocumentHtml({
    bankName: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি",
    outlet: "ফকিরবাজার এজেন্ট আউটলেট ১২১/১১, বুড়িচং, কুমিল্লা",
    bodyHtml: record.body_html || "",
    fields: mergedFields,
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{record.application_type || "আবেদন"} — {record.customer_name}</DialogTitle>
        </DialogHeader>
        {record.body_html ? (
          <iframe
            title="Application body"
            srcDoc={documentPreviewSrcDoc(html)}
            sandbox=""
            className="bg-white border rounded h-[70vh] w-full"
          />
        ) : (
          <div className="text-sm text-muted-foreground text-center py-10">
            এই আবেদনে কোনো বডি নেই। এডিট থেকে টেমপ্লেট নির্বাচন করুন।
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>বন্ধ</Button>
          {record.body_html && (
            <Button onClick={() => printHtml(html, record.application_type || "Application")}>
              <Printer className="w-4 h-4 mr-1" /> Print / PDF
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Customer Docs Tab ----------------
function CustomerDocsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ customer_name: "", customer_nid: "", customer_mobile: "", account_number: "", doc_type: "NID", title: "", notes: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["customer_documents"],
    queryFn: async () => { const { data } = await (supabase as any).from("customer_documents").select("*").order("created_at", { ascending: false }); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      let file_path: string | undefined, file_url: string | undefined, mime_type: string | undefined, size_bytes: number | undefined;
      const f = fileRef.current?.files?.[0];
      if (f) {
        const path = `customer/${Date.now()}_${f.name}`;
        const { error } = await supabase.storage.from("application-attachments").upload(path, f);
        if (error) throw error;
        const { data: signed } = await supabase.storage.from("application-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
        file_path = path; file_url = signed?.signedUrl; mime_type = f.type; size_bytes = f.size;
      }
      const { error } = await (supabase as any).from("customer_documents").insert({ ...form, file_path, file_url, mime_type, size_bytes });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("সংরক্ষিত"); setOpen(false); setForm({ customer_name: "", customer_nid: "", customer_mobile: "", account_number: "", doc_type: "NID", title: "", notes: "" }); if (fileRef.current) fileRef.current.value = ""; qc.invalidateQueries({ queryKey: ["customer_documents"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (d: any) => {
      if (d.file_path) await supabase.storage.from("application-attachments").remove([d.file_path]);
      await (supabase as any).from("customer_documents").delete().eq("id", d.id);
    },
    onSuccess: () => { toast.success("ডিলিট হয়েছে"); qc.invalidateQueries({ queryKey: ["customer_documents"] }); },
  });

  const filtered = docs.filter((d: any) => !search || d.customer_name?.toLowerCase().includes(search.toLowerCase()) || d.customer_nid?.includes(search) || d.account_number?.includes(search));

  // Group by customer
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach((d: any) => {
      const key = d.customer_name + (d.customer_nid ? `|${d.customer_nid}` : "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="গ্রাহক নাম / NID / A/C" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> ডকুমেন্ট যোগ</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {grouped.map(([key, items]) => {
          const first = items[0];
          return (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                  {first.customer_name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{first.customer_name}</div>
                  {first.customer_nid && <div className="text-[11px] text-muted-foreground font-mono">NID: {first.customer_nid}</div>}
                  {first.account_number && <div className="text-[11px] text-muted-foreground font-mono">A/C: {first.account_number}</div>}
                </div>
              </div>
              <div className="space-y-1.5">
                {items.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                    <div className="min-w-0">
                      <Badge variant="outline" className="text-[10px] mr-1">{d.doc_type}</Badge>
                      <span className="truncate">{d.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">দেখুন</a>}
                      <button onClick={() => { if (confirm("ডিলিট?")) del.mutate(d); }} className="text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {grouped.length === 0 && <div className="col-span-full text-center py-10 text-muted-foreground">কোনো গ্রাহক ডকুমেন্ট নেই</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>গ্রাহক ডকুমেন্ট যোগ করুন</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>গ্রাহকের নাম *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>NID</Label><Input value={form.customer_nid} onChange={(e) => setForm({ ...form, customer_nid: e.target.value })} /></div>
            <div><Label>মোবাইল</Label><Input value={form.customer_mobile} onChange={(e) => setForm({ ...form, customer_mobile: e.target.value })} /></div>
            <div><Label>অ্যাকাউন্ট নং</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label>ডকুমেন্ট টাইপ</Label>
              <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["NID", "Photo", "Signature", "Form", "PDF", "Application", "Other"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="col-span-2"><Label>ফাইল</Label><input ref={fileRef} type="file" className="block w-full text-sm" /></div>
            <div className="col-span-2"><Label>মন্তব্য</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={() => save.mutate()} disabled={!form.customer_name || !form.title || save.isPending}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
