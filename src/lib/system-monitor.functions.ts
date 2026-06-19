import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FileItem = {
  bucket: string;
  name: string;
  path: string;
  size: number;
  mime: string | null;
  updated_at: string | null;
};

export type SystemStats = {
  db: {
    sizeBytes: number;
    totalRows: number;
    tables: { name: string; rows: number; size_bytes: number }[];
  };
  storage: {
    totalBytes: number;
    buckets: { name: string; files: number; bytes: number }[];
    files: FileItem[];
    byType: { type: string; count: number; bytes: number }[];
  };
};

const BUCKETS = ["documents", "signature-cards", "loan-ledger"];

function classify(mime: string | null, name: string): string {
  const m = (mime || "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (m.startsWith("image/") || ["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext)) return "Image";
  if (m === "application/pdf" || ext === "pdf") return "PDF";
  if (["doc","docx","xls","xlsx","ppt","pptx","txt","csv"].includes(ext)) return "Document";
  if (m.startsWith("video/")) return "Video";
  if (m.startsWith("audio/")) return "Audio";
  return "Other";
}

async function listAll(admin: any, bucket: string, prefix = ""): Promise<FileItem[]> {
  const out: FileItem[] = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error || !data) return out;
  for (const item of data) {
    if (item.id === null || item.metadata == null) {
      // folder
      const sub = await listAll(admin, bucket, prefix ? `${prefix}/${item.name}` : item.name);
      out.push(...sub);
    } else {
      out.push({
        bucket,
        name: item.name,
        path: prefix ? `${prefix}/${item.name}` : item.name,
        size: Number(item.metadata?.size ?? 0),
        mime: (item.metadata?.mimetype as string) ?? null,
        updated_at: item.updated_at ?? null,
      });
    }
  }
  return out;
}

export const getSystemStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemStats> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: dbData, error: dbErr } = await supabaseAdmin.rpc("get_system_stats" as any);
    if (dbErr) throw dbErr;
    const db = dbData as any;

    const allFiles: FileItem[] = [];
    const buckets: { name: string; files: number; bytes: number }[] = [];
    for (const b of BUCKETS) {
      const files = await listAll(supabaseAdmin, b);
      allFiles.push(...files);
      buckets.push({ name: b, files: files.length, bytes: files.reduce((a, f) => a + f.size, 0) });
    }

    const byTypeMap = new Map<string, { count: number; bytes: number }>();
    for (const f of allFiles) {
      const t = classify(f.mime, f.name);
      const cur = byTypeMap.get(t) ?? { count: 0, bytes: 0 };
      cur.count++;
      cur.bytes += f.size;
      byTypeMap.set(t, cur);
    }
    const byType = Array.from(byTypeMap.entries()).map(([type, v]) => ({ type, ...v }));

    return {
      db: {
        sizeBytes: Number(db?.db_size_bytes ?? 0),
        totalRows: Number(db?.total_rows ?? 0),
        tables: (db?.tables ?? []).map((t: any) => ({
          name: t.name,
          rows: Number(t.rows ?? 0),
          size_bytes: Number(t.size_bytes ?? 0),
        })),
      },
      storage: {
        totalBytes: allFiles.reduce((a, f) => a + f.size, 0),
        buckets,
        files: allFiles,
        byType,
      },
    };
  });

export const deleteStorageFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: string; path: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(data.bucket).remove([data.path]);
    if (error) throw error;
    return { ok: true };
  });
