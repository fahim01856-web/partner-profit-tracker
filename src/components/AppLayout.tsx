import { Link, useRouter, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  LayoutDashboard, TrendingUp, Receipt, Users, ClipboardCheck,
  Wallet, Handshake, FileBarChart, LogOut, Menu, X, Languages,
  ClipboardList, MessageSquare, Target, FileText, Banknote,
  BookOpen, FileSignature, Boxes, BookUser
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { LiveClock } from "@/components/LiveClock";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const path = router.state.location.pathname;

  const nav = [
    { to: "/dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
    { to: "/monthly-report", label: t("nav_monthly_report"), icon: FileBarChart },
    { to: "/agent-bank-investment", label: t("nav_investment"), icon: TrendingUp },
    { to: "/daily-deposit", label: t("nav_daily_deposit"), icon: Banknote },
    { to: "/cash-book", label: t("nav_cash_book"), icon: BookOpen },
    { to: "/expense", label: t("nav_expense"), icon: Receipt },
    { to: "/signature-cards", label: t("nav_signature"), icon: FileSignature },
    { to: "/inventory", label: t("nav_inventory"), icon: Boxes },
    { to: "/staff", label: t("nav_staff"), icon: Users },
    { to: "/employee-attendance", label: t("nav_emp_att"), icon: ClipboardCheck },
    { to: "/salary", label: t("nav_salary"), icon: Wallet },
    { to: "/salary-sheet", label: t("nav_salary_sheet"), icon: FileBarChart },
    { to: "/partners", label: t("nav_partners"), icon: Handshake },
    { to: "/reports", label: t("nav_reports"), icon: FileBarChart },
    { to: "/pending-works", label: t("nav_pending"), icon: ClipboardList },
    { to: "/sms-sending", label: t("nav_sms"), icon: MessageSquare },
    { to: "/targets", label: t("nav_targets"), icon: Target },
    { to: "/documents", label: t("nav_documents"), icon: FileText },
    { to: "/loan-ledger", label: t("nav_loan_ledger"), icon: BookUser },
  ] as const;

  const LangToggle = ({ className = "" }: { className?: string }) => (
    <button
      onClick={() => setLang(lang === "bn" ? "en" : "bn")}
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-sidebar-border hover:bg-sidebar-accent/60 transition", className)}
      title="Switch language"
    >
      <Languages className="w-3.5 h-3.5" />
      {lang === "bn" ? "EN" : "বাং"}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={cn(
        "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 no-print flex flex-col h-screen",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl font-bold shrink-0" style={{ background: 'var(--gradient-gold)', color: 'var(--gold-foreground)' }}>
              {lang === "bn" ? "ইব" : "IB"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm leading-tight truncate">{t("bankShort")}</div>
              <div className="text-xs opacity-80 truncate">{t("outlet")}</div>
              <div className="text-[10px] opacity-60 truncate">{t("location")}</div>
            </div>
            <LangToggle />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 overscroll-contain">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors w-full",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 p-3 border-t border-sidebar-border">
          <div className="text-xs opacity-80 px-2 mb-2 truncate">{user?.email}</div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60"
          >
            <LogOut className="w-4 h-4" /> {t("logout")}
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <main className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-card border-b px-4 py-3 flex items-center justify-between gap-2 no-print">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted shrink-0">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <LiveClock compact className="flex-1 justify-center min-w-0" />
          <LangToggle />
        </header>
        <div className="hidden lg:flex sticky top-0 z-20 bg-background/80 backdrop-blur border-b px-6 py-3 items-center justify-between no-print">
          <div className="font-semibold text-sm text-muted-foreground">{t("appTitle")}</div>
          <LiveClock />
        </div>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
