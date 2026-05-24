import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtBDT, fmtBnDate, toBn, genVoucherNo } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer, FileDown } from "lucide-react";

export const Route = createFileRoute("/_app/expense")({ component: ExpensePage });

const CATEGORIES = ["বিদ্যুৎ বিল", "ইন্টারনেট", "অফিস ভাড়া", "স্টেশনারি", "যাতায়াত", "মেরামত", "অন্যান্য"];

function ExpensePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    voucher_no: genVoucherNo(), date: new Date().toISOString().slice(0,10),
    category: CATEGORIES[0], description: "", paid_to: "", amount: "", note: "",
  });
  const [printRow, setPrintRow] = useState<any>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        voucher_no: form.voucher_no, date: form.date, category: form.category,
        description: form.description, paid_to: form.paid_to, amount: Number(form.amount), note: form.note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ভাউচার তৈরি হয়েছে");
      setForm({ ...form, voucher_no: genVoucherNo(), description: "", paid_to: "", amount: "", note: "" });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
  });

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  const doPrint = (r: any) => {
    setPrintRow(r);
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold">খরচ ভাউচার</h1>
          <p className="text-sm text-muted-foreground">প্রত্যেক দিনের ভাউচার তৈরি, এডিট ও প্রিন্ট করুন</p>
        </div>
        <Button variant="outline" onClick={() => { setPrintRow(null); window.print(); }}><FileDown className="w-4 h-4 mr-2" /> সব প্রিন্ট / PDF</Button>
      </div>

      <Card className="p-5 no-print">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> নতুন ভাউচার</h2>
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><Label>ভাউচার নং</Label><Input value={form.voucher_no} onChange={(e) => setForm({...form, voucher_no: e.target.value})} required /></div>
          <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} required /></div>
          <div><Label>ক্যাটাগরি</Label>
            <select className="w-full h-9 rounded-md border border-input px-3 text-sm bg-background" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>প্রাপক</Label><Input value={form.paid_to} onChange={(e) => setForm({...form, paid_to: e.target.value})} /></div>
          <div><Label>পরিমাণ (৳)</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></div>
          <div><Label>বিবরণ</Label><Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
          <div className="sm:col-span-2 lg:col-span-3"><Label>মন্তব্য</Label><Textarea value={form.note} onChange={(e) => setForm({...form, note: e.target.value})} /></div>
          <div><Button type="submit" disabled={add.isPending}>ভাউচার তৈরি করুন</Button></div>
        </form>
      </Card>

      {/* Voucher print template */}
      {printRow && (
        <div className="print-area hidden print:block">
          <div className="p-8 max-w-2xl mx-auto">
            <div className="border-b-2 border-primary pb-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">ইসলামী ব্যাংক বাংলাদেশ পিএলসি</div>
                <div className="text-sm">এজেন্ট আউটলেট ১২১/১১, ফকির বাজার, বুড়িচং, কুমিল্লা</div>
                <div className="text-lg font-bold mt-3 underline">খরচ ভাউচার</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><strong>ভাউচার নং:</strong> {printRow.voucher_no}</div>
              <div className="text-right"><strong>তারিখ:</strong> {fmtBnDate(printRow.date)}</div>
              <div><strong>ক্যাটাগরি:</strong> {printRow.category}</div>
              <div><strong>প্রাপক:</strong> {printRow.paid_to}</div>
            </div>
            <div className="border p-4 mb-6"><strong>বিবরণ:</strong><br/>{printRow.description}<br/>{printRow.note}</div>
            <div className="text-xl font-bold border-t-2 border-b-2 py-3 text-center">পরিমাণ: {fmtBDT(Number(printRow.amount))}</div>
            <div className="grid grid-cols-2 gap-8 mt-16 text-center text-sm">
              <div><div className="border-t pt-1">প্রাপকের স্বাক্ষর</div></div>
              <div><div className="border-t pt-1">অনুমোদনকারী (মো. ফাহিম)</div></div>
            </div>
          </div>
        </div>
      )}

      <Card className={`p-5 ${printRow ? 'no-print' : 'print-area'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">ভাউচার তালিকা</h2>
          <div className="text-sm">মোট: <span className="font-bold text-destructive">{fmtBDT(total)}</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>
              <th className="p-2">ভাউচার নং</th><th className="p-2">তারিখ</th><th className="p-2">ক্যাটাগরি</th>
              <th className="p-2">প্রাপক</th><th className="p-2 text-right">পরিমাণ</th><th className="p-2 no-print"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.voucher_no}</td>
                  <td className="p-2">{fmtBnDate(r.date)}</td>
                  <td className="p-2">{r.category}</td>
                  <td className="p-2">{r.paid_to}</td>
                  <td className="p-2 text-right font-semibold">{fmtBDT(Number(r.amount))}</td>
                  <td className="p-2 no-print flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => doPrint(r)}><Printer className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">কোনো ভাউচার নেই</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground mt-3">মোট ভাউচার: {toBn(rows.length)}</div>
      </Card>
    </div>
  );
}
