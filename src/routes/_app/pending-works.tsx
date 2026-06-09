import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Printer, Plus, Trash2, Pencil, CheckCircle2, Clock, X, ClipboardList, Settings2 } from "lucide-react";
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
  const [form, setForm] = useState(empty(""));
  const [showForm, setShowForm] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);

  // Pick first category when loaded
  if (!activeCat && categories.length > 0) {
    setActiveCat(categories[0].slug);
  }

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

  const filtered = useMemo(() => {
    return rows
      .filter((r) => r.category === activeCat)
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.customer_name || "").toLowerCase().includes(q) ||
          (r.account_number || "").toLowerCase().includes(q) ||
          (r.mobile || "").toLowerCase().includes(q)
        );
      });
  }, [rows, activeCat, statusFilter, search]);

  const counts = useMemo(() => {
    const map: Record<string, { p: number; c: number }> = {};
    for (const c of CATEGORIES) map[c.id] = { p: 0, c: 0 };
    for (const r of rows) {
      if (!map[r.category]) map[r.category] = { p: 0, c: 0 };
      if (r.status === "completed") map[r.category].c++;
      else map[r.category].p++;
    }
    return map;
  }, [rows]);

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

  const currentCat = CATEGORIES.find((c) => c.id === activeCat)!;
  const lbl = (c: typeof CATEGORIES[number]) => (lang === "bn" ? c.bn : c.en);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          <Button onClick={() => { setForm(empty(activeCat)); setShowForm(true); }}><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন পেন্ডিং" : "New Pending"}</Button>
        </div>
      </div>

      <Tabs value={activeCat} onValueChange={(v) => { setActiveCat(v); setForm(empty(v)); }} className="no-print">
        <TabsList className="flex flex-wrap h-auto justify-start">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs">
              {lbl(c)}
              {counts[c.id]?.p > 0 && <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-[10px]">{counts[c.id].p}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showForm && (
        <Card className="p-4 sm:p-6 no-print border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{form.id ? (lang === "bn" ? "এডিট" : "Edit") : (lang === "bn" ? "নতুন এন্ট্রি" : "New Entry")} — {lbl(currentCat)}</h3>
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

      <div className="flex gap-2 flex-wrap no-print">
        <Input placeholder={lang === "bn" ? "নাম/অ্যাকাউন্ট/মোবাইল খুঁজুন" : "Search name/account/mobile"} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === "bn" ? "সকল অবস্থা" : "All Status"}</SelectItem>
            <SelectItem value="pending">{lang === "bn" ? "পেন্ডিং" : "Pending"}</SelectItem>
            <SelectItem value="in_progress">{lang === "bn" ? "চলমান" : "In Progress"}</SelectItem>
            <SelectItem value="completed">{lang === "bn" ? "সম্পন্ন" : "Completed"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden print-area">
        <div className="hidden print:block p-4 text-center border-b">
          <div className="font-bold text-lg">{t("bankName")}</div>
          <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          <div className="font-semibold mt-2">{lbl(currentCat)}</div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{lang === "bn" ? "শিরোনাম" : "Title"}</TableHead>
                <TableHead>{lang === "bn" ? "কাস্টমার" : "Customer"}</TableHead>
                <TableHead>{lang === "bn" ? "অ্যাকাউন্ট" : "Account"}</TableHead>
                <TableHead>{lang === "bn" ? "মোবাইল" : "Mobile"}</TableHead>
                <TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead>
                <TableHead>{lang === "bn" ? "অগ্রাধিকার" : "Priority"}</TableHead>
                <TableHead>{lang === "bn" ? "অবস্থা" : "Status"}</TableHead>
                <TableHead className="no-print text-right">{lang === "bn" ? "অ্যাকশন" : "Action"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-6">{t("loading")}</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</TableCell></TableRow>}
              {filtered.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.customer_name || "-"}</TableCell>
                  <TableCell>{r.account_number || "-"}</TableCell>
                  <TableCell>{r.mobile || "-"}</TableCell>
                  <TableCell>{r.entry_date}</TableCell>
                  <TableCell><Badge variant={r.priority === "urgent" ? "destructive" : r.priority === "high" ? "default" : "secondary"}>{r.priority}</Badge></TableCell>
                  <TableCell>
                    {r.status === "completed" ? <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />{lang === "bn" ? "সম্পন্ন" : "Done"}</Badge>
                      : r.status === "in_progress" ? <Badge className="bg-amber-500"><Clock className="w-3 h-3 mr-1" />{lang === "bn" ? "চলমান" : "Progress"}</Badge>
                      : <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{lang === "bn" ? "পেন্ডিং" : "Pending"}</Badge>}
                  </TableCell>
                  <TableCell className="no-print text-right">
                    <Button size="icon" variant="ghost" onClick={() => toggleStatus.mutate(r)} title={r.status === "completed" ? "Mark pending" : "Mark complete"}>
                      <CheckCircle2 className={`w-4 h-4 ${r.status === "completed" ? "text-green-600" : ""}`} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(lang === "bn" ? "মুছবেন?" : "Delete?")) del.mutate(r.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
