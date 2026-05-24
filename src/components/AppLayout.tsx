import { Link, useRouter, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, TrendingUp, Receipt, Users, ClipboardCheck,
  Wallet, Handshake, FileBarChart, LogOut, Menu, X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const nav = [
  { to: "/dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { to: "/income", label: "আয় এন্ট্রি", icon: TrendingUp },
  { to: "/expense", label: "খরচ ভাউচার", icon: Receipt },
  { to: "/staff", label: "স্টাফ", icon: Users },
  { to: "/attendance", label: "হাজিরা", icon: ClipboardCheck },
  { to: "/salary", label: "বেতন হিসাব", icon: Wallet },
  { to: "/partners", label: "পার্টনার শেয়ার", icon: Handshake },
  { to: "/reports", label: "রিপোর্ট", icon: FileBarChart },
] as const;

export function AppLayout() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const path = router.state.location.pathname;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-72 bg-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 no-print",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl font-bold" style={{ background: 'var(--gradient-gold)', color: 'var(--gold-foreground)' }}>
              ইব
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">ইসলামী ব্যাংক</div>
              <div className="text-xs opacity-80">এজেন্ট আউটলেট ১২১/১১</div>
              <div className="text-[10px] opacity-60">ফকির বাজার, বুড়িচং</div>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = path === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-sidebar-border">
          <div className="text-xs opacity-80 px-2 mb-2 truncate">{user?.email}</div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60"
          >
            <LogOut className="w-4 h-4" /> লগআউট
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <main className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-card border-b px-4 py-3 flex items-center justify-between no-print">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-md hover:bg-muted">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="font-semibold text-sm">এজেন্ট ব্যাংক হিসাব</div>
          <div className="w-7" />
        </header>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
