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
import { toast } from "sonner";
import { Plus, Trash2, Printer, Pencil, AlertTriangle, CheckCircle2, Clock, ListTodo, Upload } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b", in_progress: "#3b82f6", completed: "#10b981", verified: "#8b5cf6", cancelled: "#6b7280",
};

const PRIORITY_VARIANT: Record<string, string> = { urgent: "destructive", high: "default", medium: "secondary", low: "outline" };

function TasksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [filter, setFilter] = useState({ status: "all", priority: "all", category: "all", assigned: "all" });
  const [form, setForm] = useState<any>(emptyTask());

  function emptyTask() {
    return { title: "", description: "", category: "daily", priority: "medium", status: "pending", assigned_to: "", deadline: "", completion_note: "" };
  }

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => { const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => { const { data } = await supabase.from("staff").select("id,name").order("name"); return data || []; },
  });

  const save = useMutation({
    mutationFn: async () => {
      const staffName = staff.find((s: any) => s.id === form.assigned_to)?.name || null;
      const payload: any = {
        title: form.title, description: form.description || null, category: form.category, priority: form.priority, status: form.status,
        assigned_to: form.assigned_to || null, assigned_to_name: staffName, deadline: form.deadline || null,
        completion_note: form.completion_note || null,
        completed_on: form.status === "completed" || form.status === "verified" ? new Date().toISOString() : null,
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
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("tasks").delete().eq("id", id); }, onSuccess: () => { toast.success("ডিলিট"); qc.invalidateQueries({ queryKey: ["tasks"] }); } });

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t: any) => t.status === "pending").length;
    const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
    const completed = tasks.filter((t: any) => ["completed", "verified"].includes(t.status)).length;
    const overdue = tasks.filter((t: any) => t.deadline && t.deadline < today && !["completed", "verified", "cancelled"].includes(t.status)).length;
    return { total, pending, inProgress, completed, overdue };
  }, [tasks, today]);

  const pieData = ["pending", "in_progress", "completed", "verified", "cancelled"].map((s) => ({ name: s, value: tasks.filter((t: any) => t.status === s).length })).filter((x) => x.value > 0);
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

  const filtered = tasks.filter((t: any) => {
    if (filter.status !== "all" && t.status !== filter.status) return false;
    if (filter.priority !== "all" && t.priority !== filter.priority) return false;
    if (filter.category !== "all" && t.category !== filter.category) return false;
    if (filter.assigned !== "all" && t.assigned_to !== filter.assigned) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">Task Management</h1>
          <p className="text-sm text-muted-foreground">Smart Task System</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/pending-works">📋 Pending Works</Link></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Button onClick={() => { setEdit(null); setForm(emptyTask()); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> নতুন Task</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><ListTodo className="w-3 h-3" /> মোট</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> অপেক্ষমাণ</div><div className="text-2xl font-bold text-amber-600">{stats.pending}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">চলমান</div><div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> সম্পন্ন</div><div className="text-2xl font-bold text-green-600">{stats.completed}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> অতিক্রান্ত</div><div className="text-2xl font-bold text-red-600">{stats.overdue}</div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">স্ট্যাটাস অনুযায়ী</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {pieData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name] || "#888"} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">স্টাফ পারফরম্যান্স</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={staffPerf}>
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#94a3b8" name="মোট" />
              <Bar dataKey="done" fill="#10b981" name="সম্পন্ন" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-3 no-print">
        <div className="flex flex-wrap gap-2">
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.priority} onValueChange={(v) => setFilter({ ...filter, priority: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব অগ্রাধিকার</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব বিভাগ</SelectItem>
              {["daily", "audit", "meeting", "compliance", "kyc", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter.assigned} onValueChange={(v) => setFilter({ ...filter, assigned: v })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="সব স্টাফ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব স্টাফ</SelectItem>
              {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.map((t: any) => {
          const overdue = t.deadline && t.deadline < today && !["completed", "verified", "cancelled"].includes(t.status);
          return (
            <Card key={t.id} className={`p-3 ${overdue ? "border-red-300" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{t.title}</div>
                    <Badge variant={PRIORITY_VARIANT[t.priority] as any}>{t.priority}</Badge>
                    <Badge variant="outline">{t.category}</Badge>
                    <Badge style={{ backgroundColor: STATUS_COLORS[t.status], color: "white" }}>{t.status}</Badge>
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                  </div>
                  {t.description && <div className="text-sm text-muted-foreground mt-1">{t.description}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    দায়িত্ব: {t.assigned_to_name || "—"} • Deadline: {t.deadline || "—"}
                    {t.source_type && ` • উৎস: ${t.source_type}`}
                  </div>
                  {t.completion_note && <div className="text-xs mt-1 italic">📝 {t.completion_note}</div>}
                </div>
                <div className="flex gap-1 no-print">
                  <Button size="sm" variant="ghost" onClick={() => { setEdit(t); setForm({ title: t.title, description: t.description || "", category: t.category, priority: t.priority, status: t.status, assigned_to: t.assigned_to || "", deadline: t.deadline || "", completion_note: t.completion_note || "" }); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট?")) del.mutate(t.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">কোনো Task নেই</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Task সম্পাদনা" : "নতুন Task"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="col-span-2"><Label>বিবরণ</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>বিভাগ</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["daily", "audit", "meeting", "compliance", "kyc", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                <SelectContent>{["pending", "in_progress", "completed", "verified", "cancelled"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            <div className="col-span-2"><Label>দায়িত্বপ্রাপ্ত স্টাফ</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="স্টাফ নির্বাচন" /></SelectTrigger>
                <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>সম্পন্ন নোট</Label><Textarea rows={2} value={form.completion_note} onChange={(e) => setForm({ ...form, completion_note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={() => save.mutate()} disabled={!form.title}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
