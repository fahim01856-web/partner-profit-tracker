import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Printer, FileText, Target as TargetIcon, AlertTriangle, ListChecks, Users as UsersIcon, History, CalendarClock, Save } from "lucide-react";

function daysLeft(due?: string | null): { n: number; label: string; tone: "ok" | "warn" | "danger" | "done" } | null {
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (n < 0) return { n, label: `${Math.abs(n)} দিন অতিক্রান্ত`, tone: "danger" };
  if (n === 0) return { n, label: "আজই শেষ দিন", tone: "warn" };
  if (n <= 3) return { n, label: `${n} দিন বাকি`, tone: "warn" };
  return { n, label: `${n} দিন বাকি`, tone: "ok" };
}

export const Route = createFileRoute("/_app/meetings/$id")({ component: MeetingDetail });

function MeetingDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: mtg } = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const updateMtg = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("meetings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("আপডেট হয়েছে"); qc.invalidateQueries({ queryKey: ["meeting", id] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
  });

  const [summary, setSummary] = useState<string>("");
  const [nextDate, setNextDate] = useState<string>("");
  // sync local state when meeting loads
  if (mtg && summary === "" && (mtg.summary || "") !== "" && summary !== mtg.summary) {
    // no-op: initialized below via key trick
  }

  if (!mtg) return <div className="p-8">লোড হচ্ছে...</div>;

  const nl = daysLeft(mtg.next_meeting_date);

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex items-center justify-between gap-2 no-print">
        <Button asChild variant="ghost" size="sm"><Link to="/meetings"><ArrowLeft className="w-4 h-4 mr-1" /> ফিরে যান</Link></Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" /> Print/PDF</Button>
      </div>

      <Card className="p-5 print:shadow-none print:border-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{mtg.title}</h1>
            <div className="text-sm text-muted-foreground mt-1">{mtg.meeting_date} {mtg.meeting_time || ""} • {mtg.location || "—"} • সভাপতি: {mtg.chairperson || "—"}</div>
            <Badge variant="outline" className="mt-2 text-[10px]">{mtg.meeting_type}</Badge>
          </div>
          <Select value={mtg.status} onValueChange={(v) => updateMtg.mutate({ status: v })}>
            <SelectTrigger className="w-40 no-print"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">নির্ধারিত</SelectItem>
              <SelectItem value="in_progress">চলমান</SelectItem>
              <SelectItem value="completed">সম্পন্ন</SelectItem>
              <SelectItem value="cancelled">বাতিল</SelectItem>
            </SelectContent>
          </Select>
          <Badge className="print:inline-block hidden">{mtg.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs flex items-center gap-1"><CalendarClock className="w-3 h-3" /> পরবর্তী মিটিং তারিখ</Label>
            <div className="flex gap-2 mt-1">
              <Input type="date" defaultValue={mtg.next_meeting_date || ""} onChange={(e) => setNextDate(e.target.value)} className="no-print" />
              <Button size="sm" variant="outline" onClick={() => updateMtg.mutate({ next_meeting_date: nextDate || null })} className="no-print"><Save className="w-3 h-3" /></Button>
            </div>
            {nl && <div className={`text-xs mt-1 ${nl.tone === "danger" ? "text-destructive" : nl.tone === "warn" ? "text-amber-600" : "text-green-600"}`}>{nl.label}</div>}
          </div>
          <div>
            <Label className="text-xs">সারসংক্ষেপ / Minutes of Meeting (MoM)</Label>
            <div className="flex gap-2 mt-1">
              <Textarea rows={3} defaultValue={mtg.summary || ""} onChange={(e) => setSummary(e.target.value)} className="no-print" placeholder="মিটিং-এর সিদ্ধান্ত, আলোচনা, নোট..." />
              <Button size="sm" variant="outline" onClick={() => updateMtg.mutate({ summary: summary })} className="no-print self-start"><Save className="w-3 h-3" /></Button>
            </div>
            {mtg.summary && <div className="text-xs mt-1 bg-muted/50 p-2 rounded print:block hidden whitespace-pre-wrap">{mtg.summary}</div>}
          </div>
        </div>
      </Card>

      <Tabs defaultValue="agenda" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto no-print">
          <TabsTrigger value="agenda"><FileText className="w-4 h-4 mr-1" /> Agenda</TabsTrigger>
          <TabsTrigger value="problems"><AlertTriangle className="w-4 h-4 mr-1" /> Problems</TabsTrigger>
          <TabsTrigger value="targets"><TargetIcon className="w-4 h-4 mr-1" /> Targets</TabsTrigger>
          <TabsTrigger value="actions"><ListChecks className="w-4 h-4 mr-1" /> Action Plan</TabsTrigger>
          <TabsTrigger value="attendees"><UsersIcon className="w-4 h-4 mr-1" /> Attendees</TabsTrigger>
          <TabsTrigger value="previous"><History className="w-4 h-4 mr-1" /> Previous Review</TabsTrigger>
          <TabsTrigger value="summary">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda"><AgendaTab meetingId={id} /></TabsContent>
        <TabsContent value="problems"><ProblemsTab meetingId={id} /></TabsContent>
        <TabsContent value="targets"><TargetsTab meetingId={id} /></TabsContent>
        <TabsContent value="actions"><ActionsTab meetingId={id} /></TabsContent>
        <TabsContent value="attendees"><AttendeesTab meetingId={id} /></TabsContent>
        <TabsContent value="previous"><PreviousReviewTab currentDate={mtg.meeting_date} /></TabsContent>
        <TabsContent value="summary"><SummaryTab meetingId={id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AgendaTab({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ topic: "", presenter: "", time_slot: "", notes: "" });
  const { data = [] } = useQuery({
    queryKey: ["meeting_agendas", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_agendas").select("*").eq("meeting_id", meetingId).order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_agendas").insert({ meeting_id: meetingId, ...form, sort_order: data.length });
      if (error) throw error;
    },
    onSuccess: () => { setForm({ topic: "", presenter: "", time_slot: "", notes: "" }); qc.invalidateQueries({ queryKey: ["meeting_agendas", meetingId] }); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("meeting_agendas").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_agendas", meetingId] }),
  });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 no-print">
        <Input placeholder="টপিক *" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="md:col-span-2" />
        <Input placeholder="উপস্থাপক" value={form.presenter} onChange={(e) => setForm({ ...form, presenter: e.target.value })} />
        <Input placeholder="সময় (যেমন: 10:00-10:15)" value={form.time_slot} onChange={(e) => setForm({ ...form, time_slot: e.target.value })} />
        <Button onClick={() => form.topic && add.mutate()}><Plus className="w-4 h-4 mr-1" /> যোগ</Button>
        <Textarea placeholder="নোট" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-5" />
      </div>
      <div className="space-y-2">
        {data.map((a: any, i: number) => (
          <div key={a.id} className="flex items-start gap-3 border-b pb-2">
            <div className="w-6 text-sm font-mono text-muted-foreground">{i + 1}.</div>
            <div className="flex-1">
              <div className="font-medium">{a.topic}</div>
              <div className="text-xs text-muted-foreground">{a.presenter || "—"} • {a.time_slot || "—"}</div>
              {a.notes && <div className="text-xs mt-1">{a.notes}</div>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)} className="no-print"><Trash2 className="w-3 h-3 text-destructive" /></Button>
          </div>
        ))}
        {data.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো এজেন্ডা নেই</div>}
      </div>
    </Card>
  );
}

