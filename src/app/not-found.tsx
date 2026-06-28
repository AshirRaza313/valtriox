import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#10151E] px-4">
      <img src="/valtriox-logo.png" alt="Valtriox" className="h-9 w-auto object-contain mb-6" />
      <h1 className="text-6xl font-bold text-white">404</h1>
      <p className="mt-4 text-lg text-slate-400">Page not found</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-medium text-white hover:from-amber-600 hover:to-amber-700 transition-all shadow-[0_0_16px_rgba(211,166,56,0.25)]"
      >
        Go Home
      </Link>
    </div>
  );
}
