import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Boxes, Plus, Trash2, Pencil, Printer, Save, AlertTriangle, PackageCheck, PackageMinus, Package, ClipboardList, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/inventory")({ component: InventoryPage });

type ItemType = "mtdr" | "mmpdsa" | "cheque_book";

type Receipt = { id: string; date: string; item_type: ItemType; quantity: number; source: string | null; note: string | null };
type Distribution = { id: string; date: string; item_type: ItemType; quantity: number; customer_name: string; account_number: string; note: string | null };
type Pending = { id: string; item_type: ItemType; customer_name: string; mobile: string | null; account_number: string; quantity: number; note: string | null; status: "pending" | "delivered"; requested_date: string; delivered_date: string | null };

const todayStr = () => new Date().toISOString().slice(0, 10);
const LOW_STOCK = 10;

function InventoryPage() {
  const { lang, t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");

  const itemLabel = (it: ItemType) => {
    if (it === "mtdr") return "MTDR";
    if (it === "mmpdsa") return "MMPDSA";
    return lang === "bn" ? "চেক বই" : "Cheque Book";
  };

  const [rForm, setRForm] = useState({ id: null as string | null, date: todayStr(), item_type: "mtdr" as ItemType, quantity: "", source: "", note: "" });
  const [dForm, setDForm] = useState({ id: null as string | null, date: todayStr(), item_type: "mtdr" as ItemType, quantity: "", customer_name: "", account_number: "", note: "" });
  const [pForm, setPForm] = useState({ id: null as string | null, item_type: "mtdr" as ItemType, customer_name: "", mobile: "", account_number: "", quantity: "1", note: "" });
  const [pStatusFilter, setPStatusFilter] = useState<"pending" | "delivered" | "all">("pending");

  // Filters for history
  const [fType, setFType] = useState<string>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const { data: receipts = [] } = useQuery({
    queryKey: ["inventory_receipts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_receipts").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Receipt[];
    },
  });

  const { data: distributions = [] } = useQuery({
    queryKey: ["inventory_distributions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_distributions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Distribution[];
    },
  });

  const { data: pendings = [] } = useQuery({
    queryKey: ["inventory_pending"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_pending_requests").select("*").order("requested_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pending[];
    },
  });

  const pendingCount = (it: ItemType) => pendings.filter((p) => p.item_type === it && p.status === "pending").reduce((s, p) => s + Number(p.quantity), 0);

  const sumBy = (rows: { item_type: ItemType; quantity: number }[], it: ItemType) =>
    rows.filter((r) => r.item_type === it).reduce((s, r) => s + Number(r.quantity), 0);

  const stock = (it: ItemType) => sumBy(receipts, it) - sumBy(distributions, it);

  const items: ItemType[] = ["mtdr", "mmpdsa", "cheque_book"];

  const saveReceipt = useMutation({
    mutationFn: async () => {
      const qty = Number(rForm.quantity || 0);
      if (qty <= 0) throw new Error("Quantity required");
      const payload = { date: rForm.date, item_type: rForm.item_type, quantity: qty, source: rForm.source.trim() || null, note: rForm.note.trim() || null };
      if (rForm.id) {
        const { error } = await supabase.from("inventory_receipts").update(payload).eq("id", rForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_receipts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_receipts"] });
      toast.success(t("save") + " ✓");
      setRForm({ id: null, date: todayStr(), item_type: rForm.item_type, quantity: "", source: "", note: "" });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const saveDist = useMutation({
    mutationFn: async () => {
      const qty = Number(dForm.quantity || 0);
      if (qty <= 0) throw new Error("Quantity required");
      if (!dForm.customer_name.trim() || !dForm.account_number.trim()) throw new Error(lang === "bn" ? "কাস্টমার নাম ও অ্যাকাউন্ট নং দিন" : "Customer name & account required");
      // Check stock
      if (!dForm.id && qty > stock(dForm.item_type)) {
        if (!confirm(lang === "bn" ? `স্টক কম! বর্তমান স্টক: ${stock(dForm.item_type)}. তবুও সংরক্ষণ করবেন?` : `Insufficient stock! Current: ${stock(dForm.item_type)}. Save anyway?`)) {
          throw new Error("Cancelled");
        }
      }
      const payload = { date: dForm.date, item_type: dForm.item_type, quantity: qty, customer_name: dForm.customer_name.trim(), account_number: dForm.account_number.trim(), note: dForm.note.trim() || null };
      if (dForm.id) {
        const { error } = await supabase.from("inventory_distributions").update(payload).eq("id", dForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_distributions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_distributions"] });
      toast.success(t("save") + " ✓");
      setDForm({ id: null, date: todayStr(), item_type: dForm.item_type, quantity: "", customer_name: "", account_number: "", note: "" });
    },
    onError: (e: any) => { if (e.message !== "Cancelled") toast.error(e.message || "Error"); },
  });

  const delReceipt = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("inventory_receipts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_receipts"] }); toast.success(t("deleted")); },
  });
  const delDist = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("inventory_distributions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_distributions"] }); toast.success(t("deleted")); },
  });

  const savePending = useMutation({
    mutationFn: async () => {
      const qty = Number(pForm.quantity || 0);
      if (!pForm.customer_name.trim() || !pForm.account_number.trim()) throw new Error(lang === "bn" ? "নাম ও অ্যাকাউন্ট নং দিন" : "Name & account required");
      if (qty <= 0) throw new Error(lang === "bn" ? "পরিমাণ দিন" : "Quantity required");
      const payload = {
        item_type: pForm.item_type,
        customer_name: pForm.customer_name.trim(),
        mobile: pForm.mobile.trim() || null,
        account_number: pForm.account_number.trim(),
        quantity: qty,
        note: pForm.note.trim() || null,
      };
      if (pForm.id) {
        const { error } = await supabase.from("inventory_pending_requests").update(payload).eq("id", pForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_pending_requests").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory_pending"] });
      toast.success(t("save") + " ✓");
      setPForm({ id: null, item_type: pForm.item_type, customer_name: "", mobile: "", account_number: "", quantity: "1", note: "" });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const markDelivered = useMutation({
    mutationFn: async (p: Pending) => {
      const { error } = await supabase.from("inventory_pending_requests").update({ status: "delivered", delivered_date: todayStr() }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_pending"] }); toast.success(lang === "bn" ? "বিতরণ সম্পন্ন" : "Marked delivered"); },
  });

  const markPending = useMutation({
    mutationFn: async (p: Pending) => {
      const { error } = await supabase.from("inventory_pending_requests").update({ status: "pending", delivered_date: null }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_pending"] }); },
  });

  const delPending = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("inventory_pending_requests").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory_pending"] }); toast.success(t("deleted")); },
  });

  const filteredPendings = pendings.filter((p) => (fType === "all" || p.item_type === fType) && (pStatusFilter === "all" || p.status === pStatusFilter));

  const inDateRange = (d: string) => {
    if (fFrom && d < fFrom) return false;
    if (fTo && d > fTo) return false;
    return true;
  };
  const filteredReceipts = receipts.filter((r) => (fType === "all" || r.item_type === fType) && inDateRange(r.date));
  const filteredDist = distributions.filter((r) => (fType === "all" || r.item_type === fType) && inDateRange(r.date));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="w-6 h-6 text-primary" /> {lang === "bn" ? "ফর্ম ও চেক বই ইনভেন্টরি" : "Form & Cheque Book Inventory"}</h1>
          <p className="text-muted-foreground text-sm">{lang === "bn" ? "MTDR, MMPDSA, চেক বই স্টক ম্যানেজমেন্ট" : "MTDR, MMPDSA, Cheque Book stock management"}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("print")}</Button>
      </div>

      {/* Stock cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => {
          const s = stock(it);
          const low = s <= LOW_STOCK;
          return (
            <Card key={it} className={`p-4 ${low ? "border-red-400 bg-red-50/40" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold flex items-center gap-1.5"><Package className="w-4 h-4 text-primary" /> {itemLabel(it)}</div>
                {low && <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium"><AlertTriangle className="w-3 h-3" /> {lang === "bn" ? "স্টক কম" : "Low Stock"}</span>}
              </div>
              <div className={`text-3xl font-bold mt-2 ${low ? "text-red-600" : "text-primary"}`}>{fmt.num(s)}</div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="text-emerald-700"><PackageCheck className="w-3 h-3 inline" /> {lang === "bn" ? "প্রাপ্ত" : "Recv"}: <b>{fmt.num(sumBy(receipts, it))}</b></div>
                <div className="text-red-700"><PackageMinus className="w-3 h-3 inline" /> {lang === "bn" ? "বিতরণ" : "Dist"}: <b>{fmt.num(sumBy(distributions, it))}</b></div>
                <div className="text-amber-700"><ClipboardList className="w-3 h-3 inline" /> {lang === "bn" ? "পেন্ডিং" : "Pend"}: <b>{fmt.num(pendingCount(it))}</b></div>
              </div>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="no-print">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard">{lang === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}</TabsTrigger>
          <TabsTrigger value="receive">{lang === "bn" ? "প্রাপ্ত যোগ" : "Add Received"}</TabsTrigger>
          <TabsTrigger value="distribute">{lang === "bn" ? "বিতরণ" : "Distribute"}</TabsTrigger>
          <TabsTrigger value="receipts">{lang === "bn" ? "প্রাপ্ত তালিকা" : "Receipts"}</TabsTrigger>
          <TabsTrigger value="distributions">{lang === "bn" ? "বিতরণ তালিকা" : "Distributions"}</TabsTrigger>
          <TabsTrigger value="pending">
            <ClipboardList className="w-3.5 h-3.5 mr-1" /> {lang === "bn" ? "পেন্ডিং কাস্টমার" : "Pending Customers"}
            {pendings.filter((p) => p.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-[10px]">{fmt.num(pendings.filter((p) => p.status === "pending").length)}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assets"><Package className="w-3.5 h-3.5 mr-1" /> {lang === "bn" ? "এজেন্ট ব্যাংক সম্পদ" : "Agent Bank Assets"}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">{lang === "bn" ? "সর্বশেষ ১০টি লেনদেন" : "Last 10 Transactions"}</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{lang === "bn" ? "ধরন" : "Type"}</TableHead>
                    <TableHead>{lang === "bn" ? "আইটেম" : "Item"}</TableHead>
                    <TableHead className="text-right">{lang === "bn" ? "পরিমাণ" : "Qty"}</TableHead>
                    <TableHead>{lang === "bn" ? "বিবরণ" : "Details"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...receipts.slice(0, 10).map((r) => ({ ...r, kind: "received" as const, details: r.source ?? "—" })),
                    ...distributions.slice(0, 10).map((d) => ({ ...d, kind: "distributed" as const, details: `${d.customer_name} (${d.account_number})` }))]
                    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{fmt.date(row.date)}</TableCell>
                        <TableCell>{row.kind === "received" ? <span className="text-emerald-700">{lang === "bn" ? "প্রাপ্ত" : "Received"}</span> : <span className="text-red-700">{lang === "bn" ? "বিতরণ" : "Distributed"}</span>}</TableCell>
                        <TableCell>{itemLabel(row.item_type as ItemType)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt.num(row.quantity)}</TableCell>
                        <TableCell className="text-xs">{row.details}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receive" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> {rForm.id ? t("edit") : (lang === "bn" ? "শাখা থেকে প্রাপ্ত যোগ করুন" : "Add Received from Branch")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>{t("date")}</Label>
                <Input type="date" value={rForm.date} onChange={(e) => setRForm({ ...rForm, date: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "আইটেম" : "Item"}</Label>
                <Select value={rForm.item_type} onValueChange={(v: any) => setRForm({ ...rForm, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{items.map((it) => <SelectItem key={it} value={it}>{itemLabel(it)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{lang === "bn" ? "পরিমাণ" : "Quantity"}</Label>
                <Input type="number" value={rForm.quantity} onChange={(e) => setRForm({ ...rForm, quantity: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>{lang === "bn" ? "উৎস / শাখা" : "Source / Branch"}</Label>
                <Input value={rForm.source} onChange={(e) => setRForm({ ...rForm, source: e.target.value })} />
              </div>
              <div>
                <Label>{t("note")}</Label>
                <Input value={rForm.note} onChange={(e) => setRForm({ ...rForm, note: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              {rForm.id && <Button variant="outline" onClick={() => setRForm({ id: null, date: todayStr(), item_type: rForm.item_type, quantity: "", source: "", note: "" })}>{t("cancel_edit")}</Button>}
              <Button onClick={() => saveReceipt.mutate()} disabled={saveReceipt.isPending}><Save className="w-4 h-4" /> {rForm.id ? t("update") : t("save")}</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="distribute" className="mt-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> {dForm.id ? t("edit") : (lang === "bn" ? "কাস্টমারকে বিতরণ" : "Distribute to Customer")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>{t("date")}</Label>
                <Input type="date" value={dForm.date} onChange={(e) => setDForm({ ...dForm, date: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "আইটেম" : "Item"}</Label>
                <Select value={dForm.item_type} onValueChange={(v: any) => setDForm({ ...dForm, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{items.map((it) => <SelectItem key={it} value={it}>{itemLabel(it)} ({lang === "bn" ? "স্টক" : "Stock"}: {fmt.num(stock(it))})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{lang === "bn" ? "পরিমাণ" : "Quantity"}</Label>
                <Input type="number" value={dForm.quantity} onChange={(e) => setDForm({ ...dForm, quantity: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "কাস্টমার নাম" : "Customer Name"} *</Label>
                <Input value={dForm.customer_name} onChange={(e) => setDForm({ ...dForm, customer_name: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "অ্যাকাউন্ট নম্বর" : "Account Number"} *</Label>
                <Input value={dForm.account_number} onChange={(e) => setDForm({ ...dForm, account_number: e.target.value })} />
              </div>
              <div>
                <Label>{t("note")}</Label>
                <Input value={dForm.note} onChange={(e) => setDForm({ ...dForm, note: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              {dForm.id && <Button variant="outline" onClick={() => setDForm({ id: null, date: todayStr(), item_type: dForm.item_type, quantity: "", customer_name: "", account_number: "", note: "" })}>{t("cancel_edit")}</Button>}
              <Button onClick={() => saveDist.mutate()} disabled={saveDist.isPending}><Save className="w-4 h-4" /> {dForm.id ? t("update") : t("save")}</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4 space-y-3">
          <FilterBar fType={fType} setFType={setFType} fFrom={fFrom} setFFrom={setFFrom} fTo={fTo} setFTo={setFTo} lang={lang} items={items} itemLabel={itemLabel} />
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{lang === "bn" ? "আইটেম" : "Item"}</TableHead>
                    <TableHead className="text-right">{lang === "bn" ? "পরিমাণ" : "Qty"}</TableHead>
                    <TableHead>{lang === "bn" ? "উৎস" : "Source"}</TableHead>
                    <TableHead>{t("note")}</TableHead>
                    <TableHead className="text-right no-print">{t("edit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noEntries")}</TableCell></TableRow>}
                  {filteredReceipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{fmt.date(r.date)}</TableCell>
                      <TableCell>{itemLabel(r.item_type)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">+{fmt.num(r.quantity)}</TableCell>
                      <TableCell>{r.source || "—"}</TableCell>
                      <TableCell className="text-xs">{r.note || "—"}</TableCell>
                      <TableCell className="text-right no-print">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setRForm({ id: r.id, date: r.date, item_type: r.item_type, quantity: String(r.quantity), source: r.source ?? "", note: r.note ?? "" }); setTab("receive"); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) delReceipt.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="distributions" className="mt-4 space-y-3">
          <FilterBar fType={fType} setFType={setFType} fFrom={fFrom} setFFrom={setFFrom} fTo={fTo} setFTo={setFTo} lang={lang} items={items} itemLabel={itemLabel} />
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{lang === "bn" ? "আইটেম" : "Item"}</TableHead>
                    <TableHead className="text-right">{lang === "bn" ? "পরিমাণ" : "Qty"}</TableHead>
                    <TableHead>{lang === "bn" ? "কাস্টমার" : "Customer"}</TableHead>
                    <TableHead>A/C</TableHead>
                    <TableHead className="text-right no-print">{t("edit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDist.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noEntries")}</TableCell></TableRow>}
                  {filteredDist.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmt.date(d.date)}</TableCell>
                      <TableCell>{itemLabel(d.item_type)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-700">−{fmt.num(d.quantity)}</TableCell>
                      <TableCell>{d.customer_name}</TableCell>
                      <TableCell className="font-mono text-xs">{d.account_number}</TableCell>
                      <TableCell className="text-right no-print">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setDForm({ id: d.id, date: d.date, item_type: d.item_type, quantity: String(d.quantity), customer_name: d.customer_name, account_number: d.account_number, note: d.note ?? "" }); setTab("distribute"); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) delDist.mutate(d.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {/* Entry form */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              {pForm.id ? t("edit") : (lang === "bn" ? "পেন্ডিং কাস্টমার এন্ট্রি (যাদের দেওয়ার বাকি)" : "Add Pending Customer (yet to deliver)")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>{lang === "bn" ? "আইটেম" : "Item"}</Label>
                <Select value={pForm.item_type} onValueChange={(v: any) => setPForm({ ...pForm, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{items.map((it) => <SelectItem key={it} value={it}>{itemLabel(it)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{lang === "bn" ? "কাস্টমার নাম" : "Customer Name"} *</Label>
                <Input value={pForm.customer_name} onChange={(e) => setPForm({ ...pForm, customer_name: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "মোবাইল নম্বর" : "Mobile Number"}</Label>
                <Input value={pForm.mobile} onChange={(e) => setPForm({ ...pForm, mobile: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "অ্যাকাউন্ট নম্বর" : "Account Number"} *</Label>
                <Input value={pForm.account_number} onChange={(e) => setPForm({ ...pForm, account_number: e.target.value })} />
              </div>
              <div>
                <Label>{lang === "bn" ? "পরিমাণ" : "Quantity"}</Label>
                <Input type="number" value={pForm.quantity} onChange={(e) => setPForm({ ...pForm, quantity: e.target.value })} />
              </div>
              <div>
                <Label>{t("note")}</Label>
                <Input value={pForm.note} onChange={(e) => setPForm({ ...pForm, note: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              {pForm.id && <Button variant="outline" onClick={() => setPForm({ id: null, item_type: pForm.item_type, customer_name: "", mobile: "", account_number: "", quantity: "1", note: "" })}>{t("cancel_edit")}</Button>}
              <Button onClick={() => savePending.mutate()} disabled={savePending.isPending}><Save className="w-4 h-4" /> {pForm.id ? t("update") : t("save")}</Button>
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{lang === "bn" ? "আইটেম" : "Item"}</Label>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === "bn" ? "সব" : "All"}</SelectItem>
                    {items.map((it) => <SelectItem key={it} value={it}>{itemLabel(it)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</Label>
                <Select value={pStatusFilter} onValueChange={(v: any) => setPStatusFilter(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{lang === "bn" ? "পেন্ডিং" : "Pending"}</SelectItem>
                    <SelectItem value="delivered">{lang === "bn" ? "বিতরণ সম্পন্ন" : "Delivered"}</SelectItem>
                    <SelectItem value="all">{lang === "bn" ? "সব" : "All"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full" onClick={() => { setFType("all"); setPStatusFilter("pending"); }}>{lang === "bn" ? "ক্লিয়ার" : "Clear"}</Button>
              </div>
            </div>
          </Card>

          {/* List */}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "bn" ? "তারিখ" : "Date"}</TableHead>
                    <TableHead>{lang === "bn" ? "আইটেম" : "Item"}</TableHead>
                    <TableHead>{lang === "bn" ? "কাস্টমার" : "Customer"}</TableHead>
                    <TableHead>{lang === "bn" ? "মোবাইল" : "Mobile"}</TableHead>
                    <TableHead>A/C</TableHead>
                    <TableHead className="text-right">{lang === "bn" ? "পরিমাণ" : "Qty"}</TableHead>
                    <TableHead>{lang === "bn" ? "স্ট্যাটাস" : "Status"}</TableHead>
                    <TableHead className="text-right no-print">{lang === "bn" ? "অ্যাকশন" : "Action"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPendings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noEntries")}</TableCell></TableRow>}
                  {filteredPendings.map((p) => (
                    <TableRow key={p.id} className={p.status === "pending" ? "" : "opacity-60"}>
                      <TableCell className="text-xs">{fmt.date(p.requested_date)}</TableCell>
                      <TableCell>{itemLabel(p.item_type)}</TableCell>
                      <TableCell className="font-medium">{p.customer_name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.mobile || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{p.account_number}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt.num(p.quantity)}</TableCell>
                      <TableCell>
                        {p.status === "pending" ? (
                          <Badge variant="destructive" className="text-[10px]">{lang === "bn" ? "পেন্ডিং" : "Pending"}</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">{lang === "bn" ? "সম্পন্ন" : "Delivered"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right no-print">
                        <div className="inline-flex gap-1">
                          {p.status === "pending" ? (
                            <Button size="sm" variant="ghost" title={lang === "bn" ? "বিতরণ সম্পন্ন" : "Mark delivered"} onClick={() => markDelivered.mutate(p)}><Check className="w-3.5 h-3.5 text-emerald-600" /></Button>
                          ) : (
                            <Button size="sm" variant="ghost" title={lang === "bn" ? "পেন্ডিংয়ে ফিরিয়ে নিন" : "Mark pending"} onClick={() => markPending.mutate(p)}><X className="w-3.5 h-3.5 text-amber-600" /></Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setPForm({ id: p.id, item_type: p.item_type, customer_name: p.customer_name, mobile: p.mobile ?? "", account_number: p.account_number, quantity: String(p.quantity), note: p.note ?? "" })}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) delPending.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <AssetsPanel lang={lang} t={t} fmt={fmt} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Asset = { id: string; name: string; category: string | null; quantity: number; note: string | null };

function AssetsPanel({ lang, t, fmt }: { lang: string; t: (k: string) => string; fmt: { num: (n: number) => string } }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ id: null as string | null, name: "", category: "", quantity: "1", note: "" });
  const [search, setSearch] = useState("");

  const { data: assets = [] } = useQuery({
    queryKey: ["agent_bank_assets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("agent_bank_assets").select("*").order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Asset[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const qty = Number(form.quantity || 0);
      if (!form.name.trim()) throw new Error(lang === "bn" ? "নাম দিন" : "Name required");
      const payload = { name: form.name.trim(), category: form.category.trim() || null, quantity: qty, note: form.note.trim() || null };
      if (form.id) {
        const { error } = await (supabase as any).from("agent_bank_assets").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("agent_bank_assets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent_bank_assets"] });
      toast.success(t("save") + " ✓");
      setForm({ id: null, name: "", category: "", quantity: "1", note: "" });
    },
    onError: (e: any) => toast.error(e.message || "Error"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("agent_bank_assets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent_bank_assets"] }); toast.success(t("deleted")); },
  });

  const filtered = assets.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || (a.category ?? "").toLowerCase().includes(q);
  });

  const totalQty = assets.reduce((s, a) => s + Number(a.quantity || 0), 0);
  const totalItems = assets.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট আইটেম" : "Total Items"}</div>
          <div className="text-2xl font-bold text-primary">{fmt.num(totalItems)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{lang === "bn" ? "মোট পরিমাণ" : "Total Quantity"}</div>
          <div className="text-2xl font-bold text-primary">{fmt.num(totalQty)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> {form.id ? t("edit") : (lang === "bn" ? "নতুন সম্পদ যোগ করুন" : "Add New Asset")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Label>{lang === "bn" ? "নাম" : "Name"} *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={lang === "bn" ? "যেমন: কম্পিউটার, প্রিন্টার" : "e.g. Computer, Printer"} />
          </div>
          <div>
            <Label>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={lang === "bn" ? "ইলেকট্রনিকস" : "Electronics"} />
          </div>
          <div>
            <Label>{lang === "bn" ? "পরিমাণ (পিস)" : "Quantity (pcs)"}</Label>
            <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <Label>{t("note")}</Label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {form.id && <Button variant="outline" onClick={() => setForm({ id: null, name: "", category: "", quantity: "1", note: "" })}>{t("cancel_edit")}</Button>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="w-4 h-4" /> {t("save")}</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold">{lang === "bn" ? "সম্পদ তালিকা" : "Assets List"}</h3>
          <Input className="w-full md:w-64" placeholder={lang === "bn" ? "সার্চ..." : "Search..."} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "bn" ? "নাম" : "Name"}</TableHead>
                <TableHead>{lang === "bn" ? "ক্যাটাগরি" : "Category"}</TableHead>
                <TableHead className="text-right">{lang === "bn" ? "পরিমাণ" : "Qty"}</TableHead>
                <TableHead>{t("note")}</TableHead>
                <TableHead className="text-right no-print">{t("actions" as any) || ""}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">{lang === "bn" ? "কোনো সম্পদ নেই" : "No assets"}</TableCell></TableRow>
              ) : filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.category ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt.num(a.quantity)}</TableCell>
                  <TableCell className="text-xs">{a.note ?? "—"}</TableCell>
                  <TableCell className="text-right no-print">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setForm({ id: a.id, name: a.name, category: a.category ?? "", quantity: String(a.quantity), note: a.note ?? "" })}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("confirm_delete"))) del.mutate(a.id); }}><Trash2 className="w-3.5 h-3.5 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}


function FilterBar({ fType, setFType, fFrom, setFFrom, fTo, setFTo, lang, items, itemLabel }: any) {
  return (
    <Card className="p-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">{lang === "bn" ? "আইটেম" : "Item"}</Label>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === "bn" ? "সব" : "All"}</SelectItem>
              {items.map((it: ItemType) => <SelectItem key={it} value={it}>{itemLabel(it)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{lang === "bn" ? "শুরু" : "From"}</Label>
          <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{lang === "bn" ? "শেষ" : "To"}</Label>
          <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => { setFType("all"); setFFrom(""); setFTo(""); }}>{lang === "bn" ? "ক্লিয়ার" : "Clear"}</Button>
        </div>
      </div>
    </Card>
  );
}
