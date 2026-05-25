import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFmt, genVoucherNo } from "@/lib/format";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer, FileDown, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/_app/expense")({ component: ExpensePage });

const CATEGORY_KEYS: DictKey[] = ["cat_electricity", "cat_internet", "cat_rent", "cat_stationery", "cat_transport", "cat_repair", "cat_other"];

function ExpensePage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const emptyForm = () => ({
    voucher_no: genVoucherNo(), date: new Date().toISOString().slice(0,10),
    category: CATEGORY_KEYS[0] as string, description: "", paid_to: "", amount: "", note: "",
  });
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printRow, setPrintRow] = useState<any>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        voucher_no: form.voucher_no, date: form.date, category: form.category,
        description: form.description, paid_to: form.paid_to, amount: Number(form.amount), note: form.note,
      };
      if (editingId) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? t("updated") : t("voucher_created"));
      resetForm();
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      voucher_no: r.voucher_no, date: r.date, category: r.category,
      description: r.description ?? "", paid_to: r.paid_to ?? "", amount: String(r.amount), note: r.note ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onDelete = (id: string) => { if (window.confirm(t("confirm_delete"))) del.mutate(id); };

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const showCat = (val: string) =>
    (CATEGORY_KEYS as string[]).includes(val) ? t(val as DictKey) : val;

  const doPrint = (r: any) => {
    setPrintRow(r);
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">{t("expense_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("expense_sub")}</p>
        </div>
        <Button variant="outline" onClick={() => { setPrintRow(null); window.print(); }}><FileDown className="w-4 h-4 mr-2" /> {t("printAll")}</Button>
      </div>

      <Card className={`p-5 no-print ${editingId ? "ring-2 ring-primary" : ""}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          {editingId ? <><Pencil className="w-4 h-4" /> {t("edit")}</> : <><Plus className="w-4 h-4" /> {t("expense_new")}</>}
        </h2>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>{t("voucher_no")}</Label><Input value={form.voucher_no} onChange={(e) => setForm({...form, voucher_no: e.target.value})} required /></div>
          <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} required /></div>
          <div><Label>{t("category")}</Label>
            <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
              {CATEGORY_KEYS.map(k => <option key={k} value={k}>{t(k)}</option>)}
            </select>
          </div>
          <div><Label>{t("paid_to")}</Label><Input value={form.paid_to} onChange={(e) => setForm({...form, paid_to: e.target.value})} /></div>
          <div><Label>{t("amountBDT")}</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></div>
          <div><Label>{t("description")}</Label><Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>{t("note")}</Label><Textarea value={form.note} onChange={(e) => setForm({...form, note: e.target.value})} /></div>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>{editingId ? t("update") : t("create_voucher")}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
          </div>
        </form>
      </Card>

      {printRow && (
        <div className="print-area hidden print:block">
          <div className="p-8 max-w-2xl mx-auto">
            <div className="border-b-2 border-primary pb-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{t("bankName")}</div>
                <div className="text-sm">{t("outlet")}, {t("locationFull")}</div>
                <div className="text-lg font-bold mt-3 underline">{t("expense_voucher_doc")}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><strong>{t("voucher_no")}:</strong> {printRow.voucher_no}</div>
              <div className="text-right"><strong>{t("date")}:</strong> {fmt.date(printRow.date)}</div>
              <div><strong>{t("category")}:</strong> {showCat(printRow.category)}</div>
              <div><strong>{t("paid_to")}:</strong> {printRow.paid_to}</div>
            </div>
            <div className="border p-4 mb-6"><strong>{t("description")}:</strong><br/>{printRow.description}<br/>{printRow.note}</div>
            <div className="text-xl font-bold border-t-2 border-b-2 py-3 text-center">{t("amount")}: {fmt.bdt(Number(printRow.amount))}</div>
            <div className="grid grid-cols-2 gap-8 mt-16 text-center text-sm">
              <div><div className="border-t pt-1">{t("receiver_signature")}</div></div>
              <div><div className="border-t pt-1">{t("approvedBy")}</div></div>
            </div>
          </div>
        </div>
      )}

      <Card className={`p-5 ${printRow ? 'no-print' : 'print-area'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t("voucher_list")}</h2>
          <div className="text-sm">{t("total")}: <span className="font-bold text-destructive">{fmt.bdt(total)}</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">{t("voucher_no")}</th><th className="p-2">{t("date")}</th><th className="p-2">{t("category")}</th>
              <th className="p-2">{t("paid_to")}</th><th className="p-2 text-right">{t("amount")}</th><th className="p-2 no-print"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t ${editingId === r.id ? "bg-primary/5" : ""}`}>
                  <td className="p-2 font-mono text-xs">{r.voucher_no}</td>
                  <td className="p-2">{fmt.date(r.date)}</td>
                  <td className="p-2">{showCat(r.category)}</td>
                  <td className="p-2">{r.paid_to}</td>
                  <td className="p-2 text-right font-semibold">{fmt.bdt(Number(r.amount))}</td>
                  <td className="p-2 no-print">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => doPrint(r)} title={t("print")}><Printer className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(r)} title={t("edit")}><Pencil className="w-4 h-4 text-primary" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} title={t("delete")}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("no_vouchers")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-3">{t("total_vouchers")}: {fmt.num(rows.length)}</div>
      </Card>
    </div>
  );
}
