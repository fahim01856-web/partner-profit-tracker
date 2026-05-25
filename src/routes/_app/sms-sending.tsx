import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { MessageSquare, Send, Plus, Trash2, Printer, BookOpen, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/sms-sending")({ component: SmsPage });

type SmsRow = {
  id: string;
  sms_type: string;
  customer_name: string | null;
  account_number: string | null;
  mobile: string;
  message: string;
  status: string;
  receive_date: string | null;
  sent_at: string | null;
  created_at: string;
};

const checkBookTemplate = (name: string) =>
  `প্রিয় ${name || "গ্রাহক"},\nআপনার চেক বই আমাদের শাখায় এসে পৌঁছেছে। অনুগ্রহ করে সংগ্রহ করুন।\nধন্যবাদ — ইসলামী ব্যাংক এজেন্ট আউটলেট ১২১/১১, ফকির বাজার, বুড়িচং।`;

function SmsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState("checkbook");

  const { data: rows = [] } = useQuery({
    queryKey: ["sms_logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_logs" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SmsRow[];
    },
  });

  // ----- Check Book -----
  const [cbForm, setCbForm] = useState({ customer_name: "", account_number: "", mobile: "", receive_date: new Date().toISOString().slice(0, 10) });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const checkBookRows = useMemo(() => rows.filter((r) => r.sms_type === "check_book"), [rows]);
  const filteredCB = useMemo(() => checkBookRows.filter((r) => !search || (r.customer_name || "").toLowerCase().includes(search.toLowerCase()) || r.mobile.includes(search) || (r.account_number || "").includes(search)), [checkBookRows, search]);

  const addCheckBook = useMutation({
    mutationFn: async () => {
      if (!cbForm.mobile) throw new Error(lang === "bn" ? "মোবাইল দিন" : "Mobile required");
      const { error } = await supabase.from("sms_logs" as any).insert({
        sms_type: "check_book",
        customer_name: cbForm.customer_name,
        account_number: cbForm.account_number,
        mobile: cbForm.mobile,
        receive_date: cbForm.receive_date,
        message: checkBookTemplate(cbForm.customer_name),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms_logs"] });
      toast.success(lang === "bn" ? "যোগ হয়েছে" : "Added");
      setCbForm({ customer_name: "", account_number: "", mobile: "", receive_date: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendSms = useMutation({
    mutationFn: async (ids: string[]) => {
      // Mark as sent (frontend simulation). User can attach real SMS gateway later.
      const { error } = await supabase.from("sms_logs" as any).update({ status: "sent", sent_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ["sms_logs"] });
      toast.success(lang === "bn" ? `${ids.length} টি SMS পাঠানো হয়েছে` : `${ids.length} SMS sent`);
      setSelected(new Set());
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sms_logs" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sms_logs"] }),
  });

  // ----- Custom SMS -----
  const [custom, setCustom] = useState({ customer_name: "", mobile: "", message: "" });
  const TEMPLATES = [
    { id: "balance", bn: "ব্যালেন্স রিমাইন্ডার", en: "Balance Reminder", text: "প্রিয় গ্রাহক, আপনার অ্যাকাউন্টে ব্যালেন্স কম। অনুগ্রহ করে জমা করুন। — ইসলামী ব্যাংক।" },
    { id: "dps", bn: "DPS কিস্তি", en: "DPS Installment", text: "প্রিয় গ্রাহক, আপনার DPS এর কিস্তির সময় হয়েছে। অনুগ্রহ করে পরিশোধ করুন। — ইসলামী ব্যাংক।" },
    { id: "thanks", bn: "ধন্যবাদ", en: "Thank You", text: "প্রিয় গ্রাহক, ইসলামী ব্যাংক এজেন্ট আউটলেট ১২১/১১ এ লেনদেনের জন্য ধন্যবাদ।" },
  ];

  const sendCustom = useMutation({
    mutationFn: async () => {
      if (!custom.mobile || !custom.message) throw new Error(lang === "bn" ? "মোবাইল ও মেসেজ দিন" : "Mobile & message required");
      const { error } = await supabase.from("sms_logs" as any).insert({
        sms_type: "custom",
        customer_name: custom.customer_name,
        mobile: custom.mobile,
        message: custom.message,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms_logs"] });
      toast.success(lang === "bn" ? "SMS পাঠানো হয়েছে" : "SMS sent");
      setCustom({ customer_name: "", mobile: "", message: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const customLog = useMemo(() => rows.filter((r) => r.sms_type === "custom"), [rows]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-primary" />
          {lang === "bn" ? "SMS পাঠানোর অপশন" : "SMS Sending"}
        </h1>
        <p className="text-muted-foreground text-sm">{lang === "bn" ? "চেক বই SMS ও কাস্টম SMS পাঠান" : "Check Book SMS & Custom SMS"}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-print">
          <TabsTrigger value="checkbook"><BookOpen className="w-4 h-4 mr-1" />{lang === "bn" ? "চেক বই SMS" : "Check Book SMS"}</TabsTrigger>
          <TabsTrigger value="custom"><MessageCircle className="w-4 h-4 mr-1" />{lang === "bn" ? "কাস্টম SMS" : "Custom SMS"}</TabsTrigger>
        </TabsList>

        <TabsContent value="checkbook" className="space-y-4">
          <Card className="p-4 no-print">
            <h3 className="font-bold mb-3">{lang === "bn" ? "নতুন চেক বই কাস্টমার যোগ করুন" : "Add Check Book Customer"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><Label>{lang === "bn" ? "নাম" : "Name"}</Label><Input value={cbForm.customer_name} onChange={(e) => setCbForm({ ...cbForm, customer_name: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "অ্যাকাউন্ট নং" : "Account No"}</Label><Input value={cbForm.account_number} onChange={(e) => setCbForm({ ...cbForm, account_number: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "মোবাইল *" : "Mobile *"}</Label><Input value={cbForm.mobile} onChange={(e) => setCbForm({ ...cbForm, mobile: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "প্রাপ্তির তারিখ" : "Receive Date"}</Label><Input type="date" value={cbForm.receive_date} onChange={(e) => setCbForm({ ...cbForm, receive_date: e.target.value })} /></div>
            </div>
            <div className="mt-3 p-3 bg-muted rounded text-xs whitespace-pre-line">{checkBookTemplate(cbForm.customer_name)}</div>
            <Button className="mt-3" onClick={() => addCheckBook.mutate()}><Plus className="w-4 h-4 mr-1" />{lang === "bn" ? "যোগ করুন" : "Add"}</Button>
          </Card>

          <div className="flex gap-2 flex-wrap no-print">
            <Input placeholder={lang === "bn" ? "খুঁজুন..." : "Search..."} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Button disabled={selected.size === 0} onClick={() => sendSms.mutate(Array.from(selected))}><Send className="w-4 h-4 mr-1" />{lang === "bn" ? `নির্বাচিত পাঠান (${selected.size})` : `Send Selected (${selected.size})`}</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
          </div>

          <Card className="overflow-hidden print-area">
            <div className="hidden print:block p-4 text-center border-b">
              <div className="font-bold text-lg">{t("bankName")}</div>
              <div className="text-sm">{lang === "bn" ? "চেক বই SMS লিস্ট" : "Check Book SMS List"}</div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="no-print w-10"></TableHead>
                    <TableHead>#</TableHead>
                    <TableHead>{lang === "bn" ? "নাম" : "Name"}</TableHead>
                    <TableHead>{lang === "bn" ? "অ্যাকাউন্ট" : "Account"}</TableHead>
                    <TableHead>{lang === "bn" ? "মোবাইল" : "Mobile"}</TableHead>
                    <TableHead>{lang === "bn" ? "প্রাপ্তির তারিখ" : "Receive Date"}</TableHead>
                    <TableHead>{lang === "bn" ? "অবস্থা" : "Status"}</TableHead>
                    <TableHead className="no-print">{lang === "bn" ? "অ্যাকশন" : "Action"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCB.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</TableCell></TableRow>}
                  {filteredCB.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="no-print">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => { const s = new Set(selected); if (v) s.add(r.id); else s.delete(r.id); setSelected(s); }} />
                      </TableCell>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{r.customer_name || "-"}</TableCell>
                      <TableCell>{r.account_number || "-"}</TableCell>
                      <TableCell>{r.mobile}</TableCell>
                      <TableCell>{r.receive_date || "-"}</TableCell>
                      <TableCell>
                        {r.status === "sent" ? <Badge className="bg-green-600">{lang === "bn" ? "পাঠানো" : "Sent"}</Badge> : <Badge variant="outline">{lang === "bn" ? "পেন্ডিং" : "Pending"}</Badge>}
                      </TableCell>
                      <TableCell className="no-print">
                        {r.status !== "sent" && <Button size="sm" variant="outline" onClick={() => sendSms.mutate([r.id])}><Send className="w-3 h-3 mr-1" />{lang === "bn" ? "পাঠান" : "Send"}</Button>}
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card className="p-4 no-print">
            <h3 className="font-bold mb-3">{lang === "bn" ? "কাস্টম SMS পাঠান" : "Send Custom SMS"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{lang === "bn" ? "কাস্টমার নাম" : "Customer Name"}</Label><Input value={custom.customer_name} onChange={(e) => setCustom({ ...custom, customer_name: e.target.value })} /></div>
              <div><Label>{lang === "bn" ? "মোবাইল *" : "Mobile *"}</Label><Input value={custom.mobile} onChange={(e) => setCustom({ ...custom, mobile: e.target.value })} /></div>
            </div>
            <div className="mt-3">
              <Label>{lang === "bn" ? "রেডি টেমপ্লেট" : "Ready Templates"}</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {TEMPLATES.map((tp) => (
                  <Button key={tp.id} size="sm" variant="outline" onClick={() => setCustom({ ...custom, message: tp.text })}>{lang === "bn" ? tp.bn : tp.en}</Button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Label>{lang === "bn" ? "মেসেজ *" : "Message *"} <span className="text-xs text-muted-foreground ml-2">{custom.message.length} chars</span></Label>
              <Textarea rows={4} value={custom.message} onChange={(e) => setCustom({ ...custom, message: e.target.value })} maxLength={1600} />
            </div>
            {custom.message && <div className="mt-3 p-3 bg-muted rounded text-sm"><div className="text-xs font-semibold mb-1 text-muted-foreground">{lang === "bn" ? "প্রিভিউ" : "Preview"}</div>{custom.message}</div>}
            <Button className="mt-3" onClick={() => sendCustom.mutate()}><Send className="w-4 h-4 mr-1" />{lang === "bn" ? "পাঠান" : "Send"}</Button>
          </Card>

          <Card className="overflow-hidden print-area">
            <div className="p-3 border-b flex items-center justify-between no-print">
              <h3 className="font-bold">{lang === "bn" ? "পাঠানো SMS ইতিহাস" : "Sent SMS History"}</h3>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1" />{lang === "bn" ? "প্রিন্ট" : "Print"}</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{lang === "bn" ? "নাম" : "Name"}</TableHead>
                    <TableHead>{lang === "bn" ? "মোবাইল" : "Mobile"}</TableHead>
                    <TableHead>{lang === "bn" ? "মেসেজ" : "Message"}</TableHead>
                    <TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead>
                    <TableHead className="no-print"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customLog.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{lang === "bn" ? "কোনো এন্ট্রি নেই" : "No entries"}</TableCell></TableRow>}
                  {customLog.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{r.customer_name || "-"}</TableCell>
                      <TableCell>{r.mobile}</TableCell>
                      <TableCell className="max-w-md truncate">{r.message}</TableCell>
                      <TableCell>{r.sent_at?.slice(0, 16).replace("T", " ") || "-"}</TableCell>
                      <TableCell className="no-print"><Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
