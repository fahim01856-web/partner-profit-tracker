import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFmt, monthRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, User as UserIcon, Phone, Mail, MapPin, Calendar, IdCard,
  Wallet, ClipboardCheck, FileText, Star, Activity, Plus, Trash2,
  Briefcase, TrendingUp, Clock, FileCheck, Pencil
} from "lucide-react";

export const Route = createFileRoute("/_app/staff/$id")({ component: StaffProfilePage });

function useSignedPhoto(pathOrUrl: string | null | undefined) {
  return useQuery({
    queryKey: ["staff-photo", pathOrUrl],
    queryFn: async () => {
      if (!pathOrUrl) return "";
      if (pathOrUrl.startsWith("http")) return pathOrUrl;
      const { data } = await supabase.storage.from("documents").createSignedUrl(pathOrUrl, 300);
      return data?.signedUrl ?? "";
    },
    enabled: !!pathOrUrl,
    staleTime: 4 * 60 * 1000,
  });
}

async function logActivity(staff_id: string, action: string, category: string, details?: string, performed_by?: string) {
  await supabase.from("staff_activity_log").insert({ staff_id, action, category, details: details || null, performed_by: performed_by || null });
}

function StaffProfilePage() {
  const { id } = Route.useParams();
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: photoUrl } = useSignedPhoto(staff?.photo_url);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!staff) return <div className="p-8 text-center text-muted-foreground">Not found</div>;

  const initials = (staff.name || "").split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const tenureMonths = staff.joining_date
    ? Math.floor((Date.now() - new Date(staff.joining_date).getTime()) / (30 * 86400000))
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/staff" })}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {lang === "bn" ? "ফিরে যান" : "Back"}
        </Button>
      </div>

      {/* Header card */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 via-card to-card">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <Avatar className="w-28 h-28 ring-4 ring-primary/20">
            <AvatarImage src={photoUrl || undefined} alt={staff.name} />
            <AvatarFallback className="text-2xl bg-muted">{initials || <UserIcon className="w-10 h-10" />}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{staff.name}</h1>
              {staff.active ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              {staff.employee_code && <Badge variant="outline">#{staff.employee_code}</Badge>}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1"><Briefcase className="w-3.5 h-3.5" />{staff.position || "—"}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
              <Stat icon={<Wallet className="w-3.5 h-3.5" />} label={lang === "bn" ? "মাসিক বেতন" : "Monthly Salary"} value={fmt.bdt(Number(staff.monthly_salary || 0))} />
              <Stat icon={<Calendar className="w-3.5 h-3.5" />} label={lang === "bn" ? "যোগদান" : "Joined"} value={staff.joining_date ? fmt.date(staff.joining_date) : "—"} />
              <Stat icon={<Clock className="w-3.5 h-3.5" />} label={lang === "bn" ? "চাকরির মেয়াদ" : "Tenure"} value={`${fmt.num(tenureMonths)} ${lang === "bn" ? "মাস" : "months"}`} />
              <Stat icon={<IdCard className="w-3.5 h-3.5" />} label="NID" value={staff.nid || "—"} />
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start w-full gap-1">
          <TabsTrigger value="profile"><UserIcon className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "প্রোফাইল" : "Profile"}</TabsTrigger>
          <TabsTrigger value="attendance"><ClipboardCheck className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "হাজিরা" : "Attendance"}</TabsTrigger>
          <TabsTrigger value="leave"><Calendar className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "ছুটি" : "Leave"}</TabsTrigger>
          <TabsTrigger value="salary"><Wallet className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "বেতন" : "Salary"}</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "ডকুমেন্ট" : "Documents"}</TabsTrigger>
          <TabsTrigger value="performance"><Star className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "পারফরম্যান্স" : "Performance"}</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="w-3.5 h-3.5 mr-1" />{lang === "bn" ? "লগ" : "Activity"}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab staff={staff} /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab staffId={id} /></TabsContent>
        <TabsContent value="leave"><LeaveTab staffId={id} /></TabsContent>
        <TabsContent value="salary"><SalaryTab staffId={id} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab staffId={id} /></TabsContent>
        <TabsContent value="performance"><PerformanceTab staffId={id} /></TabsContent>
        <TabsContent value="activity"><ActivityTab staffId={id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="font-semibold text-sm mt-0.5 break-words">{value}</div>
    </div>
  );
}

