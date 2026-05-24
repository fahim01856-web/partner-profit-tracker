import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFmt } from "@/lib/format";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FileDown } from "lucide-react";

export const Route = createFileRoute("/_app/income")({ component: IncomePage });

const CATEGORY_KEYS: DictKey[] = ["cat_commission", "cat_service", "cat_other_income"];

function IncomePage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), category: CATEGORY_KEYS[0] as string, description: "", amount: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incomes").select("*").order("date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("incomes").insert({
        date: form.date, category: form.category, description: form.description, amount: Number(form.amount),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("income_added"));
      setForm({ ...form, description: "", amount: "" });
      qc.invalidateQueries({ queryKey: ["incomes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses" === "" ? "expenses" : "incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["incomes"] }); },
  });

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  // Translate stored category keys back to user language
  const showCat = (val: string) => {
    if ((CATEGORY_KEYS as string[]).includes(val)) return t(val as DictKey);
    return val;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("income_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("income_sub")}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><FileDown className="w-4 h-4 mr-2" /> {t("printPdf")}</Button>
      </div>

      <Card className="p-5 no-print">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> {t("income_new")}</h2>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} required /></div>
          <div><Label>{t("category")}</Label>
            <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
              {CATEGORY_KEYS.map(k => <option key={k} value={k}>{t(k)}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2"><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
          <div><Label>{t("amountBDT")}</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></div>
          <div className="lg:col-span-5"><Button type="submit" disabled={add.isPending}>{t("add")}</Button></div>
        </form>
      </Card>

      <Card className="p-5 print-area">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t("income_list")}</h2>
          <div className="text-sm">{t("total")}: <span className="font-bold text-success">{fmt.bdt(total)}</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">{t("date")}</th><th className="p-2">{t("category")}</th><th className="p-2">{t("description")}</th>
              <th className="p-2 text-right">{t("amount")}</th><th className="p-2 no-print"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{fmt.date(r.date)}</td>
                  <td className="p-2">{showCat(r.category)}</td>
                  <td className="p-2">{r.description}</td>
                  <td className="p-2 text-right font-semibold">{fmt.bdt(Number(r.amount))}</td>
                  <td className="p-2 no-print"><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-3">{t("total")}: {fmt.num(rows.length)}</div>
      </Card>
    </div>
  );
}
