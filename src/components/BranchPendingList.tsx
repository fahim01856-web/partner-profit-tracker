import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Printer, ClipboardList, Cloud, CloudOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = {
  id: string;
  sl: string;
  date: string;
  work: string;
  done: boolean;
  sort_order: number;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function BranchPendingList() {
  const { lang } = useI18n();
  const [title, setTitle] = useState<string>("কুমিল্লা ব্রাঞ্চ ওয়ার্ক পেন্ডিং");
  const [items, setItems] = useState<Item[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load user + data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setLoaded(true);
        return;
      }
      const [{ data: rows }, { data: settings }] = await Promise.all([
        supabase
          .from("branch_pending_list")
          .select("id, sl, work_date, work, done, sort_order")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase.from("branch_pending_settings").select("title").eq("user_id", uid).maybeSingle(),
      ]);
      if (cancelled) return;
      if (rows) {
        setItems(
          rows.map((r) => ({
            id: r.id,
            sl: r.sl ?? "",
            date: r.work_date ?? "",
            work: r.work ?? "",
            done: !!r.done,
            sort_order: r.sort_order ?? 0,
          })),
        );
      }
      if (settings?.title) setTitle(settings.title);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // debounced title save
  useEffect(() => {
    if (!loaded || !userId) return;
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(async () => {
      await supabase
        .from("branch_pending_settings")
        .upsert({ user_id: userId, title }, { onConflict: "user_id" });
    }, 500);
    return () => {
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    };
  }, [title, loaded, userId]);

  const nextSL = useMemo(() => String(items.length + 1), [items.length]);

  const addRow = async () => {
    if (!userId) {
      toast.error("সেভ করতে লগইন করুন");
      return;
    }
    setSaving(true);
    const sort_order = items.length;
    const { data, error } = await supabase
      .from("branch_pending_list")
      .insert({
        user_id: userId,
        sl: nextSL,
        work_date: todayISO(),
        work: "",
        done: false,
        sort_order,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("সেভ করা যায়নি");
      return;
    }
    setItems((s) => [
      ...s,
      { id: data.id, sl: nextSL, date: todayISO(), work: "", done: false, sort_order },
    ]);
  };

  const update = (id: string, patch: Partial<Item>) => {
    setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (!userId) return;
    const dbPatch: {
      sl?: string;
      work_date?: string | null;
      work?: string;
      done?: boolean;
    } = {};
    if ("sl" in patch) dbPatch.sl = patch.sl;
    if ("date" in patch) dbPatch.work_date = patch.date || null;
    if ("work" in patch) dbPatch.work = patch.work;
    if ("done" in patch) dbPatch.done = patch.done;
    setSaving(true);
    supabase
      .from("branch_pending_list")
      .update(dbPatch)
      .eq("id", id)
      .then(({ error }) => {
        setSaving(false);
        if (error) toast.error("সেভ ব্যর্থ");
      });
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((s) => s.filter((r) => r.id !== id));
    if (!userId) return;
    const { error } = await supabase.from("branch_pending_list").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error("মুছতে ব্যর্থ");
    }
  };

  const stats = useMemo(() => {
    const done = items.filter((i) => i.done).length;
    return { total: items.length, done, pending: items.length - done };
  }, [items]);

  const printPad = () => {
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    const rows = items
      .map(
        (r, idx) => `
        <tr>
          <td style="text-align:center;width:60px">${r.sl || idx + 1}</td>
          <td style="width:120px">${r.date || ""}</td>
          <td>${(r.work || "").replace(/</g, "&lt;")}</td>
          <td style="text-align:center;width:120px">${r.done ? "✔ সম্পন্ন" : "☐ পেন্ডিং"}</td>
        </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>
        body{font-family:'SolaimanLipi','Noto Sans Bengali',Arial,sans-serif;padding:28px;color:#111}
        .pad{border:2px solid #0a5c36;border-radius:10px;padding:20px}
        .bank{font-size:20px;font-weight:700;color:#0a5c36;text-align:center}
        .branch{text-align:center;font-size:13px;margin-bottom:6px}
        h2{text-align:center;margin:10px 0 14px;font-size:18px;border-bottom:2px dashed #0a5c36;padding-bottom:8px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #444;padding:8px}
        th{background:#0a5c36;color:#fff;text-align:left}
        .meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#333}
        .sig{margin-top:40px;display:flex;justify-content:space-between;font-size:12px}
        .sig div{border-top:1px solid #444;padding-top:4px;min-width:180px;text-align:center}
        @media print{ button{display:none} }
      </style></head><body>
      <div class="pad">
        <div class="bank">ইসলামী ব্যাংক বাংলাদেশ পিএলসি</div>
        <div class="branch">ফকিরবাজার এজেন্ট আউটলেট, ১২১/১১, বুড়িচং, কুমিল্লা</div>
        <h2>${title}</h2>
        <div class="meta"><span>তারিখ: ${todayISO()}</span><span>মোট: ${stats.total} | সম্পন্ন: ${stats.done} | পেন্ডিং: ${stats.pending}</span></div>
        <table>
          <thead><tr><th style="text-align:center">SL</th><th>তারিখ</th><th>পেন্ডিং কাজ</th><th style="text-align:center">স্ট্যাটাস</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" style="text-align:center;padding:20px">কোনো এন্ট্রি নেই</td></tr>`}</tbody>
        </table>
        <div class="sig"><div>প্রস্তুতকারী</div><div>অনুমোদনকারী</div></div>
      </div>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Card className="p-4 sm:p-5 border-primary/30 no-print">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ClipboardList className="w-4 h-4 text-primary" />
            {lang === "bn" ? "ব্রাঞ্চ পেন্ডিং চেকলিস্ট" : "Branch Pending Checklist"}
            {userId ? (
              <span className="ml-1 inline-flex items-center gap-1 text-green-600">
                <Cloud className="w-3 h-3" /> {saving ? "সেভ হচ্ছে…" : "ক্লাউড সেভ"}
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
                <CloudOff className="w-3 h-3" /> লগইন প্রয়োজন
              </span>
            )}
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-bold text-base sm:text-lg h-9"
            placeholder="কুমিল্লা ব্রাঞ্চ ওয়ার্ক পেন্ডিং"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="text-xs px-2 py-1 rounded bg-muted self-center">
            মোট: <b>{stats.total}</b> | সম্পন্ন: <b className="text-green-600">{stats.done}</b> | পেন্ডিং: <b className="text-amber-600">{stats.pending}</b>
          </div>
          <Button variant="outline" size="sm" onClick={printPad}>
            <Printer className="w-4 h-4 mr-1" />প্রিন্ট কপি
          </Button>
          <Button size="sm" onClick={addRow} disabled={!userId}>
            <Plus className="w-4 h-4 mr-1" />নতুন সারি
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-muted">
            <tr>
              <th className="border p-2 w-16">SL</th>
              <th className="border p-2 w-36">তারিখ</th>
              <th className="border p-2 text-left">পেন্ডিং কাজ</th>
              <th className="border p-2 w-28">সম্পন্ন</th>
              <th className="border p-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loaded && items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">
                  "নতুন সারি" বাটনে ক্লিক করে সিরিয়াল বাই সিরিয়াল কাজ যোগ করুন
                </td>
              </tr>
            )}
            {items.map((r, idx) => (
              <tr key={r.id} className={r.done ? "bg-green-500/5" : ""}>
                <td className="border p-1">
                  <Input value={r.sl} onChange={(e) => update(r.id, { sl: e.target.value })} className="h-8 text-center" placeholder={String(idx + 1)} />
                </td>
                <td className="border p-1">
                  <Input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} className="h-8" />
                </td>
                <td className="border p-1">
                  <Input value={r.work} onChange={(e) => update(r.id, { work: e.target.value })} className="h-8" placeholder="কাজের বিবরণ" />
                </td>
                <td className="border p-1 text-center">
                  <label className="flex items-center justify-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={r.done} onChange={(e) => update(r.id, { done: e.target.checked })} className="w-4 h-4" />
                    <span className={`text-xs ${r.done ? "text-green-600 font-medium" : "text-muted-foreground"}`}>{r.done ? "✔" : "—"}</span>
                  </label>
                </td>
                <td className="border p-1 text-center">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">টিপ: ডেটা ক্লাউডে সেভ হয় — যেকোনো ডিভাইস থেকে এডিট করতে পারবেন।</p>
    </Card>
  );
}
