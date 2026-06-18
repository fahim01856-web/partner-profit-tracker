import { BankLogo } from "@/components/BankLogo";
import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Building2, Languages } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { session, loading, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  if (!loading && session) return <Navigate to="/dashboard" />;

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("login_success"));
    nav({ to: "/dashboard" });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("signup_success"));
  };

  const heroLines = t("hero_title").split("\n");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      <button
        onClick={() => setLang(lang === "bn" ? "en" : "bn")}
        className="absolute top-4 right-4 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-card border shadow-sm hover:bg-muted"
      >
        <Languages className="w-3.5 h-3.5" />
        {lang === "bn" ? "English" : "বাংলা"}
      </button>

      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden"
        style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white p-1 grid place-items-center shadow"><BankLogo className="w-full h-full" /></div>
          <div>
            <div className="font-bold text-lg">{t("bankName")}</div>
            <div className="text-sm opacity-80">{t("outlet")}</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            {heroLines.map((l, i) => <span key={i}>{l}<br/></span>)}
          </h1>
          <p className="text-base opacity-90 max-w-md">{t("hero_sub")}</p>
        </div>
        <div className="text-sm opacity-75">
          <div>📍 {t("locationFull")}</div>
          <div className="mt-1">{t("inCharge")}</div>
        </div>
        <Building2 className="absolute -bottom-10 -right-10 w-96 h-96 opacity-5" />
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white p-0.5 grid place-items-center shadow-sm"><BankLogo className="w-full h-full" /></div>
            <div>
              <div className="font-bold text-sm">{t("bankShort")} 121/11</div>
              <div className="text-xs text-muted-foreground">{t("outlet")}</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">{t("welcome")}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t("admin_login_msg")}</p>

          <form onSubmit={onLogin} className="space-y-3">
            <div>
              <Label htmlFor="le">{t("email")}</Label>
              <Input id="le" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div>
              <Label htmlFor="lp">{t("password")}</Label>
              <Input id="lp" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {t("login_btn")}
            </Button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              {lang === "bn" ? "শুধুমাত্র অনুমোদিত অ্যাডমিন অ্যাকাউন্ট। নতুন অ্যাকাউন্টের জন্য ম্যানেজারের সাথে যোগাযোগ করুন।" : "Authorized admin accounts only. Contact the manager for access."}
            </p>
          </form>

        </Card>
      </div>
    </div>
  );
}
