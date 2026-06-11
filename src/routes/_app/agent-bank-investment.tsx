import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Pencil, X, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/_app/agent-bank-investment")({ component: InvestmentPage });

const TYPES = [
  { value: "investment", bn: "বিনিয়োগ (জমা)", en: "Investment (In)" },
  { value: "withdrawal", bn: "উত্তোলন", en: "Withdrawal" },
] as const;

function InvestmentPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    partner_name: "",
    type: "investment" as string,
    amount: "",
    description: "",
  });
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPartner, setFilterPartner] = useState<string>("");

  const { data: rows = [] } = useQuery({
    queryKey: ["agent_bank_investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_bank_investments")
        .select("*")
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        partner_name: form.partner_name.trim(),
        type: form.type,
        amount: Number(form.amount),
        description: form.description || null,
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

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      date: r.date,
      partner_name: r.partner_name,
      type: r.type,
      amount: String(r.amount),
      description: r.description ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = (id: string) => {
    if (window.confirm(t("confirm_delete"))) del.mutate(id);
  };

  const filtered = useMemo(
    () => (filterPartner ? rows.filter((r) => r.partner_name === filterPartner) : rows),
    [rows, filterPartner],
  );

  const partners = useMemo(() => Array.from(new Set(rows.map((r) => r.partner_name))).sort(), [rows]);

  const totals = useMemo(() => {
    let invested = 0, withdrawn = 0;
    for (const r of filtered) {
      const a = Number(r.amount);
      if (r.type === "investment") invested += a;
      else withdrawn += a;
    }
    return { invested, withdrawn, balance: invested - withdrawn };
  }, [filtered]);

  const perPartner = useMemo(() => {
    const map = new Map<string, { invested: number; withdrawn: number }>();
    for (const r of rows) {
      const e = map.get(r.partner_name) ?? { invested: 0, withdrawn: 0 };
      const a = Number(r.amount);
      if (r.type === "investment") e.invested += a; else e.withdrawn += a;
      map.set(r.partner_name, e);
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v, balance: v.invested - v.withdrawn }));
  }, [rows]);

  const showType = (val: string) => {
    const t = TYPES.find((x) => x.value === val);
    return t ? (lang === "bn" ? t.bn : t.en) : val;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lang === "bn" ? "এজেন্ট ব্যাংক বিনিয়োগ" : "Agent Bank Investment"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "bn" ? "পার্টনারদের বিনিয়োগ ও উত্তোলনের হিসাব" : "Partner investments & withdrawals"}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <FileDown className="w-4 h-4 mr-2" /> {t("printPdf")}
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingUp className="w-4 h-4 text-success" />
            {lang === "bn" ? "মোট বিনিয়োগ" : "Total Invested"}
          </div>
          <div className="mt-1 text-xl font-bold text-success">{fmt.bdt(totals.invested)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingDown className="w-4 h-4 text-destructive" />
            {lang === "bn" ? "মোট উত্তোলন" : "Total Withdrawn"}
          </div>
          <div className="mt-1 text-xl font-bold text-destructive">{fmt.bdt(totals.withdrawn)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Wallet className="w-4 h-4 text-primary" />
            {lang === "bn" ? "নেট ব্যালেন্স" : "Net Balance"}
          </div>
          <div className="mt-1 text-xl font-bold">{fmt.bdt(totals.balance)}</div>
        </Card>
      </div>

      <Card className={`p-5 no-print ${editingId ? "ring-2 ring-primary" : ""}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          {editingId ? <><Pencil className="w-4 h-4" /> {t("edit")}</> : <><Plus className="w-4 h-4" /> {lang === "bn" ? "নতুন এন্ট্রি" : "New Entry"}</>}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <Label>{t("date")}</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
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
          <div className="lg:col-span-2">
            <Label>{t("description")}</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="lg:col-span-6 flex gap-2">
            <Button type="submit" disabled={save.isPending}>{editingId ? t("update") : t("add")}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
          </div>
        </form>
      </Card>

      {perPartner.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3">{lang === "bn" ? "পার্টনার অনুযায়ী সারাংশ" : "Per-Partner Summary"}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-2">{lang === "bn" ? "পার্টনার" : "Partner"}</th>
                  <th className="p-2 text-right">{lang === "bn" ? "বিনিয়োগ" : "Invested"}</th>
                  <th className="p-2 text-right">{lang === "bn" ? "উত্তোলন" : "Withdrawn"}</th>
                  <th className="p-2 text-right">{lang === "bn" ? "ব্যালেন্স" : "Balance"}</th>
                </tr>
              </thead>
              <tbody>
                {perPartner.map((p) => (
                  <tr key={p.name} className="border-t">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-right text-success">{fmt.bdt(p.invested)}</td>
                    <td className="p-2 text-right text-destructive">{fmt.bdt(p.withdrawn)}</td>
                    <td className="p-2 text-right font-bold">{fmt.bdt(p.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5 print-area">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold">{lang === "bn" ? "বিনিয়োগের তালিকা" : "Investment List"}</h2>
          <div className="flex items-center gap-2 no-print">
            <Label className="text-xs">{lang === "bn" ? "ফিল্টার:" : "Filter:"}</Label>
            <select
              className="h-8 rounded-md border border-input px-2 text-xs bg-background"
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
            >
              <option value="">{lang === "bn" ? "সকল পার্টনার" : "All partners"}</option>
              {partners.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">{t("date")}</th>
                <th className="p-2">{lang === "bn" ? "পার্টনার" : "Partner"}</th>
                <th className="p-2">{lang === "bn" ? "ধরন" : "Type"}</th>
                <th className="p-2">{t("description")}</th>
                <th className="p-2 text-right">{t("amount")}</th>
                <th className="p-2 no-print"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`border-t ${editingId === r.id ? "bg-primary/5" : ""}`}>
                  <td className="p-2">{fmt.date(r.date)}</td>
                  <td className="p-2 font-medium">{r.partner_name}</td>
                  <td className="p-2">
                    <span className={r.type === "investment" ? "text-success" : "text-destructive"}>
                      {showType(r.type)}
                    </span>
                  </td>
                  <td className="p-2">{r.description}</td>
                  <td className={`p-2 text-right font-semibold ${r.type === "investment" ? "text-success" : "text-destructive"}`}>
                    {r.type === "withdrawal" ? "-" : "+"}{fmt.bdt(Number(r.amount))}
                  </td>
                  <td className="p-2 no-print">
                    <div className="flex gap-1 justify-end">
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
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-3">{t("total")}: {fmt.num(filtered.length)}</div>
      </Card>
    </div>
  );
}
