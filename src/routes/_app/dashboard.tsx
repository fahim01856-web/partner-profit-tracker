import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useFmt, monthRange } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, TrendingDown, Wallet, Handshake } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { t } = useI18n();
  const fmt = useFmt();
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
    { label: t("monthlyIncome"), value: fmt.bdt(data?.totalInc ?? 0), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: t("monthlyExpense"), value: fmt.bdt(data?.totalExp ?? 0), icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: t("netProfit"), value: fmt.bdt(data?.profit ?? 0), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: t("partners"), value: `${fmt.num(data?.partners.length ?? 0)} ${t("persons")}`.trim(), icon: Handshake, color: "text-gold-foreground", bg: "bg-gold/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("nav_dashboard")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {fmt.months[now.getMonth()]} {fmt.num(now.getFullYear())} — {t("dashboard_summary")}
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
        <h2 className="font-semibold mb-4">{t("partnerShareTitle")}</h2>
        <div className="space-y-3">
          {(data?.partners ?? []).map((p) => {
            const share = ((data?.profit ?? 0) * Number(p.share_percent)) / 100;
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{t("share")}: {fmt.num(p.share_percent)}%</div>
                </div>
                <div className="text-lg font-bold text-primary">{fmt.bdt(share)}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
