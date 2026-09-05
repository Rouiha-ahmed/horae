export default function ClientLoading() {
  return (
    <div className="min-h-screen bg-shop_light_bg px-4 py-8 md:px-6 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-56 rounded-full bg-slate-200" />
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-[#071522] p-5">
            <div className="h-5 w-36 rounded-full bg-slate-200" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#071522]"
                >
                  <div className="h-48 bg-slate-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-3 w-20 rounded-full bg-slate-100" />
                    <div className="h-4 w-full rounded-full bg-slate-200" />
                    <div className="h-4 w-24 rounded-full bg-slate-200" />
                    <div className="h-10 rounded-2xl bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
