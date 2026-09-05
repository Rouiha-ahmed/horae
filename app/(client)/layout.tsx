import type { Metadata } from "next";
import { Suspense } from "react";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartUserGuard from "@/components/CartUserGuard";
import RouteTransition from "@/components/layout/RouteTransition";

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    template: "%s — HORAE",
    default: "HORAE",
  },
  description: "HORAE — une selection experte de soins, beaute et bien-etre.",
};

/** Minimal static skeleton shown while Header data loads (rare — cache hit is instant) */
function HeaderFallback() {
  return (
    <div className="sticky top-0 z-50 bg-[#030a12] px-3 pt-3">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 md:px-8" />
    </div>
  );
}

function FooterFallback() {
  return <div className="h-24 border-t border-white/10 bg-[#02060b]" />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <CartUserGuard />
      <div className="flex min-h-screen flex-col bg-shop_light_bg">
        <Suspense fallback={<HeaderFallback />}>
          <Header />
        </Suspense>
        <main className="flex-1"><RouteTransition>{children}</RouteTransition></main>
        <Suspense fallback={<FooterFallback />}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
