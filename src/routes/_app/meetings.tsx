import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Calendar as CalendarIcon, MapPin, User, Trash2, ExternalLink, Bell } from "lucide-react";

export const Route = createFileRoute("/_app/meetings")({ component: MeetingsLayout });

function MeetingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isDetail = /\/meetings\/[^/]+$/.test(path);
  if (isDetail) return <Outlet />;
  return <MeetingsList />;
}

function MeetingsList() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [form, setForm] = useState({
    title: "",
    meeting_type: "weekly",
    meeting_date: new Date().toISOString().slice(0, 10),
    meeting_time: "",
    location: "",
    chairperson: "",
    summary: "",
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMtg = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").insert({ ...form, meeting_time: form.meeting_time || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("মিটিং তৈরি হয়েছে");
      setOpen(false);
      setForm({ ...form, title: "", location: "", chairperson: "", summary: "" });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMtg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ডিলিট হয়েছে");
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const filtered = meetings.filter((m: any) => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (filterType !== "all" && m.meeting_type !== filterType) return false;
    return true;
  });
  const upcoming = meetings.filter((m: any) => m.meeting_date >= today && m.status === "scheduled");
  const completed = meetings.filter((m: any) => m.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meeting Schedule</h1>
          <p className="text-sm text-muted-foreground">Smart Meeting & Follow-up Management</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> নতুন মিটিং</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">মোট মিটিং</div><div className="text-2xl font-bold">{meetings.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">আসন্ন</div><div className="text-2xl font-bold text-blue-600">{upcoming.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">সম্পন্ন</div><div className="text-2xl font-bold text-green-600">{completed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">এই সপ্তাহে</div><div className="text-2xl font-bold">{upcoming.filter((m: any) => new Date(m.meeting_date) <= new Date(Date.now() + 7 * 86400000)).length}</div></Card>
      </div>

      {upcoming.length > 0 && (
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2"><Bell className="w-4 h-4 text-blue-600" /><div className="font-semibold text-sm">Reminders — আসন্ন মিটিং</div></div>
          <div className="flex flex-wrap gap-2">
            {upcoming.slice(0, 5).map((m: any) => (
              <Link key={m.id} to="/meetings/$id" params={{ id: m.id }} className="text-xs px-2 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:underline">{m.title} — {m.meeting_date}</Link>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
            <SelectItem value="scheduled">নির্ধারিত</SelectItem>
            <SelectItem value="in_progress">চলমান</SelectItem>
            <SelectItem value="completed">সম্পন্ন</SelectItem>
            <SelectItem value="cancelled">বাতিল</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ধরন</SelectItem>
            <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
            <SelectItem value="monthly">মাসিক</SelectItem>
            <SelectItem value="emergency">জরুরি</SelectItem>
            <SelectItem value="review">পর্যালোচনা</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((m: any) => (
          <Card key={m.id} className="p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-semibold flex-1">{m.title}</div>
              <Badge variant={m.status === "completed" ? "default" : m.status === "cancelled" ? "destructive" : "secondary"}>{m.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mb-3">
              <div className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {m.meeting_date} {m.meeting_time || ""}</div>
              {m.location && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.location}</div>}
              {m.chairperson && <div className="flex items-center gap-1"><User className="w-3 h-3" /> {m.chairperson}</div>}
              <Badge variant="outline" className="text-[10px]">{m.meeting_type}</Badge>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1"><Link to="/meetings/$id" params={{ id: m.id }}><ExternalLink className="w-3 h-3 mr-1" /> বিস্তারিত</Link></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("ডিলিট করবেন?")) delMtg.mutate(m.id); }}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">কোনো মিটিং নেই</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>নতুন মিটিং</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>শিরোনাম *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>ধরন</Label>
              <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
                  <SelectItem value="monthly">মাসিক</SelectItem>
                  <SelectItem value="emergency">জরুরি</SelectItem>
                  <SelectItem value="review">পর্যালোচনা</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>তারিখ *</Label><Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} /></div>
            <div><Label>সময়</Label><Input type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} /></div>
            <div><Label>স্থান</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div className="col-span-2"><Label>সভাপতি</Label><Input value={form.chairperson} onChange={(e) => setForm({ ...form, chairperson: e.target.value })} /></div>
            <div className="col-span-2"><Label>সারসংক্ষেপ</Label><Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={() => createMtg.mutate()} disabled={!form.title}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
