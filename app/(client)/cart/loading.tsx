export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl animate-pulse bg-shop_light_bg px-4 py-10 md:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-3xl bg-slate-100" />
          ))}
        </div>
        <div className="h-64 rounded-3xl bg-slate-100" />
      </div>
    </div>
  );
}
