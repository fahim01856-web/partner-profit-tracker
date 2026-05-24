import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileBarChart, Handshake, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

function ReportsPage() {
  const { t, lang } = useI18n();
  const items = [
    { to: "/partners" as const, label: t("nav_partners"), desc: lang === "bn" ? "পার্টনার প্রফিট ডিস্ট্রিবিউশন রিপোর্ট ও প্রিন্ট" : "Partner profit distribution report & print", icon: Handshake },
    { to: "/income" as const, label: t("nav_income"), desc: lang === "bn" ? "মাসিক আয়ের তালিকা" : "Monthly income list", icon: TrendingUp },
    { to: "/expense" as const, label: t("nav_expense"), desc: lang === "bn" ? "ভাউচার তালিকা ও প্রিন্ট" : "Voucher list & print", icon: Receipt },
    { to: "/salary" as const, label: t("nav_salary"), desc: lang === "bn" ? "মাসিক বেতন প্রদান রিপোর্ট" : "Monthly salary report", icon: Wallet },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <FileBarChart className="w-7 h-7 text-primary" /> {t("nav_reports")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "bn" ? "সকল প্রিন্ট ও PDF রিপোর্টে দ্রুত প্রবেশ" : "Quick access to all printable / PDF reports"}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it) => (
          <Card key={it.to} className="p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
              <it.icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{it.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
              <Button asChild size="sm" className="mt-3">
                <Link to={it.to}>{lang === "bn" ? "খুলুন" : "Open"}</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