/* --------------------- PROFILE TAB --------------------- */
function ProfileTab({ staff }: { staff: any }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-3">{lang === "bn" ? "ব্যক্তিগত তথ্য" : "Personal Information"}</h3>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <Row icon={<Phone className="w-3.5 h-3.5" />} label={lang === "bn" ? "ফোন" : "Phone"} value={staff.phone} />
        <Row icon={<Phone className="w-3.5 h-3.5 text-destructive" />} label={lang === "bn" ? "জরুরি যোগাযোগ" : "Emergency"} value={staff.emergency_contact} />
        <Row icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={staff.email} />
        <Row icon={<IdCard className="w-3.5 h-3.5" />} label="NID" value={staff.nid} />
        <Row icon={<Calendar className="w-3.5 h-3.5" />} label={lang === "bn" ? "জন্ম তারিখ" : "Date of Birth"} value={staff.date_of_birth ? fmt.date(staff.date_of_birth) : null} />
        <Row icon={<Calendar className="w-3.5 h-3.5" />} label={lang === "bn" ? "যোগদান" : "Joining Date"} value={staff.joining_date ? fmt.date(staff.joining_date) : null} />
        <Row icon={<MapPin className="w-3.5 h-3.5" />} label={lang === "bn" ? "ঠিকানা" : "Address"} value={staff.address} full />
      </div>
      <div className="mt-4 pt-4 border-t">
        <Link to="/staff" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <Pencil className="w-3.5 h-3.5" /> {lang === "bn" ? "প্রোফাইল এডিট করুন (Staff মেনু থেকে)" : "Edit profile (from Staff menu)"}
        </Link>
      </div>
    </Card>
  );
}

