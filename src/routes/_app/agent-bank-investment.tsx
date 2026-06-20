import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { genVoucherNo } from "@/lib/format";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Printer, Pencil, X, TrendingUp, TrendingDown, Wallet,
  ArrowLeft, Users, FileText, Image as ImageIcon, Upload, Banknote, Landmark,
  Search, Download, Award, Activity, PieChart as PieIcon, BarChart3,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { ClientOnly } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/agent-bank-investment")({ component: InvestmentPage });

const TYPES = [
  { value: "investment", bn: "বিনিয়োগ (জমা)", en: "Investment (In)" },
  { value: "withdrawal", bn: "উত্তোলন", en: "Withdrawal" },
] as const;

const PAY_METHODS = [
  { value: "cash", bn: "ক্যাশ", en: "Cash" },
  { value: "bank", bn: "ব্যাংক", en: "Bank" },
] as const;

type Row = {
  id: string;
  date: string;
  partner_name: string;
  type: string;
  amount: number;
  description: string | null;
  voucher_no: string | null;
  payment_method: string | null;
  voucher_image_url: string | null;
  created_at: string;
};

// Signed URL helper (private bucket)
async function getSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("voucher-images").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

function SignedImage({ path, className, onClick }: { path: string; className?: string; onClick?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { getSignedUrl(path).then(setUrl); }, [path]);
  if (!url) return <div className={`bg-muted animate-pulse ${className ?? ""}`} />;
  return <img src={url} className={className} onClick={onClick} alt="voucher" />;
}

function InvestmentPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [voucherPrint, setVoucherPrint] = useState<Row | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    partner_name: "",
    type: "investment" as string,
    amount: "",
    description: "",
    voucher_no: genVoucherNo(),
    payment_method: "cash" as string,
    voucher_image_url: "" as string,
  });
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["agent_bank_investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_bank_investments")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("voucher-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setForm((f) => ({ ...f, voucher_image_url: path }));
      toast.success(lang === "bn" ? "ছবি আপলোড হয়েছে" : "Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setUploading(false); }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        partner_name: form.partner_name.trim(),
        type: form.type,
        amount: Number(form.amount),
        description: form.description || null,
        voucher_no: form.voucher_no?.trim() || genVoucherNo(),
        payment_method: form.payment_method,
        voucher_image_url: form.voucher_image_url || null,
      };
      if (!payload.partner_name) throw new Error(lang === "bn" ? "পার্টনারের নাম দিন" : "Partner name required");
      if (editingId) {
        const { error } = await supabase.from("agent_bank_investments").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agent_bank_investments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? t("updated") : (lang === "bn" ? "সফলভাবে সংরক্ষিত" : "Saved"));
      resetForm();
      qc.invalidateQueries({ queryKey: ["agent_bank_investments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_bank_investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries({ queryKey: ["agent_bank_investments"] });
    },
  });

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setForm({
      date: r.date,
      partner_name: r.partner_name,
      type: r.type,
      amount: String(r.amount),
      description: r.description ?? "",
      voucher_no: r.voucher_no ?? genVoucherNo(),
      payment_method: r.payment_method ?? "cash",
      voucher_image_url: r.voucher_image_url ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = (id: string) => { if (window.confirm(t("confirm_delete"))) del.mutate(id); };

  const openImage = async (path: string) => {
    const u = await getSignedUrl(path);
    if (u) setImagePreview(u);
  };

  const partners = useMemo(() => Array.from(new Set(rows.map((r) => r.partner_name))).sort(), [rows]);

  const perPartner = useMemo(() => {
    const map = new Map<string, { invested: number; withdrawn: number; count: number; last: string }>();
    for (const r of rows) {
      const e = map.get(r.partner_name) ?? { invested: 0, withdrawn: 0, count: 0, last: r.date };
      const a = Number(r.amount);
      if (r.type === "investment") e.invested += a; else e.withdrawn += a;
      e.count += 1;
      if (r.date > e.last) e.last = r.date;
      map.set(r.partner_name, e);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v, balance: v.invested - v.withdrawn }));
  }, [rows]);

  const totals = useMemo(() => {
    const invested = perPartner.reduce((s, p) => s + p.invested, 0);
    const withdrawn = perPartner.reduce((s, p) => s + p.withdrawn, 0);
    return { invested, withdrawn, balance: invested - withdrawn };
  }, [perPartner]);

  const [search, setSearch] = useState("");

  // ============== SMART ANALYTICS ==============
  const analytics = useMemo(() => {
    const now = new Date();
    const ymThis = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ymLast = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;
    const sum = (pred: (r: Row) => boolean) => rows.filter(pred).reduce((s, r) => s + Number(r.amount), 0);

    const thisMonthIn = sum((r) => r.type === "investment" && r.date.startsWith(ymThis));
    const thisMonthOut = sum((r) => r.type === "withdrawal" && r.date.startsWith(ymThis));
    const lastMonthIn = sum((r) => r.type === "investment" && r.date.startsWith(ymLast));
    const lastMonthOut = sum((r) => r.type === "withdrawal" && r.date.startsWith(ymLast));
    const thisNet = thisMonthIn - thisMonthOut;
    const lastNet = lastMonthIn - lastMonthOut;
    const momPct = lastNet === 0 ? 0 : ((thisNet - lastNet) / Math.abs(lastNet)) * 100;

    // Last 12 months trend
    const trend: { month: string; invested: number; withdrawn: number; net: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { month: "short", year: "2-digit" });
      const inv = sum((r) => r.type === "investment" && r.date.startsWith(ym));
      const wd = sum((r) => r.type === "withdrawal" && r.date.startsWith(ym));
      trend.push({ month: label, invested: inv, withdrawn: wd, net: inv - wd });
    }

    const cashTotal = sum((r) => (r.payment_method ?? "cash") === "cash");
    const bankTotal = sum((r) => r.payment_method === "bank");
    const methodSplit = [
      { name: lang === "bn" ? "ক্যাশ" : "Cash", value: cashTotal, color: "hsl(var(--success))" },
      { name: lang === "bn" ? "ব্যাংক" : "Bank", value: bankTotal, color: "hsl(var(--primary))" },
    ];

    const partnerShare = perPartner
      .filter((p) => p.invested > 0)
      .sort((a, b) => b.invested - a.invested)
      .slice(0, 6)
      .map((p) => ({ name: p.name, value: p.invested }));

    const topInvestor = perPartner.reduce<{ name: string; invested: number } | null>((m, p) => !m || p.invested > m.invested ? p : m, null);
    const largestTx = rows.reduce<Row | null>((m, r) => !m || Number(r.amount) > Number(m.amount) ? r : m, null);
    const avgTicket = rows.length ? rows.reduce((s, r) => s + Number(r.amount), 0) / rows.length : 0;
    const activePartners = perPartner.filter((p) => p.balance > 0).length;

    return { thisMonthIn, thisMonthOut, lastMonthIn, lastMonthOut, thisNet, lastNet, momPct, trend, methodSplit, partnerShare, topInvestor, largestTx, avgTicket, activePartners };
  }, [rows, perPartner, lang]);

  const exportCSV = () => {
    const header = ["Date", "Voucher", "Partner", "Type", "Method", "Amount", "Description"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const vals = [r.date, r.voucher_no ?? "", r.partner_name, r.type, r.payment_method ?? "", String(r.amount), (r.description ?? "").replace(/[,\n]/g, " ")];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `agent-bank-investments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))", "#8b5cf6", "#f59e0b", "#06b6d4"];

  const payMethodLabel = (v: string | null) => {
    const m = PAY_METHODS.find((x) => x.value === (v ?? "cash"));
    return m ? (lang === "bn" ? m.bn : m.en) : (v ?? "-");
  };

  // ============== PARTNER STATEMENT VIEW ==============
  if (selectedPartner) {
    const partnerRows = rows
      .filter((r) => r.partner_name === selectedPartner)
      .sort((a, b) => (a.date === b.date ? a.created_at.localeCompare(b.created_at) : a.date.localeCompare(b.date)));

    let running = 0;
    const withRunning = partnerRows.map((r) => {
      const a = Number(r.amount);
      running += r.type === "investment" ? a : -a;
      return { ...r, running };
    });

    const summary = perPartner.find((p) => p.name === selectedPartner) ?? { invested: 0, withdrawn: 0, balance: 0, count: 0 };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <Button variant="ghost" onClick={() => setSelectedPartner(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {lang === "bn" ? "ফেরত" : "Back"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> {lang === "bn" ? "স্টেটমেন্ট প্রিন্ট" : "Print Statement"}
          </Button>
        </div>

        <Card className="p-6 print-area">
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">{lang === "bn" ? "ব্যাংক স্টেটমেন্ট" : "Bank Statement"}</h1>
            <p className="text-sm text-muted-foreground">{lang === "bn" ? "এজেন্ট ব্যাংক বিনিয়োগ হিসাব" : "Agent Bank Investment Account"}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div>
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "পার্টনার" : "Partner"}</div>
              <div className="text-lg font-bold">{selectedPartner}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "মুদ্রণের তারিখ" : "Statement Date"}</div>
              <div className="text-sm font-medium">{fmt.date(new Date())}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <Card className="p-3 bg-success/5">
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট বিনিয়োগ" : "Total In"}</div>
              <div className="text-lg font-bold text-success">{fmt.bdt(summary.invested)}</div>
            </Card>
            <Card className="p-3 bg-destructive/5">
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট উত্তোলন" : "Total Out"}</div>
              <div className="text-lg font-bold text-destructive">{fmt.bdt(summary.withdrawn)}</div>
            </Card>
            <Card className="p-3 bg-primary/5">
              <div className="text-xs text-muted-foreground">{lang === "bn" ? "বর্তমান ব্যালেন্স" : "Balance"}</div>
              <div className="text-lg font-bold">{fmt.bdt(summary.balance)}</div>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 border text-left">{lang === "bn" ? "ক্রমিক" : "#"}</th>
                  <th className="p-2 border text-left">{t("date")}</th>
                  <th className="p-2 border text-left">{lang === "bn" ? "ভাউচার নং" : "Voucher No"}</th>
                  <th className="p-2 border text-left">{lang === "bn" ? "পদ্ধতি" : "Method"}</th>
                  <th className="p-2 border text-left">{t("description")}</th>
                  <th className="p-2 border text-center">{lang === "bn" ? "ছবি" : "Image"}</th>
                  <th className="p-2 border text-right">{lang === "bn" ? "জমা" : "Deposit"}</th>
                  <th className="p-2 border text-right">{lang === "bn" ? "উত্তোলন" : "Withdraw"}</th>
                  <th className="p-2 border text-right">{lang === "bn" ? "ব্যালেন্স" : "Balance"}</th>
                  <th className="p-2 border no-print"></th>
                </tr>
              </thead>
              <tbody>
                {withRunning.map((r, idx) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 border">{fmt.num(idx + 1)}</td>
                    <td className="p-2 border">{fmt.date(r.date)}</td>
                    <td className="p-2 border font-mono text-xs">{r.voucher_no ?? "-"}</td>
                    <td className="p-2 border">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${r.payment_method === "bank" ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}>
                        {r.payment_method === "bank" ? <Landmark className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                        {payMethodLabel(r.payment_method)}
                      </span>
                    </td>
                    <td className="p-2 border">{r.description ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 border text-center">
                      {r.voucher_image_url ? (
                        <button type="button" onClick={() => openImage(r.voucher_image_url!)} className="inline-block">
                          <SignedImage path={r.voucher_image_url} className="w-10 h-10 object-cover rounded border cursor-pointer hover:opacity-80" />
                        </button>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="p-2 border text-right text-success font-semibold">
                      {r.type === "investment" ? fmt.bdt(Number(r.amount)) : ""}
                    </td>
                    <td className="p-2 border text-right text-destructive font-semibold">
                      {r.type === "withdrawal" ? fmt.bdt(Number(r.amount)) : ""}
                    </td>
                    <td className={`p-2 border text-right font-bold ${r.running < 0 ? "text-destructive" : ""}`}>
                      {fmt.bdt(r.running)}
                    </td>
                    <td className="p-2 border no-print">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setVoucherPrint(r)} title={lang === "bn" ? "ভাউচার প্রিন্ট" : "Print Voucher"}>
                          <FileText className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(r)} title={t("edit")}>
                          <Pencil className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} title={t("delete")}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {withRunning.length === 0 && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>
                )}
              </tbody>
              {withRunning.length > 0 && (
                <tfoot className="bg-muted font-bold">
                  <tr>
                    <td colSpan={6} className="p-2 border text-right">{t("total")}</td>
                    <td className="p-2 border text-right text-success">{fmt.bdt(summary.invested)}</td>
                    <td className="p-2 border text-right text-destructive">{fmt.bdt(summary.withdrawn)}</td>
                    <td className="p-2 border text-right">{fmt.bdt(summary.balance)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
            <div className="text-center">
              <div className="border-t pt-2">{lang === "bn" ? "প্রস্তুতকারী" : "Prepared By"}</div>
            </div>
            <div className="text-center">
              <div className="border-t pt-2">{lang === "bn" ? "অনুমোদনকারী" : "Approved By"}</div>
            </div>
          </div>
        </Card>

        {voucherPrint && <VoucherPrint row={voucherPrint} onClose={() => setVoucherPrint(null)} lang={lang} fmt={fmt} payMethodLabel={payMethodLabel} />}
        {imagePreview && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setImagePreview(null)}>
            <img src={imagePreview} className="max-w-full max-h-full rounded" alt="voucher preview" />
            <Button className="absolute top-4 right-4" size="sm" variant="secondary" onClick={() => setImagePreview(null)}><X className="w-4 h-4" /></Button>
          </div>
        )}
      </div>
    );
  }

  // ============== MAIN VIEW ==============
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lang === "bn" ? "এজেন্ট ব্যাংক বিনিয়োগ" : "Agent Bank Investment"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn" ? "পার্টনারদের আলাদা ব্যাংক স্টেটমেন্ট" : "Per-partner bank statements"}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingUp className="w-4 h-4 text-success" />{lang === "bn" ? "মোট বিনিয়োগ" : "Total Invested"}
          </div>
          <div className="mt-1 text-xl font-bold text-success">{fmt.bdt(totals.invested)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingDown className="w-4 h-4 text-destructive" />{lang === "bn" ? "মোট উত্তোলন" : "Total Withdrawn"}
          </div>
          <div className="mt-1 text-xl font-bold text-destructive">{fmt.bdt(totals.withdrawn)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Wallet className="w-4 h-4 text-primary" />{lang === "bn" ? "নেট ব্যালেন্স" : "Net Balance"}
          </div>
          <div className="mt-1 text-xl font-bold">{fmt.bdt(totals.balance)}</div>
        </Card>
      </div>

      {/* SMART ANALYTICS DASHBOARD */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 via-transparent to-success/5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> {lang === "bn" ? "স্মার্ট বিশ্লেষণ" : "Smart Analytics"}
          </h2>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> {lang === "bn" ? "CSV রপ্তানি" : "Export CSV"}
          </Button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "এই মাসে নেট" : "This Month Net"}</div>
            <div className={`text-lg font-bold ${analytics.thisNet >= 0 ? "text-success" : "text-destructive"}`}>{fmt.bdt(analytics.thisNet)}</div>
            <div className={`text-[11px] flex items-center gap-1 ${analytics.momPct >= 0 ? "text-success" : "text-destructive"}`}>
              {analytics.momPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {analytics.momPct.toFixed(1)}% {lang === "bn" ? "গত মাস থেকে" : "vs last month"}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Award className="w-3 h-3" /> {lang === "bn" ? "শীর্ষ বিনিয়োগকারী" : "Top Investor"}</div>
            <div className="text-sm font-bold truncate">{analytics.topInvestor?.name ?? "—"}</div>
            <div className="text-xs text-success">{analytics.topInvestor ? fmt.bdt(analytics.topInvestor.invested) : ""}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "গড় লেনদেন" : "Avg Transaction"}</div>
            <div className="text-lg font-bold">{fmt.bdt(analytics.avgTicket)}</div>
            <div className="text-[11px] text-muted-foreground">{fmt.num(rows.length)} {lang === "bn" ? "মোট" : "total"}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "সক্রিয় পার্টনার" : "Active Partners"}</div>
            <div className="text-lg font-bold text-primary">{fmt.num(analytics.activePartners)} / {fmt.num(perPartner.length)}</div>
            <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "ইতিবাচক ব্যালেন্স" : "positive balance"}</div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> {lang === "bn" ? "১২ মাসের ধারা" : "12-Month Trend"}</h3>
            <ClientOnly fallback={<div className="h-64" />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.trend}>
                    <defs>
                      <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.6} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt.bdt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="invested" stroke="hsl(var(--success))" fill="url(#gIn)" name={lang === "bn" ? "বিনিয়োগ" : "Invested"} />
                    <Area type="monotone" dataKey="withdrawn" stroke="hsl(var(--destructive))" fill="url(#gOut)" name={lang === "bn" ? "উত্তোলন" : "Withdrawn"} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ClientOnly>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><PieIcon className="w-4 h-4 text-primary" /> {lang === "bn" ? "পার্টনার শেয়ার" : "Partner Share"}</h3>
            <ClientOnly fallback={<div className="h-64" />}>
              <div className="h-64">
                {analytics.partnerShare.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{t("noEntries")}</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.partnerShare} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={70} label={(e) => e.name}>
                        {analytics.partnerShare.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt.bdt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ClientOnly>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Banknote className="w-4 h-4 text-success" /> {lang === "bn" ? "পেমেন্ট পদ্ধতি" : "Payment Method"}</h3>
            <div className="space-y-2">
              {analytics.methodSplit.map((m) => {
                const tot = analytics.methodSplit.reduce((s, x) => s + x.value, 0) || 1;
                const pct = (m.value / tot) * 100;
                return (
                  <div key={m.name}>
                    <div className="flex justify-between text-xs mb-1"><span>{m.name}</span><span className="font-semibold">{fmt.bdt(m.value)} ({pct.toFixed(0)}%)</span></div>
                    <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full" style={{ width: `${pct}%`, background: m.color }} /></div>
                  </div>
                );
              })}
            </div>
            {analytics.largestTx && (
              <div className="mt-4 pt-3 border-t">
                <div className="text-[11px] text-muted-foreground">{lang === "bn" ? "সর্বোচ্চ লেনদেন" : "Largest Transaction"}</div>
                <div className="text-sm font-bold truncate">{analytics.largestTx.partner_name}</div>
                <div className="text-xs"><span className={analytics.largestTx.type === "investment" ? "text-success" : "text-destructive"}>{fmt.bdt(Number(analytics.largestTx.amount))}</span> · {fmt.date(analytics.largestTx.date)}</div>
              </div>
            )}
          </Card>

          <Card className="p-4 lg:col-span-3">
            <h3 className="text-sm font-semibold mb-3">{lang === "bn" ? "মাসিক তুলনা" : "Monthly Comparison"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "এই মাসে বিনিয়োগ" : "This Month In"}</div><div className="font-bold text-success">{fmt.bdt(analytics.thisMonthIn)}</div></div>
              <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "এই মাসে উত্তোলন" : "This Month Out"}</div><div className="font-bold text-destructive">{fmt.bdt(analytics.thisMonthOut)}</div></div>
              <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "গত মাসে বিনিয়োগ" : "Last Month In"}</div><div className="font-bold">{fmt.bdt(analytics.lastMonthIn)}</div></div>
              <div><div className="text-[11px] text-muted-foreground">{lang === "bn" ? "গত মাসে উত্তোলন" : "Last Month Out"}</div><div className="font-bold">{fmt.bdt(analytics.lastMonthOut)}</div></div>
            </div>
          </Card>
        </div>
      </Card>


      <Card className={`p-5 ${editingId ? "ring-2 ring-primary" : ""}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          {editingId ? <><Pencil className="w-4 h-4" /> {t("edit")}</> : <><Plus className="w-4 h-4" /> {lang === "bn" ? "নতুন এন্ট্রি" : "New Entry"}</>}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>{t("date")}</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <Label>{lang === "bn" ? "ভাউচার নং" : "Voucher No"}</Label>
            <Input value={form.voucher_no} onChange={(e) => setForm({ ...form, voucher_no: e.target.value })} />
          </div>
          <div>
            <Label>{lang === "bn" ? "পার্টনার" : "Partner"}</Label>
            <Input list="partner-list" value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} required />
            <datalist id="partner-list">
              {partners.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div>
            <Label>{lang === "bn" ? "ধরন" : "Type"}</Label>
            <select
              className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((tp) => <option key={tp.value} value={tp.value}>{lang === "bn" ? tp.bn : tp.en}</option>)}
            </select>
          </div>
          <div>
            <Label>{lang === "bn" ? "পেমেন্ট পদ্ধতি" : "Payment Method"}</Label>
            <div className="flex gap-2 mt-1">
              {PAY_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm({ ...form, payment_method: m.value })}
                  className={`flex-1 h-9 rounded-md border text-sm flex items-center justify-center gap-1 ${
                    form.payment_method === m.value
                      ? (m.value === "bank" ? "border-primary bg-primary/10 text-primary" : "border-success bg-success/10 text-success")
                      : "border-input bg-background"
                  }`}
                >
                  {m.value === "bank" ? <Landmark className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                  {lang === "bn" ? m.bn : m.en}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>{t("amountBDT")}</Label>
            <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("description")}</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Label className="flex items-center gap-2"><ImageIcon className="w-4 h-4" /> {lang === "bn" ? "ভাউচার ছবি" : "Voucher Image"}</Label>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <label className={`inline-flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-background cursor-pointer text-sm hover:bg-accent ${uploading ? "opacity-50" : ""}`}>
                <Upload className="w-4 h-4" />
                {uploading ? (lang === "bn" ? "আপলোড হচ্ছে..." : "Uploading...") : (lang === "bn" ? "ছবি বেছে নিন" : "Choose Image")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
                />
              </label>
              {form.voucher_image_url && (
                <div className="flex items-center gap-2">
                  <SignedImage path={form.voucher_image_url} className="w-16 h-16 object-cover rounded border" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, voucher_image_url: "" })}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-4 flex gap-2">
            <Button type="submit" disabled={save.isPending || uploading}>{editingId ? t("update") : t("add")}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> {lang === "bn" ? "পার্টনারদের তালিকা" : "Partners"}
            <span className="text-xs text-muted-foreground font-normal">({fmt.num(perPartner.length)})</span>
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-9 w-56"
              placeholder={lang === "bn" ? "পার্টনার খুঁজুন..." : "Search partner..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {perPartner.length === 0 ? (
          <div className="text-center text-muted-foreground p-6">{t("noEntries")}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {perPartner
              .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
              .map((p) => {
                const sharePct = totals.invested > 0 ? (p.invested / totals.invested) * 100 : 0;
                return (
                  <Card
                    key={p.name}
                    className="p-4 cursor-pointer hover:shadow-md hover:border-primary transition"
                    onClick={() => setSelectedPartner(p.name)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-lg truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground shrink-0">{fmt.num(p.count)} {lang === "bn" ? "এন্ট্রি" : "entries"}</div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{lang === "bn" ? "বিনিয়োগ" : "Invested"}</span>
                        <span className="text-success font-semibold">{fmt.bdt(p.invested)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{lang === "bn" ? "উত্তোলন" : "Withdrawn"}</span>
                        <span className="text-destructive font-semibold">{fmt.bdt(p.withdrawn)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-medium">{lang === "bn" ? "ব্যালেন্স" : "Balance"}</span>
                        <span className={`font-bold ${p.balance < 0 ? "text-destructive" : ""}`}>{fmt.bdt(p.balance)}</span>
                      </div>
                      <div className="pt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{lang === "bn" ? "শেয়ার" : "Share"}</span><span>{sharePct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${sharePct}%` }} /></div>
                      </div>
                      <div className="text-[10px] text-muted-foreground pt-1">{lang === "bn" ? "শেষ লেনদেন:" : "Last:"} {fmt.date(p.last)}</div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3">
                      {lang === "bn" ? "স্টেটমেন্ট দেখুন" : "View Statement"}
                    </Button>
                  </Card>
                );
              })}
          </div>
        )}
      </Card>
    </div>
  );
}

function VoucherPrint({ row, onClose, lang, fmt, payMethodLabel }: { row: Row; onClose: () => void; lang: string; fmt: ReturnType<typeof useFmt>; payMethodLabel: (v: string | null) => string }) {
  const typeLabel = TYPES.find((x) => x.value === row.type);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 voucher-modal">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b no-print">
          <h3 className="font-semibold">{lang === "bn" ? "ভাউচার" : "Voucher"}</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> {lang === "bn" ? "প্রিন্ট" : "Print"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-8 print-area voucher-print">
          <div className="text-center border-b-2 border-double pb-4 mb-6">
            <h1 className="text-2xl font-bold">{lang === "bn" ? "অর্থ ভাউচার" : "Payment Voucher"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{lang === "bn" ? "এজেন্ট ব্যাংক বিনিয়োগ" : "Agent Bank Investment"}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground">{lang === "bn" ? "ভাউচার নং:" : "Voucher No:"}</span>
              <div className="font-bold font-mono">{row.voucher_no ?? "-"}</div>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">{lang === "bn" ? "তারিখ:" : "Date:"}</span>
              <div className="font-bold">{fmt.date(row.date)}</div>
            </div>
          </div>
          <table className="w-full text-sm border mb-6">
            <tbody>
              <tr className="border-b">
                <td className="p-3 bg-muted font-medium w-1/3">{lang === "bn" ? "পার্টনার" : "Partner"}</td>
                <td className="p-3 font-bold">{row.partner_name}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 bg-muted font-medium">{lang === "bn" ? "লেনদেনের ধরন" : "Transaction Type"}</td>
                <td className="p-3 font-semibold">{typeLabel ? (lang === "bn" ? typeLabel.bn : typeLabel.en) : row.type}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 bg-muted font-medium">{lang === "bn" ? "পেমেন্ট পদ্ধতি" : "Payment Method"}</td>
                <td className="p-3 font-semibold">{payMethodLabel(row.payment_method)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-3 bg-muted font-medium">{lang === "bn" ? "বিবরণ" : "Description"}</td>
                <td className="p-3">{row.description ?? "—"}</td>
              </tr>
              <tr>
                <td className="p-3 bg-muted font-medium">{lang === "bn" ? "পরিমাণ" : "Amount"}</td>
                <td className={`p-3 font-bold text-lg ${row.type === "investment" ? "text-success" : "text-destructive"}`}>
                  {row.type === "withdrawal" ? "-" : "+"}{fmt.bdt(Number(row.amount))}
                </td>
              </tr>
            </tbody>
          </table>
          {row.voucher_image_url && (
            <div className="mb-6">
              <div className="text-sm font-medium mb-2">{lang === "bn" ? "সংযুক্ত ভাউচার ছবি:" : "Attached Voucher Image:"}</div>
              <SignedImage path={row.voucher_image_url} className="max-w-full max-h-96 border rounded mx-auto" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-6 mt-16 text-sm text-center">
            <div><div className="border-t pt-2">{lang === "bn" ? "প্রস্তুতকারী" : "Prepared By"}</div></div>
            <div><div className="border-t pt-2">{lang === "bn" ? "গ্রহীতা" : "Received By"}</div></div>
            <div><div className="border-t pt-2">{lang === "bn" ? "অনুমোদনকারী" : "Approved By"}</div></div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .voucher-modal, .voucher-modal * { visibility: visible; }
          .voucher-modal { position: absolute; inset: 0; background: white; }
          .voucher-modal .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
