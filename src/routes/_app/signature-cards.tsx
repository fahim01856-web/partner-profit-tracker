import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { FileSignature, Search, Upload, Trash2, Pencil, Printer, Save, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_app/signature-cards")({ component: SignatureCardsPage });

type Card = {
  id: string;
  account_number: string;
  customer_name: string;
  mobile: string | null;
  image_path: string;
  note: string | null;
};

function SignatureCardsPage() {
  const { lang, t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    id: null as string | null,
    account_number: "",
    customer_name: "",
    mobile: "",
    note: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Card | null>(null);

  const { data: cards = [] } = useQuery({
    queryKey: ["signature_cards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signature_cards").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Card[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.account_number.toLowerCase().includes(q) || c.customer_name.toLowerCase().includes(q));
  }, [cards, search]);

  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const need = filtered.filter((c) => !imgUrls[c.id]);
    if (need.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(need.map(async (c) => {
        const { data } = await supabase.storage.from("signature-cards").createSignedUrl(c.image_path, 3600);
        if (data?.signedUrl) updates[c.id] = data.signedUrl;
      }));
      if (Object.keys(updates).length) setImgUrls((p) => ({ ...p, ...updates }));
    })();
  }, [filtered]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.account_number.trim() || !form.customer_name.trim()) throw new Error(lang === "bn" ? "অ্যাকাউন্ট নং ও নাম লিখুন" : "Account no & name required");
      let image_path = "";
      if (form.id) {
        const existing = cards.find((c) => c.id === form.id);
        image_path = existing?.image_path ?? "";
      }
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${Date.now()}-${form.account_number.replace(/[^a-zA-Z0-9]/g, "")}.${ext}`;
        const { error: upErr } = await supabase.storage.from("signature-cards").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        // delete old if editing
        if (form.id && image_path) await supabase.storage.from("signature-cards").remove([image_path]);
        image_path = path;
      }
      if (!image_path) throw new Error(lang === "bn" ? "সাইন কার্ডের ছবি দিন" : "Please upload an image");
      const payload = {
        account_number: form.account_number.trim(),
        customer_name: form.customer_name.trim(),
        mobile: form.mobile.trim() || null,
        note: form.note.trim() || null,
        image_path,
      };
      if (form.id) {
        const { error } = await supabase.from("signature_cards").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("signature_cards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature_cards"] });
      toast.success(t("save") + " ✓");
      setForm({ id: null, account_number: "", customer_name: "", mobile: "", note: "" });
      setFile(null);
      setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const del = useMutation({
    mutationFn: async (c: Card) => {
      await supabase.storage.from("signature-cards").remove([c.image_path]);
      const { error } = await supabase.from("signature_cards").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature_cards"] });
      toast.success(t("deleted"));
    },
  });

  const startEdit = (c: Card) => {
    setForm({ id: c.id, account_number: c.account_number, customer_name: c.customer_name, mobile: c.mobile ?? "", note: c.note ?? "" });
    setFile(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileSignature className="w-6 h-6 text-primary" /> {lang === "bn" ? "সিগনেচার কার্ড সিস্টেম" : "Signature Card System"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "অ্যাকাউন্ট নম্বর দিয়ে সার্চ, দেখা ও প্রিন্ট" : "Search by account number, view & print"}</p>
        </div>
        <Button onClick={() => { setShowForm(true); setForm({ id: null, account_number: "", customer_name: "", mobile: "", note: "" }); setFile(null); }}>
          <Plus className="w-4 h-4" /> {lang === "bn" ? "নতুন কার্ড" : "New Card"}
        </Button>
      </div>

      <Card className="p-3 no-print">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={lang === "bn" ? "অ্যাকাউন্ট নম্বর বা নাম দিয়ে সার্চ করুন..." : "Search by account number or name..."} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {showForm && (
        <Card className="p-4 no-print">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{form.id ? t("edit") : (lang === "bn" ? "নতুন সিগনেচার কার্ড" : "New Signature Card")}</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>{lang === "bn" ? "অ্যাকাউন্ট নম্বর" : "Account Number"} *</Label>
              <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
            <div>
              <Label>{lang === "bn" ? "কাস্টমার নাম" : "Customer Name"} *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>{lang === "bn" ? "মোবাইল" : "Mobile"}</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <Label>{lang === "bn" ? "সাইন কার্ডের ছবি" : "Signature Card Image"} {!form.id && "*"}</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {form.id && <p className="text-[11px] text-muted-foreground mt-1">{lang === "bn" ? "ছবি না বদলালে পুরোনোটাই থাকবে" : "Leave empty to keep current image"}</p>}
            </div>
            <div className="md:col-span-2">
              <Label>{t("note")}</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t("cancel_edit")}</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="w-4 h-4" /> {form.id ? t("update") : t("save")}</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground col-span-full">{lang === "bn" ? "কোনো সিগনেচার কার্ড পাওয়া যায়নি" : "No signature cards found"}</Card>
        )}
        {filtered.map((c) => (
          <Card key={c.id} className="p-3 flex flex-col gap-2">
            <button onClick={() => setPreview(c)} className="aspect-[4/3] w-full bg-muted rounded overflow-hidden">
              {imgUrls[c.id] ? <img src={imgUrls[c.id]} alt={c.customer_name} className="w-full h-full object-contain" /> : <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">{t("loading")}</div>}
            </button>
            <div>
              <div className="font-semibold text-sm truncate">{c.customer_name}</div>
              <div className="text-xs text-muted-foreground">A/C: {c.account_number}</div>
              {c.mobile && <div className="text-xs text-muted-foreground">📱 {c.mobile}</div>}
            </div>
            <div className="flex gap-1 no-print">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(c)}><Search className="w-3.5 h-3.5" /> {lang === "bn" ? "দেখুন" : "View"}</Button>
              <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) del.mutate(c); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
            </div>
          </Card>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white" onClick={() => setPreview(null)}>
          <div className="bg-white max-w-2xl w-full rounded-lg overflow-hidden print:rounded-none print:max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between no-print">
              <div>
                <div className="font-bold">{preview.customer_name}</div>
                <div className="text-xs text-muted-foreground">A/C: {preview.account_number}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("print")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="p-4">
              <div className="print-block text-center mb-3 hidden print:block">
                <div className="font-bold text-lg">{preview.customer_name}</div>
                <div className="text-sm">A/C: {preview.account_number}</div>
                {preview.mobile && <div className="text-sm">Mobile: {preview.mobile}</div>}
              </div>
              {imgUrls[preview.id] && <img src={imgUrls[preview.id]} alt={preview.customer_name} className="w-full max-h-[70vh] object-contain" />}
              {preview.note && <p className="mt-3 text-sm text-muted-foreground">{preview.note}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
