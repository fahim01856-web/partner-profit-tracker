import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSignedPhoto(pathOrUrl: string | null | undefined) {
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

export function StaffPhoto({
  path,
  name,
  className = "w-9 h-9 rounded-full object-cover border bg-muted",
}: {
  path: string | null | undefined;
  name: string;
  className?: string;
}) {
  const { data: url } = useSignedPhoto(path);
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  if (url) return <img src={url} alt={name} className={className} />;
  return (
    <div className={`${className} grid place-items-center text-xs font-semibold text-muted-foreground`}>
      {initials || "?"}
    </div>
  );
}
