import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtBDT, toBn, bnMonths } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/salary")({ component: SalaryPage });

function SalaryPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-all"],
    queryFn: async () => (await supabase.from("staff").select("*").eq("active", true).order("name")).data ?? [],
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["salaries", month, year],
    queryFn: async () => (await supabase.from("salaries").select("*").eq("month", month).eq("year", year)).data ?? [],
  });

  const pay = useMutation({
    mutationFn: async (p: { staff_id: string; base_salary: number; deductions: number; bonus: number; }) => {
      const net = p.base_salary - p.deductions + p.bonus;
      const { error } = await supabase.from("salaries").upsert({
        staff_id: p.staff_id, month, year,
        base_salary: p.base_salary, deductions: p.deductions, bonus: p.bonus,
        net_paid: net, paid_on: new Date().toISOString().slice(0,10),
      }, { onConflict: "staff_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("বেতন রেকর্ড হয়েছে"); qc.invalidateQueries({ queryKey: ["salaries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = salaries.reduce((s, r) => s + Number(r.net_paid), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">বেতন হিসাব</h1>
          <p className="text-sm text-muted-foreground">{bnMonths[month-1]} {toBn(year)}</p>
        </div>
        <div className="flex gap-2">
          <select className="h-9 rounded-md border px-3 text-sm bg-background" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {bnMonths.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <Input type="number" className="w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      <Card className="p-5">
        <div className="space-y-3">
          {staff.map((s) => {
            const existing = salaries.find(x => x.staff_id === s.id);
            return <SalaryRow key={s.id} staff={s} existing={existing} onPay={(p: { base_salary: number; deductions: number; bonus: number }) => pay.mutate({ staff_id: s.id, ...p })} />;
          })}
        </div>
        <div className="mt-4 pt-4 border-t flex justify-between font-semibold">
          <span>মোট প্রদত্ত বেতন:</span>
          <span className="text-primary">{fmtBDT(total)}</span>
        </div>
      </Card>
    </div>
  );
}

function SalaryRow({ staff, existing, onPay }: any) {
  const [base, setBase] = useState(existing?.base_salary ?? staff.monthly_salary);
  const [ded, setDed] = useState(existing?.deductions ?? 0);
  const [bonus, setBonus] = useState(existing?.bonus ?? 0);
  const net = Number(base) - Number(ded) + Number(bonus);

  return (
    <div className="p-3 rounded-lg border space-y-2">
      <div className="flex justify-between items-center">
        <div className="font-semibold">{staff.name} <span className="text-xs text-muted-foreground">— {staff.position}</span></div>
        {existing && <span className="text-xs px-2 py-0.5 rounded bg-success/15 text-success">প্রদত্ত</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div><Label className="text-xs">মূল বেতন</Label><Input type="number" value={base} onChange={(e) => setBase(Number(e.target.value))} /></div>
        <div><Label className="text-xs">কর্তন</Label><Input type="number" value={ded} onChange={(e) => setDed(Number(e.target.value))} /></div>
        <div><Label className="text-xs">বোনাস</Label><Input type="number" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} /></div>
        <div><Label className="text-xs">নেট</Label><div className="h-9 flex items-center font-bold text-primary">{fmtBDT(net)}</div></div>
      </div>
      <Button size="sm" onClick={() => onPay({ base_salary: Number(base), deductions: Number(ded), bonus: Number(bonus) })}>সংরক্ষণ</Button>
    </div>
  );
}
