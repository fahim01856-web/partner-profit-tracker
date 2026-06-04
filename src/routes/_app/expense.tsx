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
    voucher_no: "", date: new Date().toISOString().slice(0,10),
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
      // Preserve date and category so multiple vouchers can be added quickly for the same day
      const keepDate = form.date;
      const keepCat = form.category;
      setForm({ ...emptyForm(), date: keepDate, category: keepCat });
      setEditingId(null);
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

  // Build unique suggestion lists from previous entries
  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.map(v => (v ?? "").trim()).filter(Boolean)));
  const paidToOptions = uniq(rows.map(r => r.paid_to));
  const descOptions = uniq(rows.map(r => r.description));
  const noteOptions = uniq(rows.map(r => r.note));

  // Compute date-wise serial: 1,2,3... per date, oldest-first within the day
  const dateSerial = (() => {
    const byDate = new Map<string, any[]>();
    [...rows]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .forEach(r => {
        const arr = byDate.get(r.date) ?? [];
        arr.push(r);
        byDate.set(r.date, arr);
      });
    const m = new Map<string, number>();
    byDate.forEach(arr => arr.forEach((r, i) => m.set(r.id, i + 1)));
    return m;
  })();

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
          <div><Label>{t("paid_to")}</Label><Input list="exp-paid-to-list" value={form.paid_to} onChange={(e) => setForm({...form, paid_to: e.target.value})} /></div>
          <div><Label>{t("amountBDT")}</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></div>
          <div><Label>{t("description")}</Label><Input list="exp-desc-list" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>{t("note")}</Label><Input list="exp-note-list" value={form.note} onChange={(e) => setForm({...form, note: e.target.value})} /></div>
          <datalist id="exp-paid-to-list">{paidToOptions.map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="exp-desc-list">{descOptions.map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="exp-note-list">{noteOptions.map(v => <option key={v} value={v} />)}</datalist>
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>{editingId ? t("update") : t("create_voucher")}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
          </div>
        </form>
      </Card>

      {printRow && (
        <div className="print-area hidden print:block">
          <div className="p-8 max-w-3xl mx-auto text-black">
            {/* Header */}
            <div className="border-2 border-black p-4 mb-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center font-bold shrink-0">IB</div>
                <div className="flex-1 text-center">
                  <div className="text-xl font-extrabold tracking-wide">ISLAMI BANK AGENT BANKING</div>
                  <div className="text-sm font-bold">M/S FEED HOUSE (121/11)</div>
                  <div className="text-xs">{t("outlet")}, {t("locationFull")}</div>
                </div>
              </div>
              <div className="text-center mt-3">
                <span className="inline-block border border-black px-4 py-1 text-base font-bold uppercase">
                  {t("expense_voucher_doc")}
                </span>
              </div>
            </div>

            {/* Meta as table */}
            <table className="w-full border border-black border-collapse text-sm mb-4">
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-semibold bg-gray-100 w-1/4">{t("voucher_no")}</td>
                  <td className="border border-black p-2 w-1/4">{printRow.voucher_no}</td>
                  <td className="border border-black p-2 font-semibold bg-gray-100 w-1/4">{t("date")}</td>
                  <td className="border border-black p-2 w-1/4">{fmt.date(printRow.date)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 font-semibold bg-gray-100">{t("category")}</td>
                  <td className="border border-black p-2">{showCat(printRow.category)}</td>
                  <td className="border border-black p-2 font-semibold bg-gray-100">{t("paid_to")}</td>
                  <td className="border border-black p-2">{printRow.paid_to ?? '—'}</td>
                </tr>
              </tbody>
            </table>

            {/* Particulars table */}
            <table className="w-full border border-black border-collapse text-sm mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-2 w-12">Sl</th>
                  <th className="border border-black p-2 text-left">{t("description")}</th>
                  <th className="border border-black p-2 w-32 text-right">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 text-center">{fmt.num(1)}</td>
                  <td className="border border-black p-2 align-top">
                    <div>{printRow.description || '—'}</div>
                    {printRow.note && <div className="text-xs text-gray-700 mt-1">{printRow.note}</div>}
                  </td>
                  <td className="border border-black p-2 text-right font-semibold align-top">{fmt.bdt(Number(printRow.amount))}</td>
                </tr>
                {/* Filler rows */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="h-7">
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2"></td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-black p-2 text-right" colSpan={2}>{t("total")}</td>
                  <td className="border border-black p-2 text-right">{fmt.bdt(Number(printRow.amount))}</td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-8 mt-16 text-center text-xs">
              <div><div className="border-t border-black pt-1">{t("receiver_signature")}</div></div>
              <div><div className="border-t border-black pt-1">Prepared By</div></div>
              <div><div className="border-t border-black pt-1">{t("approvedBy")}</div></div>
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
              <th className="p-2 w-12">Sl/Day</th>
              <th className="p-2">{t("voucher_no")}</th><th className="p-2">{t("date")}</th><th className="p-2">{t("category")}</th>
              <th className="p-2">{t("paid_to")}</th><th className="p-2 text-right">{t("amount")}</th><th className="p-2 no-print"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t ${editingId === r.id ? "bg-primary/5" : ""}`}>
                  <td className="p-2 text-center font-semibold text-muted-foreground">{fmt.num(dateSerial.get(r.id) ?? 0)}</td>
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
              {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("no_vouchers")}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-3">{t("total_vouchers")}: {fmt.num(rows.length)}</div>
      </Card>
    </div>
  );
}
