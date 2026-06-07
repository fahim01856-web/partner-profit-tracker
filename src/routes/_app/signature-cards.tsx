import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  FileSignature, Search, Pencil, Printer, Save, Plus, X, Trash2,
  ZoomIn, ZoomOut, Maximize2, Minimize2, ShieldCheck, AlertCircle, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_app/signature-cards")({ component: SignatureCardsPage });

type SigCard = {
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

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mode, setMode] = useState<"verify" | "manage">("verify");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    id: null as string | null,
    account_number: "",
    customer_name: "",
    mobile: "",
    note: "",
  });
  const [file, setFile] = useState<File | null>(null);

  // Verification panel state
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const verifyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(id);
  }, [query]);

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["signature_cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SigCard[];
    },
  });

  // Verification: instant match on full or partial account number (prefer exact)
  const matched = useMemo<SigCard | null>(() => {
    if (!debounced) return null;
    const q = debounced.toLowerCase();
    const exact = cards.find((c) => c.account_number.toLowerCase() === q);
    if (exact) return exact;
    const partial = cards.find((c) => c.account_number.toLowerCase().includes(q));
    return partial ?? null;
  }, [cards, debounced]);

  const managedList = useMemo(() => {
    const q = debounced.toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.account_number.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q),
    );
  }, [cards, debounced]);

  // Signed URL cache
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const need = (mode === "verify" ? (matched ? [matched] : []) : managedList).filter(
      (c) => c && !imgUrls[c.id],
    );
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        need.map(async (c) => {
          const { data } = await supabase.storage
            .from("signature-cards")
            .createSignedUrl(c.image_path, 3600);
          if (data?.signedUrl) updates[c.id] = data.signedUrl;
        }),
      );
      if (!cancelled && Object.keys(updates).length) {
        setImgUrls((p) => ({ ...p, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matched, managedList, mode]);

  // Reset zoom when match changes
  useEffect(() => { setZoom(1); }, [matched?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.account_number.trim() || !form.customer_name.trim())
        throw new Error(lang === "bn" ? "অ্যাকাউন্ট নং ও নাম লিখুন" : "Account no & name required");
      let image_path = "";
      if (form.id) {
        const existing = cards.find((c) => c.id === form.id);
        image_path = existing?.image_path ?? "";
      }
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${Date.now()}-${form.account_number.replace(/[^a-zA-Z0-9]/g, "")}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("signature-cards")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        if (form.id && image_path)
          await supabase.storage.from("signature-cards").remove([image_path]);
        image_path = path;
      }
      if (!image_path)
        throw new Error(lang === "bn" ? "সাইন কার্ডের ছবি দিন" : "Please upload an image");
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
    mutationFn: async (c: SigCard) => {
      await supabase.storage.from("signature-cards").remove([c.image_path]);
      const { error } = await supabase.from("signature_cards").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature_cards"] });
      toast.success(t("deleted"));
    },
  });

  const startEdit = (c: SigCard) => {
    setForm({
      id: c.id,
      account_number: c.account_number,
      customer_name: c.customer_name,
      mobile: c.mobile ?? "",
      note: c.note ?? "",
    });
    setFile(null);
    setShowForm(true);
    setMode("manage");
  };

  const toggleFullscreen = async () => {
    try {
      if (!fullscreen) {
        await verifyRef.current?.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch { /* ignore */ }
  };
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {lang === "bn" ? "সিগনেচার ভেরিফিকেশন সিস্টেম" : "Signature Verification System"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {lang === "bn"
              ? "অ্যাকাউন্ট নম্বর দিয়ে দ্রুত স্বাক্ষর যাচাই করুন"
              : "Verify customer signatures instantly by account number"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border bg-card p-0.5">
            <Button
              size="sm"
              variant={mode === "verify" ? "default" : "ghost"}
              className="h-8"
              onClick={() => setMode("verify")}
            >
              <ShieldCheck className="w-4 h-4" /> {lang === "bn" ? "যাচাই" : "Verify"}
            </Button>
            <Button
              size="sm"
              variant={mode === "manage" ? "default" : "ghost"}
              className="h-8"
              onClick={() => setMode("manage")}
            >
              <FileSignature className="w-4 h-4" /> {lang === "bn" ? "ম্যানেজ" : "Manage"}
            </Button>
          </div>
          {mode === "manage" && (
            <Button
              onClick={() => {
                setShowForm(true);
                setForm({ id: null, account_number: "", customer_name: "", mobile: "", note: "" });
                setFile(null);
              }}
            >
              <Plus className="w-4 h-4" /> {lang === "bn" ? "নতুন কার্ড" : "New Card"}
            </Button>
          )}
        </div>
      </div>

      {/* Search bar - banking style */}
      <Card className="p-4 no-print shadow-sm">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "অ্যাকাউন্ট নম্বর" : "Account Number"}
        </Label>
        <div className="relative mt-1.5">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            inputMode="numeric"
            className="pl-11 h-14 text-lg font-mono tracking-wider rounded-xl border-2 focus-visible:ring-primary"
            placeholder={lang === "bn" ? "অ্যাকাউন্ট নম্বর লিখুন..." : "Enter account number..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
              aria-label="Clear"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </Card>

      {/* VERIFY MODE */}
      {mode === "verify" && (
        <>
          {!debounced && (
            <Card className="p-12 text-center text-muted-foreground border-dashed">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {lang === "bn"
                  ? "যাচাই শুরু করতে উপরে অ্যাকাউন্ট নম্বর লিখুন"
                  : "Enter an account number above to begin verification"}
              </p>
            </Card>
          )}

          {debounced && cardsLoading && (
            <Card className="p-12 text-center text-muted-foreground">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            </Card>
          )}

          {debounced && !cardsLoading && !matched && (
            <Card className="p-10 text-center border-2 border-dashed border-red-200 bg-red-50/40">
              <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
              <div className="text-lg font-bold text-red-700">
                {lang === "bn" ? "অ্যাকাউন্ট পাওয়া যায়নি" : "Account Not Found"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "bn"
                  ? `"${debounced}" নম্বরের কোনো সিগনেচার কার্ড নেই`
                  : `No signature card on file for "${debounced}"`}
              </p>
            </Card>
          )}

          {matched && (
            <div
              ref={verifyRef}
              className="print-area animate-in fade-in slide-in-from-bottom-2 duration-300 bg-background"
            >
              <Card className="overflow-hidden border-2 shadow-xl rounded-2xl">
                {/* Bank-style header band */}
                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-6 h-6" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest opacity-90">
                        {lang === "bn" ? "সিগনেচার ভেরিফিকেশন কার্ড" : "Signature Verification Card"}
                      </div>
                      <div className="text-xs opacity-75">
                        {new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex gap-1.5 no-print">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                      title="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                      title="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={toggleFullscreen}
                      title="Fullscreen"
                    >
                      {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => window.print()}
                      title="Print"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Customer info strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 py-4 border-b bg-muted/30">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {lang === "bn" ? "অ্যাকাউন্ট নাম" : "Account Name"}
                    </div>
                    <div className="text-lg font-bold mt-0.5">{matched.customer_name}</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {lang === "bn" ? "অ্যাকাউন্ট নম্বর" : "Account Number"}
                    </div>
                    <div className="text-lg font-mono font-bold tracking-wider mt-0.5">
                      {matched.account_number}
                    </div>
                  </div>
                </div>

                {/* Signature focus area */}
                <div className="bg-gradient-to-b from-white to-muted/20 p-4 sm:p-6">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold text-center mb-3">
                    ✦ {lang === "bn" ? "স্বাক্ষর" : "Signature"} ✦
                  </div>
                  <div className="relative w-full overflow-auto rounded-xl border-2 border-dashed border-muted-foreground/20 bg-white" style={{ minHeight: "55vh", maxHeight: fullscreen ? "80vh" : "65vh" }}>
                    {imgUrls[matched.id] ? (
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <img
                          src={imgUrls[matched.id]}
                          alt={matched.customer_name}
                          className="max-w-none transition-transform duration-200 select-none"
                          style={{
                            transform: `scale(${zoom})`,
                            transformOrigin: "center center",
                            maxHeight: fullscreen ? "75vh" : "60vh",
                          }}
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  {/* Mobile controls */}
                  <div className="flex sm:hidden justify-center gap-2 mt-3 no-print">
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Footer band */}
                <div className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{lang === "bn" ? "যাচাই-সাপেক্ষ" : "For verification only"}</span>
                  {matched.mobile && <span>📱 {matched.mobile}</span>}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* MANAGE MODE */}
      {mode === "manage" && (
        <>
          {showForm && (
            <Card className="p-4 no-print">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  {form.id ? t("edit") : lang === "bn" ? "নতুন সিগনেচার কার্ড" : "New Signature Card"}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
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
                  <Label>
                    {lang === "bn" ? "সাইন কার্ডের ছবি" : "Signature Card Image"} {!form.id && "*"}
                  </Label>
                  <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {form.id && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {lang === "bn" ? "ছবি না বদলালে পুরোনোটাই থাকবে" : "Leave empty to keep current image"}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label>{t("note")}</Label>
                  <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>{t("cancel_edit")}</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  <Save className="w-4 h-4" /> {form.id ? t("update") : t("save")}
                </Button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {managedList.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground col-span-full">
                {lang === "bn" ? "কোনো সিগনেচার কার্ড পাওয়া যায়নি" : "No signature cards found"}
              </Card>
            )}
            {managedList.map((c) => (
              <Card key={c.id} className="p-3 flex flex-col gap-2">
                <div className="aspect-[4/3] w-full bg-muted rounded overflow-hidden">
                  {imgUrls[c.id] ? (
                    <img src={imgUrls[c.id]} alt={c.customer_name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
                      {t("loading")}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm truncate">{c.customer_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">A/C: {c.account_number}</div>
                  {c.mobile && <div className="text-xs text-muted-foreground">📱 {c.mobile}</div>}
                </div>
                <div className="flex gap-1 no-print">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setQuery(c.account_number);
                      setMode("verify");
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> {lang === "bn" ? "যাচাই" : "Verify"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(t("confirm_delete"))) del.mutate(c);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
