import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Pencil, Printer, ExternalLink, Plus, X, Download, Settings2, Search, FileSpreadsheet, AlertTriangle, CheckCircle2, Files, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/documents")({ component: DocumentsPage });

type Category = { id: string; slug: string; name_bn: string; name_en: string; sort_order: number };
type Doc = { id: string; category: string; title: string; file_url: string | null; file_name: string | null; description: string | null; expiry_date: string | null; uploaded_by: string | null; created_at: string };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `cat_${Date.now()}`;
}

function DocumentsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [activeCat, setActiveCat] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", expiry_date: "", uploaded_by: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [search, setSearch] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "soon" | "valid" | "none">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "expiry">("newest");

  const { data: categories = [] } = useQuery({
    queryKey: ["document_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_categories" as any).select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Category[];
    },
  });

  useEffect(() => {
    if (!activeCat && categories.length > 0) setActiveCat(categories[0].slug);
  }, [activeCat, categories]);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Doc[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title) throw new Error(lang === "bn" ? "শিরোনাম দিন" : "Title required");
      if (!activeCat) throw new Error(lang === "bn" ? "ক্যাটাগরি নেই" : "No category");
      setUploading(true);
      let file_url: string | null = null;
      let file_name: string | null = null;
      if (file) {
        const path = `${activeCat}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        file_url = path;
        file_name = file.name;
      }
      const payload: any = {
        category: activeCat, title: form.title, description: form.description || null,
        expiry_date: form.expiry_date || null, uploaded_by: form.uploaded_by || null,
      };
      if (file_url) { payload.file_url = file_url; payload.file_name = file_name; }
      if (editingId) {
        const { error } = await supabase.from("documents" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success(lang === "bn" ? "সংরক্ষণ হয়েছে" : "Saved");
      setForm({ title: "", description: "", expiry_date: "", uploaded_by: "" });
      setFile(null); setShowForm(false); setEditingId(null); setUploading(false);
    },
    onError: (e: any) => { toast.error(e.message); setUploading(false); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("documents" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const startEdit = (d: Doc) => {
    setEditingId(d.id);
    setForm({ title: d.title, description: d.description || "", expiry_date: d.expiry_date || "", uploaded_by: d.uploaded_by || "" });
    setShowForm(true);
  };

  const toStoragePath = (val: string) => {
    const marker = "/documents/";
    const idx = val.indexOf(marker);
    return idx >= 0 ? val.substring(idx + marker.length) : val;
  };
  const getSignedUrl = async (val: string) => {
    const path = toStoragePath(val);
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) throw error || new Error("signed url failed");
    return data.signedUrl;
  };
  const handleView = async (d: Doc) => {
    if (!d.file_url) return;
    try {
      const url = await getSignedUrl(d.file_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch { toast.error(lang === "bn" ? "ফাইল খোলা যায়নি" : "Could not open file"); }
  };
  const handleDownload = async (d: Doc) => {
    if (!d.file_url) return;
    try {
      const signed = await getSignedUrl(d.file_url);
      const res = await fetch(signed);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = d.file_name || d.title;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(lang === "bn" ? "ডাউনলোড শুরু হয়েছে" : "Download started");
    } catch { toast.error(lang === "bn" ? "ডাউনলোড ব্যর্থ" : "Download failed"); }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const soonDate = new Date(); soonDate.setDate(soonDate.getDate() + 30);
  const soonStr = soonDate.toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = docs.filter((d) => activeCat === "__all__" || d.category === activeCat);
    if (q) {
      list = list.filter((d) =>
        [d.title, d.description, d.uploaded_by, d.file_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    if (expiryFilter !== "all") {
      list = list.filter((d) => {
        if (expiryFilter === "none") return !d.expiry_date;
        if (!d.expiry_date) return false;
        if (expiryFilter === "expired") return d.expiry_date < todayStr;
        if (expiryFilter === "soon") return d.expiry_date >= todayStr && d.expiry_date <= soonStr;
        if (expiryFilter === "valid") return d.expiry_date > soonStr;
        return true;
      });
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sortBy === "expiry") return (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999");
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [docs, activeCat, search, expiryFilter, sortBy, todayStr, soonStr]);

  const stats = useMemo(() => {
    const scope = docs.filter((d) => activeCat === "__all__" || d.category === activeCat);
    return {
      total: scope.length,
      withFile: scope.filter((d) => d.file_url).length,
      expired: scope.filter((d) => d.expiry_date && d.expiry_date < todayStr).length,
      soon: scope.filter((d) => d.expiry_date && d.expiry_date >= todayStr && d.expiry_date <= soonStr).length,
    };
  }, [docs, activeCat, todayStr, soonStr]);

  const catName = (slug: string) => {
    const c = categories.find((x) => x.slug === slug);
    return c ? (lang === "bn" ? c.name_bn : c.name_en) : slug;
  };

  const exportCSV = () => {
    const rows = [
      ["#", lang === "bn" ? "ক্যাটাগরি" : "Category", lang === "bn" ? "শিরোনাম" : "Title", lang === "bn" ? "ফাইল" : "File", lang === "bn" ? "মেয়াদ শেষ" : "Expiry", lang === "bn" ? "আপলোডকারী" : "Uploaded By", lang === "bn" ? "তারিখ" : "Date", lang === "bn" ? "বিবরণ" : "Description"],
      ...filtered.map((d, i) => [i + 1, catName(d.category), d.title, d.file_name || "", d.expiry_date || "", d.uploaded_by || "", d.created_at.slice(0, 10), (d.description || "").replace(/\n/g, " ")]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `documents_${todayStr}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
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
        const { error } = await supabase.from("document_categories" as any).update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("document_categories" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document_categories"] });
      toast.success(lang === "bn" ? "সংরক্ষণ হয়েছে" : "Saved");
      setEditingCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document_categories"] });
      toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />{lang === "bn" ? "ডকুমেন্ট ম্যানেজমেন্ট" : "Document Management"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "গুরুত্বপূর্ণ ফাইল আপলোড, এডিট ও প্রিন্ট" : "Upload, edit & print important documents"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setManageOpen(true)}><Settings2 className="w-4 h-4 mr-1" />{lang === "bn" ? "ক্যাটাগরি" : "Categories"}</Button>
          <Button variant="outline" onClick={exportCSV}><FileSpreadsheet className="w-4 h-4 mr-1" />CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          <Button onClick={() => { setEditingId(null); setForm({ title: "", description: "", expiry_date: "", uploaded_by: "" }); setFile(null); setShowForm(true); }} disabled={!activeCat || activeCat === "__all__"}><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন ডকুমেন্ট" : "New Document"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <Card className="p-3 flex items-center gap-3"><div className="p-2 rounded-md bg-primary/10"><Files className="w-5 h-5 text-primary" /></div><div><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট" : "Total"}</div><div className="font-bold text-lg">{stats.total}</div></div></Card>
        <Card className="p-3 flex items-center gap-3"><div className="p-2 rounded-md bg-emerald-500/10"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div><div><div className="text-xs text-muted-foreground">{lang === "bn" ? "ফাইল সহ" : "With File"}</div><div className="font-bold text-lg">{stats.withFile}</div></div></Card>
        <Card className="p-3 flex items-center gap-3"><div className="p-2 rounded-md bg-amber-500/10"><Clock className="w-5 h-5 text-amber-600" /></div><div><div className="text-xs text-muted-foreground">{lang === "bn" ? "৩০ দিনে শেষ" : "Expiring 30d"}</div><div className="font-bold text-lg">{stats.soon}</div></div></Card>
        <Card className="p-3 flex items-center gap-3"><div className="p-2 rounded-md bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div><div><div className="text-xs text-muted-foreground">{lang === "bn" ? "মেয়াদ শেষ" : "Expired"}</div><div className="font-bold text-lg">{stats.expired}</div></div></Card>
      </div>

      <Tabs value={activeCat} onValueChange={setActiveCat} className="no-print">
        <TabsList className="flex flex-wrap h-auto justify-start">
          <TabsTrigger value="__all__" className="text-xs">{lang === "bn" ? "সব" : "All"}</TabsTrigger>
          {categories.map((c) => <TabsTrigger key={c.slug} value={c.slug} className="text-xs">{lbl(c)}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card className="p-3 no-print">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === "bn" ? "শিরোনাম, বিবরণ, ফাইল, আপলোডকারী..." : "Search title, description, file, uploader..."} className="pl-9" />
          </div>
          <Select value={expiryFilter} onValueChange={(v) => setExpiryFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "bn" ? "সব মেয়াদ" : "All expiry"}</SelectItem>
              <SelectItem value="expired">{lang === "bn" ? "মেয়াদ শেষ" : "Expired"}</SelectItem>
              <SelectItem value="soon">{lang === "bn" ? "৩০ দিনে শেষ" : "Expiring ≤30d"}</SelectItem>
              <SelectItem value="valid">{lang === "bn" ? "বৈধ" : "Valid"}</SelectItem>
              <SelectItem value="none">{lang === "bn" ? "মেয়াদ নেই" : "No expiry"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{lang === "bn" ? "নতুন আগে" : "Newest"}</SelectItem>
              <SelectItem value="oldest">{lang === "bn" ? "পুরাতন আগে" : "Oldest"}</SelectItem>
              <SelectItem value="title">{lang === "bn" ? "শিরোনাম (A-Z)" : "Title (A-Z)"}</SelectItem>
              <SelectItem value="expiry">{lang === "bn" ? "মেয়াদ (কাছের আগে)" : "Expiry (soonest)"}</SelectItem>
            </SelectContent>
          </Select>
          {(search || expiryFilter !== "all" || sortBy !== "newest") && (
            <Button variant="ghost" onClick={() => { setSearch(""); setExpiryFilter("all"); setSortBy("newest"); }}><X className="w-4 h-4 mr-1" />{lang === "bn" ? "রিসেট" : "Reset"}</Button>
          )}
        </div>
        {(search || expiryFilter !== "all") && (
          <div className="mt-2 text-xs text-muted-foreground">{lang === "bn" ? `${filtered.length} টি ফলাফল` : `${filtered.length} results`}</div>
        )}
      </Card>

      {showForm && currentCat && (
        <Card className="p-4 sm:p-6 no-print border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{editingId ? (lang === "bn" ? "এডিট" : "Edit") : (lang === "bn" ? "নতুন ডকুমেন্ট" : "New Document")} — {lbl(currentCat)}</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>{lang === "bn" ? "শিরোনাম *" : "Title *"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "আপলোডকারী" : "Uploaded By"}</Label><Input value={form.uploaded_by} onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "মেয়াদ শেষ" : "Expiry Date"}</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "ফাইল" : "File"}</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            <div className="sm:col-span-2"><Label>{lang === "bn" ? "বিবরণ" : "Description"}</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => save.mutate()} disabled={uploading}><Upload className="w-4 h-4 mr-1" />{uploading ? (lang === "bn" ? "আপলোড হচ্ছে..." : "Uploading...") : editingId ? (lang === "bn" ? "আপডেট" : "Update") : (lang === "bn" ? "সংরক্ষণ" : "Save")}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>{lang === "bn" ? "বাতিল" : "Cancel"}</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden print-area">
        <div className="hidden print:block p-4 text-center border-b">
          <div className="font-bold text-lg">{t("bankName")}</div>
          <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          <div className="font-semibold mt-2">{currentCat ? lbl(currentCat) : ""}</div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead>{activeCat === "__all__" && <TableHead>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</TableHead>}<TableHead>{lang === "bn" ? "শিরোনাম" : "Title"}</TableHead><TableHead>{lang === "bn" ? "ফাইল" : "File"}</TableHead><TableHead>{lang === "bn" ? "মেয়াদ শেষ" : "Expiry"}</TableHead><TableHead>{lang === "bn" ? "আপলোডকারী" : "Uploaded By"}</TableHead><TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead><TableHead className="no-print"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={activeCat === "__all__" ? 8 : 7} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো ডকুমেন্ট নেই" : "No documents"}</TableCell></TableRow>}
            {filtered.map((d, i) => {
              const isExpired = !!d.expiry_date && d.expiry_date < todayStr;
              const isSoon = !!d.expiry_date && !isExpired && d.expiry_date <= soonStr;
              return (
              <TableRow key={d.id} className={isExpired ? "bg-destructive/5" : isSoon ? "bg-amber-500/5" : ""}>
                <TableCell>{i + 1}</TableCell>
                {activeCat === "__all__" && <TableCell><Badge variant="outline" className="text-xs">{catName(d.category)}</Badge></TableCell>}
                <TableCell className="font-medium">{d.title}{d.description && <div className="text-xs text-muted-foreground line-clamp-1">{d.description}</div>}</TableCell>
                <TableCell>{d.file_url ? <button type="button" onClick={() => handleView(d)} className="text-primary inline-flex items-center gap-1 hover:underline">{d.file_name || "View"} <ExternalLink className="w-3 h-3" /></button> : "-"}</TableCell>
                <TableCell>{d.expiry_date ? <span className={isExpired ? "text-destructive font-medium" : isSoon ? "text-amber-600 font-medium" : ""}>{d.expiry_date}{isExpired && <Badge variant="destructive" className="ml-1 text-[10px]">{lang === "bn" ? "শেষ" : "Expired"}</Badge>}{isSoon && <Badge className="ml-1 text-[10px] bg-amber-500 hover:bg-amber-500">{lang === "bn" ? "শীঘ্রই" : "Soon"}</Badge>}</span> : "-"}</TableCell>
                <TableCell>{d.uploaded_by || "-"}</TableCell><TableCell>{d.created_at.slice(0, 10)}</TableCell>
                <TableCell className="no-print">
                  <div className="flex items-center gap-1">
                    {d.file_url && (
                      <Button size="icon" variant="ghost" onClick={() => handleDownload(d)} title={lang === "bn" ? "ডাউনলোড" : "Download"}><Download className="w-4 h-4 text-primary" /></Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => startEdit(d)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(lang === "bn" ? "মুছবেন?" : "Delete?")) del.mutate(d.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                  if (confirm(lang === "bn" ? "এই ক্যাটাগরি মুছবেন? (এতে থাকা ডকুমেন্ট থেকে যাবে)" : "Delete this category? (Existing documents remain)")) {
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
