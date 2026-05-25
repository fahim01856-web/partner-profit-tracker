import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">৪০৪</h1>
        <h2 className="mt-4 text-xl font-semibold">পেজটি পাওয়া যায়নি</h2>
        <p className="mt-2 text-sm text-muted-foreground">আপনি যে পেজটি খুঁজছেন সেটি নেই বা সরানো হয়েছে।</p>
        <Link to="/" className="inline-flex mt-6 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          হোমে ফিরে যান
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">একটি সমস্যা হয়েছে</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "এজেন্ট ব্যাংক হিসাব — ইসলামী ব্যাংক ১২১/১১ ফকির বাজার" },
      { name: "description", content: "ইসলামী ব্যাংক এজেন্ট আউটলেট ১২১/১১, ফকির বাজার, বুড়িচং — আয়, ব্যয়, ভাউচার, হাজিরা ও পার্টনার শেয়ার ব্যবস্থাপনা।" },
      { property: "og:title", content: "এজেন্ট ব্যাংক হিসাব — ইসলামী ব্যাংক ১২১/১১ ফকির বাজার" },
      { name: "twitter:title", content: "এজেন্ট ব্যাংক হিসাব — ইসলামী ব্যাংক ১২১/১১ ফকির বাজার" },
      { property: "og:description", content: "ইসলামী ব্যাংক এজেন্ট আউটলেট ১২১/১১, ফকির বাজার, বুড়িচং — আয়, ব্যয়, ভাউচার, হাজিরা ও পার্টনার শেয়ার ব্যবস্থাপনা।" },
      { name: "twitter:description", content: "ইসলামী ব্যাংক এজেন্ট আউটলেট ১২১/১১, ফকির বাজার, বুড়িচং — আয়, ব্যয়, ভাউচার, হাজিরা ও পার্টনার শেয়ার ব্যবস্থাপনা।" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/PssIM9K9rVMUhMNflFkT5pjNSoH3/social-images/social-1779712434987-142461.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/PssIM9K9rVMUhMNflFkT5pjNSoH3/social-images/social-1779712434987-142461.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
