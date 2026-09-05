"use client";

import { useHydrated } from "@/hooks";
import { cn } from "@/lib/utils";
import SignInClient from "./SignInClient";

const SignIn = ({ className }: { className?: string }) => {
  const mounted = useHydrated();

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-sm font-semibold text-white/60 shadow-[0_10px_24px_-20px_rgba(20,142,207,0.9)]",
          className
        )}
      >
        Connexion
      </button>
    );
  }

  return <SignInClient className={className} />;
};

export default SignIn;