function parseBulk(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(\d+[\.\)\-:]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

function ProblemsTab({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ problem: "", raised_by: "", status: "open", resolution: "" });
  const [bulk, setBulk] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["meeting_problems", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_problems").select("*").eq("meeting_id", meetingId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("meeting_problems").insert({ meeting_id: meetingId, ...form }); if (error) throw error; },
    onSuccess: () => { setForm({ problem: "", raised_by: "", status: "open", resolution: "" }); qc.invalidateQueries({ queryKey: ["meeting_problems", meetingId] }); },
  });
  const bulkAdd = useMutation({
    mutationFn: async () => {
      const items = parseBulk(bulk);
      if (!items.length) return;
      const rows = items.map((problem) => ({ meeting_id: meetingId, problem, status: "open" }));
      const { error } = await supabase.from("meeting_problems").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { setBulk(""); toast.success("সব সমস্যা যোগ হয়েছে"); qc.invalidateQueries({ queryKey: ["meeting_problems", meetingId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: any) => { await supabase.from("meeting_problems").update(patch).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_problems", meetingId] }),
  });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("meeting_problems").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_problems", meetingId] }) });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 no-print">
        <Input placeholder="সমস্যা *" value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} className="md:col-span-2" />
        <Input placeholder="উত্থাপনকারী" value={form.raised_by} onChange={(e) => setForm({ ...form, raised_by: e.target.value })} />
        <Button onClick={() => form.problem && add.mutate()}><Plus className="w-4 h-4 mr-1" /> যোগ</Button>
      </div>
      <div className="border-t pt-3 no-print">
        <Label className="text-xs">একসাথে সিরিয়াল করে যোগ করুন (প্রতি লাইনে একটি সমস্যা)</Label>
        <Textarea rows={4} placeholder={"1. প্রথম সমস্যা\n2. দ্বিতীয় সমস্যা\n3. তৃতীয় সমস্যা"} value={bulk} onChange={(e) => setBulk(e.target.value)} className="mt-1" />
        <Button size="sm" className="mt-2" onClick={() => bulkAdd.mutate()} disabled={!bulk.trim()}><Plus className="w-4 h-4 mr-1" /> সব যোগ করুন ({parseBulk(bulk).length})</Button>
      </div>
      <div className="space-y-2">
        {data.map((p: any, i: number) => (
          <div key={p.id} className="border rounded p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="w-7 text-sm font-mono text-muted-foreground pt-0.5">{i + 1}.</div>
              <div className="flex-1">
                <div className="font-medium">{p.problem}</div>
                <div className="text-xs text-muted-foreground">{p.raised_by || "—"}</div>
              </div>
              <Select value={p.status} onValueChange={(v) => update.mutate({ id: p.id, patch: { status: v, resolved_on: v === "resolved" ? new Date().toISOString().slice(0, 10) : null } })}>
                <SelectTrigger className="w-32 no-print"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="open">খোলা</SelectItem><SelectItem value="in_progress">চলমান</SelectItem><SelectItem value="resolved">সমাধান</SelectItem></SelectContent>
              </Select>
              <Badge variant={p.status === "resolved" ? "default" : "secondary"} className="print:inline-block hidden">{p.status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)} className="no-print"><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
            <Textarea placeholder="সমাধান/Resolution" rows={2} value={p.resolution || ""} onBlur={(e) => e.target.value !== (p.resolution || "") && update.mutate({ id: p.id, patch: { resolution: e.target.value } })} defaultValue={p.resolution || ""} />
          </div>
        ))}
        {data.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো সমস্যা যোগ করা হয়নি</div>}
      </div>
    </Card>
  );
}

function TargetsTab({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ target: "", assigned_to: "", due_date: "", achievement_percent: 0, remarks: "" });
  const [bulk, setBulk] = useState("");
  const [bulkDue, setBulkDue] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["meeting_targets", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_targets").select("*").eq("meeting_id", meetingId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("meeting_targets").insert({ meeting_id: meetingId, ...form, due_date: form.due_date || null }); if (error) throw error; },
    onSuccess: () => { setForm({ target: "", assigned_to: "", due_date: "", achievement_percent: 0, remarks: "" }); qc.invalidateQueries({ queryKey: ["meeting_targets", meetingId] }); },
  });
  const bulkAdd = useMutation({
    mutationFn: async () => {
      const items = parseBulk(bulk);
      if (!items.length) return;
      const rows = items.map((target) => ({ meeting_id: meetingId, target, due_date: bulkDue || null, achievement_percent: 0 }));
      const { error } = await supabase.from("meeting_targets").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { setBulk(""); setBulkDue(""); toast.success("সব লক্ষ্য যোগ হয়েছে"); qc.invalidateQueries({ queryKey: ["meeting_targets", meetingId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({ mutationFn: async ({ id, patch }: any) => { await supabase.from("meeting_targets").update(patch).eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_targets", meetingId] }) });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("meeting_targets").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_targets", meetingId] }) });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 no-print">
        <Input placeholder="লক্ষ্য *" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="md:col-span-2" />
        <Input placeholder="দায়িত্বপ্রাপ্ত" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} />
        <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <Button onClick={() => form.target && add.mutate()}><Plus className="w-4 h-4 mr-1" /> যোগ</Button>
      </div>
      <div className="border-t pt-3 no-print space-y-2">
        <Label className="text-xs">একসাথে সিরিয়াল করে যোগ করুন (প্রতি লাইনে একটি লক্ষ্য)</Label>
        <Textarea rows={4} placeholder={"1. প্রথম লক্ষ্য\n2. দ্বিতীয় লক্ষ্য\n3. তৃতীয় লক্ষ্য"} value={bulk} onChange={(e) => setBulk(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={bulkDue} onChange={(e) => setBulkDue(e.target.value)} className="w-44" placeholder="সবার Due Date (ঐচ্ছিক)" />
          <Button size="sm" onClick={() => bulkAdd.mutate()} disabled={!bulk.trim()}><Plus className="w-4 h-4 mr-1" /> সব যোগ করুন ({parseBulk(bulk).length})</Button>
        </div>
      </div>
      <div className="space-y-3">
        {data.map((t: any, i: number) => {
          const dl = daysLeft(t.due_date);
          const done = (t.achievement_percent || 0) >= 100;
          return (
            <div key={t.id} className={`border rounded p-3 ${dl?.tone === "danger" && !done ? "border-destructive/50 bg-destructive/5" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="w-7 text-sm font-mono text-muted-foreground pt-0.5">{i + 1}.</div>
                <div className="flex-1">
                  <div className="font-medium">{t.target}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                    <span>{t.assigned_to || "—"}</span>
                    <span>• Due: {t.due_date || "—"}</span>
                    {dl && !done && <Badge variant={dl.tone === "danger" ? "destructive" : dl.tone === "warn" ? "secondary" : "outline"} className="text-[10px]">{dl.label}</Badge>}
                    {done && <Badge className="text-[10px] bg-green-600">সম্পন্ন</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)} className="no-print"><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={t.achievement_percent} className="flex-1" />
                <Input type="number" min={0} max={100} defaultValue={t.achievement_percent} onBlur={(e) => update.mutate({ id: t.id, patch: { achievement_percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })} className="w-20 no-print" />
                <span className="text-sm font-mono">{t.achievement_percent}%</span>
              </div>
              <Textarea placeholder="মন্তব্য / Remarks" rows={1} defaultValue={t.remarks || ""} onBlur={(e) => e.target.value !== (t.remarks || "") && update.mutate({ id: t.id, patch: { remarks: e.target.value } })} className="mt-2 no-print" />
              {t.remarks && <div className="text-xs mt-1 print:block hidden">📝 {t.remarks}</div>}
            </div>
          );
        })}
        {data.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো লক্ষ্য নেই</div>}
      </div>
    </Card>
  );
}

function ActionsTab({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ action: "", responsible: "", deadline: "" });
  const { data = [] } = useQuery({
    queryKey: ["meeting_actions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_actions").select("*").eq("meeting_id", meetingId).order("deadline", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_actions").insert({ meeting_id: meetingId, ...form, deadline: form.deadline || null });
      if (error) throw error;
      // also create task
      await supabase.from("tasks").insert({ title: form.action, category: "meeting", priority: "medium", assigned_to_name: form.responsible || null, deadline: form.deadline || null, source_type: "meeting", source_id: meetingId });
    },
    onSuccess: () => { setForm({ action: "", responsible: "", deadline: "" }); qc.invalidateQueries({ queryKey: ["meeting_actions", meetingId] }); toast.success("Action যোগ হয়েছে + Task তৈরি"); },
  });
  const update = useMutation({ mutationFn: async ({ id, patch }: any) => { await supabase.from("meeting_actions").update(patch).eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_actions", meetingId] }) });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("meeting_actions").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_actions", meetingId] }) });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 no-print">
        <Input placeholder="অ্যাকশন *" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="md:col-span-2" />
        <Input placeholder="দায়িত্বপ্রাপ্ত" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
        <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        <Button onClick={() => form.action && add.mutate()}><Plus className="w-4 h-4 mr-1" /> যোগ</Button>
      </div>
      <div className="space-y-2">
        {data.map((a: any) => {
          const dl = daysLeft(a.deadline);
          const done = a.status === "completed";
          return (
            <div key={a.id} className={`flex flex-wrap items-center gap-2 border rounded p-2 ${dl?.tone === "danger" && !done ? "border-destructive/50 bg-destructive/5" : ""}`}>
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium text-sm">{a.action}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                  <span>{a.responsible || "—"}</span>
                  <span>• Due: {a.deadline || "—"}</span>
                  {dl && !done && <Badge variant={dl.tone === "danger" ? "destructive" : dl.tone === "warn" ? "secondary" : "outline"} className="text-[10px]">{dl.label}</Badge>}
                </div>
              </div>
              <Select value={a.status} onValueChange={(v) => update.mutate({ id: a.id, patch: { status: v, completed_on: v === "completed" ? new Date().toISOString().slice(0, 10) : null } })}>
                <SelectTrigger className="w-36 no-print"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Badge className="print:inline-block hidden">{a.status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)} className="no-print"><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          );
        })}
        {data.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">কোনো অ্যাকশন নেই</div>}
      </div>
    </Card>
  );
}

function AttendeesTab({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["meeting_attendees", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_attendees").select("*").eq("meeting_id", meetingId);
      if (error) throw error;
      return data;
    },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff_list"],
    queryFn: async () => { const { data } = await supabase.from("staff").select("id,name,position").order("name"); return (data as any[]) || []; },
  });
  const add = useMutation({
    mutationFn: async (payload: any) => { const { error } = await supabase.from("meeting_attendees").insert({ meeting_id: meetingId, ...payload }); if (error) throw error; },
    onSuccess: () => { setName(""); setRole(""); qc.invalidateQueries({ queryKey: ["meeting_attendees", meetingId] }); },
  });
  const update = useMutation({ mutationFn: async ({ id, patch }: any) => { await supabase.from("meeting_attendees").update(patch).eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_attendees", meetingId] }) });
  const del = useMutation({ mutationFn: async (id: string) => { await supabase.from("meeting_attendees").delete().eq("id", id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_attendees", meetingId] }) });
  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 no-print">
        <Select onValueChange={(v) => { const s = staff.find((x: any) => x.id === v); if (s) add.mutate({ staff_id: s.id, name: s.name, role: s.position }); }}>
          <SelectTrigger><SelectValue placeholder="স্টাফ থেকে যোগ করুন" /></SelectTrigger>
          <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="অথবা নাম লিখুন" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="পদ" value={role} onChange={(e) => setRole(e.target.value)} />
        <Button onClick={() => name && add.mutate({ name, role })}><Plus className="w-4 h-4 mr-1" /> যোগ</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {data.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 border rounded p-2">
            <input type="checkbox" checked={p.present} onChange={(e) => update.mutate({ id: p.id, patch: { present: e.target.checked } })} className="no-print" />
            <div className="flex-1">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.role || "—"}</div>
            </div>
            <Badge variant={p.present ? "default" : "secondary"}>{p.present ? "উপস্থিত" : "অনুপস্থিত"}</Badge>
            <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)} className="no-print"><Trash2 className="w-3 h-3 text-destructive" /></Button>
          </div>
        ))}
        {data.length === 0 && <div className="col-span-full text-sm text-muted-foreground text-center py-4">কেউ যোগ হননি</div>}
      </div>
    </Card>
  );
}

function SummaryTab({ meetingId }: { meetingId: string }) {
  const { data: actions = [] } = useQuery({
    queryKey: ["meeting_actions", meetingId],
    queryFn: async () => { const { data } = await supabase.from("meeting_actions").select("*").eq("meeting_id", meetingId); return data || []; },
  });
  const { data: targets = [] } = useQuery({
    queryKey: ["meeting_targets", meetingId],
    queryFn: async () => { const { data } = await supabase.from("meeting_targets").select("*").eq("meeting_id", meetingId); return data || []; },
  });
  const { data: problems = [] } = useQuery({
    queryKey: ["meeting_problems", meetingId],
    queryFn: async () => { const { data } = await supabase.from("meeting_problems").select("*").eq("meeting_id", meetingId); return data || []; },
  });
  const done = actions.filter((a: any) => a.status === "completed").length;
  const avgTarget = targets.length ? Math.round(targets.reduce((s: number, t: any) => s + (t.achievement_percent || 0), 0) / targets.length) : 0;
  const resolved = problems.filter((p: any) => p.status === "resolved").length;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Card className="p-4"><div className="text-sm text-muted-foreground">অ্যাকশন সম্পন্ন</div><div className="text-2xl font-bold">{done}/{actions.length}</div><Progress className="mt-2" value={actions.length ? (done / actions.length) * 100 : 0} /></Card>
      <Card className="p-4"><div className="text-sm text-muted-foreground">গড় লক্ষ্য অর্জন</div><div className="text-2xl font-bold">{avgTarget}%</div><Progress className="mt-2" value={avgTarget} /></Card>
      <Card className="p-4"><div className="text-sm text-muted-foreground">সমস্যা সমাধান</div><div className="text-2xl font-bold">{resolved}/{problems.length}</div><Progress className="mt-2" value={problems.length ? (resolved / problems.length) * 100 : 0} /></Card>
    </div>
  );
}

function PreviousReviewTab({ currentDate }: { currentDate: string }) {
  const { data: prev } = useQuery({
    queryKey: ["meeting_prev", currentDate],
    queryFn: async () => {
      const { data } = await supabase.from("meetings").select("*").lt("meeting_date", currentDate).order("meeting_date", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  const { data: actions = [] } = useQuery({
    enabled: !!prev?.id,
    queryKey: ["meeting_prev_actions", prev?.id],
    queryFn: async () => { const { data } = await supabase.from("meeting_actions").select("*").eq("meeting_id", prev!.id); return data || []; },
  });
  const { data: targets = [] } = useQuery({
    enabled: !!prev?.id,
    queryKey: ["meeting_prev_targets", prev?.id],
    queryFn: async () => { const { data } = await supabase.from("meeting_targets").select("*").eq("meeting_id", prev!.id); return data || []; },
  });
  const { data: problems = [] } = useQuery({
    enabled: !!prev?.id,
    queryKey: ["meeting_prev_problems", prev?.id],
    queryFn: async () => { const { data } = await supabase.from("meeting_problems").select("*").eq("meeting_id", prev!.id); return data || []; },
  });

  if (!prev) return <Card className="p-6 text-center text-muted-foreground">পূর্বের কোনো মিটিং পাওয়া যায়নি</Card>;

  const pendingActions = actions.filter((a: any) => a.status !== "completed");
  const openProblems = problems.filter((p: any) => p.status !== "resolved");
  const incompleteTargets = targets.filter((t: any) => (t.achievement_percent || 0) < 100);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{prev.title}</div>
          <div className="text-xs text-muted-foreground">{prev.meeting_date} • {prev.meeting_type}</div>
        </div>
        <Button asChild size="sm" variant="outline" className="no-print"><Link to="/meetings/$id" params={{ id: prev.id }}>পূর্ণ বিবরণ</Link></Button>
      </div>

      <div>
        <div className="font-medium text-sm mb-2 flex items-center gap-2"><ListChecks className="w-4 h-4" /> অসম্পূর্ণ অ্যাকশন ({pendingActions.length})</div>
        <div className="space-y-1">
          {pendingActions.length === 0 && <div className="text-xs text-muted-foreground">সব সম্পন্ন ✓</div>}
          {pendingActions.map((a: any) => {
            const dl = daysLeft(a.deadline);
            return (
              <div key={a.id} className="flex items-center gap-2 text-sm border-b pb-1">
                <div className="flex-1">{a.action} <span className="text-xs text-muted-foreground">— {a.responsible || "—"}</span></div>
                {dl && <Badge variant={dl.tone === "danger" ? "destructive" : "secondary"} className="text-[10px]">{dl.label}</Badge>}
                <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="font-medium text-sm mb-2 flex items-center gap-2"><TargetIcon className="w-4 h-4" /> অসম্পূর্ণ লক্ষ্য ({incompleteTargets.length})</div>
        <div className="space-y-1">
          {incompleteTargets.length === 0 && <div className="text-xs text-muted-foreground">সব অর্জিত ✓</div>}
          {incompleteTargets.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-sm border-b pb-1">
              <div className="flex-1">{t.target} <span className="text-xs text-muted-foreground">— {t.assigned_to || "—"}</span></div>
              <Progress value={t.achievement_percent} className="w-24" />
              <span className="text-xs font-mono w-10 text-right">{t.achievement_percent}%</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-medium text-sm mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> অমীমাংসিত সমস্যা ({openProblems.length})</div>
        <div className="space-y-1">
          {openProblems.length === 0 && <div className="text-xs text-muted-foreground">সব সমাধান হয়েছে ✓</div>}
          {openProblems.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 text-sm border-b pb-1">
              <div className="flex-1">{p.problem} <span className="text-xs text-muted-foreground">— {p.raised_by || "—"}</span></div>
              <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
