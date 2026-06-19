import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFmt } from "@/lib/format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CalendarClock, Plus, Search, Pencil, Trash2, Printer, Download, FileSpreadsheet,
  Bell, CheckCircle2, XCircle, Clock, Users, Wallet, TrendingUp, Calendar as CalIcon,
  Phone, Hash, AlertCircle, Filter, RefreshCw, BarChart3
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/upcoming-payments")({
  component: UpcomingPaymentsPage,
});

type Status = "pending" | "paid" | "cancelled";

type Payment = {
  id: string;
  serial_no: number;
  payment_date: string;
  customer_name: string;
  customer_mobile: string | null;
  customer_account_id: string | null;
  amount: number;
  purpose: string | null;
  notes: string | null;
  status: Status;
  paid_at: string | null;
  created_at: string;
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDaysISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyForm = () => ({
  id: "" as string | "",
  payment_date: todayISO(),
  customer_name: "",
  customer_mobile: "",
  customer_account_id: "",
  amount: "" as string,
  purpose: "",
  notes: "",
  status: "pending" as Status,
});

function UpcomingPaymentsPage() {
  const { bdt, date: fmtDate, num } = useFmt();
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmt, setMinAmt] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeTab, setActiveTab] = useState("dashboard");
  const [customerFocus, setCustomerFocus] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("upcoming_payments")
      .select("*")
      .order("payment_date", { ascending: true })
      .order("serial_no", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data || []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.customer_name.trim() || !form.payment_date || !form.amount) {
      toast.error("নাম, তারিখ ও পরিমাণ আবশ্যক");
      return;
    }
    const payload = {
      payment_date: form.payment_date,
      customer_name: form.customer_name.trim(),
      customer_mobile: form.customer_mobile.trim() || null,
      customer_account_id: form.customer_account_id.trim() || null,
      amount: Number(form.amount) || 0,
      purpose: form.purpose.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      paid_at: form.status === "paid" ? new Date().toISOString() : null,
    };
    let error;
    if (form.id) {
      ({ error } = await (supabase as any).from("upcoming_payments").update(payload).eq("id", form.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await (supabase as any).from("upcoming_payments").insert({ ...payload, created_by: user?.id }));
    }
    if (error) return toast.error(error.message);
    toast.success(form.id ? "আপডেট হয়েছে" : "যোগ হয়েছে");
    setOpen(false);
    setForm(emptyForm());
    load();
  };

  const edit = (p: Payment) => {
    setForm({
      id: p.id,
      payment_date: p.payment_date,
      customer_name: p.customer_name,
      customer_mobile: p.customer_mobile || "",
      customer_account_id: p.customer_account_id || "",
      amount: String(p.amount),
      purpose: p.purpose || "",
      notes: p.notes || "",
      status: p.status,
    });
    setOpen(true);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this payment record?")) return;
    const { error } = await (supabase as any).from("upcoming_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ডিলিট হয়েছে");
    load();
  };

  const markStatus = async (id: string, status: Status) => {
    const { error } = await (supabase as any)
      .from("upcoming_payments")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("স্ট্যাটাস আপডেট");
    load();
  };

  // --- derived ---
  const today = todayISO();
  const tomorrow = addDaysISO(1);
  const in7 = addDaysISO(7);
  const in30 = addDaysISO(30);
  const monthStart = today.slice(0, 7) + "-01";
  const monthEnd = (() => {
    const d = new Date();
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
  })();

  const stats = useMemo(() => {
    const sum = (arr: Payment[]) => arr.reduce((a, b) => a + Number(b.amount), 0);
    const pending = rows.filter(r => r.status === "pending");
    return {
      today: sum(pending.filter(r => r.payment_date === today)),
      tomorrow: sum(pending.filter(r => r.payment_date === tomorrow)),
      next7: sum(pending.filter(r => r.payment_date >= today && r.payment_date <= in7)),
      next30: sum(pending.filter(r => r.payment_date >= today && r.payment_date <= in30)),
      month: sum(pending.filter(r => r.payment_date >= monthStart && r.payment_date <= monthEnd)),
      pendingTotal: sum(pending),
      paidTotal: sum(rows.filter(r => r.status === "paid")),
      todayCount: pending.filter(r => r.payment_date === today).length,
      tomorrowCount: pending.filter(r => r.payment_date === tomorrow).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minA = Number(minAmt) || 0;
    return rows.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (fromDate && r.payment_date < fromDate) return false;
      if (toDate && r.payment_date > toDate) return false;
      if (minA && Number(r.amount) < minA) return false;
      if (q) {
        const hay = `${r.customer_name} ${r.customer_mobile || ""} ${r.customer_account_id || ""} ${r.purpose || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, fromDate, toDate, minAmt]);

  const dayList = useMemo(() => rows.filter(r => r.payment_date === selectedDate), [rows, selectedDate]);
  const daySum = dayList.reduce((a, b) => a + Number(b.amount), 0);

  // Customer aggregation
  const customers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; mobile: string; promised: number; paid: number; pending: number; dates: string[]; list: Payment[] }>();
    rows.forEach(r => {
      const key = (r.customer_mobile || r.customer_name).trim().toLowerCase();
      if (!map.has(key)) map.set(key, { key, name: r.customer_name, mobile: r.customer_mobile || "", promised: 0, paid: 0, pending: 0, dates: [], list: [] });
      const c = map.get(key)!;
      c.promised += Number(r.amount);
      if (r.status === "paid") c.paid += Number(r.amount);
      if (r.status === "pending") { c.pending += Number(r.amount); c.dates.push(r.payment_date); }
      c.list.push(r);
    });
    return Array.from(map.values()).sort((a, b) => b.pending - a.pending);
  }, [rows]);

  // Chart data
  const next14 = useMemo(() => {
    const out: { date: string; label: string; amount: number; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = addDaysISO(i);
      const day = rows.filter(r => r.payment_date === d && r.status === "pending");
      out.push({ date: d, label: d.slice(5), amount: day.reduce((a, b) => a + Number(b.amount), 0), count: day.length });
    }
    return out;
  }, [rows]);

  const monthlyForecast = useMemo(() => {
    const map = new Map<string, number>();
    rows.filter(r => r.status === "pending" && r.payment_date >= today).forEach(r => {
      const k = r.payment_date.slice(0, 7);
      map.set(k, (map.get(k) || 0) + Number(r.amount));
    });
    return Array.from(map.entries()).sort().slice(0, 12).map(([k, v]) => ({ month: k, amount: v }));
  }, [rows]);

  const statusPie = useMemo(() => {
    const acc = { pending: 0, paid: 0, cancelled: 0 };
    rows.forEach(r => { acc[r.status] += Number(r.amount); });
    return [
      { name: "Pending", value: acc.pending, color: "hsl(38 92% 50%)" },
      { name: "Paid", value: acc.paid, color: "hsl(142 71% 45%)" },
      { name: "Cancelled", value: acc.cancelled, color: "hsl(0 72% 51%)" },
    ];
  }, [rows]);

  const reminders = useMemo(() =>
    rows.filter(r => r.status === "pending" && r.payment_date >= today && r.payment_date <= in7)
      .sort((a, b) => a.payment_date.localeCompare(b.payment_date)).slice(0, 8),
  [rows]);

  // Exports
  const exportCSV = (data: Payment[], name: string) => {
    const headers = ["Serial", "Date", "Customer", "Mobile", "Account ID", "Amount", "Purpose", "Status", "Notes"];
    const lines = [headers.join(",")].concat(
      data.map(r => [r.serial_no, r.payment_date, `"${r.customer_name}"`, r.customer_mobile || "", r.customer_account_id || "", r.amount, `"${(r.purpose || "").replace(/"/g, '""')}"`, r.status, `"${(r.notes || "").replace(/"/g, '""')}"`].join(","))
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => window.print();

  const daysUntil = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - new Date(today).getTime()) / 86400000);
    return diff;
  };

  const statusBadge = (s: Status) => {
    const map = {
      pending: { cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock, label: "Pending" },
      paid: { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2, label: "Paid" },
      cancelled: { cls: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle, label: "Cancelled" },
    } as const;
    const m = map[s];
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", m.cls)}>
        <m.icon className="w-3 h-3" /> {m.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground shadow-lg">
              <CalendarClock className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">আসন্ন পেমেন্ট ম্যানেজমেন্ট</h1>
              <p className="text-sm text-muted-foreground">Upcoming Payment Management — track future payouts day by day</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="w-4 h-4" />Refresh</Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyForm()); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-md"><Plus className="w-4 h-4" />নতুন পেমেন্ট</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{form.id ? "এডিট" : "নতুন"} আসন্ন পেমেন্ট</DialogTitle>
                </DialogHeader>
                {(() => {
                  const profileMap = new Map<string, { name: string; mobile: string; account: string; purpose: string }>();
                  [...rows].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")).forEach(r => {
                    const k = ((r.customer_mobile || "") + "|" + r.customer_name).trim().toLowerCase();
                    if (!k) return;
                    profileMap.set(k, {
                      name: r.customer_name,
                      mobile: r.customer_mobile || "",
                      account: r.customer_account_id || "",
                      purpose: r.purpose || "",
                    });
                  });
                  const profiles = Array.from(profileMap.values());
                  const uniqBy = <T,>(arr: T[], key: (x: T) => string) => Array.from(new Map(arr.map(x => [key(x), x])).values());
                  const nameOpts = uniqBy(profiles.filter(p => p.name), p => p.name.toLowerCase());
                  const mobileOpts = uniqBy(profiles.filter(p => p.mobile), p => p.mobile);
                  const accountOpts = uniqBy(profiles.filter(p => p.account), p => p.account);
                  const purposeOpts = Array.from(new Set(rows.map(r => (r.purpose || "").trim()).filter(Boolean)));

                  const applyProfile = (p: { name: string; mobile: string; account: string; purpose: string }) => {
                    setForm(f => ({
                      ...f,
                      customer_name: p.name || f.customer_name,
                      customer_mobile: p.mobile || f.customer_mobile,
                      customer_account_id: p.account || f.customer_account_id,
                      purpose: f.purpose || p.purpose,
                    }));
                  };

                  const tryAutoFill = (field: "name" | "mobile" | "account", value: string) => {
                    const v = value.trim().toLowerCase();
                    if (!v) return;
                    const hit = profiles.find(p =>
                      (field === "name" && p.name.toLowerCase() === v) ||
                      (field === "mobile" && p.mobile.toLowerCase() === v) ||
                      (field === "account" && p.account.toLowerCase() === v)
                    );
                    if (hit) applyProfile(hit);
                  };

                  return (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>পেমেন্ট তারিখ *</Label>
                    <Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>পরিমাণ (৳) *</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>কাস্টমার নাম * <span className="text-xs text-muted-foreground">({nameOpts.length} previous)</span></Label>
                    <Input
                      list="up-name-list"
                      value={form.customer_name}
                      onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                      onBlur={e => tryAutoFill("name", e.target.value)}
                      placeholder="টাইপ করুন — পূর্বের কাস্টমার সাজেস্ট হবে"
                    />
                    <datalist id="up-name-list">
                      {nameOpts.map(p => (
                        <option key={p.name} value={p.name}>{p.mobile ? `📱 ${p.mobile}` : ""}{p.account ? ` · ${p.account}` : ""}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>মোবাইল নাম্বার</Label>
                    <Input
                      list="up-mobile-list"
                      value={form.customer_mobile}
                      onChange={e => setForm(f => ({ ...f, customer_mobile: e.target.value }))}
                      onBlur={e => tryAutoFill("mobile", e.target.value)}
                    />
                    <datalist id="up-mobile-list">
                      {mobileOpts.map(p => (
                        <option key={p.mobile} value={p.mobile}>{p.name}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>অ্যাকাউন্ট/কাস্টমার আইডি</Label>
                    <Input
                      list="up-account-list"
                      value={form.customer_account_id}
                      onChange={e => setForm(f => ({ ...f, customer_account_id: e.target.value }))}
                      onBlur={e => tryAutoFill("account", e.target.value)}
                    />
                    <datalist id="up-account-list">
                      {accountOpts.map(p => (
                        <option key={p.account} value={p.account}>{p.name}{p.mobile ? ` · ${p.mobile}` : ""}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>স্ট্যাটাস</Label>
                    <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as Status }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>উদ্দেশ্য / বিবরণ</Label>
                    <Input
                      list="up-purpose-list"
                      value={form.purpose}
                      onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                    />
                    <datalist id="up-purpose-list">
                      {purposeOpts.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>অতিরিক্ত নোট</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  {profiles.length > 0 && !form.id && (
                    <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" /> দ্রুত নির্বাচন — পূর্বের কাস্টমার (সর্বশেষ {Math.min(6, profiles.length)})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profiles.slice(-6).reverse().map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => applyProfile(p)}
                            className="text-xs px-2 py-1 rounded-md border bg-background hover:bg-accent transition"
                            title={`${p.name}${p.mobile ? " · " + p.mobile : ""}${p.account ? " · " + p.account : ""}`}
                          >
                            {p.name}{p.mobile ? ` · ${p.mobile}` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                  );
                })()}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={save}>{form.id ? "Update" : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Today", val: stats.today, count: stats.todayCount, icon: CalIcon, grad: "from-blue-500 to-cyan-500" },
          { label: "Tomorrow", val: stats.tomorrow, count: stats.tomorrowCount, icon: Clock, grad: "from-violet-500 to-purple-500" },
          { label: "Next 7 Days", val: stats.next7, icon: TrendingUp, grad: "from-indigo-500 to-blue-600" },
          { label: "Next 30 Days", val: stats.next30, icon: BarChart3, grad: "from-fuchsia-500 to-pink-500" },
          { label: "This Month", val: stats.month, icon: CalendarClock, grad: "from-amber-500 to-orange-500" },
          { label: "Total Pending", val: stats.pendingTotal, icon: AlertCircle, grad: "from-rose-500 to-red-600" },
          { label: "Total Paid", val: stats.paidTotal, icon: CheckCircle2, grad: "from-emerald-500 to-teal-500" },
        ].map((s, i) => (
          <Card key={i} className="relative overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-0.5 backdrop-blur-sm border-border/60">
            <div className={cn("absolute inset-0 opacity-[0.08] bg-gradient-to-br", s.grad)} />
            <div className={cn("absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br opacity-30 blur-2xl", s.grad)} />
            <CardContent className="relative p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</span>
                <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br grid place-items-center text-white shadow", s.grad)}>
                  <s.icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg font-bold tabular-nums">{bdt(s.val)}</div>
              {s.count !== undefined && (
                <div className="text-[10px] text-muted-foreground mt-0.5">{num(s.count)} customers</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="datewise">Date Wise</TabsTrigger>
          <TabsTrigger value="list">All Payments</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4 text-primary" /> Upcoming 14-Day Cash Outflow</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={next14}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => bdt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#g1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-4 h-4 text-amber-500" /> Reminders (Next 7 Days)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[260px] overflow-auto">
                {reminders.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No upcoming reminders</div>}
                {reminders.map(r => {
                  const d = daysUntil(r.payment_date);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border bg-card/50 hover:bg-accent/40 transition">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{r.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(r.payment_date)}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-bold text-primary">{bdt(Number(r.amount))}</div>
                        <div className={cn("text-[10px] font-medium", d <= 1 ? "text-rose-600" : d <= 3 ? "text-amber-600" : "text-muted-foreground")}>
                          {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Payment Forecast</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyForecast}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => bdt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Paid vs Pending vs Cancelled</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => bdt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DATE WISE */}
        <TabsContent value="datewise" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="space-y-1.5">
                <Label>তারিখ নির্বাচন করুন</Label>
                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full sm:w-56" />
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border p-3 bg-gradient-to-br from-blue-500/10 to-transparent">
                  <div className="text-xs text-muted-foreground">তারিখ</div>
                  <div className="font-bold">{fmtDate(selectedDate)}</div>
                </div>
                <div className="rounded-xl border p-3 bg-gradient-to-br from-emerald-500/10 to-transparent">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />Total Customers</div>
                  <div className="font-bold text-lg">{num(dayList.length)}</div>
                </div>
                <div className="rounded-xl border p-3 bg-gradient-to-br from-amber-500/10 to-transparent col-span-2 sm:col-span-1">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" />Total Payable</div>
                  <div className="font-bold text-lg text-primary">{bdt(daySum)}</div>
                </div>
              </div>
              <Button variant="outline" onClick={printReport} className="gap-2"><Printer className="w-4 h-4" />Print</Button>
            </CardContent>
          </Card>

          <Card className="print-area">
            <CardHeader><CardTitle>Payment List — {fmtDate(selectedDate)}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <PaymentTable rows={dayList} onEdit={edit} onDelete={del} onStatus={markStatus} bdt={bdt} num={num} fmtDate={fmtDate} statusBadge={statusBadge} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALL PAYMENTS */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="নাম, মোবাইল, আইডি দিয়ে খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="From" />
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="To" />
              <Input type="number" placeholder="Min Amount" value={minAmt} onChange={e => setMinAmt(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Filter className="w-4 h-4" /> {num(filtered.length)} records</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportCSV(filtered, "upcoming-payments")} className="gap-1.5"><FileSpreadsheet className="w-4 h-4" />Excel</Button>
                <Button size="sm" variant="outline" onClick={printReport} className="gap-1.5"><Printer className="w-4 h-4" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> :
                <PaymentTable rows={filtered} onEdit={edit} onDelete={del} onStatus={markStatus} bdt={bdt} num={num} fmtDate={fmtDate} statusBadge={statusBadge} />}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOMERS */}
        <TabsContent value="customers" className="space-y-4">
          {customerFocus ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setCustomerFocus(null)}>← Back</Button>
                  <CardTitle className="mt-2">{customers.find(c => c.key === customerFocus)?.name}</CardTitle>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Phone className="w-3 h-3" />{customers.find(c => c.key === customerFocus)?.mobile || "—"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const c = customers.find(x => x.key === customerFocus)!;
                  return (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatBox label="Total Promised" value={bdt(c.promised)} color="from-blue-500" />
                        <StatBox label="Total Paid" value={bdt(c.paid)} color="from-emerald-500" />
                        <StatBox label="Remaining" value={bdt(c.promised - c.paid)} color="from-amber-500" />
                        <StatBox label="Upcoming Dates" value={num(c.dates.length)} color="from-violet-500" />
                      </div>
                      <PaymentTable rows={c.list} onEdit={edit} onDelete={del} onStatus={markStatus} bdt={bdt} num={num} fmtDate={fmtDate} statusBadge={statusBadge} />
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customers.map(c => (
                <Card key={c.key} className="cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all" onClick={() => setCustomerFocus(c.key)}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.mobile || "—"}</div>
                      </div>
                      <Badge variant="outline">{num(c.list.length)}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[10px] text-muted-foreground">Promised</div><div className="text-xs font-bold">{bdt(c.promised)}</div></div>
                      <div><div className="text-[10px] text-muted-foreground">Paid</div><div className="text-xs font-bold text-emerald-600">{bdt(c.paid)}</div></div>
                      <div><div className="text-[10px] text-muted-foreground">Pending</div><div className="text-xs font-bold text-amber-600">{bdt(c.pending)}</div></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {customers.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">No customers yet</div>}
            </div>
          )}
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="hover:shadow-lg transition">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalIcon className="w-4 h-4 text-primary" />Date Wise Report</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">All payments grouped by date.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportCSV(rows, "date-wise-report")} className="gap-1.5"><Download className="w-4 h-4" />CSV</Button>
                  <Button size="sm" variant="outline" onClick={printReport} className="gap-1.5"><Printer className="w-4 h-4" />Print</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Customer Wise Report</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Per-customer aggregated summary.</p>
                <Button size="sm" variant="outline" onClick={() => {
                  const headers = ["Customer", "Mobile", "Promised", "Paid", "Pending", "Count"];
                  const lines = [headers.join(",")].concat(customers.map(c => [`"${c.name}"`, c.mobile, c.promised, c.paid, c.pending, c.list.length].join(",")));
                  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "customer-report.csv"; a.click();
                }} className="gap-1.5"><Download className="w-4 h-4" />Export</Button>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Monthly Forecast</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={monthlyForecast}>
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => bdt(v)} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={cn("rounded-xl border p-3 bg-gradient-to-br to-transparent", color + "/10")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold text-lg">{value}</div>
    </div>
  );
}

function PaymentTable({
  rows, onEdit, onDelete, onStatus, bdt, num, fmtDate, statusBadge,
}: {
  rows: Payment[];
  onEdit: (p: Payment) => void;
  onDelete: (id: string) => void;
  onStatus: (id: string, s: Status) => void;
  bdt: (n: number) => string;
  num: (n: number | string) => string;
  fmtDate: (d: string) => string;
  statusBadge: (s: Status) => React.ReactNode;
}) {
  if (rows.length === 0) return <div className="p-8 text-center text-muted-foreground">No records</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-y">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Mobile</th>
            <th className="px-3 py-2 font-medium">Acc ID</th>
            <th className="px-3 py-2 font-medium text-right">Amount</th>
            <th className="px-3 py-2 font-medium">Purpose</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b hover:bg-accent/30 transition">
              <td className="px-3 py-2 tabular-nums text-muted-foreground">{num(r.serial_no)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.payment_date)}</td>
              <td className="px-3 py-2 font-medium">{r.customer_name}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.customer_mobile || "—"}</td>
              <td className="px-3 py-2 text-muted-foreground"><Hash className="w-3 h-3 inline" />{r.customer_account_id || "—"}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">{bdt(Number(r.amount))}</td>
              <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{r.purpose || "—"}</td>
              <td className="px-3 py-2">{statusBadge(r.status)}</td>
              <td className="px-3 py-2 text-right no-print">
                <div className="inline-flex gap-1">
                  {r.status !== "paid" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => onStatus(r.id, "paid")} title="Mark Paid"><CheckCircle2 className="w-4 h-4" /></Button>
                  )}
                  {r.status !== "cancelled" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => onStatus(r.id, "cancelled")} title="Cancel"><XCircle className="w-4 h-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