function Row({ icon, label, value, full }: { icon: React.ReactNode; label: string; value: any; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="font-medium mt-0.5 break-words">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

/* --------------------- ATTENDANCE TAB --------------------- */
function AttendanceTab({ staffId }: { staffId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { start, end } = useMemo(() => monthRange(year, month), [year, month]);

  const { data: rows = [] } = useQuery({
    queryKey: ["attendance", staffId, start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*")
        .eq("staff_id", staffId).gte("date", start).lte("date", end).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const s = { present: 0, absent: 0, late: 0, leave: 0 };
    rows.forEach((r: any) => {
      if (r.status === "present") s.present++;
      else if (r.status === "absent") s.absent++;
      else if (r.status === "late") s.late++;
      else if (r.status === "leave") s.leave++;
    });
    return s;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end flex-wrap">
        <div><Label className="text-xs">{lang === "bn" ? "মাস" : "Month"}</Label>
          <Input type="number" min="1" max="12" className="w-20" value={month} onChange={e => setMonth(Number(e.target.value))} />
        </div>
        <div><Label className="text-xs">{lang === "bn" ? "বছর" : "Year"}</Label>
          <Input type="number" className="w-24" value={year} onChange={e => setYear(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox color="green" label={lang === "bn" ? "উপস্থিত" : "Present"} value={stats.present} />
        <StatBox color="red" label={lang === "bn" ? "অনুপস্থিত" : "Absent"} value={stats.absent} />
        <StatBox color="amber" label={lang === "bn" ? "দেরি" : "Late"} value={stats.late} />
        <StatBox color="blue" label={lang === "bn" ? "ছুটি" : "Leave"} value={stats.leave} />
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr><th className="p-2 text-left">{lang === "bn" ? "তারিখ" : "Date"}</th>
              <th className="p-2 text-left">{lang === "bn" ? "অবস্থা" : "Status"}</th>
              <th className="p-2 text-left">In</th><th className="p-2 text-left">Out</th>
              <th className="p-2 text-left">{lang === "bn" ? "নোট" : "Note"}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{lang === "bn" ? "কোনো রেকর্ড নেই" : "No records"}</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{fmt.date(r.date)}</td>
                <td className="p-2"><Badge variant={r.status === "present" ? "default" : r.status === "absent" ? "destructive" : "secondary"}>{r.status}</Badge></td>
                <td className="p-2">{r.in_time || "—"}</td><td className="p-2">{r.out_time || "—"}</td>
                <td className="p-2 text-muted-foreground">{r.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function StatBox({ color, label, value }: { color: string; label: string; value: number }) {
  const { num } = useFmt();
  const map: any = {
    green: "bg-green-50 text-green-900 border-green-200 dark:bg-green-950/30",
    red: "bg-red-50 text-red-900 border-red-200 dark:bg-red-950/30",
    amber: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30",
    blue: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/30",
  };
  return (
    <div className={`border rounded-lg p-3 ${map[color]}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-bold">{num(value)}</div>
    </div>
  );
}

/* --------------------- LEAVE TAB --------------------- */
function LeaveTab({ staffId }: { staffId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ start_date: "", end_date: "", leave_type: "casual", reason: "", approved_by: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["leaves", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leaves").select("*").eq("staff_id", staffId).order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leaves").insert({ staff_id: staffId, ...form });
      if (error) throw error;
      await logActivity(staffId, `Leave applied: ${form.leave_type}`, "leave", `${form.start_date} → ${form.end_date}`, form.approved_by);
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "ছুটি যোগ হয়েছে" : "Leave added");
      setForm({ start_date: "", end_date: "", leave_type: "casual", reason: "", approved_by: "" });
      qc.invalidateQueries({ queryKey: ["leaves", staffId] });
      qc.invalidateQueries({ queryKey: ["activity", staffId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (lid: string) => { const { error } = await supabase.from("leaves").delete().eq("id", lid); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["leaves", staffId] }); },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" />{lang === "bn" ? "নতুন ছুটি" : "New Leave"}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>{lang === "bn" ? "শুরু" : "From"}</Label><Input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "শেষ" : "To"}</Label><Input type="date" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "ধরন" : "Type"}</Label>
            <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
              <option value="casual">Casual</option><option value="sick">Sick</option><option value="annual">Annual</option><option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div><Label>{lang === "bn" ? "অনুমোদনকারী" : "Approved by"}</Label><Input value={form.approved_by} onChange={e => setForm({ ...form, approved_by: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "কারণ" : "Reason"}</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="sm:col-span-3"><Button type="submit" disabled={add.isPending}>{lang === "bn" ? "যোগ করুন" : "Add"}</Button></div>
        </form>
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr><th className="p-2 text-left">{lang === "bn" ? "শুরু" : "From"}</th><th className="p-2 text-left">{lang === "bn" ? "শেষ" : "To"}</th>
              <th className="p-2 text-left">{lang === "bn" ? "ধরন" : "Type"}</th><th className="p-2 text-left">{lang === "bn" ? "কারণ" : "Reason"}</th>
              <th className="p-2 text-left">{lang === "bn" ? "অনুমোদন" : "Approved"}</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{lang === "bn" ? "কোনো ছুটি নেই" : "No leaves"}</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{fmt.date(r.start_date)}</td><td className="p-2">{fmt.date(r.end_date)}</td>
                <td className="p-2"><Badge variant="outline">{r.leave_type}</Badge></td>
                <td className="p-2">{r.reason || "—"}</td><td className="p-2">{r.approved_by || "—"}</td>
                <td className="p-2"><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------- SALARY TAB --------------------- */
function SalaryTab({ staffId }: { staffId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const { data: rows = [] } = useQuery({
    queryKey: ["salaries", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("salaries").select("*").eq("staff_id", staffId).order("year", { ascending: false }).order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const totalPaid = rows.filter((r: any) => r.payment_status === "paid").reduce((s: number, r: any) => s + Number(r.net_paid || 0), 0);
  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <div><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট পরিশোধিত" : "Total Paid"}</div>
          <div className="text-2xl font-bold text-primary">{fmt.bdt(totalPaid)}</div></div>
        <div><div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট মাস" : "Total months"}</div>
          <div className="text-2xl font-bold">{fmt.num(rows.length)}</div></div>
        <Link to="/salary" className="text-sm text-primary hover:underline">{lang === "bn" ? "Salary মেনু থেকে এডিট" : "Edit from Salary menu →"}</Link>
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs">
            <tr><th className="p-2 text-left">{lang === "bn" ? "মাস/বছর" : "Month/Year"}</th>
              <th className="p-2 text-right">{lang === "bn" ? "মূল" : "Base"}</th>
              <th className="p-2 text-right">{lang === "bn" ? "ভাতা" : "Allowance"}</th>
              <th className="p-2 text-right">{lang === "bn" ? "বোনাস" : "Bonus"}</th>
              <th className="p-2 text-right">{lang === "bn" ? "কর্তন" : "Deduction"}</th>
              <th className="p-2 text-right">{lang === "bn" ? "নিট" : "Net"}</th>
              <th className="p-2">{lang === "bn" ? "অবস্থা" : "Status"}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">{lang === "bn" ? "কোনো বেতন নেই" : "No salary records"}</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{fmt.num(r.month)}/{fmt.num(r.year)}</td>
                <td className="p-2 text-right">{fmt.bdt(Number(r.base_salary))}</td>
                <td className="p-2 text-right">{fmt.bdt(Number(r.allowance))}</td>
                <td className="p-2 text-right">{fmt.bdt(Number(r.bonus))}</td>
                <td className="p-2 text-right text-red-600">{fmt.bdt(Number(r.deductions))}</td>
                <td className="p-2 text-right font-semibold">{fmt.bdt(Number(r.net_paid))}</td>
                <td className="p-2"><Badge variant={r.payment_status === "paid" ? "default" : "secondary"}>{r.payment_status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------- DOCUMENTS TAB --------------------- */
function DocumentsTab({ staffId }: { staffId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", category: "personal", description: "", expiry_date: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["staff-docs", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("staff_id", staffId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let file_url = null, file_name = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `staff/${staffId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        file_url = path; file_name = file.name;
      }
      const { error } = await supabase.from("documents").insert({
        staff_id: staffId, title: form.title, category: form.category,
        description: form.description || null, expiry_date: form.expiry_date || null,
        file_url, file_name,
      });
      if (error) throw error;
      await logActivity(staffId, `Document uploaded: ${form.title}`, "document");
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "ডকুমেন্ট যোগ হয়েছে" : "Document added");
      setForm({ title: "", category: "personal", description: "", expiry_date: "" }); setFile(null);
      qc.invalidateQueries({ queryKey: ["staff-docs", staffId] });
      qc.invalidateQueries({ queryKey: ["activity", staffId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const del = useMutation({
    mutationFn: async (did: string) => { const { error } = await supabase.from("documents").delete().eq("id", did); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["staff-docs", staffId] }); },
  });

  const openDoc = async (file_url: string) => {
    if (file_url.startsWith("http")) { window.open(file_url, "_blank"); return; }
    const { data } = await supabase.storage.from("documents").createSignedUrl(file_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" />{lang === "bn" ? "ডকুমেন্ট আপলোড" : "Upload Document"}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 gap-3">
          <div><Label>{lang === "bn" ? "শিরোনাম" : "Title"} *</Label><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</Label>
            <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="personal">Personal</option><option value="nid">NID</option><option value="certificate">Certificate</option>
              <option value="contract">Contract</option><option value="bank">Bank</option><option value="other">Other</option>
            </select>
          </div>
          <div><Label>{lang === "bn" ? "মেয়াদ" : "Expiry Date"}</Label><Input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "ফাইল" : "File"}</Label><Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "বিবরণ" : "Description"}</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Button type="submit" disabled={uploading}>{uploading ? "..." : (lang === "bn" ? "আপলোড" : "Upload")}</Button></div>
        </form>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.length === 0 && <Card className="p-6 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">{lang === "bn" ? "কোনো ডকুমেন্ট নেই" : "No documents"}</Card>}
        {rows.map((d: any) => {
          const expired = d.expiry_date && new Date(d.expiry_date) < new Date();
          return (
            <Card key={d.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck className="w-4 h-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{d.title}</div>
                    <div className="text-xs text-muted-foreground">{d.category}</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
              {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
              {d.expiry_date && <div className={`text-xs ${expired ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                {lang === "bn" ? "মেয়াদ:" : "Expires:"} {fmt.date(d.expiry_date)} {expired && `(${lang === "bn" ? "মেয়াদোত্তীর্ণ" : "expired"})`}
              </div>}
              {d.file_url && <Button size="sm" variant="outline" className="w-full" onClick={() => openDoc(d.file_url)}>{lang === "bn" ? "দেখুন" : "View File"}</Button>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------- PERFORMANCE TAB --------------------- */
function PerformanceTab({ staffId }: { staffId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ review_date: new Date().toISOString().slice(0, 10), period: "monthly", rating: "4", strengths: "", weaknesses: "", goals: "", comments: "", reviewer: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["staff-perf", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_performance").select("*").eq("staff_id", staffId).order("review_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const avg = rows.length ? rows.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) / rows.length : 0;

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_performance").insert({
        staff_id: staffId, ...form, rating: Number(form.rating),
      });
      if (error) throw error;
      await logActivity(staffId, `Performance review (${form.period}): ${form.rating}/5`, "performance", form.comments, form.reviewer);
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "রিভিউ যোগ হয়েছে" : "Review added");
      setForm({ review_date: new Date().toISOString().slice(0, 10), period: "monthly", rating: "4", strengths: "", weaknesses: "", goals: "", comments: "", reviewer: "" });
      qc.invalidateQueries({ queryKey: ["staff-perf", staffId] });
      qc.invalidateQueries({ queryKey: ["activity", staffId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (pid: string) => { const { error } = await supabase.from("staff_performance").delete().eq("id", pid); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["staff-perf", staffId] }); },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">{lang === "bn" ? "গড় রেটিং" : "Average Rating"}</div>
          <div className="text-3xl font-bold flex items-center gap-2">
            {fmt.num(avg.toFixed(1))} <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-xs text-muted-foreground">{fmt.num(rows.length)} {lang === "bn" ? "টি রিভিউ" : "reviews"}</div>
        </div>
        <TrendingUp className="w-10 h-10 text-primary" />
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" />{lang === "bn" ? "নতুন রিভিউ" : "New Review"}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>{lang === "bn" ? "তারিখ" : "Date"}</Label><Input type="date" required value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "পিরিয়ড" : "Period"}</Label>
            <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}>
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
            </select>
          </div>
          <div><Label>{lang === "bn" ? "রেটিং (০-৫)" : "Rating (0-5)"}</Label><Input type="number" min="0" max="5" step="0.1" required value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "রিভিউয়ার" : "Reviewer"}</Label><Input value={form.reviewer} onChange={e => setForm({ ...form, reviewer: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-3 grid sm:grid-cols-3 gap-3">
            <div><Label>{lang === "bn" ? "শক্তি" : "Strengths"}</Label><Textarea rows={2} value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "দুর্বলতা" : "Weaknesses"}</Label><Textarea rows={2} value={form.weaknesses} onChange={e => setForm({ ...form, weaknesses: e.target.value })} /></div>
            <div><Label>{lang === "bn" ? "লক্ষ্য" : "Goals"}</Label><Textarea rows={2} value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} /></div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>{lang === "bn" ? "মন্তব্য" : "Comments"}</Label><Textarea rows={2} value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} /></div>
          <div><Button type="submit" disabled={add.isPending}>{lang === "bn" ? "যোগ করুন" : "Add Review"}</Button></div>
        </form>
      </Card>
      <div className="space-y-3">
        {rows.length === 0 && <Card className="p-6 text-center text-muted-foreground">{lang === "bn" ? "কোনো রিভিউ নেই" : "No reviews yet"}</Card>}
        {rows.map((r: any) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{r.period}</Badge>
                <span className="text-xs text-muted-foreground">{fmt.date(r.review_date)}</span>
                {r.reviewer && <span className="text-xs text-muted-foreground">• {r.reviewer}</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 font-bold text-amber-600"><Star className="w-4 h-4 fill-amber-500" />{fmt.num(Number(r.rating).toFixed(1))}/5</div>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 mt-3 text-xs">
              {r.strengths && <div><div className="font-semibold text-green-700">{lang === "bn" ? "শক্তি" : "Strengths"}</div><div className="text-muted-foreground">{r.strengths}</div></div>}
              {r.weaknesses && <div><div className="font-semibold text-red-700">{lang === "bn" ? "দুর্বলতা" : "Weaknesses"}</div><div className="text-muted-foreground">{r.weaknesses}</div></div>}
              {r.goals && <div><div className="font-semibold text-blue-700">{lang === "bn" ? "লক্ষ্য" : "Goals"}</div><div className="text-muted-foreground">{r.goals}</div></div>}
            </div>
            {r.comments && <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">{r.comments}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------- ACTIVITY LOG TAB --------------------- */
function ActivityTab({ staffId }: { staffId: string }) {
  const { lang } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState({ action: "", category: "general", details: "", performed_by: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["activity", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_activity_log").select("*").eq("staff_id", staffId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_activity_log").insert({ staff_id: staffId, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(lang === "bn" ? "লগ যোগ হয়েছে" : "Log added");
      setForm({ action: "", category: "general", details: "", performed_by: "" });
      qc.invalidateQueries({ queryKey: ["activity", staffId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const catColor: any = {
    general: "bg-gray-100 text-gray-800", leave: "bg-blue-100 text-blue-800",
    document: "bg-purple-100 text-purple-800", performance: "bg-amber-100 text-amber-800",
    salary: "bg-green-100 text-green-800", warning: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" />{lang === "bn" ? "নতুন লগ এন্ট্রি" : "New Log Entry"}</h3>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 gap-3">
          <div><Label>{lang === "bn" ? "কার্যক্রম" : "Action"} *</Label><Input required value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} placeholder={lang === "bn" ? "যেমন: বিশেষ প্রশংসা" : "e.g. Special commendation"} /></div>
          <div><Label>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</Label>
            <select className="w-full h-9 border rounded-md px-2 bg-background" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="general">General</option><option value="warning">Warning</option><option value="performance">Performance</option>
              <option value="leave">Leave</option><option value="document">Document</option><option value="salary">Salary</option>
            </select>
          </div>
          <div className="sm:col-span-2"><Label>{lang === "bn" ? "বিস্তারিত" : "Details"}</Label><Textarea rows={2} value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} /></div>
          <div><Label>{lang === "bn" ? "করেছেন" : "Performed By"}</Label><Input value={form.performed_by} onChange={e => setForm({ ...form, performed_by: e.target.value })} /></div>
          <div className="flex items-end"><Button type="submit" disabled={add.isPending}>{lang === "bn" ? "যোগ করুন" : "Add"}</Button></div>
        </form>
      </Card>
      <div className="space-y-2">
        {rows.length === 0 && <Card className="p-6 text-center text-muted-foreground">{lang === "bn" ? "কোনো লগ নেই" : "No activity"}</Card>}
        {rows.map((r: any) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${catColor[r.category] || catColor.general}`}>{r.category}</span>
                  <span className="font-medium text-sm">{r.action}</span>
                </div>
                {r.details && <div className="text-xs text-muted-foreground mt-1">{r.details}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {fmt.date(r.created_at)} • {new Date(r.created_at).toLocaleTimeString()}
                  {r.performed_by && ` • ${r.performed_by}`}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
