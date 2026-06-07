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
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="text-emerald-700"><PackageCheck className="w-3 h-3 inline" /> {lang === "bn" ? "প্রাপ্ত" : "Received"}: <b>{fmt.num(sumBy(receipts, it))}</b></div>
                <div className="text-red-700"><PackageMinus className="w-3 h-3 inline" /> {lang === "bn" ? "বিতরণ" : "Distributed"}: <b>{fmt.num(sumBy(distributions, it))}</b></div>
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
      </Tabs>
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
