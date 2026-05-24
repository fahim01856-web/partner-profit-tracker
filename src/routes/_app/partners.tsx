import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Printer, Plus, Trash2, Pencil, Wallet, TrendingUp, Users, FileBarChart, X,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/partners")({ component: PartnersPage });

type Entry = {
  id: string;
  month: number;
  year: number;
  total_profit: number;
  partner1_name: string;
  partner1_percent: number;
  partner2_name: string;
  partner2_percent: number;
  notes: string | null;
  created_at: string;
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const emptyForm = () => ({
  id: null as string | null,
  month: currentMonth,
  year: currentYear,
  total_profit: "" as string,
  partner1_name: "Md. Fahim",
  partner1_percent: 80,
  partner2_name: "Partner 2",
  partner2_percent: 20,
  notes: "",
});

function PartnersPage() {
  const { t, lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [fMonth, setFMonth] = useState<string>("all");
  const [fYear, setFYear] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["monthly_profits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_profits")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        month: Number(form.month),
        year: Number(form.year),
        total_profit: Number(form.total_profit) || 0,
        partner1_name: form.partner1_name.trim() || "Partner 1",
        partner1_percent: Number(form.partner1_percent) || 0,
        partner2_name: form.partner2_name.trim() || "Partner 2",
        partner2_percent: Number(form.partner2_percent) || 0,
        notes: form.notes || null,
      };
      if (form.id) {
        const { error } = await supabase.from("monthly_profits").update(payload).eq("id", form.id);
        if (error) throw error;
        return "update";
      } else {
        const { error } = await supabase.from("monthly_profits").upsert(payload, { onConflict: "month,year" });
        if (error) throw error;
        return "insert";
      }
    },
    onSuccess: (kind) => {
      toast.success(kind === "update" ? t("pp_updated") : t("pp_saved"));
      qc.invalidateQueries({ queryKey: ["monthly_profits"] });
      setForm(emptyForm());
      setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_profits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("deleted"));
      qc.invalidateQueries({ queryKey: ["monthly_profits"] });
    },
  });

  const totalProfitNum = Number(form.total_profit) || 0;
  const p1Calc = Math.round((totalProfitNum * Number(form.partner1_percent || 0)) / 100);
  const p2Calc = Math.round((totalProfitNum * Number(form.partner2_percent || 0)) / 100);
  const grandTotal = p1Calc + p2Calc;

  // Filtering
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (fMonth !== "all" && e.month !== Number(fMonth)) return false;
      if (fYear !== "all" && e.year !== Number(fYear)) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (!e.partner1_name.toLowerCase().includes(s) && !e.partner2_name.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [entries, fMonth, fYear, search]);

  const stats = useMemo(() => {
    const totalProfit = filtered.reduce((s, e) => s + Number(e.total_profit), 0);
    const p1 = filtered.reduce((s, e) => s + (Number(e.total_profit) * Number(e.partner1_percent)) / 100, 0);
    const p2 = filtered.reduce((s, e) => s + (Number(e.total_profit) * Number(e.partner2_percent)) / 100, 0);
    return { totalProfit, p1, p2, count: filtered.length };
  }, [filtered]);

  const years = useMemo(() => {
    const ys = Array.from(new Set(entries.map((e) => e.year))).sort((a, b) => b - a);
    return ys.length ? ys : [currentYear];
  }, [entries]);

  // Chart data – sort ascending by year/month for line
  const chartData = useMemo(() => {
    return [...filtered]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((e) => ({
        name: `${fmt.months[e.month - 1].slice(0, 3)} ${fmt.num(e.year)}`,
        total: Number(e.total_profit),
        p1: Math.round((Number(e.total_profit) * Number(e.partner1_percent)) / 100),
        p2: Math.round((Number(e.total_profit) * Number(e.partner2_percent)) / 100),
      }));
  }, [filtered, fmt]);

  const pieData = [
    { name: lang === "bn" ? "পার্টনার ১" : "Partner 1", value: Math.round(stats.p1) },
    { name: lang === "bn" ? "পার্টনার ২" : "Partner 2", value: Math.round(stats.p2) },
  ];
  const pieColors = ["hsl(150 60% 35%)", "hsl(42 80% 50%)"];

  const handleEdit = (e: Entry) => {
    setForm({
      id: e.id,
      month: e.month,
      year: e.year,
      total_profit: String(e.total_profit),
      partner1_name: e.partner1_name,
      partner1_percent: Number(e.partner1_percent),
      partner2_name: e.partner2_name,
      partner2_percent: Number(e.partner2_percent),
      notes: e.notes ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("pp_title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("pp_sub")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 mr-1.5" /> {t("pp_print_sheet")}
          </Button>
          <Button onClick={() => { setForm(emptyForm()); setShowForm((v) => !v); }}>
            {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
            {showForm ? t("cancel") : t("pp_new_entry")}
          </Button>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {[
          { label: t("pp_total_profit_card"), value: fmt.bdt(stats.totalProfit), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
          { label: t("pp_p1_total_card"), value: fmt.bdt(stats.p1), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
          { label: t("pp_p2_total_card"), value: fmt.bdt(stats.p2), icon: Users, color: "text-gold-foreground", bg: "bg-gold/20" },
          { label: t("pp_entries_count"), value: fmt.num(stats.count), icon: FileBarChart, color: "text-accent-foreground", bg: "bg-accent/40" },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`w-10 h-10 rounded-lg grid place-items-center ${s.bg} ${s.color} mb-3`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-bold mt-1 break-words">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Entry Form */}
      {showForm && (
        <Card className="p-6 no-print">
          <h2 className="text-lg font-semibold mb-4">{form.id ? t("pp_edit_entry") : t("pp_new_entry")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>{t("pp_month")}</Label>
              <Select value={String(form.month)} onValueChange={(v) => setForm((f) => ({ ...f, month: Number(v) }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fmt.months.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("pp_year")}</Label>
              <Input type="number" value={form.year} className="mt-1.5"
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>{t("pp_total_profit")}</Label>
              <Input type="number" step="0.01" value={form.total_profit} className="mt-1.5"
                placeholder="e.g. 46061"
                onChange={(e) => setForm((f) => ({ ...f, total_profit: e.target.value }))} />
            </div>
            <div>
              <Label>{t("pp_partner1")}</Label>
              <Input value={form.partner1_name} className="mt-1.5"
                onChange={(e) => setForm((f) => ({ ...f, partner1_name: e.target.value }))} />
            </div>
            <div>
              <Label>{t("pp_percent")} — {t("pp_partner1")}</Label>
              <Input type="number" value={form.partner1_percent} className="mt-1.5"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setForm((f) => ({ ...f, partner1_percent: v, partner2_percent: Math.max(0, 100 - v) }));
                }} />
            </div>
            <div>
              <Label>{t("pp_partner2")}</Label>
              <Input value={form.partner2_name} className="mt-1.5"
                onChange={(e) => setForm((f) => ({ ...f, partner2_name: e.target.value }))} />
            </div>
            <div>
              <Label>{t("pp_percent")} — {t("pp_partner2")}</Label>
              <Input type="number" value={form.partner2_percent} className="mt-1.5"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setForm((f) => ({ ...f, partner2_percent: v, partner1_percent: Math.max(0, 100 - v) }));
                }} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>{t("pp_notes")}</Label>
              <Textarea value={form.notes} className="mt-1.5"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {/* Auto calculation preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="rounded-lg border-2 border-success/30 bg-success/5 p-4">
              <div className="text-xs text-muted-foreground">{t("pp_p1_share")} ({fmt.num(form.partner1_percent)}%)</div>
              <div className="text-xl font-bold text-success mt-1">{fmt.bdt(p1Calc)}</div>
            </div>
            <div className="rounded-lg border-2 border-gold/40 bg-gold/10 p-4">
              <div className="text-xs text-muted-foreground">{t("pp_p2_share")} ({fmt.num(form.partner2_percent)}%)</div>
              <div className="text-xl font-bold mt-1" style={{ color: "var(--gold-foreground)" }}>{fmt.bdt(p2Calc)}</div>
            </div>
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <div className="text-xs text-muted-foreground">{t("pp_grand_total")}</div>
              <div className="text-xl font-bold text-primary mt-1">{fmt.bdt(grandTotal)}</div>
            </div>
          </div>

          <div className="flex gap-2 mt-5 justify-end">
            <Button variant="outline" onClick={() => { setForm(emptyForm()); setShowForm(false); }}>
              {t("cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {t("pp_save")}
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">{t("pp_month")}</Label>
            <Select value={fMonth} onValueChange={setFMonth}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pp_all_months")}</SelectItem>
                {fmt.months.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("pp_year")}</Label>
            <Select value={fYear} onValueChange={setFYear}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pp_all_years")}</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{fmt.num(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">{t("pp_search_partner")}</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1.5" placeholder={t("pp_search_partner")} />
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">{t("pp_monthly_chart")}</h3>
          <div className="h-72">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="p1" name={lang === "bn" ? "পার্টনার ১" : "Partner 1"} fill="hsl(150 60% 35%)" />
                  <Bar dataKey="p2" name={lang === "bn" ? "পার্টনার ২" : "Partner 2"} fill="hsl(42 80% 50%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">{t("pp_no_entries")}</div>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">{t("pp_share_chart")}</h3>
          <div className="h-72">
            {stats.totalProfit > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">{t("pp_no_entries")}</div>
            )}
          </div>
        </Card>
      </div>

      {/* PRINT AREA — banking style sheet */}
      <div className="print-area">
        <Card className="p-6 print:shadow-none print:border-0">
          <div className="text-center border-b-2 border-primary pb-4 mb-4">
            <div className="text-xl sm:text-2xl font-bold uppercase tracking-wide">
              {lang === "bn" ? "ইসলামী ব্যাংক এজেন্ট ব্যাংকিং" : "ISLAMI BANK AGENT BANKING"}
            </div>
            <div className="text-sm font-semibold mt-1">
              {lang === "bn" ? "মেসার্স ফিড হাউজ (১২১/১১)" : "M/S FEED HOUSE (121/11)"}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === "bn" ? "ফকির বাজার আউটলেট, বুড়িচং, কুমিল্লা" : "Fakir Bazar Outlet, Burichong, Cumilla"}
            </div>
            <div className="mt-3 text-base font-semibold underline underline-offset-4">
              {t("pp_report_title")}
            </div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground mb-3 px-1">
            <div>{t("pp_filter")}: {fMonth === "all" ? t("pp_all_months") : fmt.months[Number(fMonth) - 1]} / {fYear === "all" ? t("pp_all_years") : fmt.num(fYear)}</div>
            <div>{lang === "bn" ? "প্রিন্ট তারিখ" : "Print Date"}: {fmt.date(new Date())}</div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="text-center font-bold text-foreground border-r">{t("date")}</TableHead>
                  <TableHead className="text-center font-bold text-foreground border-r">
                    {t("pp_partner1")}
                  </TableHead>
                  <TableHead className="text-center font-bold text-foreground border-r">{t("pp_taka")}</TableHead>
                  <TableHead className="text-center font-bold text-foreground border-r">
                    {t("pp_partner2")}
                  </TableHead>
                  <TableHead className="text-center font-bold text-foreground border-r">{t("pp_taka")}</TableHead>
                  <TableHead className="text-center font-bold text-foreground border-r">
                    {lang === "bn" ? "মোট প্রফিট (৳)" : "Total Profit TK"}
                  </TableHead>
                  <TableHead className="text-center font-bold text-foreground no-print">{lang === "bn" ? "কাজ" : "Action"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("pp_no_entries")}</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => {
                    const p1 = Math.round((Number(e.total_profit) * Number(e.partner1_percent)) / 100);
                    const p2 = Math.round((Number(e.total_profit) * Number(e.partner2_percent)) / 100);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="border-r font-medium whitespace-nowrap">
                          {fmt.months[e.month - 1]} {fmt.num(e.year)}
                        </TableCell>
                        <TableCell className="border-r">
                          <div className="font-semibold">{e.partner1_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {lang === "bn" ? "প্রফিট" : "Profit"} ({fmt.num(Number(e.total_profit))} × {fmt.num(e.partner1_percent)}%)
                          </div>
                        </TableCell>
                        <TableCell className="border-r text-right font-semibold tabular-nums">{fmt.bdt(p1)}</TableCell>
                        <TableCell className="border-r">
                          <div className="font-semibold">{e.partner2_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {lang === "bn" ? "প্রফিট" : "Profit"} ({fmt.num(Number(e.total_profit))} × {fmt.num(e.partner2_percent)}%)
                          </div>
                        </TableCell>
                        <TableCell className="border-r text-right font-semibold tabular-nums">{fmt.bdt(p2)}</TableCell>
                        <TableCell className="border-r text-right font-bold text-primary tabular-nums">{fmt.bdt(Number(e.total_profit))}</TableCell>
                        <TableCell className="no-print">
                          <div className="flex gap-1 justify-center">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(e)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              if (confirm(t("pp_confirm_delete"))) del.mutate(e.id);
                            }}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {filtered.length > 0 && (
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="border-r text-right">{t("pp_grand_total")}</TableCell>
                    <TableCell className="border-r" />
                    <TableCell className="border-r text-right tabular-nums text-success">{fmt.bdt(stats.p1)}</TableCell>
                    <TableCell className="border-r" />
                    <TableCell className="border-r text-right tabular-nums" style={{ color: "var(--gold-foreground)" }}>{fmt.bdt(stats.p2)}</TableCell>
                    <TableCell className="border-r text-right tabular-nums text-primary">{fmt.bdt(stats.totalProfit)}</TableCell>
                    <TableCell className="no-print" />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-16 pt-4 text-center text-sm">
            <div>
              <div className="border-t-2 border-foreground/60 pt-2">{t("pp_signature")} — {lang === "bn" ? "পার্টনার ১" : "Partner 1"}</div>
            </div>
            <div>
              <div className="border-t-2 border-foreground/60 pt-2">{t("pp_signature")} — {lang === "bn" ? "পার্টনার ২" : "Partner 2"}</div>
            </div>
          </div>

          <div className="text-center text-[10px] text-muted-foreground mt-6 print:mt-10 border-t pt-2">
            {lang === "bn"
              ? "এই রিপোর্টটি সিস্টেম দ্বারা স্বয়ংক্রিয়ভাবে তৈরি। ইসলামী ব্যাংক বাংলাদেশ পিএলসি — এজেন্ট আউটলেট ১২১/১১"
              : "This report is auto-generated. Islami Bank Bangladesh PLC — Agent Outlet 121/11"}
          </div>
        </Card>
      </div>
    </div>
  );
}
