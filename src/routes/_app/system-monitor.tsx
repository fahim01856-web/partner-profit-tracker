import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, useServerFn } from "@tanstack/react-query" with {};
import { useServerFn as useSF } from "@tanstack/react-start";
import { getSystemStats, deleteStorageFile, type SystemStats } from "@/lib/system-monitor.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import {
  Database, HardDrive, Files, Cloud, AlertTriangle, ShieldCheck, RefreshCw, Trash2,
  Image as ImageIcon, FileText, FileType2, Activity, Cpu, Server,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/system-monitor")({ component: SystemMonitorPage });

// Lovable Cloud free-tier soft caps used for visualisation
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB
const DB_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${u[i]}`;
}

const TYPE_COLORS: Record<string, string> = {
  Image: "#10b981", PDF: "#ef4444", Document: "#3b82f6",
  Video: "#a855f7", Audio: "#f59e0b", Other: "#64748b",
};

function StatCard({ icon: Icon, label, value, sub, accent = "primary" }: any) {
  return (
    <Card className="p-4 sm:p-5 relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 bg-${accent}`} />
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-lg bg-${accent}/10 text-${accent} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight">{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

function AlertBanner({ pct, label }: { pct: number; label: string }) {
  if (pct < 80) return null;
  const critical = pct >= 90;
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${critical ? "bg-destructive/10 border-destructive text-destructive" : "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400"}`}>
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <div className="text-sm font-medium">
        {critical ? "Critical: " : "Warning: "} {label} {pct.toFixed(1)}% ব্যবহৃত হয়েছে
      </div>
    </div>
  );
}

function SystemMonitorPage() {
  const qc = useQueryClient();
  const fetcher = useSF(getSystemStats);
  const deleter = useSF(deleteStorageFile);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["system-stats"],
    queryFn: () => fetcher(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const del = useMutation({
    mutationFn: (v: { bucket: string; path: string }) => deleter({ data: v }),
    onSuccess: () => {
      toast.success("ফাইল ডিলিট হয়েছে");
      qc.invalidateQueries({ queryKey: ["system-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "ডিলিট ব্যর্থ"),
  });

  const s: SystemStats | undefined = data;
  const storageUsed = s?.storage.totalBytes ?? 0;
  const storagePct = (storageUsed / STORAGE_LIMIT_BYTES) * 100;
  const dbUsed = s?.db.sizeBytes ?? 0;
  const dbPct = (dbUsed / DB_LIMIT_BYTES) * 100;

  const topFiles = [...(s?.storage.files ?? [])].sort((a, b) => b.size - a.size).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" /> Storage & System Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            স্টোরেজ, ডাটাবেস ও ক্লাউড রিসোর্স রিয়েল-টাইম মনিটরিং
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> রিফ্রেশ
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">লোড হচ্ছে...</div>
      ) : !s ? (
        <div className="text-center py-20 text-destructive">ডাটা লোড করা যায়নি</div>
      ) : (
        <>
          <div className="space-y-2">
            <AlertBanner pct={storagePct} label="ফাইল স্টোরেজ" />
            <AlertBanner pct={dbPct} label="ডাটাবেস স্টোরেজ" />
          </div>

          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={HardDrive} label="মোট স্টোরেজ" value={fmtBytes(STORAGE_LIMIT_BYTES)} sub="ক্লাউড লিমিট" accent="primary" />
            <StatCard icon={Cloud} label="ব্যবহৃত" value={fmtBytes(storageUsed)} sub={`${storagePct.toFixed(2)}%`} accent="gold" />
            <StatCard icon={ShieldCheck} label="অবশিষ্ট" value={fmtBytes(Math.max(0, STORAGE_LIMIT_BYTES - storageUsed))} accent="success" />
            <StatCard icon={Files} label="মোট ফাইল" value={s.storage.files.length} sub={`${s.storage.buckets.length} bucket`} accent="primary" />
          </div>

          {/* Storage usage card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /> Storage Usage</div>
              <Badge variant={storagePct >= 90 ? "destructive" : storagePct >= 80 ? "secondary" : "outline"}>
                {storagePct.toFixed(2)}%
              </Badge>
            </div>
            <Progress value={Math.min(100, storagePct)} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>ব্যবহৃত: {fmtBytes(storageUsed)}</span>
              <span>মোট: {fmtBytes(STORAGE_LIMIT_BYTES)}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              {s.storage.buckets.map((b) => (
                <div key={b.name} className="rounded-lg border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">{b.name}</div>
                  <div className="font-semibold mt-1">{fmtBytes(b.bytes)}</div>
                  <div className="text-xs text-muted-foreground">{b.files} ফাইল</div>
                </div>
              ))}
            </div>
          </Card>

          {/* DB usage card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Database Usage</div>
              <Badge variant={dbPct >= 90 ? "destructive" : dbPct >= 80 ? "secondary" : "outline"}>
                {dbPct.toFixed(2)}%
              </Badge>
            </div>
            <Progress value={Math.min(100, dbPct)} className="h-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">মোট সাইজ</div><div className="font-semibold">{fmtBytes(DB_LIMIT_BYTES)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">ব্যবহৃত</div><div className="font-semibold">{fmtBytes(dbUsed)}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">অবশিষ্ট</div><div className="font-semibold">{fmtBytes(Math.max(0, DB_LIMIT_BYTES - dbUsed))}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">মোট রেকর্ড</div><div className="font-semibold">{s.db.totalRows.toLocaleString()}</div></div>
            </div>

            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.db.tables.slice(0, 8).map(t => ({ name: t.name, KB: +(t.size_bytes / 1024).toFixed(1), rows: t.rows }))}>
                  <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="KB" fill="hsl(var(--primary, 158 70% 35%))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* File management */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="font-semibold flex items-center gap-2 mb-3"><FileType2 className="w-4 h-4 text-primary" /> File Type Distribution</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.storage.byType} dataKey="bytes" nameKey="type" outerRadius={90} label={(e: any) => `${e.type}: ${e.count}`}>
                      {s.storage.byType.map((e) => (
                        <Cell key={e.type} fill={TYPE_COLORS[e.type] ?? "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtBytes(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {s.storage.byType.map((t) => (
                  <div key={t.type} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded" style={{ background: TYPE_COLORS[t.type] ?? "#64748b" }} />
                    <span className="font-medium">{t.type}</span>
                    <span className="text-muted-foreground ml-auto">{t.count} · {fmtBytes(t.bytes)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="font-semibold flex items-center gap-2 mb-3"><Files className="w-4 h-4 text-primary" /> Largest Files</div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {topFiles.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">কোনো ফাইল নেই</div>}
                {topFiles.map((f) => (
                  <div key={`${f.bucket}/${f.path}`} className="flex items-center gap-2 p-2 rounded border bg-muted/20">
                    <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{f.bucket} · {fmtBytes(f.size)}</div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="shrink-0 text-destructive h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>ফাইলটি ডিলিট করবেন?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <span className="font-mono text-xs break-all">{f.bucket}/{f.path}</span> — এটি স্থায়ীভাবে মুছে যাবে।
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>বাতিল</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate({ bucket: f.bucket, path: f.path })}>
                            ডিলিট
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Cloud resource (informational — Lovable Cloud managed) */}
          <Card className="p-5">
            <div className="font-semibold flex items-center gap-2 mb-3"><Server className="w-4 h-4 text-primary" /> Cloud Resource</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Cpu className="w-3 h-3" /> Instance</div>
                <div className="font-semibold mt-1">Managed (Lovable Cloud)</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">DB Records</div>
                <div className="font-semibold mt-1">{s.db.totalRows.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tables</div>
                <div className="font-semibold mt-1">{s.db.tables.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Auto Refresh</div>
                <div className="font-semibold mt-1">৩০ সেকেন্ড</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 বিস্তারিত CPU / Memory / Bandwidth মেট্রিকস Lovable Cloud ব্যাকএন্ড ড্যাশবোর্ডে পাওয়া যাবে।
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
