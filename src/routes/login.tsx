import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
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
    toast.success("সফলভাবে লগইন হয়েছে");
    nav({ to: "/dashboard" });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল ভেরিফাই করে লগইন করুন।");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden"
        style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg grid place-items-center font-bold text-xl" style={{ background: 'var(--gradient-gold)', color: 'var(--gold-foreground)' }}>ইব</div>
          <div>
            <div className="font-bold text-lg">ইসলামী ব্যাংক বাংলাদেশ পিএলসি</div>
            <div className="text-sm opacity-80">এজেন্ট আউটলেট ১২১/১১</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            এজেন্ট ব্যাংক<br/>হিসাব ব্যবস্থাপনা
          </h1>
          <p className="text-base opacity-90 max-w-md">
            আয়, ব্যয়, ভাউচার, স্টাফ হাজিরা, বেতন ও পার্টনার শেয়ার — সব এক প্ল্যাটফর্মে। স্মার্ট, নিরাপদ ও সম্পূর্ণ বাংলায়।
          </p>
        </div>
        <div className="text-sm opacity-75">
          <div>📍 ফকির বাজার, বুড়িচং, কুমিল্লা</div>
          <div className="mt-1">ইনচার্জ: মো. ফাহিম</div>
        </div>
        <Building2 className="absolute -bottom-10 -right-10 w-96 h-96 opacity-5" />
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg grid place-items-center font-bold" style={{ background: 'var(--gradient-primary)', color: 'var(--primary-foreground)' }}>ইব</div>
            <div>
              <div className="font-bold text-sm">ইসলামী ব্যাংক ১২১/১১</div>
              <div className="text-xs text-muted-foreground">এজেন্ট আউটলেট</div>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">স্বাগতম</h2>
          <p className="text-sm text-muted-foreground mb-6">অ্যাডমিন প্যানেলে প্রবেশ করুন</p>

          <Tabs defaultValue="login">
            <TabsList className="w-full grid grid-cols-2 mb-4">
              <TabsTrigger value="login">লগইন</TabsTrigger>
              <TabsTrigger value="signup">নতুন অ্যাকাউন্ট</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-3">
                <div>
                  <Label htmlFor="le">ইমেইল</Label>
                  <Input id="le" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
                </div>
                <div>
                  <Label htmlFor="lp">পাসওয়ার্ড</Label>
                  <Input id="lp" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} লগইন করুন
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignup} className="space-y-3">
                <div>
                  <Label htmlFor="sn">পূর্ণ নাম</Label>
                  <Input id="sn" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="মো. ফাহিম" />
                </div>
                <div>
                  <Label htmlFor="se">ইমেইল</Label>
                  <Input id="se" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="sp">পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর)</Label>
                  <Input id="sp" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} অ্যাকাউন্ট তৈরি করুন
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
