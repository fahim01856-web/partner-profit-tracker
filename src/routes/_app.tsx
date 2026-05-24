import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_app")({
  component: Guarded,
});

function Guarded() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("loading")}</div>;
  if (!session) return <Navigate to="/login" />;
  return <AppLayout />;
}
