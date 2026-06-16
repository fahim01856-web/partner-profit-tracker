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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Printer, Pencil, X, TrendingUp, TrendingDown, Wallet,
  ArrowLeft, Users, FileText,
} from "lucide-react";

export const Route = createFileRoute("/_app/agent-bank-investment")({ component: InvestmentPage });

const TYPES = [
  { value: "investment", bn: "বিনিয়োগ (জমা)", en: "Investment (In)" },
  { value: "withdrawal", bn: "উত্তোলন", en: "Withdrawal" },
] as const;

type Row = {
  id: string;
  date: string;
  partner_name: string;
  type: string;
  amount: number;
  description: string | null;
  voucher_no: string | null;
  created_at: string;
};

function InvestmentPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [voucherPrint, setVoucherPrint] = useState<Row | null>(null);

  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    partner_name: "",
    type: "investment" as string,
    amount: "",
    description: "",
    voucher_no: genVoucherNo(),
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

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        partner_name: form.partner_name.trim(),
        type: form.type,
        amount: Number(form.amount),
        description: form.description || null,
        voucher_no: form.voucher_no?.trim() || genVoucherNo(),
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
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = (id: string) => { if (window.confirm(t("confirm_delete"))) del.mutate(id); };

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

  const showType = (val: string) => {
    const tp = TYPES.find((x) => x.value === val);
    return tp ? (lang === "bn" ? tp.bn : tp.en) : val;
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
                  <th className="p-2 border text-left">{t("description")}</th>
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
                    <td className="p-2 border">{r.description ?? <span className="text-muted-foreground">—</span>}</td>
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
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>
                )}
              </tbody>
              {withRunning.length > 0 && (
                <tfoot className="bg-muted font-bold">
                  <tr>
                    <td colSpan={4} className="p-2 border text-right">{t("total")}</td>
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

        {voucherPrint && <VoucherPrint row={voucherPrint} onClose={() => setVoucherPrint(null)} lang={lang} fmt={fmt} />}
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

      <Card className={`p-5 ${editingId ? "ring-2 ring-primary" : ""}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          {editingId ? <><Pencil className="w-4 h-4" /> {t("edit")}</> : <><Plus className="w-4 h-4" /> {lang === "bn" ? "নতুন এন্ট্রি" : "New Entry"}</>}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            <Label>{t("amountBDT")}</Label>
            <Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="lg:col-span-1">
            <Label>{t("description")}</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="lg:col-span-6 flex gap-2">
            <Button type="submit" disabled={save.isPending}>{editingId ? t("update") : t("add")}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> {lang === "bn" ? "পার্টনারদের তালিকা" : "Partners"}
        </h2>
        {perPartner.length === 0 ? (
          <div className="text-center text-muted-foreground p-6">{t("noEntries")}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {perPartner.map((p) => (
              <Card
                key={p.name}
                className="p-4 cursor-pointer hover:shadow-md hover:border-primary transition"
                onClick={() => setSelectedPartner(p.name)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-lg">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt.num(p.count)} {lang === "bn" ? "এন্ট্রি" : "entries"}</div>
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
                </div>
                <Button size="sm" variant="outline" className="w-full mt-3">
                  {lang === "bn" ? "স্টেটমেন্ট দেখুন" : "View Statement"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function VoucherPrint({ row, onClose, lang, fmt }: { row: Row; onClose: () => void; lang: string; fmt: ReturnType<typeof useFmt> }) {
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
