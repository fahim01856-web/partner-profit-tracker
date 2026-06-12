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

  const filtered = useMemo(() => docs.filter((d) => d.category === activeCat), [docs, activeCat]);
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
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          <Button onClick={() => { setEditingId(null); setForm({ title: "", description: "", expiry_date: "", uploaded_by: "" }); setFile(null); setShowForm(true); }} disabled={!activeCat}><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন ডকুমেন্ট" : "New Document"}</Button>
        </div>
      </div>

      <Tabs value={activeCat} onValueChange={setActiveCat} className="no-print">
        <TabsList className="flex flex-wrap h-auto justify-start">
          {categories.map((c) => <TabsTrigger key={c.slug} value={c.slug} className="text-xs">{lbl(c)}</TabsTrigger>)}
        </TabsList>
      </Tabs>

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
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{lang === "bn" ? "শিরোনাম" : "Title"}</TableHead><TableHead>{lang === "bn" ? "ফাইল" : "File"}</TableHead><TableHead>{lang === "bn" ? "মেয়াদ শেষ" : "Expiry"}</TableHead><TableHead>{lang === "bn" ? "আপলোডকারী" : "Uploaded By"}</TableHead><TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead><TableHead className="no-print"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো ডকুমেন্ট নেই" : "No documents"}</TableCell></TableRow>}
            {filtered.map((d, i) => (
              <TableRow key={d.id}>
                <TableCell>{i + 1}</TableCell><TableCell className="font-medium">{d.title}</TableCell>
                <TableCell>{d.file_url ? <button type="button" onClick={() => handleView(d)} className="text-primary inline-flex items-center gap-1 hover:underline">{d.file_name || "View"} <ExternalLink className="w-3 h-3" /></button> : "-"}</TableCell>
                <TableCell>{d.expiry_date || "-"}</TableCell><TableCell>{d.uploaded_by || "-"}</TableCell><TableCell>{d.created_at.slice(0, 10)}</TableCell>
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
