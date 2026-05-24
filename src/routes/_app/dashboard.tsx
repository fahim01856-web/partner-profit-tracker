import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { fmtBDT, toBn, bnMonths, monthRange } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Handshake } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const now = new Date();
  const { start, end } = monthRange(now.getFullYear(), now.getMonth() + 1);

  const { data } = useQuery({
    queryKey: ["dashboard", start, end],
    queryFn: async () => {
      const [inc, exp, partners] = await Promise.all([
        supabase.from("incomes").select("amount").gte("date", start).lte("date", end),
        supabase.from("expenses").select("amount").gte("date", start).lte("date", end),
        supabase.from("partners").select("*").order("share_percent", { ascending: false }),
      ]);
      const totalInc = (inc.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const totalExp = (exp.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      return { totalInc, totalExp, profit: totalInc - totalExp, partners: partners.data ?? [] };
    },
  });

  const stats = [
    { label: "মাসিক আয়", value: fmtBDT(data?.totalInc ?? 0), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: "মাসিক ব্যয়", value: fmtBDT(data?.totalExp ?? 0), icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "নেট প্রফিট", value: fmtBDT(data?.profit ?? 0), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: "পার্টনার", value: toBn(data?.partners.length ?? 0) + " জন", icon: Handshake, color: "text-gold-foreground", bg: "bg-gold/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">ড্যাশবোর্ড</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {bnMonths[now.getMonth()]} {toBn(now.getFullYear())} — সারসংক্ষেপ
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`w-10 h-10 rounded-lg grid place-items-center ${s.bg} ${s.color} mb-3`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-bold mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">পার্টনারদের চলতি মাসের শেয়ার (নেট প্রফিট থেকে)</h2>
        <div className="space-y-3">
          {(data?.partners ?? []).map((p) => {
            const share = ((data?.profit ?? 0) * Number(p.share_percent)) / 100;
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">শেয়ার: {toBn(p.share_percent)}%</div>
                </div>
                <div className="text-lg font-bold text-primary">{fmtBDT(share)}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
