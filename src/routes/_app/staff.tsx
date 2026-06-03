import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useFmt } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Upload, Phone, Mail, MapPin, Calendar, IdCard, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

function useSignedPhoto(pathOrUrl: string | null | undefined) {
  return useQuery({
    queryKey: ["staff-photo", pathOrUrl],
    queryFn: async () => {
      if (!pathOrUrl) return "";
      if (pathOrUrl.startsWith("http")) return pathOrUrl;
      const { data } = await supabase.storage.from("documents").createSignedUrl(pathOrUrl, 300);
      return data?.signedUrl ?? "";
    },
    enabled: !!pathOrUrl,
    staleTime: 4 * 60 * 1000,
  });
}

function StaffAvatar({ path, name, size }: { path: string | null | undefined; name: string; size: string }) {
  const { data: url } = useSignedPhoto(path);
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <Avatar className={`${size} ring-2 ring-border`}>
      <AvatarImage src={url || undefined} alt={name} />
      <AvatarFallback className="bg-muted">{initials || <UserIcon className="w-6 h-6 text-muted-foreground" />}</AvatarFallback>
    </Avatar>
  );
}



type StaffForm = {
  name: string; position: string; phone: string; email: string;
  monthly_salary: string; joining_date: string; date_of_birth: string;
  address: string; nid: string; emergency_contact: string; employee_code: string;
  active: boolean; sort_order: string; photo_url: string;
};

const emptyForm = (): StaffForm => ({
  name: "", position: "", phone: "", email: "",
  monthly_salary: "", joining_date: new Date().toISOString().slice(0, 10),
  date_of_birth: "", address: "", nid: "", emergency_contact: "",
  employee_code: "", active: true, sort_order: "", photo_url: "",
});

function StaffPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const qc = useQueryClient();
  const [form, setForm] = useState<StaffForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("sort_order").order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); };

  const onPhotoUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `staff/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      // Store only the object path; signed URLs are generated on demand (short-lived)
      setForm((f) => ({ ...f, photo_url: path }));
      toast.success("ছবি আপলোড হয়েছে");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };


  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, position: form.position, phone: form.phone, email: form.email || null,
        monthly_salary: Number(form.monthly_salary || 0),
        joining_date: form.joining_date || null,
        date_of_birth: form.date_of_birth || null,
        address: form.address || null, nid: form.nid || null,
        emergency_contact: form.emergency_contact || null,
        employee_code: form.employee_code || null,
        active: form.active, sort_order: Number(form.sort_order || 0),
        photo_url: form.photo_url || null,
      };
      if (editingId) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? t("updated") : t("staff_added"));
      resetForm();
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("deleted")); qc.invalidateQueries({ queryKey: ["staff"] }); },
  });

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      name: r.name ?? "", position: r.position ?? "", phone: r.phone ?? "", email: r.email ?? "",
      monthly_salary: String(r.monthly_salary ?? ""),
      joining_date: r.joining_date ?? new Date().toISOString().slice(0, 10),
      date_of_birth: r.date_of_birth ?? "",
      address: r.address ?? "", nid: r.nid ?? "", emergency_contact: r.emergency_contact ?? "",
      employee_code: r.employee_code ?? "",
      active: r.active ?? true, sort_order: String(r.sort_order ?? ""),
      photo_url: r.photo_url ?? "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = (id: string) => { if (window.confirm(t("confirm_delete"))) del.mutate(id); };

  const initials = (name: string) => name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("staff_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("staff_sub")}</p>
      </div>

      <Card className={`p-5 ${editingId ? "ring-2 ring-primary" : ""}`}>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          {editingId ? <><Pencil className="w-4 h-4" /> {t("edit")}</> : <><Plus className="w-4 h-4" /> {t("new_staff")}</>}
        </h2>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          {/* Photo + basic identity row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="w-24 h-24 ring-2 ring-border">
                <AvatarImage src={form.photo_url} alt={form.name} />
                <AvatarFallback className="text-xl bg-muted">{form.name ? initials(form.name) : <UserIcon className="w-8 h-8 text-muted-foreground" />}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhotoUpload(f); }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="w-3 h-3 mr-1" /> {uploading ? "..." : "ছবি"}
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 w-full">
              <div><Label>{t("name")} *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("position")}</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
              <div><Label>Employee Code</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
              <div><Label>Sort / Serial No</Label><Input type="number" placeholder="1, 2, 3..." value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
              <div><Label>{t("monthly_salary")}</Label><Input type="number" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Contact + dates */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Emergency Contact</Label><Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>NID No</Label><Input value={form.nid} onChange={(e) => setForm({ ...form, nid: e.target.value })} /></div>
            <div><Label>{t("joining_date")}</Label><Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Village, Post, Thana, District" />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>{editingId ? t("update") : t("add")}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" /> {t("cancel_edit")}</Button>}
          </div>
        </form>
      </Card>

      <div>
        <h2 className="font-semibold mb-3">{t("staff_list")}</h2>
        {rows.length === 0 && <Card className="p-6 text-center text-muted-foreground">{t("no_staff")}</Card>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r: any, idx: number) => (
            <Card key={r.id} className={`p-4 space-y-3 ${editingId === r.id ? "ring-2 ring-primary" : ""}`}>
              <div className="flex items-start gap-3">
                <Avatar className="w-16 h-16 shrink-0 ring-2 ring-border">
                  <AvatarImage src={r.photo_url ?? undefined} alt={r.name} />
                  <AvatarFallback className="bg-muted">{initials(r.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{fmt.num(idx + 1)}</span>
                    {!r.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <div className="font-bold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.position || "—"}{r.employee_code ? ` · ${r.employee_code}` : ""}</div>
                  <div className="text-sm font-semibold text-primary mt-1">{fmt.bdt(Number(r.monthly_salary))}</div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {r.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {r.phone}</div>}
                {r.emergency_contact && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-destructive" /> {r.emergency_contact} <span className="text-[10px]">(জরুরি)</span></div>}
                {r.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> <span className="truncate">{r.email}</span></div>}
                {r.nid && <div className="flex items-center gap-1.5"><IdCard className="w-3 h-3" /> {r.nid}</div>}
                {r.joining_date && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Joined: {fmt.date(r.joining_date)}</div>}
                {r.date_of_birth && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> DOB: {fmt.date(r.date_of_birth)}</div>}
                {r.address && <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 mt-0.5 shrink-0" /> <span className="break-words">{r.address}</span></div>}
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => startEdit(r)}><Pencil className="w-3 h-3 mr-1" /> {t("edit")}</Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
