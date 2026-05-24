import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">{t("loading")}</div>;
  return <Navigate to={session ? "/dashboard" : "/login"} />;
}
