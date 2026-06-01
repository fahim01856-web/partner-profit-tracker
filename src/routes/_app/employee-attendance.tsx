import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useFmt, monthRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays, Users, Plane, PartyPopper, FileBarChart, IdCard,
  Printer, Search, Plus, Trash2, Download, UserCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_app/employee-attendance")({ component: EmpAttPage });

const STATUS_OPTIONS = [
  { v: 'present', key: 'eatt_st_present', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { v: 'absent', key: 'eatt_st_absent', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  { v: 'late', key: 'eatt_st_late', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { v: 'half_day', key: 'eatt_st_half_day', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { v: 'weekend', key: 'eatt_st_weekend', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { v: 'holiday', key: 'eatt_st_holiday', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  { v: 'sick_leave', key: 'eatt_st_sick', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { v: 'casual_leave', key: 'eatt_st_casual', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { v: 'earn_leave', key: 'eatt_st_earn', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { v: 'training', key: 'eatt_st_training', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { v: 'tour', key: 'eatt_st_tour', color: 'bg-purple-100 text-purple-800 border-purple-300' },
] as const;

const LEAVE_TYPES = [
  'casual', 'sick', 'annual', 'maternity', 'emergency', 'official_tour', 'public_holiday',
] as const;

function statusMeta(v: string) {
  return STATUS_OPTIONS.find(s => s.v === v) ?? STATUS_OPTIONS[0];
}

function EmpAttPage() {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> {t("eatt_title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("eatt_sub")}</p>
        </div>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="daily"><CalendarDays className="w-3.5 h-3.5 mr-1" />{t("eatt_tab_daily")}</TabsTrigger>
          <TabsTrigger value="monthly"><CalendarDays className="w-3.5 h-3.5 mr-1" />{t("eatt_tab_monthly")}</TabsTrigger>
          <TabsTrigger value="leave"><Plane className="w-3.5 h-3.5 mr-1" />{t("eatt_tab_leave")}</TabsTrigger>
          <TabsTrigger value="holiday"><PartyPopper className="w-3.5 h-3.5 mr-1" />{t("eatt_tab_holiday")}</TabsTrigger>
          <TabsTrigger value="report"><FileBarChart className="w-3.5 h-3.5 mr-1" />{t("eatt_tab_report")}</TabsTrigger>
          <TabsTrigger value="employee"><IdCard className="w-3.5 h-3.5 mr-1" />{t("eatt_tab_employee")}</TabsTrigger>
        </TabsList>

        <TabsContent value="daily"><DailyTab /></TabsContent>
        <TabsContent value="monthly"><MonthlyTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="holiday"><HolidayTab /></TabsContent>
        <TabsContent value="report"><ReportTab lang={lang} /></TabsContent>
        <TabsContent value="employee"><EmployeeTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------ DAILY ATTENDANCE ------------------------ */
function DailyTab() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("date", date)).data ?? [],
  });

  const upsert = useMutation({
    mutationFn: async (payload: { staff_id: string; status?: string; in_time?: string | null; out_time?: string | null; note?: string | null }) => {
      const existing = attendance.find(a => a.staff_id === payload.staff_id);
      const row = { ...(existing ?? {}), ...payload, date };
      const { error } = await supabase.from("attendance").upsert(row, { onConflict: "staff_id,date" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const get = (id: string) => attendance.find(a => a.staff_id === id);
  const filtered = staff.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  const dayName = new Date(date).toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <Label className="text-xs">{t("date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
            </div>
            <div>
              <Label className="text-xs">{t("eatt_day")}</Label>
              <div className="h-9 px-3 flex items-center border rounded-md text-sm bg-muted/40 font-medium">{dayName}</div>
            </div>
            <div className="relative">
              <Label className="text-xs">{t("eatt_search_emp")}</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("eatt_search_emp")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-56" />
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> {t("print")}
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden print-area print:shadow-none print:border-0">
        <div className="hidden print:block p-4 text-center border-b">
          <h1 className="text-xl font-bold">{t("bankName")}</h1>
          <div className="text-sm">{t("outlet")} — {t("locationFull")}</div>
          <h2 className="text-lg font-semibold mt-2">{t("eatt_title")} — {fmt.date(date)} ({dayName})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-2.5">#</th>
                <th className="p-2.5 print:hidden">{t("eatt_photo")}</th>
                <th className="p-2.5">{t("name")}</th>
                <th className="p-2.5">{t("eatt_emp_id")}</th>
                <th className="p-2.5">{t("position")}</th>
                <th className="p-2.5">{t("eatt_in_time")}</th>
                <th className="p-2.5">{t("eatt_out_time")}</th>
                <th className="p-2.5">{t("eatt_status")}</th>
                <th className="p-2.5">{t("note")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const cur = get(s.id);
                const meta = statusMeta(cur?.status ?? 'present');
                const stKey = STATUS_OPTIONS.find(o => o.v === (cur?.status ?? ''))?.key;
                return (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="p-2.5">{fmt.num(idx + 1)}</td>
                    <td className="p-2.5 print:hidden">
                      {s.photo_url
                        ? <img src={s.photo_url} alt={s.name} className="w-9 h-9 rounded-full object-cover border" />
                        : <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><UserCircle2 className="w-5 h-5 text-muted-foreground" /></div>}
                    </td>
                    <td className="p-2.5 font-semibold">{s.name}</td>
                    <td className="p-2.5 text-xs">{s.employee_code ?? '-'}</td>
                    <td className="p-2.5 text-xs">{s.position}</td>
                    <td className="p-2.5">
                      <span className="hidden print:inline">{cur?.in_time ?? '-'}</span>
                      <Input type="time" defaultValue={cur?.in_time ?? ''} className="h-8 w-28 print:hidden"
                        onBlur={(e) => upsert.mutate({ staff_id: s.id, in_time: e.target.value || null })} />
                    </td>
                    <td className="p-2.5">
                      <span className="hidden print:inline">{cur?.out_time ?? '-'}</span>
                      <Input type="time" defaultValue={cur?.out_time ?? ''} className="h-8 w-28 print:hidden"
                        onBlur={(e) => upsert.mutate({ staff_id: s.id, out_time: e.target.value || null })} />
                    </td>
                    <td className="p-2.5">
                      <span className="hidden print:inline">{stKey ? t(stKey as never) : '-'}</span>
                      <Select value={cur?.status ?? ''} onValueChange={(v) => upsert.mutate({ staff_id: s.id, status: v })}>
                        <SelectTrigger className={`h-8 w-36 print:hidden ${cur?.status ? meta.color : ''}`}>
                          <SelectValue placeholder={t("eatt_pick_status")} />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(o => (
                            <SelectItem key={o.v} value={o.v}>{t(o.key as never)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2.5">
                      <span className="hidden print:inline">{cur?.note ?? ''}</span>
                      <Input defaultValue={cur?.note ?? ''} placeholder="-" className="h-8 w-40 print:hidden"
                        onBlur={(e) => upsert.mutate({ staff_id: s.id, note: e.target.value || null })} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{t("add_staff_first")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ MONTHLY ATTENDANCE ------------------------ */
function MonthlyTab() {
  const { t } = useI18n();
  const fmt = useFmt();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const { start, end } = monthRange(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["attendance-month", start, end],
    queryFn: async () => (await supabase.from("attendance").select("*").gte("date", start).lte("date", end)).data ?? [],
  });

  const lookup = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => m.set(`${r.staff_id}|${r.date}`, r.status));
    return m;
  }, [rows]);

  const statusShort: Record<string, string> = {
    present: 'P', absent: 'A', late: 'L', half_day: 'H', weekend: 'W',
    holiday: 'HD', sick_leave: 'SL', casual_leave: 'CL', earn_leave: 'EL',
    training: 'T', tour: 'TR',
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex justify-between items-end gap-3 flex-wrap no-print">
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">{t("pp_month")}</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{fmt.months.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("pp_year")}</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {t("printPdf")}</Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 sticky left-0 bg-muted/60 text-left">{t("name")}</th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                  <th key={d} className="p-1 border-l text-center w-7">{fmt.num(d)}</th>
                ))}
                <th className="p-2 border-l text-right">P</th>
                <th className="p-2 text-right">A</th>
                <th className="p-2 text-right">L</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => {
                let p = 0, a = 0, l = 0;
                const cells = Array.from({ length: daysInMonth }, (_, i) => {
                  const dstr = `${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
                  const st = lookup.get(`${s.id}|${dstr}`);
                  if (st === 'present') p++; else if (st === 'absent') a++; else if (st === 'late') l++;
                  return st;
                });
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2 sticky left-0 bg-card font-semibold whitespace-nowrap">{s.name}</td>
                    {cells.map((st, i) => (
                      <td key={i} className={`text-center border-l ${st ? statusMeta(st).color : ''}`}>
                        {st ? statusShort[st] : '·'}
                      </td>
                    ))}
                    <td className="p-2 border-l text-right font-bold text-emerald-700">{fmt.num(p)}</td>
                    <td className="p-2 text-right font-bold text-rose-700">{fmt.num(a)}</td>
                    <td className="p-2 text-right font-bold text-amber-700">{fmt.num(l)}</td>
                  </tr>
                );
              })}
              {staff.length === 0 && <tr><td colSpan={daysInMonth + 4} className="p-6 text-center text-muted-foreground">{t("add_staff_first")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ LEAVE MANAGEMENT ------------------------ */
function LeaveTab() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ staff_id: '', start_date: new Date().toISOString().slice(0,10), end_date: new Date().toISOString().slice(0,10), leave_type: 'casual', reason: '', approved_by: '' });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => (await supabase.from("leaves").select("*").order("start_date", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.staff_id) throw new Error(t("eatt_pick_emp"));
      const { error } = await supabase.from("leaves").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("eatt_leave_saved"));
      setForm({ ...form, reason: '', approved_by: '' });
      qc.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("leaves").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["leaves"] }); },
  });

  const nameOf = (id: string) => staff.find(s => s.id === id)?.name ?? '-';

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> {t("eatt_new_leave")}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>{t("eatt_employee")}</Label>
            <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
              <SelectTrigger><SelectValue placeholder={t("eatt_pick_emp")} /></SelectTrigger>
              <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("eatt_leave_type")}</Label>
            <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LEAVE_TYPES.map(lt => <SelectItem key={lt} value={lt}>{t(`eatt_lt_${lt}` as never)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("eatt_approved_by")}</Label><Input value={form.approved_by} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} /></div>
          <div><Label>{t("eatt_from")}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>{t("eatt_to")}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          <div className="lg:col-span-3"><Label>{t("eatt_reason")}</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div><Button type="submit" disabled={add.isPending}>{t("add")}</Button></div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-2.5">{t("eatt_employee")}</th>
                <th className="p-2.5">{t("eatt_from")}</th>
                <th className="p-2.5">{t("eatt_to")}</th>
                <th className="p-2.5">{t("eatt_leave_type")}</th>
                <th className="p-2.5">{t("eatt_reason")}</th>
                <th className="p-2.5">{t("eatt_approved_by")}</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-2.5 font-semibold">{nameOf(l.staff_id)}</td>
                  <td className="p-2.5">{fmt.date(l.start_date)}</td>
                  <td className="p-2.5">{fmt.date(l.end_date)}</td>
                  <td className="p-2.5"><Badge variant="secondary">{t(`eatt_lt_${l.leave_type}` as never) || l.leave_type}</Badge></td>
                  <td className="p-2.5 text-muted-foreground">{l.reason ?? '-'}</td>
                  <td className="p-2.5">{l.approved_by ?? '-'}</td>
                  <td className="p-2.5"><Button size="sm" variant="ghost" onClick={() => del.mutate(l.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {leaves.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ HOLIDAY SETUP ------------------------ */
function HolidayTab() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), name: '', holiday_type: 'public' });

  const { data: rows = [] } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => (await supabase.from("holidays").select("*").order("date", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("holidays").insert(form); if (error) throw error; },
    onSuccess: () => { toast.success(t("eatt_holiday_saved")); setForm({ ...form, name: '' }); qc.invalidateQueries({ queryKey: ["holidays"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("holidays").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays"] }),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> {t("eatt_new_holiday")}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="lg:col-span-2"><Label>{t("eatt_holiday_name")}</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>{t("eatt_type")}</Label>
            <Select value={form.holiday_type} onValueChange={(v) => setForm({ ...form, holiday_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t("eatt_ht_public")}</SelectItem>
                <SelectItem value="religious">{t("eatt_ht_religious")}</SelectItem>
                <SelectItem value="weekend">{t("eatt_ht_weekend")}</SelectItem>
                <SelectItem value="other">{t("eatt_ht_other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Button type="submit" disabled={add.isPending}>{t("add")}</Button></div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr><th className="p-2.5">{t("date")}</th><th className="p-2.5">{t("eatt_holiday_name")}</th><th className="p-2.5">{t("eatt_type")}</th><th className="p-2.5"></th></tr>
            </thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.id} className="border-t">
                  <td className="p-2.5 font-semibold">{fmt.date(h.date)}</td>
                  <td className="p-2.5">{h.name}</td>
                  <td className="p-2.5"><Badge variant="secondary">{t(`eatt_ht_${h.holiday_type}` as never) || h.holiday_type}</Badge></td>
                  <td className="p-2.5"><Button size="sm" variant="ghost" onClick={() => del.mutate(h.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ REPORT (Monthly + Yearly Summary) ------------------------ */
function ReportTab({ lang }: { lang: string }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const yearStart = `${year}-01-01`, yearEnd = `${year}-12-31`;
  const { start, end } = monthRange(year, month);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: monthAtt = [] } = useQuery({
    queryKey: ["att-month", start, end],
    queryFn: async () => (await supabase.from("attendance").select("*").gte("date", start).lte("date", end)).data ?? [],
  });
  const { data: yearAtt = [] } = useQuery({
    queryKey: ["att-year", year],
    queryFn: async () => (await supabase.from("attendance").select("*").gte("date", yearStart).lte("date", yearEnd)).data ?? [],
  });
  const { data: monthLeaves = [] } = useQuery({
    queryKey: ["leaves-month", start, end],
    queryFn: async () => (await supabase.from("leaves").select("*").lte("start_date", end).gte("end_date", start)).data ?? [],
  });
  const { data: monthHolidays = [] } = useQuery({
    queryKey: ["holidays-month", start, end],
    queryFn: async () => (await supabase.from("holidays").select("*").gte("date", start).lte("date", end)).data ?? [],
  });

  const summary = useMemo(() => {
    const count = (st: string) => monthAtt.filter(a => a.status === st).length;
    return {
      present: count('present'), absent: count('absent'), late: count('late'),
      leave: monthLeaves.length, holiday: monthHolidays.length,
      workingDays: new Date(year, month, 0).getDate() - monthHolidays.length,
    };
  }, [monthAtt, monthLeaves, monthHolidays, year, month]);

  const exportCsv = () => {
    const header = ['Name', 'Present', 'Absent', 'Late'];
    const lines = [header.join(',')];
    staff.forEach(s => {
      const recs = monthAtt.filter(a => a.staff_id === s.id);
      lines.push([s.name, recs.filter(r => r.status === 'present').length, recs.filter(r => r.status === 'absent').length, recs.filter(r => r.status === 'late').length].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `attendance-${year}-${month}.csv`; a.click();
  };

  const yearlyByStaff = useMemo(() => {
    return staff.map(s => {
      const recs = yearAtt.filter(a => a.staff_id === s.id);
      return {
        id: s.id, name: s.name,
        present: recs.filter(r => r.status === 'present').length,
        absent: recs.filter(r => r.status === 'absent').length,
        late: recs.filter(r => r.status === 'late').length,
      };
    });
  }, [staff, yearAtt]);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex gap-3 items-end flex-wrap no-print">
        <div>
          <Label className="text-xs">{t("pp_month")}</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{fmt.months.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">{t("pp_year")}</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" /></div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> {t("eatt_export_csv")}</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> {t("printPdf")}</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: t("eatt_total_present"), v: summary.present, c: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
          { l: t("eatt_total_absent"), v: summary.absent, c: 'text-rose-700 border-rose-200 bg-rose-50' },
          { l: t("eatt_total_late"), v: summary.late, c: 'text-amber-700 border-amber-200 bg-amber-50' },
          { l: t("eatt_total_leave"), v: summary.leave, c: 'text-blue-700 border-blue-200 bg-blue-50' },
          { l: t("eatt_total_holiday"), v: summary.holiday, c: 'text-fuchsia-700 border-fuchsia-200 bg-fuchsia-50' },
          { l: t("eatt_working_days"), v: summary.workingDays, c: 'text-indigo-700 border-indigo-200 bg-indigo-50' },
        ].map((s, i) => (
          <Card key={i} className={`p-3 border ${s.c}`}>
            <div className="text-xs opacity-80">{s.l}</div>
            <div className="text-2xl font-bold">{fmt.num(s.v)}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b font-semibold">{t("eatt_yearly_report")} — {fmt.num(year)}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr><th className="p-2.5">{t("name")}</th><th className="p-2.5 text-right">{t("eatt_total_present")}</th><th className="p-2.5 text-right">{t("eatt_total_absent")}</th><th className="p-2.5 text-right">{t("eatt_total_late")}</th></tr>
            </thead>
            <tbody>
              {yearlyByStaff.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2.5 font-semibold">{r.name}</td>
                  <td className="p-2.5 text-right text-emerald-700 font-semibold">{fmt.num(r.present)}</td>
                  <td className="p-2.5 text-right text-rose-700 font-semibold">{fmt.num(r.absent)}</td>
                  <td className="p-2.5 text-right text-amber-700 font-semibold">{fmt.num(r.late)}</td>
                </tr>
              ))}
              {yearlyByStaff.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("noEntries")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------ EMPLOYEE INFO ------------------------ */
function EmployeeTab() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, { employee_code?: string; photo_url?: string }>>({});

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-all"],
    queryFn: async () => (await supabase.from("staff").select("*").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (id: string) => {
      const patch = editing[id]; if (!patch) return;
      const { error } = await supabase.from("staff").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => { setEditing(prev => { const c = { ...prev }; delete c[id]; return c; }); toast.success(t("save")); qc.invalidateQueries({ queryKey: ["staff-all"] }); qc.invalidateQueries({ queryKey: ["staff-active"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b font-semibold flex items-center gap-2"><IdCard className="w-4 h-4" /> {t("eatt_employee_info")}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="p-2.5">{t("eatt_photo")}</th>
              <th className="p-2.5">{t("eatt_photo_url")}</th>
              <th className="p-2.5">{t("name")}</th>
              <th className="p-2.5">{t("eatt_emp_id")}</th>
              <th className="p-2.5">{t("position")}</th>
              <th className="p-2.5">{t("phone")}</th>
              <th className="p-2.5">{t("joining")}</th>
              <th className="p-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => {
              const e = editing[s.id] ?? {};
              const photo = e.photo_url ?? s.photo_url;
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2.5">
                    {photo
                      ? <img src={photo} alt={s.name} className="w-12 h-12 rounded-full object-cover border" />
                      : <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><UserCircle2 className="w-6 h-6 text-muted-foreground" /></div>}
                  </td>
                  <td className="p-2.5"><Input className="h-8 w-56" placeholder="https://..." defaultValue={s.photo_url ?? ''} onChange={(ev) => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], photo_url: ev.target.value } }))} /></td>
                  <td className="p-2.5 font-semibold">{s.name}</td>
                  <td className="p-2.5"><Input className="h-8 w-28" defaultValue={s.employee_code ?? ''} onChange={(ev) => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], employee_code: ev.target.value } }))} /></td>
                  <td className="p-2.5">{s.position}</td>
                  <td className="p-2.5">{s.phone}</td>
                  <td className="p-2.5">{s.joining_date ? fmt.date(s.joining_date) : '-'}</td>
                  <td className="p-2.5"><Button size="sm" disabled={!editing[s.id]} onClick={() => save.mutate(s.id)}>{t("save")}</Button></td>
                </tr>
              );
            })}
            {staff.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("no_staff")}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
