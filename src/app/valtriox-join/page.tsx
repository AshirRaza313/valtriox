"use client";

import { Suspense } from "react";
import ValtrioxJoinContent from "./ValtrioxJoinContent";

function ValtrioxJoinFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/20 flex items-center justify-center animate-pulse">
        <svg className="h-8 w-8 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
      </div>
    </div>
  );
}

export default function ValtrioxJoinPage() {
  return (
    <Suspense fallback={<ValtrioxJoinFallback />}>
      <ValtrioxJoinContent />
    </Suspense>
  );
}
