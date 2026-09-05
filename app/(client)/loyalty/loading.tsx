import Container from "@/components/Container";

export default function LoyaltyLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04101c] to-[#02060b] pb-20">
      <Container className="py-10">
        {/* page header skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-7 w-48 animate-pulse rounded-full bg-slate-200" />
          <div className="h-9 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-4 w-96 animate-pulse rounded-lg bg-slate-100" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px]">
          {/* left column */}
          <div className="space-y-6">
            {/* loyalty card skeleton */}
            <div className="h-72 animate-pulse rounded-[32px] bg-gradient-to-br from-slate-200 to-slate-300" />

            {/* progress skeleton */}
            <div className="h-40 animate-pulse rounded-[28px] bg-slate-100" />

            {/* benefits skeleton */}
            <div className="h-36 animate-pulse rounded-[28px] bg-slate-100" />
          </div>

          {/* right column */}
          <div className="space-y-5">
            <div className="h-64 animate-pulse rounded-[28px] bg-slate-100" />
            <div className="h-52 animate-pulse rounded-[28px] bg-slate-100" />
            <div className="h-16 animate-pulse rounded-[22px] bg-slate-100" />
          </div>
        </div>
      </Container>
    </div>
  );
}
