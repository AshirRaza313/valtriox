export default function Loading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#10151E]">
      <div className="flex flex-col items-center gap-6">
        {/* Logo placeholder */}
        <div className="h-9 w-32 rounded-lg bg-white/5 animate-pulse" />
        {/* Spinner */}
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-amber-500" />
        <p className="text-sm text-slate-500">Loading Valtriox…</p>
      </div>
    </div>
  );
}
