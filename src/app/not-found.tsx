import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-white dark:bg-gray-950 px-4">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Page not found</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
