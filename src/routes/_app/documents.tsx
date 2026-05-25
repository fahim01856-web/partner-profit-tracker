import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Pencil, Printer, ExternalLink, Plus, X, Download } from "lucide-react";

export const Route = createFileRoute("/_app/documents")({ component: DocumentsPage });

const DOC_CATEGORIES = [
  { id: "licence", bn: "লাইসেন্স কপি", en: "Licence Copy" },
  { id: "trade_licence", bn: "ট্রেড লাইসেন্স", en: "Trade Licence" },
  { id: "bank_authorization", bn: "ব্যাংক অথরাইজেশন", en: "Bank Authorization" },
  { id: "staff_docs", bn: "স্টাফ ডকুমেন্ট", en: "Staff Documents" },
  { id: "customer_docs", bn: "কাস্টমার ডকুমেন্ট", en: "Customer Documents" },
  { id: "other", bn: "অন্যান্য", en: "Others" },
];

type Doc = { id: string; category: string; title: string; file_url: string | null; file_name: string | null; description: string | null; expiry_date: string | null; uploaded_by: string | null; created_at: string };

function DocumentsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [activeCat, setActiveCat] = useState(DOC_CATEGORIES[0].id);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", expiry_date: "", uploaded_by: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
      setUploading(true);
      let file_url: string | null = null;
      let file_name: string | null = null;
      if (file) {
        const path = `${activeCat}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        // Store the storage path; signed URLs are generated on demand for view/download.
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

  const handleDownload = async (d: Doc) => {
    if (!d.file_url) return;
    try {
      const res = await fetch(d.file_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.file_name || d.title;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(lang === "bn" ? "ডাউনলোড শুরু হয়েছে" : "Download started");
    } catch {
      toast.error(lang === "bn" ? "ডাউনলোড ব্যর্থ" : "Download failed");
    }
  };

  const filtered = useMemo(() => docs.filter((d) => d.category === activeCat), [docs, activeCat]);
  const lbl = (c: typeof DOC_CATEGORIES[number]) => (lang === "bn" ? c.bn : c.en);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />{lang === "bn" ? "ডকুমেন্ট ম্যানেজমেন্ট" : "Document Management"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "গুরুত্বপূর্ণ ফাইল আপলোড, এডিট ও প্রিন্ট" : "Upload, edit & print important documents"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          <Button onClick={() => { setEditingId(null); setForm({ title: "", description: "", expiry_date: "", uploaded_by: "" }); setFile(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "নতুন ডকুমেন্ট" : "New Document"}</Button>
        </div>
      </div>

      <Tabs value={activeCat} onValueChange={setActiveCat} className="no-print">
        <TabsList className="flex flex-wrap h-auto">
          {DOC_CATEGORIES.map((c) => <TabsTrigger key={c.id} value={c.id} className="text-xs">{lbl(c)}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {showForm && (
        <Card className="p-4 sm:p-6 no-print border-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{editingId ? (lang === "bn" ? "এডিট" : "Edit") : (lang === "bn" ? "নতুন ডকুমেন্ট" : "New Document")} — {lbl(DOC_CATEGORIES.find((c) => c.id === activeCat)!)}</h3>
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
          <div className="font-semibold mt-2">{lbl(DOC_CATEGORIES.find((c) => c.id === activeCat)!)}</div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{lang === "bn" ? "শিরোনাম" : "Title"}</TableHead><TableHead>{lang === "bn" ? "ফাইল" : "File"}</TableHead><TableHead>{lang === "bn" ? "মেয়াদ শেষ" : "Expiry"}</TableHead><TableHead>{lang === "bn" ? "আপলোডকারী" : "Uploaded By"}</TableHead><TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead><TableHead className="no-print"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো ডকুমেন্ট নেই" : "No documents"}</TableCell></TableRow>}
            {filtered.map((d, i) => (
              <TableRow key={d.id}>
                <TableCell>{i + 1}</TableCell><TableCell className="font-medium">{d.title}</TableCell>
                <TableCell>{d.file_url ? <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">{d.file_name || "View"} <ExternalLink className="w-3 h-3" /></a> : "-"}</TableCell>
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
    </div>
  );
}
