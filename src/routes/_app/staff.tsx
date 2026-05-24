import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtBDT, fmtBnDate } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

function StaffPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", position: "", phone: "", monthly_salary: "", joining_date: new Date().toISOString().slice(0,10) });

  const { data: rows = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff").insert({
        name: form.name, position: form.position, phone: form.phone,
        monthly_salary: Number(form.monthly_salary || 0), joining_date: form.joining_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("স্টাফ যোগ হয়েছে");
      setForm({ name: "", position: "", phone: "", monthly_salary: "", joining_date: new Date().toISOString().slice(0,10) });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["staff"] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">স্টাফ ব্যবস্থাপনা</h1>
        <p className="text-sm text-muted-foreground">স্টাফদের তথ্য ও মাসিক বেতন সেটআপ করুন</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> নতুন স্টাফ</h2>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>নাম</Label><Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
          <div><Label>পদবী</Label><Input value={form.position} onChange={(e) => setForm({...form, position: e.target.value})} /></div>
          <div><Label>মোবাইল</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
          <div><Label>মাসিক বেতন (৳)</Label><Input type="number" value={form.monthly_salary} onChange={(e) => setForm({...form, monthly_salary: e.target.value})} /></div>
          <div><Label>জয়েনিং তারিখ</Label><Input type="date" value={form.joining_date} onChange={(e) => setForm({...form, joining_date: e.target.value})} /></div>
          <div className="lg:pt-6"><Button type="submit" disabled={add.isPending}>যোগ করুন</Button></div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">স্টাফ তালিকা</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">নাম</th><th className="p-2">পদবী</th><th className="p-2">মোবাইল</th>
              <th className="p-2">জয়েনিং</th><th className="p-2 text-right">বেতন</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2">{r.position}</td>
                  <td className="p-2">{r.phone}</td>
                  <td className="p-2">{r.joining_date ? fmtBnDate(r.joining_date) : '-'}</td>
                  <td className="p-2 text-right">{fmtBDT(Number(r.monthly_salary))}</td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">কোনো স্টাফ নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
