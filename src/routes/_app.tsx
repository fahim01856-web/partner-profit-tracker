import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_app")({
  component: Guarded,
});

function Guarded() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">লোড হচ্ছে...</div>;
  if (!session) return <Navigate to="/login" />;
  return <AppLayout />;
}
