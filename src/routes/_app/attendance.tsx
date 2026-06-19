import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFmt } from "@/lib/format";
import { useI18n, type DictKey } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/attendance")({ component: AttendancePage });

const STATUSES: { v: string; key: DictKey }[] = [
  { v: 'present', key: 'st_present' },
  { v: 'absent', key: 'st_absent' },
  { v: 'late', key: 'st_late' },
  { v: 'leave', key: 'st_leave' },
];

function AttendancePage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await supabase.from("staff").select("*").eq("active", true).order("sort_order").order("name")).data ?? [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", date],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("date", date)).data ?? [],
  });

  const mark = useMutation({
    mutationFn: async ({ staff_id, status }: { staff_id: string; status: string }) => {
      const { error } = await supabase.from("attendance").upsert({ staff_id, date, status }, { onConflict: "staff_id,date" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const getStatus = (id: string) => attendance.find(a => a.staff_id === id)?.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("attendance_title")}</h1>
          <p className="text-sm text-muted-foreground">{fmt.date(date)}</p>
        </div>
        <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <Card className="p-5">
        <div className="space-y-3">
          {staff.map((s) => {
            const cur = getStatus(s.id);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.position}{s.nid ? ` · NID: ${s.nid}` : ""}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {STATUSES.map(st => (
                    <Button key={st.v} size="sm" variant={cur === st.v ? "default" : "outline"}
                      onClick={() => mark.mutate({ staff_id: s.id, status: st.v })}>
                      {t(st.key)}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          {staff.length === 0 && <div className="text-center text-muted-foreground py-8">{t("add_staff_first")}</div>}
        </div>
      </Card>
    </div>
  );
}
