export default function LegalLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back button placeholder */}
        <div className="h-5 w-32 rounded bg-slate-200 animate-pulse mb-8" />
        {/* Title placeholder */}
        <div className="h-9 w-2/3 rounded bg-slate-200 animate-pulse mb-3" />
        <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse mb-4" />
        {/* Body content placeholders */}
        <div className="space-y-3 mt-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-1/4 rounded bg-slate-200 animate-pulse" />
              <div className="h-4 w-full rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
