import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

function StaffPage() {
  const { t } = useI18n();
  const fmt = useFmt();
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
      toast.success(t("staff_added"));
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
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["staff"] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("staff_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("staff_sub")}</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> {t("new_staff")}</h2>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>{t("name")}</Label><Input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
          <div><Label>{t("position")}</Label><Input value={form.position} onChange={(e) => setForm({...form, position: e.target.value})} /></div>
          <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
          <div><Label>{t("monthly_salary")}</Label><Input type="number" value={form.monthly_salary} onChange={(e) => setForm({...form, monthly_salary: e.target.value})} /></div>
          <div><Label>{t("joining_date")}</Label><Input type="date" value={form.joining_date} onChange={(e) => setForm({...form, joining_date: e.target.value})} /></div>
          <div className="lg:pt-6"><Button type="submit" disabled={add.isPending}>{t("add")}</Button></div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">{t("staff_list")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">{t("name")}</th><th className="p-2">{t("position")}</th><th className="p-2">{t("phone")}</th>
              <th className="p-2">{t("joining")}</th><th className="p-2 text-right">{t("salary_short")}</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-semibold">{r.name}</td>
                  <td className="p-2">{r.position}</td>
                  <td className="p-2">{r.phone}</td>
                  <td className="p-2">{r.joining_date ? fmt.date(r.joining_date) : '-'}</td>
                  <td className="p-2 text-right">{fmt.bdt(Number(r.monthly_salary))}</td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("no_staff")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
