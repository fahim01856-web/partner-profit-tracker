import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Pencil, Printer, Save, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/_app/cash-book")({ component: CashBookPage });

type Entry = {
  id: string;
  date: string;
  entry_type: "in" | "out";
  description: string;
  amount: number;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function CashBookPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();

  const [date, setDate] = useState(todayStr());
  const [form, setForm] = useState({
    id: null as string | null,
    entry_type: "in" as "in" | "out",
    description: "",
    amount: "",
  });
  const [openingInput, setOpeningInput] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["cash_book_entries", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_book_entries")
        .select("*")
        .eq("date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const { data: openingRow } = useQuery({
    queryKey: ["cash_book_opening", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("cash_book_opening")
        .select("*")
        .eq("date", date)
        .maybeSingle();
      return data;
    },
  });

  // Compute opening: explicit > previous day's closing > 0
  const { data: priorClosing = 0 } = useQuery({
    queryKey: ["cash_book_prior_closing", date],
    queryFn: async () => {
      const { data: open } = await supabase.from("cash_book_opening").select("*").lt("date", date).order("date", { ascending: false }).limit(1);
      const startDate = open?.[0]?.date ?? null;
      const startBal = open?.[0] ? Number(open[0].opening_balance) : 0;
      let q = supabase.from("cash_book_entries").select("entry_type,amount,date").lt("date", date);
      if (startDate) q = q.gte("date", startDate);
      const { data: rows } = await q;
      let bal = startBal;
      (rows ?? []).forEach((r: any) => {
        bal += r.entry_type === "in" ? Number(r.amount) : -Number(r.amount);
      });
      return bal;
    },
  });

  const opening = openingRow ? Number(openingRow.opening_balance) : priorClosing;
  const cashIn = entries.filter((e) => e.entry_type === "in").reduce((s, e) => s + Number(e.amount), 0);
  const cashOut = entries.filter((e) => e.entry_type === "out").reduce((s, e) => s + Number(e.amount), 0);
  const closing = opening + cashIn - cashOut;

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount || 0);
      if (!form.description.trim()) throw new Error(lang === "bn" ? "বিবরণ লিখুন" : "Description required");
      if (amount <= 0) throw new Error(lang === "bn" ? "পরিমাণ লিখুন" : "Amount required");
      const payload = { date, entry_type: form.entry_type, description: form.description.trim(), amount };
      if (form.id) {
        const { error } = await supabase.from("cash_book_entries").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cash_book_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_entries"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      toast.success(t("save") + " ✓");
      setForm({ id: null, entry_type: form.entry_type, description: "", amount: "" });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cash_book_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_entries"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      toast.success(t("deleted"));
    },
  });

  const saveOpening = useMutation({
    mutationFn: async () => {
      const val = Number(openingInput || 0);
      const { error } = await supabase.from("cash_book_opening").upsert({ date, opening_balance: val }, { onConflict: "date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash_book_opening"] });
      qc.invalidateQueries({ queryKey: ["cash_book_prior_closing"] });
      toast.success(t("save") + " ✓");
      setOpeningInput("");
    },
  });

  const startEdit = (e: Entry) => {
    setForm({ id: e.id, entry_type: e.entry_type, description: e.description, amount: String(e.amount) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> {lang === "bn" ? "দৈনিক ক্যাশ বুক" : "Daily Cash Book"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "প্রতিদিনের আয়, ব্যয় ও ব্যালেন্স" : "Daily cash in, out and balance"}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("print")}</Button>
      </div>

      <Card className="p-4 no-print">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>{t("date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>{lang === "bn" ? "ওপেনিং ব্যালেন্স (ম্যানুয়াল)" : "Opening Balance (manual)"}</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder={String(opening)} value={openingInput} onChange={(e) => setOpeningInput(e.target.value)} />
              <Button onClick={() => saveOpening.mutate()} disabled={!openingInput}><Save className="w-4 h-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{lang === "bn" ? "ম্যানুয়াল না দিলে আগের দিনের ক্লোজিং স্বয়ংক্রিয়ভাবে নেওয়া হবে" : "If empty, previous day's closing balance is used automatically"}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={lang === "bn" ? "ওপেনিং ব্যালেন্স" : "Opening Balance"} value={fmt.bdt(opening)} icon={<Wallet className="w-4 h-4" />} />
        <Stat label={lang === "bn" ? "ক্যাশ ইন" : "Cash In"} value={fmt.bdt(cashIn)} icon={<TrendingUp className="w-4 h-4" />} accent="text-emerald-600" />
        <Stat label={lang === "bn" ? "ক্যাশ আউট" : "Cash Out"} value={fmt.bdt(cashOut)} icon={<TrendingDown className="w-4 h-4" />} accent="text-red-600" />
        <Stat label={lang === "bn" ? "ক্লোজিং ব্যালেন্স" : "Closing Balance"} value={fmt.bdt(closing)} icon={<Wallet className="w-4 h-4" />} accent="text-primary" />
      </div>

      <Card className="p-4 no-print">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> {form.id ? t("edit") : (lang === "bn" ? "নতুন এন্ট্রি" : "New Entry")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>{lang === "bn" ? "ধরন" : "Type"}</Label>
            <Select value={form.entry_type} onValueChange={(v: any) => setForm({ ...form, entry_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">{lang === "bn" ? "ক্যাশ ইন (আয়)" : "Cash In"}</SelectItem>
                <SelectItem value="out">{lang === "bn" ? "ক্যাশ আউট (ব্যয়)" : "Cash Out"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{t("description")}</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>{t("amountBDT")}</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {form.id && <Button variant="outline" onClick={() => setForm({ id: null, entry_type: "in", description: "", amount: "" })}>{t("cancel_edit")}</Button>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="w-4 h-4" /> {form.id ? t("update") : t("save")}</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b font-semibold flex items-center justify-between print-block">
          <span>{lang === "bn" ? "দৈনিক ক্যাশ বুক — " : "Daily Cash Book — "}{fmt.date(date)}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "ক্যাশ ইন" : "Cash In"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "ক্যাশ আউট" : "Cash Out"}</TableHead>
                <TableHead className="text-right no-print">{t("edit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="font-semibold">{lang === "bn" ? "ওপেনিং ব্যালেন্স" : "Opening Balance"}</TableCell>
                <TableCell className="text-right font-semibold">{fmt.bdt(opening)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="no-print"></TableCell>
              </TableRow>
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noEntries")}</TableCell></TableRow>
              )}
              {entries.map((e, i) => (
                <TableRow key={e.id}>
                  <TableCell className="text-center">{fmt.num(i + 1)}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell className="text-right text-emerald-700">{e.entry_type === "in" ? fmt.bdt(e.amount) : ""}</TableCell>
                  <TableCell className="text-right text-red-700">{e.entry_type === "out" ? fmt.bdt(e.amount) : ""}</TableCell>
                  <TableCell className="text-right no-print">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) del.mutate(e.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2}>{lang === "bn" ? "মোট" : "Total"}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt.bdt(cashIn)}</TableCell>
                <TableCell className="text-right text-red-700">{fmt.bdt(cashOut)}</TableCell>
                <TableCell className="no-print"></TableCell>
              </TableRow>
              <TableRow className="bg-primary/10 font-bold">
                <TableCell colSpan={2}>{lang === "bn" ? "ক্লোজিং ব্যালেন্স" : "Closing Balance"}</TableCell>
                <TableCell colSpan={2} className="text-right text-primary">{fmt.bdt(closing)}</TableCell>
                <TableCell className="no-print"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</div>
      <div className={`text-lg font-bold mt-1 ${accent ?? ""}`}>{value}</div>
    </Card>
  );
}
