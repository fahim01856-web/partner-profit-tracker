import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, Trash2, Printer, Pencil, AlertTriangle, CheckCircle2, Clock, ListTodo,
  Search, Download, LayoutGrid, List as ListIcon, Calendar as CalendarIcon,
  MessageSquare, Copy, Repeat, Timer, Tag, Hash,
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", in_progress: "#3b82f6", completed: "#10b981", verified: "#8b5cf6", cancelled: "#6b7280",
};
const PRIORITY_VARIANT: Record<string, string> = { urgent: "destructive", high: "default", medium: "secondary", low: "outline" };
const STATUSES = ["pending", "in_progress", "completed", "verified", "cancelled"];
const CATEGORIES = ["daily", "audit", "meeting", "compliance", "kyc", "other"];

function emptyTask() {
  return {
    title: "", description: "", category: "daily", priority: "medium", status: "pending",
    assigned_to: "", start_date: "", deadline: "", reminder_date: "",
    completion_note: "", progress: 0, estimated_hours: "", actual_hours: "",
    tags: "", checklist: [] as { text: string; done: boolean }[],
    recurrence: "none", parent_task_id: "", location: "", cost: "", color: "",
  };
}

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ status: "all", priority: "all", category: "all", assigned: "all", tag: "all", overdue: false });
  const [form, setForm] = useState<any>(emptyTask());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPriority, setBulkPriority] = useState("medium");
  const [bulkAssigned, setBulkAssigned] = useState("");
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [commentTask, setCommentTask] = useState<any>(null);
  const [newComment, setNewComment] = useState("");
  const [checkItem, setCheckItem] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => { const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }); if (error) throw error; return data || []; },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => { const { data } = await supabase.from("staff").select("id,name").order("name"); return data || []; },
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["task_templates"],
    queryFn: async () => { const { data } = await (supabase as any).from("task_templates").select("*").order("created_at", { ascending: false }); return data || []; },
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["task_comments", commentTask?.id],
    enabled: !!commentTask,
    queryFn: async () => { const { data } = await (supabase as any).from("task_comments").select("*").eq("task_id", commentTask.id).order("created_at"); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const staffName = staff.find((s: any) => s.id === form.assigned_to)?.name || null;
      const tagsArr = (form.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
      const payload: any = {
        title: form.title, description: form.description || null,
        category: form.category, priority: form.priority, status: form.status,
        assigned_to: form.assigned_to || null, assigned_to_name: staffName,
        start_date: form.start_date || null, deadline: form.deadline || null,
        reminder_date: form.reminder_date || null, completion_note: form.completion_note || null,
        progress: Number(form.progress) || 0,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        actual_hours: form.actual_hours ? Number(form.actual_hours) : null,
        tags: tagsArr, checklist: form.checklist,
        recurrence: form.recurrence === "none" ? null : form.recurrence,
        parent_task_id: form.parent_task_id || null,
        location: form.location || null,
        cost: form.cost ? Number(form.cost) : null,
        color: form.color || null,
        completed_on: ["completed", "verified"].includes(form.status) ? new Date().toISOString() : null,
      };
      if (edit) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", edit.id);
        if (error) throw error;
        if (edit.status !== form.status) {
          await supabase.from("task_history").insert({ task_id: edit.id, action: "status_change", from_status: edit.status, to_status: form.status, note: form.completion_note || null });
        }
      } else {
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("সংরক্ষিত"); setOpen(false); setEdit(null); setForm(emptyTask()); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("tasks").delete().eq("id", id); },
    onSuccess: () => { toast.success("ডিলিট"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  const quickStatus = useMutation({
    mutationFn: async ({ id, status, oldStatus }: any) => {
      const upd: any = { status, completed_on: ["completed", "verified"].includes(status) ? new Date().toISOString() : null };
      if (status === "completed") upd.progress = 100;
      await supabase.from("tasks").update(upd).eq("id", id);
      await supabase.from("task_history").insert({ task_id: id, action: "status_change", from_status: oldStatus, to_status: status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const bulkAdd = useMutation({
    mutationFn: async () => {
      const lines = bulkText.split("\n").map((l) => l.replace(/^\s*(\d+[\.\)]|[-•*])\s*/, "").trim()).filter(Boolean);
      if (!lines.length) throw new Error("কোনো শিরোনাম নেই");
      const staffName = staff.find((s: any) => s.id === bulkAssigned)?.name || null;
      const rows = lines.map((title) => ({
        title, priority: bulkPriority, status: "pending", category: "daily",
        assigned_to: bulkAssigned || null, assigned_to_name: staffName,
        deadline: bulkDeadline || null, progress: 0,
      }));
      const { error } = await supabase.from("tasks").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("যোগ হয়েছে"); setBulkOpen(false); setBulkText(""); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const tagsArr = (form.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean);
      const { error } = await (supabase as any).from("task_templates").insert({
        name: form.title, title: form.title, description: form.description,
        category: form.category, priority: form.priority,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        checklist: form.checklist, tags: tagsArr,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("টেমপ্লেট সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["task_templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!newComment.trim() || !commentTask) return;
      await (supabase as any).from("task_comments").insert({ task_id: commentTask.id, comment: newComment });
    },
    onSuccess: () => { setNewComment(""); qc.invalidateQueries({ queryKey: ["task_comments", commentTask?.id] }); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (t: any) => t.deadline && t.deadline < today && !["completed", "verified", "cancelled"].includes(t.status);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t: any) => (t.tags || []).forEach((x: string) => s.add(x)));
    return Array.from(s);
  }, [tasks]);

  const filtered = useMemo(() => tasks.filter((t: any) => {
    if (search && !`${t.title} ${t.description || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.priority !== "all" && t.priority !== filter.priority) return false;
    if (filter.category !== "all" && t.category !== filter.category) return false;
    if (filter.assigned !== "all" && t.assigned_to !== filter.assigned) return false;
    if (filter.tag !== "all" && !(t.tags || []).includes(filter.tag)) return false;
    if (filter.overdue && !isOverdue(t)) return false;
    return true;
  }), [tasks, search, filter, today]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t: any) => t.status === "pending").length;
    const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
    const completed = tasks.filter((t: any) => ["completed", "verified"].includes(t.status)).length;
    const overdue = tasks.filter(isOverdue).length;
    const dueToday = tasks.filter((t: any) => t.deadline === today && !["completed", "verified", "cancelled"].includes(t.status)).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const totalEstHrs = tasks.reduce((s: number, t: any) => s + (Number(t.estimated_hours) || 0), 0);
    const totalActHrs = tasks.reduce((s: number, t: any) => s + (Number(t.actual_hours) || 0), 0);
    return { total, pending, inProgress, completed, overdue, dueToday, completionRate, totalEstHrs, totalActHrs };
  }, [tasks, today]);

  const pieData = STATUSES.map((s) => ({ name: s, value: tasks.filter((t: any) => t.status === s).length })).filter((x) => x.value > 0);
  const staffPerf = useMemo(() => {
    const map = new Map<string, { name: string; total: number; done: number }>();
    tasks.forEach((t: any) => {
      const k = t.assigned_to_name || "Unassigned";
      const v = map.get(k) || { name: k, total: 0, done: 0 };
      v.total++;
      if (["completed", "verified"].includes(t.status)) v.done++;
      map.set(k, v);
    });
    return Array.from(map.values()).slice(0, 8);
  }, [tasks]);

  function exportCSV() {
    const headers = ["Title", "Category", "Priority", "Status", "Assigned", "Start", "Deadline", "Progress", "Est.Hrs", "Act.Hrs", "Tags"];
    const rows = filtered.map((t: any) => [
      t.title, t.category, t.priority, t.status, t.assigned_to_name || "",
      t.start_date || "", t.deadline || "", t.progress || 0,
      t.estimated_hours || "", t.actual_hours || "", (t.tags || []).join("|"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `tasks_${today}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function loadTemplate(tpl: any) {
    setForm({
      ...emptyTask(),
      title: tpl.title, description: tpl.description || "",
      category: tpl.category || "daily", priority: tpl.priority || "medium",
      estimated_hours: tpl.estimated_hours || "",
      checklist: Array.isArray(tpl.checklist) ? tpl.checklist : [],
      tags: (tpl.tags || []).join(", "),
    });
    setTplOpen(false); setEdit(null); setOpen(true);
  }

  function duplicateTask(t: any) {
    setEdit(null);
    setForm({
      title: t.title + " (copy)", description: t.description || "",
      category: t.category, priority: t.priority, status: "pending",
      assigned_to: t.assigned_to || "", start_date: "", deadline: "", reminder_date: "",
      completion_note: "", progress: 0,
      estimated_hours: t.estimated_hours || "", actual_hours: "",
      tags: (t.tags || []).join(", "), checklist: t.checklist || [],
      recurrence: t.recurrence || "none", parent_task_id: "", location: t.location || "",
      cost: t.cost || "", color: t.color || "",
    });
    setOpen(true);
  }

  // Kanban / Calendar helpers
  const kanbanCols = STATUSES.filter((s) => s !== "cancelled");
  const calMap = useMemo(() => {
    const m = new Map<string, any[]>();
    filtered.forEach((t: any) => { if (t.deadline) { const a = m.get(t.deadline) || []; a.push(t); m.set(t.deadline, a); } });
    return m;
  }, [filtered]);
  const monthDays = useMemo(() => {
    const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let i = 1; i <= last; i++) arr.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    return arr;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">📋 Smart Task Management</h1>
          <p className="text-sm text-muted-foreground">ডিজিটাল টাস্ক সিস্টেম — Kanban, Calendar, Templates, Comments, Time Tracking</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/pending-works">📋 Pending Works</Link></Button>
          <Button variant="outline" size="sm" onClick={() => setTplOpen(true)}><Copy className="w-4 h-4 mr-1" /> টেমপ্লেট</Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}><ListTodo className="w-4 h-4 mr-1" /> Bulk Add</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button size="sm" onClick={() => { setEdit(null); setForm(emptyTask()); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> নতুন Task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><ListTodo className="w-3 h-3" /> মোট</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground"><Clock className="w-3 h-3 inline" /> অপেক্ষমাণ</div><div className="text-2xl font-bold text-amber-600">{stats.pending}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">চলমান</div><div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3 inline" /> সম্পন্ন</div><div className="text-2xl font-bold text-green-600">{stats.completed}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3 inline" /> অতিক্রান্ত</div><div className="text-2xl font-bold text-red-600">{stats.overdue}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">আজ Due</div><div className="text-2xl font-bold text-orange-600">{stats.dueToday}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">সম্পন্ন হার</div><div className="text-2xl font-bold text-violet-600">{stats.completionRate}%</div><Progress value={stats.completionRate} className="h-1 mt-1" /></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">স্ট্যাটাস</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                {pieData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name] || "#888"} />)}
              </Pie>
              <Legend /><Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="font-semibold text-sm mb-2">স্টাফ পারফরম্যান্স</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={staffPerf}>
              <XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Legend />
              <Bar dataKey="total" fill="#94a3b8" name="মোট" />
              <Bar dataKey="done" fill="#10b981" name="সম্পন্ন" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground mt-2 flex gap-4">
            <span><Timer className="w-3 h-3 inline" /> Est: {stats.totalEstHrs}h</span>
            <span>Act: {stats.totalActHrs}h</span>
          </div>
        </Card>
      </div>

      <Card className="p-3 no-print">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input placeholder="খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব স্ট্যাটাস</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filter.priority} onValueChange={(v) => setFilter({ ...filter, priority: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব Priority</SelectItem>{["urgent", "high", "medium", "low"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব বিভাগ</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filter.assigned} onValueChange={(v) => setFilter({ ...filter, assigned: v })}>
            <SelectTrigger className="w-36"><SelectValue placeholder="সব স্টাফ" /></SelectTrigger>
            <SelectContent><SelectItem value="all">সব স্টাফ</SelectItem>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          {allTags.length > 0 && (
            <Select value={filter.tag} onValueChange={(v) => setFilter({ ...filter, tag: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">সব Tag</SelectItem>{allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <Checkbox checked={filter.overdue} onCheckedChange={(v) => setFilter({ ...filter, overdue: !!v })} /> Overdue
          </label>
        </div>
      </Card>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="no-print">
          <TabsTrigger value="list"><ListIcon className="w-4 h-4 mr-1" /> List</TabsTrigger>
          <TabsTrigger value="kanban"><LayoutGrid className="w-4 h-4 mr-1" /> Kanban</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarIcon className="w-4 h-4 mr-1" /> Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-2 mt-3">
          {filtered.map((t: any) => {
            const overdue = isOverdue(t);
            const checklistDone = (t.checklist || []).filter((c: any) => c.done).length;
            const checklistTotal = (t.checklist || []).length;
            return (
              <Card key={t.id} className={`p-3 ${overdue ? "border-red-300" : ""}`} style={t.color ? { borderLeftWidth: 4, borderLeftColor: t.color } : {}}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{t.title}</div>
                      <Badge variant={PRIORITY_VARIANT[t.priority] as any}>{t.priority}</Badge>
                      <Badge variant="outline">{t.category}</Badge>
                      <Badge style={{ backgroundColor: STATUS_COLORS[t.status], color: "white" }}>{t.status}</Badge>
                      {overdue && <Badge variant="destructive">Overdue</Badge>}
                      {t.recurrence && <Badge variant="outline"><Repeat className="w-3 h-3 mr-1" />{t.recurrence}</Badge>}
                      {(t.tags || []).map((tg: string) => <Badge key={tg} variant="secondary"><Hash className="w-3 h-3" />{tg}</Badge>)}
                    </div>
                    {t.description && <div className="text-sm text-muted-foreground mt-1">{t.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>👤 {t.assigned_to_name || "—"}</span>
                      {t.deadline && <span>📅 {t.deadline}</span>}
                      {t.estimated_hours && <span><Timer className="w-3 h-3 inline" /> {t.actual_hours || 0}/{t.estimated_hours}h</span>}
                      {checklistTotal > 0 && <span>☑ {checklistDone}/{checklistTotal}</span>}
                      {t.location && <span>📍 {t.location}</span>}
                    </div>
                    {t.progress > 0 && <Progress value={t.progress} className="h-1.5 mt-2" />}
                  </div>
                  <div className="flex gap-1 no-print">
                    <Select value={t.status} onValueChange={(v) => quickStatus.mutate({ id: t.id, status: v, oldStatus: t.status })}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => setCommentTask(t)}><MessageSquare className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicateTask(t)}><Copy className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEdit(t);
                      setForm({
                        title: t.title, description: t.description || "", category: t.category, priority: t.priority, status: t.status,
                        assigned_to: t.assigned_to || "", start_date: t.start_date || "", deadline: t.deadline || "", reminder_date: t.reminder_date || "",
                        completion_note: t.completion_note || "", progress: t.progress || 0,
                        estimated_hours: t.estimated_hours || "", actual_hours: t.actual_hours || "",
                        tags: (t.tags || []).join(", "), checklist: t.checklist || [],
                        recurrence: t.recurrence || "none", parent_task_id: t.parent_task_id || "",
                        location: t.location || "", cost: t.cost || "", color: t.color || "",
                      });
                      setOpen(true);
                    }}><Pencil className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট?")) del.mutate(t.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">কোনো Task নেই</div>}
        </TabsContent>

        <TabsContent value="kanban" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {kanbanCols.map((col) => {
              const items = filtered.filter((t: any) => t.status === col);
              return (
                <Card key={col} className="p-3 bg-muted/30">
                  <div className="font-semibold text-sm mb-2 flex justify-between items-center">
                    <span style={{ color: STATUS_COLORS[col] }}>● {col}</span>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {items.map((t: any) => (
                      <Card key={t.id} className="p-2 cursor-pointer hover:shadow-md" onClick={() => { setCommentTask(null); duplicateTask; }}>
                        <div className="text-sm font-medium">{t.title}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge variant={PRIORITY_VARIANT[t.priority] as any} className="text-[10px]">{t.priority}</Badge>
                          {isOverdue(t) && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                        </div>
                        {t.assigned_to_name && <div className="text-[10px] text-muted-foreground mt-1">👤 {t.assigned_to_name}</div>}
                        {t.deadline && <div className="text-[10px] text-muted-foreground">📅 {t.deadline}</div>}
                        {t.progress > 0 && <Progress value={t.progress} className="h-1 mt-1" />}
                        <div className="flex gap-1 mt-1">
                          {STATUSES.filter((s) => s !== t.status && s !== "cancelled").slice(0, 2).map((s) => (
                            <Button key={s} size="sm" variant="ghost" className="h-5 text-[9px] px-1" onClick={(e) => { e.stopPropagation(); quickStatus.mutate({ id: t.id, status: s, oldStatus: t.status }); }}>→ {s}</Button>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-3">
          <Card className="p-3">
            <div className="font-semibold text-sm mb-2">{new Date().toLocaleDateString("bn-BD", { month: "long", year: "numeric" })}</div>
            <div className="grid grid-cols-7 gap-1 text-xs">
              {["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"].map((d) => <div key={d} className="font-semibold text-center p-1">{d}</div>)}
              {monthDays.map((d, i) => (
                <div key={i} className={`min-h-[80px] border rounded p-1 ${d === today ? "bg-primary/10 border-primary" : ""}`}>
                  {d && (
                    <>
                      <div className="text-[10px] font-semibold">{Number(d.slice(-2))}</div>
                      <div className="space-y-0.5">
                        {(calMap.get(d) || []).slice(0, 3).map((t: any) => (
                          <div key={t.id} className="text-[9px] truncate rounded px-1" style={{ backgroundColor: STATUS_COLORS[t.status] + "33" }} title={t.title}>{t.title}</div>
                        ))}
                        {(calMap.get(d) || []).length > 3 && <div className="text-[9px] text-muted-foreground">+{(calMap.get(d) || []).length - 3}</div>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? "Task সম্পাদনা" : "নতুন Task"}</DialogTitle></DialogHeader>
          <Tabs defaultValue="basic">
            <TabsList>
              <TabsTrigger value="basic">মৌলিক</TabsTrigger>
              <TabsTrigger value="schedule">সময়সূচী</TabsTrigger>
              <TabsTrigger value="checklist">চেকলিস্ট ({form.checklist.length})</TabsTrigger>
              <TabsTrigger value="extra">অতিরিক্ত</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="grid grid-cols-2 gap-3 mt-3">
              <div className="col-span-2"><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="col-span-2"><Label>বিবরণ</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>বিভাগ</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>অগ্রাধিকার</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "urgent"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>স্ট্যাটাস</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>দায়িত্বপ্রাপ্ত</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="স্টাফ নির্বাচন" /></SelectTrigger>
                  <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Progress: {form.progress}%</Label>
                <input type="range" min={0} max={100} step={5} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="col-span-2"><Label><Tag className="w-3 h-3 inline" /> Tags (কমা দিয়ে)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="urgent, q3, audit" /></div>
            </TabsContent>

            <TabsContent value="schedule" className="grid grid-cols-2 gap-3 mt-3">
              <div><Label>শুরুর তারিখ</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
              <div><Label>Reminder</Label><Input type="date" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} /></div>
              <div><Label>Recurrence</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["none", "daily", "weekly", "monthly", "yearly"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>আনুমানিক ঘণ্টা</Label><Input type="number" step="0.5" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} /></div>
              <div><Label>প্রকৃত ঘণ্টা</Label><Input type="number" step="0.5" value={form.actual_hours} onChange={(e) => setForm({ ...form, actual_hours: e.target.value })} /></div>
            </TabsContent>

            <TabsContent value="checklist" className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input value={checkItem} onChange={(e) => setCheckItem(e.target.value)} placeholder="নতুন আইটেম..." onKeyDown={(e) => {
                  if (e.key === "Enter" && checkItem.trim()) { setForm({ ...form, checklist: [...form.checklist, { text: checkItem, done: false }] }); setCheckItem(""); }
                }} />
                <Button onClick={() => { if (checkItem.trim()) { setForm({ ...form, checklist: [...form.checklist, { text: checkItem, done: false }] }); setCheckItem(""); } }}><Plus className="w-4 h-4" /></Button>
              </div>
              {form.checklist.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 border rounded">
                  <Checkbox checked={c.done} onCheckedChange={(v) => {
                    const cl = [...form.checklist]; cl[i] = { ...cl[i], done: !!v }; setForm({ ...form, checklist: cl });
                  }} />
                  <span className={`flex-1 text-sm ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                  <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, checklist: form.checklist.filter((_: any, j: number) => j !== i) })}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              ))}
              {form.checklist.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">কোনো চেকলিস্ট আইটেম নেই</div>}
            </TabsContent>

            <TabsContent value="extra" className="grid grid-cols-2 gap-3 mt-3">
              <div><Label>স্থান</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><Label>খরচ (৳)</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
              <div><Label>রঙ লেবেল</Label><Input type="color" value={form.color || "#3b82f6"} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
              <div><Label>প্যারেন্ট Task (sub-task)</Label>
                <Select value={form.parent_task_id} onValueChange={(v) => setForm({ ...form, parent_task_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{tasks.filter((t: any) => t.id !== edit?.id).slice(0, 50).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>সম্পন্ন নোট</Label><Textarea rows={2} value={form.completion_note} onChange={(e) => setForm({ ...form, completion_note: e.target.value })} /></div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => saveTemplate.mutate()} disabled={!form.title}><Copy className="w-4 h-4 mr-1" /> টেমপ্লেট হিসেবে সেভ</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={() => save.mutate()} disabled={!form.title}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk add dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bulk Add Tasks</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea rows={8} placeholder="প্রতি লাইনে একটি task...&#10;1. KYC verification&#10;2. Cash count&#10;3. Daily report" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Select value={bulkPriority} onValueChange={setBulkPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={bulkAssigned} onValueChange={setBulkAssigned}>
                <SelectTrigger><SelectValue placeholder="দায়িত্বপ্রাপ্ত" /></SelectTrigger>
                <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={bulkDeadline} onChange={(e) => setBulkDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>বাতিল</Button>
            <Button onClick={() => bulkAdd.mutate()}>যোগ করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates dialog */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Task টেমপ্লেট</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templates.map((tpl: any) => (
              <Card key={tpl.id} className="p-3 cursor-pointer hover:bg-accent" onClick={() => loadTemplate(tpl)}>
                <div className="font-semibold text-sm">{tpl.name}</div>
                <div className="text-xs text-muted-foreground">{tpl.category} • {tpl.priority}</div>
                {tpl.description && <div className="text-xs mt-1">{tpl.description}</div>}
              </Card>
            ))}
            {templates.length === 0 && <div className="text-center text-muted-foreground py-8">কোনো টেমপ্লেট নেই। Task সংরক্ষণের সময় "টেমপ্লেট হিসেবে সেভ" চাপুন।</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments dialog */}
      <Dialog open={!!commentTask} onOpenChange={(v) => !v && setCommentTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>মন্তব্য: {commentTask?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {comments.map((c: any) => (
              <div key={c.id} className="p-2 border rounded text-sm">
                <div className="text-xs text-muted-foreground">{c.author_name || "Anonymous"} • {new Date(c.created_at).toLocaleString("bn-BD")}</div>
                <div>{c.comment}</div>
              </div>
            ))}
            {comments.length === 0 && <div className="text-center text-muted-foreground py-4 text-sm">কোনো মন্তব্য নেই</div>}
          </div>
          <div className="flex gap-2">
            <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="মন্তব্য লিখুন..." onKeyDown={(e) => { if (e.key === "Enter") addComment.mutate(); }} />
            <Button onClick={() => addComment.mutate()}>পাঠান</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
