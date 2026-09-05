export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl animate-pulse space-y-4 bg-shop_light_bg px-4 py-10 md:px-6">
      <div className="h-8 w-40 rounded-full bg-slate-200" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-3xl border border-white/10 bg-[#071522]" />
      ))}
    </div>
  );
}
