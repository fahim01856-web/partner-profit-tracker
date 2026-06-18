import { BankLogo } from "@/components/BankLogo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFmt } from "@/lib/format";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer, FileDown, Pencil, X, ChevronDown, ChevronRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/expense")({ component: ExpensePage });

const BUILTIN_CATS: DictKey[] = ["cat_electricity", "cat_internet", "cat_rent", "cat_stationery", "cat_transport", "cat_repair", "cat_other"];

type Row = {
  id?: string;
  category: string;
  description: string;
  paid_to: string;
  amount: string;
  note: string;
};

const emptyRow = (): Row => ({ category: "", description: "", paid_to: "", amount: "", note: "" });
const voucherNoFor = (date: string) => `EXP-${date.replaceAll("-", "")}`;

function ExpensePage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [editingVoucher, setEditingVoucher] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [printVoucher, setPrintVoucher] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: allRows = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false }).order("created_at", { ascending: true }).limit(2000);
      if (error) throw error;
      return data;
    },
  });

  const { data: savedCats = [] } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("usage_count", { ascending: false }).limit(5000);
      if (error) throw error;
      return data;
    },
  });

  // Suggestion list: built-in (translated) + saved
  const catOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { name: string; count: number; builtin?: boolean }[] = [];
    BUILTIN_CATS.forEach((k) => {
      const label = t(k);
      if (!seen.has(label.toLowerCase())) { seen.add(label.toLowerCase()); list.push({ name: label, count: 0, builtin: true }); }
    });
    savedCats.forEach((c) => {
      if (!seen.has(c.name.toLowerCase())) { seen.add(c.name.toLowerCase()); list.push({ name: c.name, count: c.usage_count }); }
    });
    return list;
  }, [savedCats, t]);

  const paidToOptions = useMemo(() => Array.from(new Set(allRows.map(r => (r.paid_to ?? "").trim()).filter(Boolean))), [allRows]);
  const descOptions = useMemo(() => Array.from(new Set(allRows.map(r => (r.description ?? "").trim()).filter(Boolean))), [allRows]);

  // Group rows by date (= voucher)
  const vouchers = useMemo(() => {
    const map = new Map<string, typeof allRows>();
    allRows.forEach((r) => {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    });
    return Array.from(map.entries())
      .map(([date, items]) => ({
        date,
        voucher_no: voucherNoFor(date),
        items,
        total: items.reduce((s, r) => s + Number(r.amount), 0),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allRows]);

  const filteredVouchers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter(v =>
      v.date.includes(q) || v.voucher_no.toLowerCase().includes(q) ||
      v.items.some((i: any) => [i.category, i.description, i.paid_to, i.note].some((f) => (f ?? "").toString().toLowerCase().includes(q)))
    );
  }, [vouchers, search]);

  const resetForm = () => { setDate(new Date().toISOString().slice(0,10)); setRows([emptyRow()]); setEditingVoucher(null); };

  const loadVoucher = (vDate: string) => {
    const items = allRows.filter(r => r.date === vDate);
    setDate(vDate);
    setRows(items.length ? items.map(i => ({
      id: i.id, category: i.category, description: i.description ?? "", paid_to: i.paid_to ?? "",
      amount: String(i.amount), note: i.note ?? "",
    })) : [emptyRow()]);
    setEditingVoucher(vDate);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = useMutation({
    mutationFn: async () => {
      const valid = rows.filter(r => r.category.trim() && Number(r.amount) > 0);
      if (!valid.length) throw new Error(t("expense_need_row"));
      const voucher_no = voucherNoFor(date);

      // Replace voucher: delete existing rows for the new date AND (if editing) the original date
      const datesToClear = Array.from(new Set([date, ...(editingVoucher ? [editingVoucher] : [])]));
      const { error: delErr } = await supabase.from("expenses").delete().in("date", datesToClear);
      if (delErr) throw delErr;

      const payload = valid.map((r, idx) => ({
        voucher_no: `${voucher_no}-${idx + 1}`,
        date,
        category: r.category.trim(),
        description: r.description.trim() || null,
        paid_to: r.paid_to.trim() || null,
        amount: Number(r.amount),
        note: r.note.trim() || null,
      }));
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) throw error;

      // Upsert categories memory (non-builtin only)
      const builtinSet = new Set(BUILTIN_CATS.map(k => t(k).toLowerCase()));
      const uniqueCats = Array.from(new Set(valid.map(r => r.category.trim()).filter(Boolean)));
      for (const name of uniqueCats) {
        if (builtinSet.has(name.toLowerCase())) continue;
        const existing = savedCats.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          await supabase.from("expense_categories").update({ usage_count: existing.usage_count + 1, last_used_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await supabase.from("expense_categories").insert({ name });
        }
      }
    },
    onSuccess: () => {
      toast.success(editingVoucher ? t("updated") : t("voucher_created"));
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delVoucher = useMutation({
    mutationFn: async (vDate: string) => {
      const { error } = await supabase.from("expenses").delete().eq("date", vDate);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const onDeleteVoucher = (d: string) => { if (window.confirm(t("confirm_delete"))) delVoucher.mutate(d); };

  const toggleExpand = (d: string) => {
    const s = new Set(expanded);
    s.has(d) ? s.delete(d) : s.add(d);
    setExpanded(s);
  };

  const doPrint = (d: string) => {
    setPrintVoucher(d);
    setTimeout(() => window.print(), 100);
  };

  const grandTotal = vouchers.reduce((s, v) => s + v.total, 0);
  const formTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const printV = printVoucher ? vouchers.find(v => v.date === printVoucher) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">{t("expense_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("expense_sub")}</p>
        </div>
        <Button variant="outline" onClick={() => { setPrintVoucher(null); window.print(); }}><FileDown className="w-4 h-4 mr-2" /> {t("printAll")}</Button>
      </div>

      <Card className={`p-5 no-print ${editingVoucher ? "ring-2 ring-primary" : ""}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold flex items-center gap-2">
            {editingVoucher ? <><Pencil className="w-4 h-4" /> {t("edit")} — {voucherNoFor(date)}</> : <><Plus className="w-4 h-4" /> {t("expense_new")}</>}
          </h2>
          {editingVoucher && <Button type="button" variant="outline" size="sm" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>{t("date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label>{t("voucher_no")}</Label>
              <Input value={voucherNoFor(date)} readOnly className="bg-muted font-mono" />
            </div>
            <div className="flex items-end">
              <div className="w-full p-3 rounded-md bg-primary/5 border">
                <div className="text-xs text-muted-foreground">{t("total")}</div>
                <div className="text-lg font-bold text-primary">{fmt.bdt(formTotal)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("expense_rows")}</Label>
              <Button type="button" size="sm" variant="secondary" onClick={() => setRows([...rows, emptyRow()])}>
                <Plus className="w-4 h-4 mr-1" /> {t("add_row")}
              </Button>
            </div>
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={idx} className="rounded-lg border p-3 bg-card/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-muted-foreground">#{fmt.num(idx + 1)}</div>
                    {rows.length > 1 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <div className="lg:col-span-1">
                      <Label className="text-xs">{t("category")}</Label>
                      <CategoryCombobox
                        value={row.category}
                        onChange={(v) => setRows(rows.map((r, i) => i === idx ? { ...r, category: v } : r))}
                        options={catOptions}
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <Label className="text-xs">{t("paid_to")}</Label>
                      <Input list="exp-paid-to-list" value={row.paid_to} onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, paid_to: e.target.value } : r))} />
                    </div>
                    <div className="lg:col-span-1">
                      <Label className="text-xs">{t("amountBDT")}</Label>
                      <Input type="number" step="0.01" required value={row.amount} onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r))} />
                    </div>
                    <div className="lg:col-span-2">
                      <Label className="text-xs">{t("description")}</Label>
                      <Input list="exp-desc-list" value={row.description} onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, description: e.target.value } : r))} />
                    </div>
                    <div className="lg:col-span-5">
                      <Label className="text-xs">{t("note")}</Label>
                      <Input value={row.note} onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <datalist id="exp-paid-to-list">{paidToOptions.map(v => <option key={v} value={v} />)}</datalist>
          <datalist id="exp-desc-list">{descOptions.map(v => <option key={v} value={v} />)}</datalist>

          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>{editingVoucher ? t("update") : t("create_voucher")}</Button>
            <Button type="button" variant="outline" onClick={() => setRows([...rows, emptyRow()])}><Plus className="w-4 h-4 mr-1" /> {t("add_row")}</Button>
          </div>
        </form>
      </Card>

      {/* Print single voucher */}
      {printV && (
        <div className="print-area hidden print:block">
          <div className="p-8 max-w-3xl mx-auto text-black">
            <div className="border-2 border-black p-4 mb-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 shrink-0 flex items-center justify-center"><BankLogo className="w-full h-full" /></div>
                <div className="flex-1 text-center">
                  <div className="text-xl font-extrabold tracking-wide">ISLAMI BANK AGENT BANKING</div>
                  <div className="text-sm font-bold">M/S FEED HOUSE (121/11)</div>
                  <div className="text-xs">{t("outlet")}, {t("locationFull")}</div>
                </div>
              </div>
              <div className="text-center mt-3">
                <span className="inline-block border border-black px-4 py-1 text-base font-bold uppercase">{t("expense_voucher_doc")}</span>
              </div>
            </div>
            <table className="w-full border border-black border-collapse text-sm mb-4">
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-semibold bg-gray-100 w-1/4">{t("voucher_no")}</td>
                  <td className="border border-black p-2 w-1/4">{printV.voucher_no}</td>
                  <td className="border border-black p-2 font-semibold bg-gray-100 w-1/4">{t("date")}</td>
                  <td className="border border-black p-2 w-1/4">{fmt.date(printV.date)}</td>
                </tr>
              </tbody>
            </table>
            <table className="w-full border border-black border-collapse text-sm mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-2 w-10">Sl</th>
                  <th className="border border-black p-2 text-left">{t("category")}</th>
                  <th className="border border-black p-2 text-left">{t("description")}</th>
                  <th className="border border-black p-2 text-left">{t("paid_to")}</th>
                  <th className="border border-black p-2 w-32 text-right">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {printV.items.map((r: any, i: number) => (
                  <tr key={r.id}>
                    <td className="border border-black p-2 text-center">{fmt.num(i + 1)}</td>
                    <td className="border border-black p-2">{r.category}</td>
                    <td className="border border-black p-2">{r.description || "—"}{r.note ? <div className="text-xs text-gray-600">{r.note}</div> : null}</td>
                    <td className="border border-black p-2">{r.paid_to || "—"}</td>
                    <td className="border border-black p-2 text-right font-semibold">{fmt.bdt(Number(r.amount))}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-black p-2 text-right" colSpan={4}>{t("total")}</td>
                  <td className="border border-black p-2 text-right">{fmt.bdt(printV.total)}</td>
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

      <Card className={`p-5 ${printV ? "no-print" : "print-area"}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
          <h2 className="font-semibold">{t("voucher_list")}</h2>
          <Input placeholder={t("search") + "..."} className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="text-sm">{t("total")}: <span className="font-bold text-destructive">{fmt.bdt(grandTotal)}</span></div>
        </div>

        <div className="space-y-2">
          {filteredVouchers.map((v) => {
            const open = expanded.has(v.date);
            return (
              <div key={v.date} className="border rounded-lg overflow-hidden">
                <div className={cn("flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition", open && "bg-primary/5")} onClick={() => toggleExpand(v.date)}>
                  <Button type="button" size="sm" variant="ghost" className="p-1 h-7 w-7">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{fmt.date(v.date)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{v.voucher_no}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{fmt.num(v.items.length)} {t("items")}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{t("total")}</div>
                    <div className="font-bold text-destructive">{fmt.bdt(v.total)}</div>
                  </div>
                  <div className="flex gap-1 no-print" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => doPrint(v.date)} title={t("print")}><Printer className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => loadVoucher(v.date)} title={t("edit")}><Pencil className="w-4 h-4 text-primary" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onDeleteVoucher(v.date)} title={t("delete")}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
                {open && (
                  <div className="border-t bg-background overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs">
                        <tr>
                          <th className="p-2 w-10">#</th>
                          <th className="p-2">{t("category")}</th>
                          <th className="p-2">{t("description")}</th>
                          <th className="p-2">{t("paid_to")}</th>
                          <th className="p-2 text-right">{t("amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.items.map((r: any, i: number) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2 text-center text-muted-foreground">{fmt.num(i + 1)}</td>
                            <td className="p-2 font-medium">{r.category}</td>
                            <td className="p-2">{r.description || "—"}{r.note ? <div className="text-xs text-muted-foreground">{r.note}</div> : null}</td>
                            <td className="p-2">{r.paid_to || "—"}</td>
                            <td className="p-2 text-right font-semibold">{fmt.bdt(Number(r.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {filteredVouchers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">{t("no_vouchers")}</div>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-3">{t("total_vouchers")}: {fmt.num(vouchers.length)}</div>
      </Card>
    </div>
  );
}

function CategoryCombobox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { name: string; count: number; builtin?: boolean }[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const showCreate = query.trim() && !options.some(o => o.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || t("select_category")}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command shouldFilter={true}>
          <CommandInput placeholder={t("search_or_type") + "..."} value={query} onValueChange={setQuery} />
          <CommandList className="max-h-64">
            <CommandEmpty>{t("no_match")}</CommandEmpty>
            {showCreate && (
              <CommandGroup heading={t("create_new")}>
                <CommandItem value={`__new__${query}`} onSelect={() => { onChange(query.trim()); setOpen(false); setQuery(""); }}>
                  <Plus className="w-4 h-4 mr-2" /> {t("add")} "{query.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={t("suggestions")}>
              {options.map((opt) => (
                <CommandItem key={opt.name} value={opt.name} onSelect={() => { onChange(opt.name); setOpen(false); setQuery(""); }}>
                  <Check className={cn("w-4 h-4 mr-2", value.toLowerCase() === opt.name.toLowerCase() ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{opt.name}</span>
                  {opt.builtin ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">★</span>
                  ) : opt.count > 0 ? (
                    <span className="text-[10px] flex items-center gap-1 text-muted-foreground"><Sparkles className="w-3 h-3" />{opt.count}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
