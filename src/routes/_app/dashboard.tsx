import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { useFmt, monthRange, localISO } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { TrendingUp, TrendingDown, Wallet, Handshake, RefreshCw, Send, UserPlus, PiggyBank } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const now = new Date();
  // Show PREVIOUS month on dashboard
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = prev.getMonth() + 1;
  const { start, end } = monthRange(year, month);
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const { start: curStart, end: curEnd } = monthRange(curYear, curMonth);
  const yesterday = localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const { data, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard", start, end, curStart, curEnd, yesterday],
    queryFn: async () => {
      const [partners, mri, mp, remitPrev, acctsPrev, dep] = await Promise.all([
        supabase.from("partners").select("*").order("share_percent", { ascending: false }),
        supabase.from("monthly_report_items").select("amount,item_type").eq("year", year).eq("month", month),
        supabase.from("monthly_profits").select("*").eq("year", year).eq("month", month).maybeSingle(),
        supabase.from("remittance_entries").select("quantity,amount").gte("date", start).lte("date", end),
        supabase.from("account_opening_entries").select("num_accounts").eq("year", year).eq("month", month),
        supabase.from("daily_deposits").select("amount").eq("date", yesterday),
      ]);
      const totalInc = (mri.data ?? []).filter((r: any) => r.item_type === "income").reduce((s, r: any) => s + Number(r.amount), 0);
      const totalExp = (mri.data ?? []).filter((r: any) => r.item_type === "expense").reduce((s, r: any) => s + Number(r.amount), 0);
      const profit = totalInc - totalExp;
      const remitCount = (remitPrev.data ?? []).reduce((s, r: any) => s + Number(r.quantity ?? 0), 0);
      const remitAmount = (remitPrev.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      const accountCount = (acctsPrev.data ?? []).reduce((s, r: any) => s + Number(r.num_accounts ?? 0), 0);
      const remitMonthIdx = prev.getMonth();
      const accountMonthIdx = prev.getMonth();
      const yesterdayDeposit = (dep.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        totalInc, totalExp, profit,
        partners: partners.data ?? [],
        monthlyProfit: mp.data,
        remitCount, remitAmount, accountCount, yesterdayDeposit,
        remitMonthIdx, accountMonthIdx,
      };
    },
  });


  // Realtime auto-refresh: any change to relevant tables invalidates the dashboard
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["dashboard"] });
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "partners" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_profits" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_report_items" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "remittance_entries" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_opening_entries" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_deposits" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Prefer manually-entered monthly profit (with custom partner split) if present
  const effectiveProfit = data?.monthlyProfit ? Number(data.monthlyProfit.total_profit) : data?.profit ?? 0;

  const stats = [
    { label: t("monthlyIncome"), value: fmt.bdt(data?.totalInc ?? 0), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: t("monthlyExpense"), value: fmt.bdt(data?.totalExp ?? 0), icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: t("netProfit"), value: fmt.bdt(effectiveProfit), icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: t("partners"), value: `${fmt.num(data?.partners.length ?? 0)} ${t("persons")}`.trim(), icon: Handshake, color: "text-gold-foreground", bg: "bg-gold/20" },
  ];

  const mp = data?.monthlyProfit;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("nav_dashboard")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fmt.months[prev.getMonth()]} {fmt.num(prev.getFullYear())} — {t("dashboard_summary")}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 shrink-0">
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Live" : "Live"}
        </Badge>
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

        <Card className="p-5">
          <div className="w-10 h-10 rounded-lg grid place-items-center bg-primary/10 text-primary mb-3">
            <Send className="w-5 h-5" />
          </div>
          <div className="text-xs text-muted-foreground">{t("foreignRemittance")} <span className="text-[10px] text-primary/80">({fmt.months[data?.remitMonthIdx ?? prev.getMonth()]})</span></div>
          <div className="text-xl font-bold mt-1">{fmt.bdt(data?.remitAmount ?? 0)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("count")}: {fmt.num(data?.remitCount ?? 0)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 rounded-lg grid place-items-center bg-success/10 text-success mb-3">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="text-xs text-muted-foreground">{t("newAccounts")} <span className="text-[10px] text-success/80">({fmt.months[data?.accountMonthIdx ?? prev.getMonth()]})</span></div>
          <div className="text-xl font-bold mt-1">{fmt.num(data?.accountCount ?? 0)}</div>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 rounded-lg grid place-items-center bg-gold/20 text-gold-foreground mb-3">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="text-xs text-muted-foreground">{t("yesterdayDeposit")}</div>
          <div className="text-xl font-bold mt-1">{fmt.bdt(data?.yesterdayDeposit ?? 0)}</div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">{t("partnerShareTitle")}</h2>
        <div className="space-y-3">
          {mp ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-semibold">{mp.partner1_name}</div>
                  <div className="text-xs text-muted-foreground">{t("share")}: {fmt.num(Number(mp.partner1_percent))}%</div>
                </div>
                <div className="text-lg font-bold text-primary">
                  {fmt.bdt((Number(mp.total_profit) * Number(mp.partner1_percent)) / 100)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-semibold">{mp.partner2_name}</div>
                  <div className="text-xs text-muted-foreground">{t("share")}: {fmt.num(Number(mp.partner2_percent))}%</div>
                </div>
                <div className="text-lg font-bold text-primary">
                  {fmt.bdt((Number(mp.total_profit) * Number(mp.partner2_percent)) / 100)}
                </div>
              </div>
            </>
          ) : (
            (data?.partners ?? []).map((p) => {
              const share = (effectiveProfit * Number(p.share_percent)) / 100;
              return (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{t("share")}: {fmt.num(p.share_percent)}%</div>
                  </div>
                  <div className="text-lg font-bold text-primary">{fmt.bdt(share)}</div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {dataUpdatedAt > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
