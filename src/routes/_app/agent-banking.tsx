import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  Wallet, Calendar, BarChart3, X,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

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
  const matched = slabs
    .filter((s) => balance >= Number(s.min_amount) && (s.max_amount == null || balance <= Number(s.max_amount)))
    .sort((a, b) => b.min_amount - a.min_amount)[0];
  const pct = matched ? Number(matched.yearly_percent) : 0;
  return { profit: (balance * (pct / 100)) / 365, pct };
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
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
