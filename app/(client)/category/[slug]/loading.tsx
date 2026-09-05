export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse bg-shop_light_bg px-4 py-8 md:px-6 lg:px-8">
      <div className="mb-6 h-8 w-48 rounded-full bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-white/10 bg-[#071522]">
            <div className="h-48 bg-slate-100" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-16 rounded-full bg-slate-100" />
              <div className="h-4 w-full rounded-full bg-slate-200" />
              <div className="h-8 rounded-2xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
