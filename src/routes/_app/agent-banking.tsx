import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Save, FileDown, Banknote, TrendingUp, Percent,
  Wallet, Calendar, BarChart3, X, ArrowUp, ArrowDown, Trophy, TrendingDown,
  Activity, Minus, Camera, Sparkles, Loader2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { ocrAgentBankingBalances } from "@/lib/ab-ocr.functions";

export const Route = createFileRoute("/_app/agent-banking")({ component: AgentBankingPage });

const ACCOUNTS = ["AWCA", "MSA", "MSSA", "MMPDSA", "MTDRA", "MHSA", "SMSA", "MFSA"] as const;
type AccountType = (typeof ACCOUNTS)[number];

const INCOME_TYPES = ["Online", "Remittance", "Other"] as const;
type IncomeType = (typeof INCOME_TYPES)[number];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtBDT = (n: number) =>
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(n || 0);

type Balance = { id: string; date: string; account_type: string; balance: number; note: string | null };
type Slab = { id: string; account_type: string; min_amount: number; max_amount: number | null; yearly_percent: number; sort_order: number };
type Income = { id: string; date: string; income_type: string; source: string | null; amount: number; note: string | null };

function calcDailyProfit(balance: number, slabs: Slab[]): { profit: number; pct: number } {
  // Tiered (bracket) calculation: each slice of balance within a slab's
  // [min, max] range is charged that slab's yearly_percent — like income tax brackets.
  if (!balance || balance <= 0 || slabs.length === 0) return { profit: 0, pct: 0 };
  const sorted = [...slabs].sort((a, b) => Number(a.min_amount) - Number(b.min_amount));
  let yearly = 0;
  for (const s of sorted) {
    const lo = Number(s.min_amount);
    const hi = s.max_amount == null ? Infinity : Number(s.max_amount);
    if (balance <= lo) break;
    const slice = Math.min(balance, hi) - lo;
    if (slice > 0) yearly += slice * (Number(s.yearly_percent) / 100);
  }
  // Round to 2 decimals to avoid floating-point artefacts (e.g. 2.9999999 → 3.00)
  const pct = Math.round(((yearly / balance) * 100) * 100) / 100;
  return { profit: yearly / 365, pct };
}

function AgentBankingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");

  const { data: balances = [] } = useQuery({
    queryKey: ["ab_balances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ab_account_balances").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data as Balance[]) ?? [];
    },
  });
  const { data: slabs = [] } = useQuery({
    queryKey: ["ab_slabs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ab_profit_slabs").select("*").order("account_type").order("sort_order");
      if (error) throw error;
      return (data as Slab[]) ?? [];
    },
  });
  const { data: incomes = [] } = useQuery({
    queryKey: ["ab_incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ab_income_entries").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data as Income[]) ?? [];
    },
  });

  // ===== Latest balances per account =====
  const latestPerAccount = useMemo(() => {
    const map = new Map<string, Balance>();
    for (const b of [...balances].sort((a, b) => a.date.localeCompare(b.date))) {
      map.set(b.account_type, b);
    }
    return map;
  }, [balances]);

  const totalDeposit = useMemo(
    () => ACCOUNTS.reduce((s, a) => s + Number(latestPerAccount.get(a)?.balance || 0), 0),
    [latestPerAccount]
  );

  const profitByAccount = useMemo(() => {
    return ACCOUNTS.map((a) => {
      const bal = Number(latestPerAccount.get(a)?.balance || 0);
      const accSlabs = slabs.filter((s) => s.account_type === a);
      const { profit, pct } = calcDailyProfit(bal, accSlabs);
      return { account: a, balance: bal, dailyProfit: profit, pct };
    });
  }, [latestPerAccount, slabs]);

  const dailyProfit = useMemo(() => profitByAccount.reduce((s, x) => s + x.dailyProfit, 0), [profitByAccount]);
  const monthlyProfit = dailyProfit * 30;
  const yearlyProfit = dailyProfit * 365;

  const incomeByType = useMemo(() => {
    const m: Record<string, number> = { Online: 0, Remittance: 0, Other: 0 };
    for (const i of incomes) m[i.income_type] = (m[i.income_type] || 0) + Number(i.amount);
    return m;
  }, [incomes]);
  const totalIncome = Object.values(incomeByType).reduce((s, n) => s + n, 0);

  // ===== Daily income aggregation =====
  const dailyIncome = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of incomes) m.set(i.date, (m.get(i.date) || 0) + Number(i.amount));
    return Array.from(m.entries()).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
  }, [incomes]);

  const incomeStats = useMemo(() => {
    if (dailyIncome.length === 0) {
      return { today: 0, yesterday: 0, changePct: 0, maxDay: null as null | { date: string; total: number }, minDay: null as null | { date: string; total: number }, avg7: 0, avg30: 0 };
    }
    const today = todayStr();
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const todayTotal = dailyIncome.find((d) => d.date === today)?.total ?? 0;
    const yestTotal = dailyIncome.find((d) => d.date === yest)?.total ?? 0;
    const changePct = yestTotal > 0 ? ((todayTotal - yestTotal) / yestTotal) * 100 : (todayTotal > 0 ? 100 : 0);
    const sorted = [...dailyIncome].sort((a, b) => b.total - a.total);
    const maxDay = sorted[0];
    const minDay = sorted[sorted.length - 1];
    const last7 = dailyIncome.slice(-7);
    const last30 = dailyIncome.slice(-30);
    const avg7 = last7.reduce((s, d) => s + d.total, 0) / (last7.length || 1);
    const avg30 = last30.reduce((s, d) => s + d.total, 0) / (last30.length || 1);
    return { today: todayTotal, yesterday: yestTotal, changePct, maxDay, minDay, avg7, avg30 };
  }, [dailyIncome]);

  // ===== Monthly aggregation =====
  const monthlyIncome = useMemo(() => {
    const m = new Map<string, { month: string; Online: number; Remittance: number; Other: number; total: number }>();
    for (const i of incomes) {
      const k = i.date.slice(0, 7);
      const row = m.get(k) || { month: k, Online: 0, Remittance: 0, Other: 0, total: 0 };
      row[i.income_type as IncomeType] = (row[i.income_type as IncomeType] || 0) + Number(i.amount);
      row.total += Number(i.amount);
      m.set(k, row);
    }
    return Array.from(m.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [incomes]);

  const monthChangePct = useMemo(() => {
    if (monthlyIncome.length < 2) return 0;
    const cur = monthlyIncome[monthlyIncome.length - 1].total;
    const prev = monthlyIncome[monthlyIncome.length - 2].total;
    return prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0);
  }, [monthlyIncome]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Banknote className="w-7 h-7 text-primary" /> Agent Banking — Daily Income & Profit
          </h1>
          <p className="text-sm text-muted-foreground">প্রতিদিনের ডিপোজিট, প্রফিট স্ল্যাব ও ইনকাম ব্যবস্থাপনা</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <FileDown className="w-4 h-4 mr-2" /> Print / PDF
        </Button>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Deposit (BDT)" value={fmtBDT(totalDeposit)} icon={Wallet} grad="from-blue-500 to-indigo-600" />
        <KpiCard label="Daily Profit" value={fmtBDT(dailyProfit)} icon={TrendingUp} grad="from-emerald-500 to-teal-600" />
        <KpiCard label="Monthly Profit (est.)" value={fmtBDT(monthlyProfit)} icon={Calendar} grad="from-amber-500 to-orange-600" />
        <KpiCard label="Total Income (all-time)" value={fmtBDT(totalIncome)} icon={BarChart3} grad="from-fuchsia-500 to-pink-600" />
      </div>

      {/* Daily Income Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MiniStat label="Today's Income" value={fmtBDT(incomeStats.today)} tone="blue" />
        <MiniStat label="Yesterday" value={fmtBDT(incomeStats.yesterday)} tone="slate" />
        <MiniStat
          label="Day-over-Day"
          value={`${incomeStats.changePct >= 0 ? "▲" : "▼"} ${Math.abs(incomeStats.changePct).toFixed(1)}%`}
          tone={incomeStats.changePct >= 0 ? "green" : "red"}
        />
        <MiniStat label="7-Day Avg" value={fmtBDT(incomeStats.avg7)} tone="amber" />
        <MiniStat
          label="Highest Day"
          value={incomeStats.maxDay ? fmtBDT(incomeStats.maxDay.total) : "—"}
          sub={incomeStats.maxDay?.date}
          tone="green"
        />
        <MiniStat
          label="Lowest Day"
          value={incomeStats.minDay ? fmtBDT(incomeStats.minDay.total) : "—"}
          sub={incomeStats.minDay?.date}
          tone="red"
        />
        <MiniStat label="30-Day Avg" value={fmtBDT(incomeStats.avg30)} tone="blue" />
        <MiniStat
          label="Month-over-Month"
          value={`${monthChangePct >= 0 ? "▲" : "▼"} ${Math.abs(monthChangePct).toFixed(1)}%`}
          tone={monthChangePct >= 0 ? "green" : "red"}
        />
      </div>



      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="deposit-analytics">Deposit Analytics</TabsTrigger>
          <TabsTrigger value="balance">Daily Balance</TabsTrigger>
          <TabsTrigger value="slabs">Profit Slabs</TabsTrigger>
          <TabsTrigger value="income">Income Entry</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Dashboard
            profitByAccount={profitByAccount}
            monthlyIncome={monthlyIncome}
            incomeByType={incomeByType}
            yearlyProfit={yearlyProfit}
          />
        </TabsContent>

        <TabsContent value="deposit-analytics" className="space-y-4">
          <DepositAnalytics balances={balances} />
        </TabsContent>


        <TabsContent value="balance">
          <BalanceTab balances={balances} qc={qc} />
        </TabsContent>

        <TabsContent value="slabs">
          <SlabTab slabs={slabs} qc={qc} />
        </TabsContent>

        <TabsContent value="income">
          <IncomeTab incomes={incomes} qc={qc} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab balances={balances} incomes={incomes} slabs={slabs} qc={qc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
/* ============ Mini stat chip ============ */
function MiniStat({ label, value, sub, tone = "blue" }: { label: string; value: string; sub?: string; tone?: "blue" | "green" | "red" | "amber" | "slate" }) {
  const toneCls = {
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  }[tone];
  return (
    <div className={`rounded-lg border p-2.5 ${toneCls}`}>
      <div className="text-[10px] font-medium opacity-80 truncate">{label}</div>
      <div className="text-sm font-bold truncate">{value}</div>
      {sub && <div className="text-[10px] opacity-70 truncate">{sub}</div>}
    </div>
  );
}


/* ============ KPI ============ */
function KpiCard({
  label, value, icon: Icon, grad,
}: { label: string; value: string; icon: any; grad: string }) {
  return (
    <Card className={`p-4 bg-gradient-to-br ${grad} text-white border-0 shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs opacity-90 truncate">{label}</div>
          <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
        </div>
        <Icon className="w-8 h-8 opacity-70 shrink-0" />
      </div>
    </Card>
  );
}

/* ============ Dashboard tab ============ */
function Dashboard({
  profitByAccount, monthlyIncome, incomeByType, yearlyProfit,
}: {
  profitByAccount: { account: string; balance: number; dailyProfit: number; pct: number }[];
  monthlyIncome: { month: string; Online: number; Remittance: number; Other: number; total: number }[];
  incomeByType: Record<string, number>;
  yearlyProfit: number;
}) {
  const pieData = Object.entries(incomeByType).map(([k, v]) => ({ name: k, value: v }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4" /> Account-wise Balance & Daily Profit</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={profitByAccount}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="account" />
            <YAxis />
            <Tooltip formatter={(v: any) => fmtBDT(Number(v))} />
            <Legend />
            <Bar dataKey="balance" fill="#3b82f6" name="Balance" />
            <Bar dataKey="dailyProfit" fill="#10b981" name="Daily Profit" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Income Distribution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => fmtBDT(Number(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Monthly Income Trend</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthlyIncome}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v: any) => fmtBDT(Number(v))} />
            <Legend />
            <Area type="monotone" dataKey="Online" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            <Area type="monotone" dataKey="Remittance" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
            <Area type="monotone" dataKey="Other" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="font-semibold mb-3">Projected Yearly Profit (based on current balances & slabs)</h3>
        <div className="text-3xl font-bold text-emerald-600">৳ {fmtBDT(yearlyProfit)}</div>
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Yearly %</TableHead>
              <TableHead className="text-right">Daily Profit</TableHead>
              <TableHead className="text-right">Yearly Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profitByAccount.map((r) => (
              <TableRow key={r.account}>
                <TableCell className="font-medium">{r.account}</TableCell>
                <TableCell className="text-right">{fmtBDT(r.balance)}</TableCell>
                <TableCell className="text-right">{r.pct}%</TableCell>
                <TableCell className="text-right text-emerald-600">{fmtBDT(r.dailyProfit)}</TableCell>
                <TableCell className="text-right text-emerald-700 font-semibold">{fmtBDT(r.dailyProfit * 365)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ============ Balance tab ============ */
function BalanceTab({ balances, qc }: { balances: Balance[]; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ id: null as string | null, date: todayStr(), account_type: "AWCA" as AccountType, balance: "", note: "" });
  const [filter, setFilter] = useState<string>("all");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        account_type: form.account_type,
        balance: Number(form.balance || 0),
        note: form.note || null,
      };
      if (form.id) {
        const { error } = await supabase.from("ab_account_balances").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ab_account_balances").upsert(payload, { onConflict: "date,account_type" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Balance saved");
      setForm({ id: null, date: todayStr(), account_type: "AWCA", balance: "", note: "" });
      qc.invalidateQueries({ queryKey: ["ab_balances"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ab_account_balances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ab_balances"] }); },
  });

  const rows = balances.filter((b) => filter === "all" || b.account_type === filter);

  return (
    <div className="space-y-4">
      <PhotoBulkUpload qc={qc} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-1 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> {form.id ? "Edit" : "Add"} Daily Balance</h3>
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <Label>Account Type</Label>
          <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v as AccountType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Balance (BDT)</Label>
          <Input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label>Note</Label>
          <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.balance} className="flex-1">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          {form.id && (
            <Button variant="outline" onClick={() => setForm({ id: null, date: todayStr(), account_type: "AWCA", balance: "", note: "" })}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Balance History</h3>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No entries</TableCell></TableRow>
              ) : rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.date}</TableCell>
                  <TableCell><Badge variant="secondary">{b.account_type}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmtBDT(Number(b.balance))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.note}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setForm({ id: b.id, date: b.date, account_type: b.account_type as AccountType, balance: String(b.balance), note: b.note || "" })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(b.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      </div>
    </div>
  );
}

/* ============ Photo bulk-upload (OCR) ============ */
function PhotoBulkUpload({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [date, setDate] = useState(todayStr());
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const runOcr = useServerFn(ocrAgentBankingBalances);

  const readFile = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("Image too large (max 8MB)"); return; }
    setLoading(true);
    try {
      const dataUrl = await readFile(f);
      setPreview(dataUrl);
      const result = await runOcr({ data: { imageDataUrl: dataUrl } });
      const next: Record<string, string> = {};
      for (const a of ACCOUNTS) {
        const v = (result as any)[a];
        if (v != null) next[a] = String(v);
      }
      setValues(next);
      if (result.date) setDate(result.date);
      const found = Object.keys(next).length;
      if (found === 0) toast.warning("কোনো ব্যালেন্স ডিটেক্ট হয়নি — ম্যানুয়ালি যোগ করুন");
      else toast.success(`${found} টি অ্যাকাউন্টের ব্যালেন্স অটো-ফিল হয়েছে`);
    } catch (e: any) {
      toast.error(e?.message || "OCR failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAll = useMutation({
    mutationFn: async () => {
      const rows = ACCOUNTS
        .filter((a) => values[a] && !isNaN(Number(values[a])))
        .map((a) => ({ date, account_type: a, balance: Number(values[a]), note: "Auto-filled from photo" }));
      if (rows.length === 0) throw new Error("No values to save");
      const { error } = await supabase
        .from("ab_account_balances")
        .upsert(rows, { onConflict: "date,account_type" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} টি ব্যালেন্স সেভ হয়েছে`);
      qc.invalidateQueries({ queryKey: ["ab_balances"] });
      setValues({});
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4 border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> ছবি থেকে অটো-আপডেট (AI OCR)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            ডেইলি ব্যালেন্স রিপোর্টের ছবি আপলোড করুন — AWCA, MSA, MSSA, MMPDSA, MTDRA, MHSA, SMSA, MFSA সবগুলো অ্যাকাউন্টের ব্যালেন্স অটোমেটিকলি ফিল হবে।
          </p>
        </div>
        <div className="w-44">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
            {loading ? "Reading…" : "ছবি আপলোড / ক্যামেরা"}
          </Button>
          {preview && (
            <img src={preview} alt="preview" className="rounded-md border max-h-48 w-full object-contain bg-muted" />
          )}
        </div>

        <div className="md:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ACCOUNTS.map((a) => (
              <div key={a}>
                <Label className="text-xs">{a}</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={values[a] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [a]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => { setValues({}); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
            <Button onClick={() => saveAll.mutate()} disabled={saveAll.isPending || Object.keys(values).length === 0}>
              <Save className="w-4 h-4 mr-2" />
              সব সেভ করুন ({Object.keys(values).length})
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ============ Slabs tab ============ */
function SlabTab({ slabs, qc }: { slabs: Slab[]; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ id: null as string | null, account_type: "AWCA" as AccountType, min_amount: "", max_amount: "", yearly_percent: "", sort_order: "0" });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        account_type: form.account_type,
        min_amount: Number(form.min_amount || 0),
        max_amount: form.max_amount ? Number(form.max_amount) : null,
        yearly_percent: Number(form.yearly_percent || 0),
        sort_order: Number(form.sort_order || 0),
      };
      if (form.id) {
        const { error } = await supabase.from("ab_profit_slabs").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ab_profit_slabs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Slab saved");
      setForm({ id: null, account_type: "AWCA", min_amount: "", max_amount: "", yearly_percent: "", sort_order: "0" });
      qc.invalidateQueries({ queryKey: ["ab_slabs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ab_profit_slabs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ab_slabs"] }); },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-1 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Percent className="w-4 h-4" /> {form.id ? "Edit" : "Add"} Profit Slab</h3>
        <div>
          <Label>Account Type</Label>
          <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v as AccountType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Min Amount</Label>
            <Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} placeholder="0" />
          </div>
          <div>
            <Label>Max Amount</Label>
            <Input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} placeholder="∞" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Yearly %</Label>
            <Input type="number" step="0.01" value={form.yearly_percent} onChange={(e) => setForm({ ...form, yearly_percent: e.target.value })} placeholder="2.0" />
          </div>
          <div>
            <Label>Sort</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">উদাহরণ: 0–3 কোটি = 2%, 3–5 কোটি = 1.5%</p>
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
            <Save className="w-4 h-4 mr-2" /> Save Slab
          </Button>
          {form.id && (
            <Button variant="outline" onClick={() => setForm({ id: null, account_type: "AWCA", min_amount: "", max_amount: "", yearly_percent: "", sort_order: "0" })}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="font-semibold mb-3">Configured Slabs</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead className="text-right">Yearly %</TableHead>
                <TableHead className="text-right">Daily %</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slabs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No slabs configured</TableCell></TableRow>
              ) : slabs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><Badge>{s.account_type}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{fmtBDT(Number(s.min_amount))}</TableCell>
                  <TableCell className="text-right font-mono">{s.max_amount == null ? "∞" : fmtBDT(Number(s.max_amount))}</TableCell>
                  <TableCell className="text-right font-semibold text-blue-600">{s.yearly_percent}%</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{(Number(s.yearly_percent) / 365).toFixed(5)}%</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setForm({ id: s.id, account_type: s.account_type as AccountType, min_amount: String(s.min_amount), max_amount: s.max_amount == null ? "" : String(s.max_amount), yearly_percent: String(s.yearly_percent), sort_order: String(s.sort_order) })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(s.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ============ Income tab ============ */
function IncomeTab({ incomes, qc }: { incomes: Income[]; qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({ id: null as string | null, date: todayStr(), income_type: "Online" as IncomeType, source: "", amount: "", note: "" });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        income_type: form.income_type,
        source: form.source || null,
        amount: Number(form.amount || 0),
        note: form.note || null,
      };
      if (form.id) {
        const { error } = await supabase.from("ab_income_entries").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ab_income_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Income saved");
      setForm({ id: null, date: todayStr(), income_type: "Online", source: "", amount: "", note: "" });
      qc.invalidateQueries({ queryKey: ["ab_incomes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ab_income_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["ab_incomes"] }); },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-1 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> {form.id ? "Edit" : "Add"} Income</h3>
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <Label>Income Type</Label>
          <Select value={form.income_type} onValueChange={(v) => setForm({ ...form, income_type: v as IncomeType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INCOME_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Source / Description</Label>
          <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. bKash cash-in" />
        </div>
        <div>
          <Label>Amount (BDT)</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <Label>Note</Label>
          <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.amount} className="flex-1">
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          {form.id && (
            <Button variant="outline" onClick={() => setForm({ id: null, date: todayStr(), income_type: "Online", source: "", amount: "", note: "" })}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="font-semibold mb-3">Income Entries</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incomes.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No income entries</TableCell></TableRow>
              ) : incomes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.date}</TableCell>
                  <TableCell><Badge variant={i.income_type === "Online" ? "default" : i.income_type === "Remittance" ? "secondary" : "outline"}>{i.income_type}</Badge></TableCell>
                  <TableCell className="text-xs">{i.source}</TableCell>
                  <TableCell className="text-right font-mono">{fmtBDT(Number(i.amount))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setForm({ id: i.id, date: i.date, income_type: i.income_type as IncomeType, source: i.source || "", amount: String(i.amount), note: i.note || "" })}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(i.id); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ============ History tab — date range filter ============ */
function HistoryTab({
  balances, incomes, slabs,
}: { balances: Balance[]; incomes: Income[]; slabs: Slab[]; qc: ReturnType<typeof useQueryClient> }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayStr());

  const fBalances = balances.filter((b) => b.date >= from && b.date <= to);
  const fIncomes = incomes.filter((i) => i.date >= from && i.date <= to);

  const totalIncome = fIncomes.reduce((s, i) => s + Number(i.amount), 0);

  // estimate profit over range from balance snapshots
  const profitOverRange = useMemo(() => {
    // average balance per account in range
    const byAcc = new Map<string, number[]>();
    for (const b of fBalances) {
      const arr = byAcc.get(b.account_type) || [];
      arr.push(Number(b.balance));
      byAcc.set(b.account_type, arr);
    }
    const days = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / 86400000) + 1);
    let total = 0;
    for (const [acc, arr] of byAcc) {
      const avg = arr.reduce((s, n) => s + n, 0) / arr.length;
      const accSlabs = slabs.filter((s) => s.account_type === acc);
      const { profit } = calcDailyProfit(avg, accSlabs);
      total += profit * days;
    }
    return { total, days };
  }, [fBalances, slabs, from, to]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <FileDown className="w-4 h-4 mr-2" /> Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
          <div className="text-xs text-muted-foreground">Balance Entries</div>
          <div className="text-2xl font-bold">{fBalances.length}</div>
        </Card>
        <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/30">
          <div className="text-xs text-muted-foreground">Income in range</div>
          <div className="text-2xl font-bold text-emerald-700">৳ {fmtBDT(totalIncome)}</div>
        </Card>
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/30">
          <div className="text-xs text-muted-foreground">Est. Profit ({profitOverRange.days}d)</div>
          <div className="text-2xl font-bold text-amber-700">৳ {fmtBDT(profitOverRange.total)}</div>
        </Card>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Income — {from} → {to}</h4>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fIncomes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.date}</TableCell>
                  <TableCell>{i.income_type}</TableCell>
                  <TableCell>{i.source}</TableCell>
                  <TableCell className="text-right font-mono">{fmtBDT(Number(i.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

/* ============ Deposit Analytics tab ============ */
function DepositAnalytics({ balances }: { balances: Balance[] }) {
  const analytics = useMemo(() => {
    // unique sorted dates ascending
    const dates = Array.from(new Set(balances.map((b) => b.date))).sort();
    if (dates.length === 0) {
      return {
        dates: [] as string[],
        timeline: [] as { date: string; total: number; delta: number }[],
        perAccountDelta: {} as Record<string, { date: string; balance: number; prev: number; delta: number }[]>,
        latestDate: null as string | null,
        prevDate: null as string | null,
        todayPerAccount: [] as { account: string; current: number; prev: number; delta: number; pct: number }[],
        maxDay: null as null | { date: string; total: number },
        minDay: null as null | { date: string; total: number },
        biggestJump: null as null | { date: string; delta: number; total: number },
        biggestDrop: null as null | { date: string; delta: number; total: number },
        avgTotal: 0,
        accountLeaders: [] as { account: string; current: number; share: number }[],
      };
    }

    // for each date, compute totalDeposit using "carry-forward latest balance per account up to date"
    const lastBalAt = (acc: string, date: string) => {
      let v = 0;
      for (const b of balances) {
        if (b.account_type === acc && b.date <= date) {
          // need latest; iterate properly
        }
      }
      // efficient: pick max date <= given
      let best: Balance | null = null;
      for (const b of balances) {
        if (b.account_type === acc && b.date <= date) {
          if (!best || b.date > best.date) best = b;
        }
      }
      return best ? Number(best.balance) : 0;
      void v;
    };

    const timeline = dates.map((d) => {
      const total = ACCOUNTS.reduce((s, a) => s + lastBalAt(a, d), 0);
      return { date: d, total, delta: 0 };
    });
    for (let i = 1; i < timeline.length; i++) {
      timeline[i].delta = timeline[i].total - timeline[i - 1].total;
    }

    const latestDate = dates[dates.length - 1];
    const prevDate = dates.length > 1 ? dates[dates.length - 2] : null;

    const todayPerAccount = ACCOUNTS.map((a) => {
      const current = lastBalAt(a, latestDate);
      const prev = prevDate ? lastBalAt(a, prevDate) : 0;
      const delta = current - prev;
      const pct = prev > 0 ? (delta / prev) * 100 : (current > 0 ? 100 : 0);
      return { account: a, current, prev, delta, pct };
    });

    // per-account delta history (last 30 dates)
    const perAccountDelta: Record<string, { date: string; balance: number; prev: number; delta: number }[]> = {};
    for (const a of ACCOUNTS) {
      const series: { date: string; balance: number; prev: number; delta: number }[] = [];
      let prev = 0;
      for (const d of dates) {
        const cur = lastBalAt(a, d);
        series.push({ date: d, balance: cur, prev, delta: cur - prev });
        prev = cur;
      }
      perAccountDelta[a] = series.slice(-30).reverse();
    }

    const sortedByTotal = [...timeline].sort((x, y) => y.total - x.total);
    const maxDay = sortedByTotal[0];
    const minDay = sortedByTotal[sortedByTotal.length - 1];
    const sortedByDelta = [...timeline].filter((t) => t.delta !== 0).sort((x, y) => y.delta - x.delta);
    const biggestJump = sortedByDelta[0] ?? null;
    const biggestDrop = sortedByDelta[sortedByDelta.length - 1] ?? null;
    const avgTotal = timeline.reduce((s, t) => s + t.total, 0) / timeline.length;

    const totalNow = todayPerAccount.reduce((s, x) => s + x.current, 0) || 1;
    const accountLeaders = [...todayPerAccount]
      .map((x) => ({ account: x.account, current: x.current, share: (x.current / totalNow) * 100 }))
      .sort((a, b) => b.current - a.current);

    return { dates, timeline, perAccountDelta, latestDate, prevDate, todayPerAccount, maxDay, minDay, biggestJump, biggestDrop, avgTotal, accountLeaders };
  }, [balances]);

  if (analytics.dates.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        কোনো ব্যালেন্স ডাটা নেই। Daily Balance ট্যাব থেকে এন্ট্রি যোগ করুন।
      </Card>
    );
  }

  const totalToday = analytics.todayPerAccount.reduce((s, x) => s + x.current, 0);
  const totalDelta = analytics.todayPerAccount.reduce((s, x) => s + x.delta, 0);
  const accountsUp = analytics.todayPerAccount.filter((x) => x.delta > 0);
  const accountsDown = analytics.todayPerAccount.filter((x) => x.delta < 0);
  const topGainer = [...analytics.todayPerAccount].sort((a, b) => b.delta - a.delta)[0];
  const topLoser = [...analytics.todayPerAccount].sort((a, b) => a.delta - b.delta)[0];

  return (
    <div className="space-y-4">
      {/* Hero — today vs previous */}
      <Card className="p-5 bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-600 text-white border-0 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase opacity-80">Latest Snapshot</div>
            <div className="text-2xl font-bold">{analytics.latestDate}</div>
            {analytics.prevDate && (
              <div className="text-xs opacity-80">আগের রেকর্ড: {analytics.prevDate}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase opacity-80">Total Deposit</div>
            <div className="text-3xl font-bold">৳ {fmtBDT(totalToday)}</div>
            <div className={`text-sm font-semibold inline-flex items-center gap-1 ${totalDelta >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
              {totalDelta >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              ৳ {fmtBDT(Math.abs(totalDelta))} (আগের দিনের তুলনায়)
            </div>
          </div>
        </div>
      </Card>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Accounts ▲" value={`${accountsUp.length} টি`} sub={accountsUp.map(a=>a.account).join(", ") || "—"} tone="green" />
        <MiniStat label="Accounts ▼" value={`${accountsDown.length} টি`} sub={accountsDown.map(a=>a.account).join(", ") || "—"} tone="red" />
        <MiniStat label="Top Gainer" value={topGainer ? `${topGainer.account}` : "—"} sub={topGainer ? `+৳ ${fmtBDT(topGainer.delta)}` : ""} tone="green" />
        <MiniStat label="Top Loser" value={topLoser && topLoser.delta < 0 ? `${topLoser.account}` : "—"} sub={topLoser && topLoser.delta < 0 ? `৳ ${fmtBDT(topLoser.delta)}` : ""} tone="red" />
      </div>

      {/* Per-account today vs yesterday */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Account-wise: গতকালকের তুলনায় আজকের পরিবর্তন
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">আগের ({analytics.prevDate ?? "—"})</TableHead>
                <TableHead className="text-right">এখন ({analytics.latestDate})</TableHead>
                <TableHead className="text-right">পার্থক্য</TableHead>
                <TableHead className="text-right">% পরিবর্তন</TableHead>
                <TableHead className="text-right">শেয়ার</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.todayPerAccount.map((r) => {
                const share = totalToday > 0 ? (r.current / totalToday) * 100 : 0;
                const dir = r.delta > 0 ? "up" : r.delta < 0 ? "down" : "flat";
                return (
                  <TableRow key={r.account}>
                    <TableCell className="font-medium"><Badge variant="secondary">{r.account}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{fmtBDT(r.prev)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmtBDT(r.current)}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${dir === "up" ? "text-emerald-600" : dir === "down" ? "text-red-600" : "text-muted-foreground"}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {dir === "up" ? <ArrowUp className="w-3 h-3" /> : dir === "down" ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        ৳ {fmtBDT(Math.abs(r.delta))}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right text-xs ${dir === "up" ? "text-emerald-600" : dir === "down" ? "text-red-600" : "text-muted-foreground"}`}>
                      {r.pct >= 0 ? "+" : ""}{r.pct.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, share)}%` }} />
                        </div>
                        {share.toFixed(1)}%
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">{fmtBDT(analytics.todayPerAccount.reduce((s, x) => s + x.prev, 0))}</TableCell>
                <TableCell className="text-right font-mono">{fmtBDT(totalToday)}</TableCell>
                <TableCell className={`text-right font-mono ${totalDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {totalDelta >= 0 ? "+" : "-"}৳ {fmtBDT(Math.abs(totalDelta))}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* High / Low / Avg cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
          <div className="flex items-center gap-2 text-xs opacity-90"><Trophy className="w-4 h-4" /> সর্বোচ্চ ডিপোজিট দিন</div>
          <div className="text-xl font-bold mt-1">৳ {fmtBDT(analytics.maxDay?.total || 0)}</div>
          <div className="text-xs opacity-80">{analytics.maxDay?.date}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-rose-500 to-red-600 text-white border-0">
          <div className="flex items-center gap-2 text-xs opacity-90"><TrendingDown className="w-4 h-4" /> সর্বনিম্ন ডিপোজিট দিন</div>
          <div className="text-xl font-bold mt-1">৳ {fmtBDT(analytics.minDay?.total || 0)}</div>
          <div className="text-xs opacity-80">{analytics.minDay?.date}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
          <div className="flex items-center gap-2 text-xs opacity-90"><ArrowUp className="w-4 h-4" /> সর্বোচ্চ বৃদ্ধি</div>
          <div className="text-xl font-bold mt-1">+৳ {fmtBDT(analytics.biggestJump?.delta || 0)}</div>
          <div className="text-xs opacity-80">{analytics.biggestJump?.date ?? "—"}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-slate-600 to-slate-800 text-white border-0">
          <div className="flex items-center gap-2 text-xs opacity-90"><ArrowDown className="w-4 h-4" /> সর্বোচ্চ হ্রাস</div>
          <div className="text-xl font-bold mt-1">৳ {fmtBDT(analytics.biggestDrop?.delta || 0)}</div>
          <div className="text-xs opacity-80">{analytics.biggestDrop?.date ?? "—"}</div>
        </Card>
      </div>

      {/* Total deposit timeline */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Total Deposit Timeline (গড় ৳ {fmtBDT(analytics.avgTotal)})
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={analytics.timeline}>
            <defs>
              <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(v: any) => `৳ ${fmtBDT(Number(v))}`} />
            <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#depGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Daily change bars */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> দৈনিক ডিপোজিট পার্থক্য (বৃদ্ধি/হ্রাস)
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={analytics.timeline.slice(-30)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(v: any) => `৳ ${fmtBDT(Number(v))}`} />
            <Bar dataKey="delta">
              {analytics.timeline.slice(-30).map((d, i) => (
                <Cell key={i} fill={d.delta >= 0 ? "#10b981" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Per-account recent deltas table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" /> Per-Account দিন-ভিত্তিক পরিবর্তন (সর্বশেষ ৩০ এন্ট্রি)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACCOUNTS.map((a) => {
            const rows = analytics.perAccountDelta[a] || [];
            if (rows.length === 0) return null;
            return (
              <div key={a} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge>{a}</Badge>
                  <span className="text-xs text-muted-foreground">{rows.length} entries</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-7 text-xs">Date</TableHead>
                        <TableHead className="h-7 text-xs text-right">Balance</TableHead>
                        <TableHead className="h-7 text-xs text-right">Δ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.date}>
                          <TableCell className="py-1 text-xs">{r.date}</TableCell>
                          <TableCell className="py-1 text-xs text-right font-mono">{fmtBDT(r.balance)}</TableCell>
                          <TableCell className={`py-1 text-xs text-right font-mono ${r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {r.delta > 0 ? "+" : r.delta < 0 ? "" : ""}{fmtBDT(r.delta)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Account share leaderboard */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" /> অ্যাকাউন্ট লিডারবোর্ড (Total Deposit Share)
        </h3>
        <div className="space-y-2">
          {analytics.accountLeaders.map((a, idx) => (
            <div key={a.account} className="flex items-center gap-3">
              <div className="w-6 text-center font-bold text-muted-foreground">{idx + 1}</div>
              <Badge variant="secondary" className="w-20 justify-center">{a.account}</Badge>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
                  style={{ width: `${Math.max(2, a.share)}%` }}
                />
              </div>
              <div className="w-32 text-right font-mono text-sm">৳ {fmtBDT(a.current)}</div>
              <div className="w-14 text-right text-xs text-muted-foreground">{a.share.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
