import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Printer, Plus, Trash2, Pencil, CheckCircle2, Clock, X, ClipboardList, Settings2, Download, Phone, MessageCircle, Copy, AlertTriangle, ListTodo, TrendingUp, CalendarClock, LayoutGrid, Search, Filter, Kanban, Table as TableIcon, Send, AlarmClock, Sparkles, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/pending-works")({ component: PendingWorksPage });

type Category = { id: string; slug: string; name_bn: string; name_en: string; sort_order: number };

type Row = {
  id: string;
  category: string;
  title: string;
  customer_name: string | null;
  account_number: string | null;
  mobile: string | null;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  entry_date: string;
  due_date: string | null;
  remarks: string | null;
};

const empty = (cat: string) => ({
  id: null as string | null,
  category: cat,
  title: "",
  customer_name: "",
  account_number: "",
  mobile: "",
  description: "",
  priority: "normal",
  status: "pending",
  assigned_to: "",
  entry_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  remarks: "",
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `cat_${Date.now()}`;
}

function exportCSV(rows: Row[], filename: string) {
  const headers = ["Title", "Customer", "Account", "Mobile", "Assigned", "Priority", "Status", "Entry Date", "Due Date", "Description", "Remarks"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.title, r.customer_name, r.account_number, r.mobile, r.assigned_to, r.priority, r.status, r.entry_date, r.due_date, r.description, r.remarks].map(esc).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function PendingWorksPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["pending_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_categories" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Category[];
    },
  });

  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all"); // all|overdue|today|week|none
  const [sortBy, setSortBy] = useState<string>("entry_desc"); // entry_desc|entry_asc|due_asc|priority
  const [form, setForm] = useState(empty(""));
  const [showForm, setShowForm] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());

  const ALL = "__all__";
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const daysDiff = (d: string) => Math.ceil((new Date(d).getTime() - new Date(todayStr).getTime()) / 86400000);

  useEffect(() => {
    if (!activeCat && categories.length > 0) setActiveCat(categories[0].slug);
  }, [activeCat, categories]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pending_works"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_works" as any)
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: typeof form) => {
      const payload = {
        category: f.category,
        title: f.title,
        customer_name: f.customer_name || null,
        account_number: f.account_number || null,
        mobile: f.mobile || null,
        description: f.description || null,
        priority: f.priority,
        status: f.status,
        assigned_to: f.assigned_to || null,
        entry_date: f.entry_date,
        due_date: f.due_date || null,
        remarks: f.remarks || null,
        completed_at: f.status === "completed" ? new Date().toISOString() : null,
      };
      if (f.id) {
        const { error } = await supabase.from("pending_works" as any).update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pending_works" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_works"] });
      toast.success(lang === "bn" ? "সংরক্ষণ হয়েছে" : "Saved");
      setForm(empty(activeCat));
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pending_works" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_works"] });
      toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (r: Row) => {
      const newStatus = r.status === "completed" ? "pending" : "completed";
      const { error } = await supabase
        .from("pending_works" as any)
        .update({ status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pending_works"] }),
  });

  const snooze = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const r = rows.find((x) => x.id === id);
      const base = r?.due_date ? new Date(r.due_date) : new Date();
      base.setDate(base.getDate() + days);
      const { error } = await supabase.from("pending_works" as any).update({ due_date: base.toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending_works"] }); toast.success(lang === "bn" ? "ডেডলাইন পেছানো হয়েছে" : "Snoozed"); },
  });

  const bulkAction = useMutation({
    mutationFn: async ({ ids, action, value }: { ids: string[]; action: "status" | "priority" | "delete"; value?: string }) => {
      if (action === "delete") {
        const { error } = await supabase.from("pending_works" as any).delete().in("id", ids);
        if (error) throw error;
      } else if (action === "status") {
        const { error } = await supabase.from("pending_works" as any).update({ status: value, completed_at: value === "completed" ? new Date().toISOString() : null }).in("id", ids);
        if (error) throw error;
      } else if (action === "priority") {
        const { error } = await supabase.from("pending_works" as any).update({ priority: value }).in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pending_works"] }); clearSel(); toast.success(lang === "bn" ? "বাল্ক অ্যাকশন সম্পন্ন" : "Bulk action done"); },
    onError: (e: any) => toast.error(e.message),
  });

  const buildReminderText = (r: Row) => {
    const due = r.due_date ? (lang === "bn" ? ` (শেষ তারিখ: ${r.due_date})` : ` (Due: ${r.due_date})`) : "";
    return lang === "bn"
      ? `প্রিয় ${r.customer_name || "গ্রাহক"}, আপনার "${r.title}" সংক্রান্ত কাজটি পেন্ডিং রয়েছে${due}। দ্রুত যোগাযোগ করুন। — ফকিরবাজার এজেন্ট আউটলেট, ১২১/১১`
      : `Dear ${r.customer_name || "Customer"}, your "${r.title}" task is pending${due}. Please contact us soon. — Fakirbazar Agent Outlet, 121/11`;
  };

  const filtered = useMemo(() => {
    const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return rows
      .filter((r) => activeCat === ALL || r.category === activeCat)
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => priorityFilter === "all" || r.priority === priorityFilter)
      .filter((r) => {
        if (dueFilter === "all") return true;
        if (dueFilter === "none") return !r.due_date;
        if (!r.due_date) return false;
        const d = daysDiff(r.due_date);
        if (dueFilter === "overdue") return d < 0 && r.status !== "completed";
        if (dueFilter === "today") return d === 0;
        if (dueFilter === "week") return d >= 0 && d <= 7;
        return true;
      })
      .filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.customer_name || "").toLowerCase().includes(q) ||
          (r.account_number || "").toLowerCase().includes(q) ||
          (r.mobile || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          (r.assigned_to || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === "entry_asc") return a.entry_date.localeCompare(b.entry_date);
        if (sortBy === "due_asc") return (a.due_date || "9999").localeCompare(b.due_date || "9999");
        if (sortBy === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        return b.entry_date.localeCompare(a.entry_date);
      });
  }, [rows, activeCat, statusFilter, priorityFilter, dueFilter, search, sortBy, todayStr]);

  const counts = useMemo(() => {
    const map: Record<string, { p: number; c: number; total: number }> = {};
    for (const c of categories) map[c.slug] = { p: 0, c: 0, total: 0 };
    for (const r of rows) {
      if (!map[r.category]) map[r.category] = { p: 0, c: 0, total: 0 };
      map[r.category].total++;
      if (r.status === "completed") map[r.category].c++;
      else map[r.category].p++;
    }
    return map;
  }, [rows, categories]);

  const stats = useMemo(() => {
    const scope = activeCat === ALL ? rows : rows.filter((r) => r.category === activeCat);
    const total = scope.length;
    const done = scope.filter((r) => r.status === "completed").length;
    const inProg = scope.filter((r) => r.status === "in_progress").length;
    const pend = scope.filter((r) => r.status === "pending").length;
    const overdue = scope.filter((r) => r.due_date && r.status !== "completed" && daysDiff(r.due_date) < 0).length;
    const todayDue = scope.filter((r) => r.due_date && r.status !== "completed" && daysDiff(r.due_date) === 0).length;
    const urgent = scope.filter((r) => r.priority === "urgent" && r.status !== "completed").length;
    const progress = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inProg, pend, overdue, todayDue, urgent, progress };
  }, [rows, activeCat, todayStr]);

  const startEdit = (r: Row) => {
    setForm({
      id: r.id,
      category: r.category,
      title: r.title,
      customer_name: r.customer_name || "",
      account_number: r.account_number || "",
      mobile: r.mobile || "",
      description: r.description || "",
      priority: r.priority,
      status: r.status,
      assigned_to: r.assigned_to || "",
      entry_date: r.entry_date,
      due_date: r.due_date || "",
      remarks: r.remarks || "",
    });
    setShowForm(true);
  };

  const currentCat = categories.find((c) => c.slug === activeCat);
  const lbl = (c: Category) => (lang === "bn" ? c.name_bn : c.name_en);

  const saveCat = useMutation({
    mutationFn: async (c: Partial<Category>) => {
      const payload = {
        slug: c.slug || slugify(c.name_en || c.name_bn || ""),
        name_bn: c.name_bn || c.name_en || "",
        name_en: c.name_en || c.name_bn || "",
        sort_order: c.sort_order ?? (categories.length + 1) * 10,
      };
      if (c.id) {
        const { error } = await supabase.from("pending_categories" as any).update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pending_categories" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_categories"] });
      toast.success(lang === "bn" ? "সংরক্ষণ হয়েছে" : "Saved");
      setEditingCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pending_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending_categories"] });
      toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {lang === "bn" ? "পেন্ডিং কাজ ব্যবস্থাপনা" : "Pending Works Management"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {lang === "bn" ? "প্রতিদিনের পেন্ডিং কাজ ট্র্যাক, এডিট, কমপ্লিট ও প্রিন্ট করুন" : "Track, edit, complete and print daily pending works"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setManageOpen(true)}><Settings2 className="w-4 h-4 mr-1" />{lang === "bn" ? "ক্যাটাগরি" : "Categories"}</Button>
          <Button variant="outline" onClick={() => exportCSV(filtered, `pending-${activeCat}`)}><Download className="w-4 h-4 mr-1" />CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          <Button onClick={() => { setForm(empty(activeCat === ALL ? (categories[0]?.slug || "") : activeCat)); setShowForm(true); }}><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন পেন্ডিং" : "New Pending"}</Button>
        </div>
      </div>

      {/* Smart Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        <Card className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{lang === "bn" ? "মোট" : "Total"}</span><ListTodo className="w-4 h-4 text-primary" /></div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{lang === "bn" ? "পেন্ডিং" : "Pending"}</span><Clock className="w-4 h-4 text-muted-foreground" /></div>
          <div className="text-2xl font-bold mt-1">{stats.pend}</div>
        </Card>
        <Card className="p-3 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{lang === "bn" ? "চলমান" : "In Progress"}</span><TrendingUp className="w-4 h-4 text-amber-600" /></div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{stats.inProg}</div>
        </Card>
        <Card className="p-3 bg-green-500/5 border-green-500/20">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{lang === "bn" ? "সম্পন্ন" : "Done"}</span><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
          <div className="text-2xl font-bold mt-1 text-green-600">{stats.done}</div>
        </Card>
        <Card className="p-3 bg-destructive/5 border-destructive/20">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{lang === "bn" ? "মেয়াদোত্তীর্ণ" : "Overdue"}</span><AlertTriangle className="w-4 h-4 text-destructive" /></div>
          <div className="text-2xl font-bold mt-1 text-destructive">{stats.overdue}</div>
        </Card>
        <Card className="p-3 bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{lang === "bn" ? "আজকের" : "Due Today"}</span><CalendarClock className="w-4 h-4 text-blue-600" /></div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{stats.todayDue}</div>
        </Card>
      </div>

      {/* Progress bar */}
      <Card className="p-3 no-print">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">{lang === "bn" ? "অগ্রগতি" : "Completion Progress"}</span>
          <span className="text-muted-foreground">{stats.done}/{stats.total} ({stats.progress}%)</span>
        </div>
        <Progress value={stats.progress} className="h-2" />
      </Card>

      <Tabs value={activeCat} onValueChange={(v) => { setActiveCat(v); setForm(empty(v === ALL ? (categories[0]?.slug || "") : v)); }} className="no-print">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value={ALL} className="text-xs"><LayoutGrid className="w-3 h-3 mr-1" />{lang === "bn" ? "সব" : "All"}</TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c.slug} value={c.slug} className="text-xs">
              {lbl(c)}
              {counts[c.slug]?.p > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-[10px]">{counts[c.slug].p}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showForm && (
        <Card className="p-4 sm:p-6 no-print border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{form.id ? (lang === "bn" ? "এডিট" : "Edit") : (lang === "bn" ? "নতুন এন্ট্রি" : "New Entry")}{currentCat ? ` — ${lbl(currentCat)}` : ""}</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><Label>{lang === "bn" ? "কাজের শিরোনাম *" : "Task Title *"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "কাস্টমার নাম" : "Customer Name"}</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "অ্যাকাউন্ট নং" : "Account Number"}</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "মোবাইল" : "Mobile"}</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "দায়িত্বপ্রাপ্ত" : "Assigned To"}</Label><Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} /></div>
            <div>
              <Label>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{lang === "bn" ? "নিম্ন" : "Low"}</SelectItem>
                  <SelectItem value="normal">{lang === "bn" ? "সাধারণ" : "Normal"}</SelectItem>
                  <SelectItem value="high">{lang === "bn" ? "উচ্চ" : "High"}</SelectItem>
                  <SelectItem value="urgent">{lang === "bn" ? "জরুরি" : "Urgent"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{lang === "bn" ? "এন্ট্রি তারিখ" : "Entry Date"}</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "শেষ তারিখ" : "Due Date"}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div>
              <Label>{lang === "bn" ? "অবস্থা" : "Status"}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{lang === "bn" ? "পেন্ডিং" : "Pending"}</SelectItem>
                  <SelectItem value="in_progress">{lang === "bn" ? "চলমান" : "In Progress"}</SelectItem>
                  <SelectItem value="completed">{lang === "bn" ? "সম্পন্ন" : "Completed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "বিবরণ" : "Description"}</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "মন্তব্য" : "Remarks"}</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => { if (!form.title) { toast.error(lang === "bn" ? "শিরোনাম লিখুন" : "Enter title"); return; } save.mutate(form); }} disabled={save.isPending}>{form.id ? (lang === "bn" ? "আপডেট" : "Update") : (lang === "bn" ? "সংরক্ষণ" : "Save")}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{lang === "bn" ? "বাতিল" : "Cancel"}</Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap no-print items-center">
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={lang === "bn" ? "নাম/অ্যাকাউন্ট/মোবাইল/বিবরণ" : "Search title/customer/account/mobile/desc"} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "bn" ? "সকল অবস্থা" : "All Status"}</SelectItem>
            <SelectItem value="pending">{lang === "bn" ? "পেন্ডিং" : "Pending"}</SelectItem>
            <SelectItem value="in_progress">{lang === "bn" ? "চলমান" : "In Progress"}</SelectItem>
            <SelectItem value="completed">{lang === "bn" ? "সম্পন্ন" : "Completed"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "bn" ? "সকল অগ্রাধিকার" : "All Priority"}</SelectItem>
            <SelectItem value="urgent">{lang === "bn" ? "জরুরি" : "Urgent"}</SelectItem>
            <SelectItem value="high">{lang === "bn" ? "উচ্চ" : "High"}</SelectItem>
            <SelectItem value="normal">{lang === "bn" ? "সাধারণ" : "Normal"}</SelectItem>
            <SelectItem value="low">{lang === "bn" ? "নিম্ন" : "Low"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dueFilter} onValueChange={setDueFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "bn" ? "সকল ডেডলাইন" : "All Due"}</SelectItem>
            <SelectItem value="overdue">{lang === "bn" ? "মেয়াদোত্তীর্ণ" : "Overdue"}</SelectItem>
            <SelectItem value="today">{lang === "bn" ? "আজকের" : "Due Today"}</SelectItem>
            <SelectItem value="week">{lang === "bn" ? "৭ দিনের মধ্যে" : "Within 7 days"}</SelectItem>
            <SelectItem value="none">{lang === "bn" ? "ডেডলাইন নেই" : "No deadline"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="entry_desc">{lang === "bn" ? "নতুন আগে" : "Newest first"}</SelectItem>
            <SelectItem value="entry_asc">{lang === "bn" ? "পুরোনো আগে" : "Oldest first"}</SelectItem>
            <SelectItem value="due_asc">{lang === "bn" ? "ডেডলাইন কাছাকাছি" : "Due soonest"}</SelectItem>
            <SelectItem value="priority">{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all" || priorityFilter !== "all" || dueFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setDueFilter("all"); }}>
            <X className="w-3 h-3 mr-1" />{lang === "bn" ? "ক্লিয়ার" : "Clear"}
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1"><Filter className="w-3 h-3" />{filtered.length} {lang === "bn" ? "টি" : "results"}</div>
      </div>

      <Card className="overflow-hidden print-area">
        <div className="hidden print:block p-4 text-center border-b">
          <div className="font-bold text-lg">{t("bankName")}</div>
          <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          <div className="font-semibold mt-2">{activeCat === ALL ? (lang === "bn" ? "সব ক্যাটাগরি" : "All Categories") : (currentCat ? lbl(currentCat) : "")}</div>
          <div className="text-xs mt-1">{new Date().toLocaleString()}</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{lang === "bn" ? "শিরোনাম" : "Title"}</TableHead>
                {activeCat === ALL && <TableHead>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</TableHead>}
                <TableHead>{lang === "bn" ? "কাস্টমার" : "Customer"}</TableHead>
                <TableHead>{lang === "bn" ? "অ্যাকাউন্ট" : "Account"}</TableHead>
                <TableHead>{lang === "bn" ? "মোবাইল" : "Mobile"}</TableHead>
                <TableHead>{lang === "bn" ? "এন্ট্রি" : "Entry"}</TableHead>
                <TableHead>{lang === "bn" ? "ডেডলাইন" : "Due"}</TableHead>
                <TableHead>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</TableHead>
                <TableHead>{lang === "bn" ? "অবস্থা" : "Status"}</TableHead>
                <TableHead className="no-print text-right">{lang === "bn" ? "অ্যাকশন" : "Action"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={11} className="text-center py-6">{t("loading")}</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</TableCell></TableRow>}
              {filtered.map((r, i) => {
                const d = r.due_date ? daysDiff(r.due_date) : null;
                const isOverdue = d !== null && d < 0 && r.status !== "completed";
                const isToday = d === 0 && r.status !== "completed";
                const rowClass = isOverdue ? "bg-destructive/5" : isToday ? "bg-amber-500/5" : "";
                const catLbl = categories.find((c) => c.slug === r.category);
                return (
                <TableRow key={r.id} className={rowClass}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div>{r.title}</div>
                    {r.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.description}</div>}
                  </TableCell>
                  {activeCat === ALL && <TableCell><Badge variant="outline" className="text-[10px]">{catLbl ? lbl(catLbl) : r.category}</Badge></TableCell>}
                  <TableCell>{r.customer_name || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.account_number || "-"}</TableCell>
                  <TableCell>
                    {r.mobile ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{r.mobile}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 no-print" onClick={() => { navigator.clipboard.writeText(r.mobile!); toast.success(lang === "bn" ? "কপি হয়েছে" : "Copied"); }}><Copy className="w-3 h-3" /></Button>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{r.entry_date}</TableCell>
                  <TableCell className="text-xs">
                    {r.due_date ? (
                      <div>
                        <div>{r.due_date}</div>
                        {r.status !== "completed" && d !== null && (
                          <Badge variant={isOverdue ? "destructive" : isToday ? "default" : "secondary"} className="text-[10px] h-4 px-1">
                            {isOverdue ? `${Math.abs(d)}${lang === "bn" ? " দিন বিলম্ব" : "d late"}` : isToday ? (lang === "bn" ? "আজ" : "Today") : `${d}${lang === "bn" ? " দিন" : "d"}`}
                          </Badge>
                        )}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell><Badge variant={r.priority === "urgent" ? "destructive" : r.priority === "high" ? "default" : "secondary"}>{r.priority}</Badge></TableCell>
                  <TableCell>
                    {r.status === "completed" ? <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />{lang === "bn" ? "সম্পন্ন" : "Done"}</Badge>
                      : r.status === "in_progress" ? <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" />{lang === "bn" ? "চলমান" : "Progress"}</Badge>
                      : <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{lang === "bn" ? "পেন্ডিং" : "Pending"}</Badge>}
                  </TableCell>
                  <TableCell className="no-print text-right whitespace-nowrap">
                    {r.mobile && <>
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Call"><a href={`tel:${r.mobile}`}><Phone className="w-3.5 h-3.5 text-blue-600" /></a></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="WhatsApp"><a href={`https://wa.me/${r.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(r.title)}`} target="_blank" rel="noreferrer"><MessageCircle className="w-3.5 h-3.5 text-green-600" /></a></Button>
                    </>}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleStatus.mutate(r)} title={r.status === "completed" ? "Mark pending" : "Mark complete"}>
                      <CheckCircle2 className={`w-4 h-4 ${r.status === "completed" ? "text-green-600" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm(lang === "bn" ? "মুছবেন?" : "Delete?")) del.mutate(r.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={manageOpen} onOpenChange={(o) => { setManageOpen(o); if (!o) setEditingCat(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "ক্যাটাগরি ব্যবস্থাপনা" : "Manage Categories"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2 border rounded">
                <div className="flex-1 text-sm">
                  <div className="font-medium">{c.name_bn}</div>
                  <div className="text-xs text-muted-foreground">{c.name_en}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditingCat(c)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  if (confirm(lang === "bn" ? "এই ক্যাটাগরি মুছবেন? (এতে থাকা পেন্ডিং কাজগুলো থেকে যাবে)" : "Delete this category? (Existing pending works remain)")) {
                    delCat.mutate(c.id);
                  }
                }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="font-semibold text-sm">{editingCat?.id ? (lang === "bn" ? "এডিট" : "Edit") : (lang === "bn" ? "নতুন ক্যাটাগরি" : "New Category")}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{lang === "bn" ? "বাংলা নাম" : "Bangla Name"}</Label>
                <Input value={editingCat?.name_bn || ""} onChange={(e) => setEditingCat({ ...(editingCat || {}), name_bn: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{lang === "bn" ? "ইংরেজি নাম" : "English Name"}</Label>
                <Input value={editingCat?.name_en || ""} onChange={(e) => setEditingCat({ ...(editingCat || {}), name_en: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{lang === "bn" ? "ক্রম" : "Sort Order"}</Label>
                <Input type="number" value={editingCat?.sort_order ?? ""} onChange={(e) => setEditingCat({ ...(editingCat || {}), sort_order: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            {editingCat && <Button variant="outline" onClick={() => setEditingCat(null)}>{lang === "bn" ? "বাতিল" : "Cancel"}</Button>}
            <Button onClick={() => {
              if (!editingCat?.name_bn && !editingCat?.name_en) { toast.error(lang === "bn" ? "নাম লিখুন" : "Enter name"); return; }
              saveCat.mutate(editingCat || {});
            }} disabled={saveCat.isPending}>
              {editingCat?.id ? (lang === "bn" ? "আপডেট" : "Update") : (lang === "bn" ? "যোগ" : "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
