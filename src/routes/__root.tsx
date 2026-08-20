import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "@/lib/store";
import { Navbar } from "@/components/Navbar";
import { CartDrawer } from "@/components/CartDrawer";
import { Footer } from "@/components/Footer";
import { SplashScreen } from "@/components/SplashScreen";
import { PageTransition } from "@/components/PageTransition";
import { TopProgressBar } from "@/components/TopProgressBar";
import { ShoppingListsProvider } from "@/lib/shopping-lists";
import { CompareBar } from "@/components/CompareBar";
import { Toaster } from "@/components/ui/sonner";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sakura-gradient px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-gradient-rose">404</h1>
        <h2 className="mt-4 font-serif text-xl">This petal drifted away</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for isn't in bloom.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft"
        >
          Return home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-xl">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-input px-5 py-2.5 text-sm font-medium">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Zari Boutique — Elegance Blooms Here" },
      {
        name: "description",
        content:
          "Zari Boutique — Timeless clothing and accessories curated for the modern romantic. Discover our Sakura collection.",
      },
      { property: "og:title", content: "Zari Boutique — Elegance Blooms Here" },
      {
        property: "og:description",
        content: "Timeless clothing and accessories curated for the modern romantic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&family=Great+Vibes&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Zari Boutique",
          url: "https://zaris-elegance.lovable.app",
          description:
            "Boutique selling elegant clothing and accessories curated for the modern romantic.",
          email: "hello@zariboutique.com",
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              telephone: "+91 99720 25151",
              contactOption: "TollFree",
              availableLanguage: ["en", "hi"],
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Zari Boutique",
          url: "https://zaris-elegance.lovable.app",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://zaris-elegance.lovable.app/shop?category={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [entryPhase, setEntryPhase] = useState<"idle" | "dimmed" | "revealed">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem("zari_splash_seen")) {
      setEntryPhase("dimmed");
    }
    // Runtime verification: log which Supabase project/key the deployed bundle uses.
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    const mask = (v?: string) =>
      !v ? "(missing)" : v.length <= 12 ? "***" : `${v.slice(0, 8)}…${v.slice(-4)} (len ${v.length})`;
    // eslint-disable-next-line no-console
    console.log("[Supabase env]", { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: mask(key) });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <ShoppingListsProvider>
          <TopProgressBar />
          <SplashScreen onFading={() => setEntryPhase("revealed")} />
          <motion.div
            animate={{
              opacity: entryPhase === "revealed" ? 1 : entryPhase === "dimmed" ? 0.75 : 1,
              scale: entryPhase === "revealed" ? 1 : entryPhase === "dimmed" ? 0.98 : 1,
            }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="origin-center"
          >
            <Navbar />
            <main className="pt-20 min-h-screen">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </main>
            <Footer />
          </motion.div>
          <CartDrawer />
          <CompareBar />
          <Toaster />
        </ShoppingListsProvider>
      </StoreProvider>

    </QueryClientProvider>
  );
}
