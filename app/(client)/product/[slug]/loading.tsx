export default function Loading() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl animate-pulse bg-shop_light_bg px-4 py-10 md:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-slate-100" />
        <div className="space-y-5">
          <div className="h-4 w-24 rounded-full bg-slate-100" />
          <div className="h-8 w-3/4 rounded-full bg-slate-200" />
          <div className="h-6 w-32 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-5/6 rounded-full bg-slate-100" />
            <div className="h-3 w-4/6 rounded-full bg-slate-100" />
          </div>
          <div className="h-12 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
