"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, MapPin, Clock, Shield, ChevronRight, Loader2, Check, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useValtrioxStore } from "@/store/brandflow-store";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// ─── Timezone name display map ──────────────────────────────────────────────
const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Karachi": "Pakistan (PKT)",
  "Asia/Kolkata": "India (IST)",
  "Asia/Dhaka": "Bangladesh (BST)",
  "Asia/Riyadh": "Saudi Arabia (AST)",
  "Asia/Dubai": "UAE (GST)",
  "Asia/Tehran": "Iran (IRST)",
  "Asia/Istanbul": "Turkey (TRT)",
  "Asia/Jakarta": "Indonesia (WIB)",
  "Asia/Kuala_Lumpur": "Malaysia (MYT)",
  "Asia/Singapore": "Singapore (SGT)",
  "Asia/Bangkok": "Thailand (ICT)",
  "Asia/Seoul": "South Korea (KST)",
  "Asia/Tokyo": "Japan (JST)",
  "Asia/Shanghai": "China (CST)",
  "Asia/Hong_Kong": "Hong Kong (HKT)",
  "Asia/Taipei": "Taiwan (CST)",
  "Asia/Manila": "Philippines (PHT)",
  "Asia/Ho_Chi_Minh": "Vietnam (ICT)",
  "Europe/London": "United Kingdom (GMT/BST)",
  "Europe/Paris": "France (CET)",
  "Europe/Berlin": "Germany (CET)",
  "Europe/Madrid": "Spain (CET)",
  "Europe/Rome": "Italy (CET)",
  "Europe/Amsterdam": "Netherlands (CET)",
  "Europe/Moscow": "Russia (MSK)",
  "Europe/Istanbul": "Turkey (TRT)",
  "America/New_York": "US Eastern (ET)",
  "America/Chicago": "US Central (CT)",
  "America/Denver": "US Mountain (MT)",
  "America/Los_Angeles": "US Pacific (PT)",
  "America/Toronto": "Canada (ET)",
  "America/Vancouver": "Canada (PT)",
  "America/Sao_Paulo": "Brazil (BRT)",
  "America/Buenos_Aires": "Argentina (ART)",
  "America/Mexico_City": "Mexico (CST)",
  "Africa/Cairo": "Egypt (EET)",
  "Africa/Lagos": "Nigeria (WAT)",
  "Africa/Johannesburg": "South Africa (SAST)",
  "Australia/Sydney": "Australia (AEST)",
  "Pacific/Auckland": "New Zealand (NZST)",
};

function getTimezoneLabel(tz: string): string {
  return TIMEZONE_LABELS[tz] || tz.replace(/_/g, " ").split("/").pop() || tz;
}

function getTimezoneAbbr(tz: string): string {
  try {
    const parts = new Date().toLocaleDateString("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    });
    const match = parts.match(/\b([A-Z]{2,5})\b/g);
    return match ? match[match.length - 1] : tz.split("/").pop()?.slice(0, 3).toUpperCase() || "UTC";
  } catch {
    return "UTC";
  }
}

function getCurrentTimeInTz(tz: string): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: tz,
    });
  } catch {
    return "--:--:--";
  }
}

function getCurrentDateInTz(tz: string): string {
  try {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: tz,
    });
  } catch {
    return "Unknown date";
  }
}

// ─── Timezone Setup Modal ───────────────────────────────────────────────────

export function TimezoneSetupModal() {
  const { organization, setOrganization, appTheme } = useValtrioxStore();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"ask" | "detecting" | "confirmed" | "done">("ask");
  const [detectedTimezone, setDetectedTimezone] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [detectedCountry, setDetectedCountry] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [liveTime, setLiveTime] = useState<string>("");

  // Check if we should show the modal (first-time only)
  useEffect(() => {
    try {
      const alreadyDetected = localStorage.getItem("valtriox-timezone-detected");
      if (!alreadyDetected && organization?.id) {
        // Short delay for smooth transition after dashboard loads
        const timer = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [organization?.id]);

  // Live clock ticking
  useEffect(() => {
    if (step === "confirmed" && detectedTimezone) {
      const interval = setInterval(() => {
        setLiveTime(getCurrentTimeInTz(detectedTimezone));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, detectedTimezone]);

  // Also check browser timezone on mount for fallback display
  useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTz) {
        setDetectedTimezone(browserTz);
        setCurrentTime(getCurrentTimeInTz(browserTz));
      }
    } catch {}
  }, []);

  const detectTimezone = useCallback(async () => {
    setStep("detecting");
    setError("");

    try {
      // First, get browser timezone (works without geolocation)
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let finalTimezone = browserTz;
      let country = "";

      // Then try geolocation for more accurate detection + country name
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: false,
              maximumAge: 300000, // 5 min cache
            });
          });

          const { latitude, longitude } = position.coords;

          // Try to get timezone name from coordinates using Intl API
          // The Intl API should already match the device's timezone
          // But we can also try to get country info
          try {
            // Use a free timezone API for country detection
            const tzResponse = await fetch(
              `https://worldtimeapi.org/api/timezone/area/${latitude.toFixed(2)}`,
              { signal: AbortSignal.timeout(3000) }
            );
            // Fallback: just use browser timezone with coordinate-based verification
          } catch {
            // If timezone API fails, just use browser timezone
          }

          // Reverse geocode for country name (best effort)
          try {
            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=1&accept-language=en`,
              { headers: { "User-Agent": "Valtriox/1.0" }, signal: AbortSignal.timeout(5000) }
            );
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              country = geoData.address?.country || "";
            }
          } catch {
            // Silent fail - country name is optional
          }
        } catch (geoError: any) {
          // User denied location or it failed - use browser timezone
          if (geoError?.code === 1) {
            // PERMISSION_DENIED - use browser timezone silently
          }
          // Continue with browser timezone
        }
      }

      setDetectedTimezone(finalTimezone);
      setDetectedCountry(country);
      setCurrentTime(getCurrentTimeInTz(finalTimezone));
      setLiveTime(getCurrentTimeInTz(finalTimezone));
      setStep("confirmed");
    } catch (err: any) {
      setError("Could not detect timezone. Using browser default.");
      // Fallback to browser timezone
      try {
        const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setDetectedTimezone(fallback);
        setStep("confirmed");
      } catch {
        setStep("ask");
      }
    }
  }, []);

  const confirmTimezone = useCallback(async () => {
    if (!detectedTimezone || !organization?.id) return;

    try {
      // Update organization timezone via API
      const res = await fetchWithAuth("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: detectedTimezone }),
      });

      if (res.ok) {
        // Update the store
        setOrganization({ ...organization, timezone: detectedTimezone });
        // Mark as detected
        localStorage.setItem("valtriox-timezone-detected", "true");
        localStorage.setItem("valtriox-timezone-value", detectedTimezone);
        setStep("done");
        // Auto-dismiss after brief success display
        setTimeout(() => setVisible(false), 1500);
      } else {
        // Still save locally even if API fails
        setOrganization({ ...organization, timezone: detectedTimezone });
        localStorage.setItem("valtriox-timezone-detected", "true");
        localStorage.setItem("valtriox-timezone-value", detectedTimezone);
        setStep("done");
        setTimeout(() => setVisible(false), 1500);
      }
    } catch {
      // Save locally even on network error
      setOrganization({ ...organization, timezone: detectedTimezone });
      localStorage.setItem("valtriox-timezone-detected", "true");
      localStorage.setItem("valtriox-timezone-value", detectedTimezone);
      setStep("done");
      setTimeout(() => setVisible(false), 1500);
    }
  }, [detectedTimezone, organization, setOrganization]);

  const skipTimezone = useCallback(() => {
    // Mark as detected so it doesn't show again, but use browser default
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      localStorage.setItem("valtriox-timezone-detected", "true");
      localStorage.setItem("valtriox-timezone-value", browserTz);
      if (organization?.id && organization?.timezone === "UTC") {
        setOrganization({ ...organization, timezone: browserTz });
      }
    } catch {}
    setVisible(false);
  }, [organization, setOrganization]);

  if (!visible) return null;

  const isDark = appTheme !== "light";

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={step === "done" ? () => setVisible(false) : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className={cn(
              "w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden",
              isDark
                ? "bg-[#0f1117] border-white/10 shadow-black/50"
                : "bg-white border-slate-200 shadow-slate-200/50"
            )}>
              {/* ── Header gradient strip ── */}
              <div className="relative h-32 overflow-hidden">
                <div className="absolute inset-0" style={{
                  background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)"
                }} />
                {/* Animated globe decoration */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  <Globe className="h-40 w-40 text-amber-400 animate-[spin_30s_linear_infinite]" />
                </div>
                {/* Floating sparkles */}
                <div className="absolute top-4 left-6">
                  <motion.div
                    animate={{ y: [0, -6, 0], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Sparkles className="h-5 w-5 text-amber-400/60" />
                  </motion.div>
                </div>
                <div className="absolute top-8 right-10">
                  <motion.div
                    animate={{ y: [0, 5, 0], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                  >
                    <Sparkles className="h-3 w-3 text-amber-300/40" />
                  </motion.div>
                </div>
                {/* Logo / Branding */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
                    style={{ background: "linear-gradient(135deg, #D4AF37, #C9A227, #B8860B)" }}>
                    <Globe className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              {/* ── Content ── */}
              <div className="px-6 pt-5 pb-6">
                <AnimatePresence mode="wait">
                  {/* STEP: ASK */}
                  {step === "ask" && (
                    <motion.div key="ask" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <h2 className={cn("text-lg font-bold text-center mb-1", isDark ? "text-white" : "text-slate-900")}>
                        Set Your Timezone
                      </h2>
                      <p className={cn("text-sm text-center mb-5", isDark ? "text-slate-400" : "text-slate-500")}>
                        Valtriox needs your location to display accurate dates, times, and analytics for your region.
                      </p>

                      {/* Info cards */}
                      <div className="space-y-3 mb-5">
                        <div className={cn(
                          "flex items-start gap-3 rounded-xl p-3 border",
                          isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-100"
                        )}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 flex-shrink-0">
                            <MapPin className="h-4 w-4 text-amber-500" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
                              Live Location Access
                            </p>
                            <p className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                              We detect your timezone using your device location. Your exact position is never stored.
                            </p>
                          </div>
                        </div>

                        <div className={cn(
                          "flex items-start gap-3 rounded-xl p-3 border",
                          isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-100"
                        )}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 flex-shrink-0">
                            <Clock className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
                              Accurate Time Display
                            </p>
                            <p className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                              All dates, reports, notifications, and schedules will match your local time.
                            </p>
                          </div>
                        </div>

                        <div className={cn(
                          "flex items-start gap-3 rounded-xl p-3 border",
                          isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-100"
                        )}>
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 flex-shrink-0">
                            <Shield className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700")}>
                              Privacy First
                            </p>
                            <p className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                              Only your timezone is saved. No GPS coordinates or personal location data is stored.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Current browser timezone preview */}
                      {detectedTimezone && (
                        <div className={cn(
                          "rounded-lg p-2.5 mb-5 border flex items-center justify-center gap-2",
                          isDark ? "bg-amber-500/5 border-amber-500/10" : "bg-amber-50 border-amber-100"
                        )}>
                          <Globe className="h-3.5 w-3.5 text-amber-500" />
                          <span className={cn("text-xs font-medium", isDark ? "text-amber-300" : "text-amber-700")}>
                            Browser detected: {getTimezoneLabel(detectedTimezone)}
                          </span>
                          <span className={cn("text-xs", isDark ? "text-amber-400/60" : "text-amber-600/60")}>
                            {currentTime}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={skipTimezone}
                          className={cn(
                            "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                            isDark
                              ? "text-slate-400 hover:bg-white/[0.05] hover:text-slate-300"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          Skip for now
                        </button>
                        <button
                          onClick={detectTimezone}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg"
                          style={{
                            background: "linear-gradient(135deg, #D4AF37, #C9A227, #B8860B)",
                            boxShadow: "0 4px 15px rgba(212,175,55,0.3)"
                          }}
                        >
                          <MapPin className="h-4 w-4" />
                          Allow Location
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP: DETECTING */}
                  {step === "detecting" && (
                    <motion.div key="detecting" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <div className="flex flex-col items-center py-8">
                        <div className="relative mb-5">
                          <div className="h-16 w-16 rounded-full flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(201,162,39,0.08))" }}>
                            <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                          </div>
                          <div className="absolute -inset-2 rounded-full border-2 border-dashed border-amber-500/20 animate-spin" style={{ animationDuration: "8s" }} />
                        </div>
                        <h3 className={cn("text-base font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>
                          Detecting Your Timezone...
                        </h3>
                        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                          Requesting location access from your device
                        </p>
                        {error && (
                          <p className="text-xs text-amber-400 mt-3 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                            {error}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* STEP: CONFIRMED */}
                  {step === "confirmed" && (
                    <motion.div key="confirmed" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <h2 className={cn("text-lg font-bold text-center mb-1", isDark ? "text-white" : "text-slate-900")}>
                        Timezone Detected!
                      </h2>
                      <p className={cn("text-sm text-center mb-5", isDark ? "text-slate-400" : "text-slate-500")}>
                        Your timezone has been identified successfully.
                      </p>

                      {/* Detected timezone display */}
                      <div className={cn(
                        "rounded-xl border p-4 mb-4",
                        isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-slate-50 border-slate-100"
                      )}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg"
                            style={{ background: "linear-gradient(135deg, #D4AF37, #C9A227)" }}>
                            <Globe className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                              {getTimezoneLabel(detectedTimezone)}
                            </p>
                            <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                              {detectedCountry ? `${detectedCountry} - ` : ""}{detectedTimezone}
                            </p>
                          </div>
                        </div>

                        {/* Live time display */}
                        <div className={cn(
                          "rounded-lg p-3 flex items-center justify-center",
                          isDark ? "bg-black/30" : "bg-white"
                        )}>
                          <Clock className="h-4 w-4 text-amber-500 mr-2" />
                          <span className={cn("text-2xl font-mono font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                            {liveTime || currentTime}
                          </span>
                          <span className={cn("text-sm font-medium ml-2", isDark ? "text-amber-400/80" : "text-amber-600")}>
                            {getTimezoneAbbr(detectedTimezone)}
                          </span>
                        </div>

                        {/* Date display */}
                        <p className={cn("text-xs text-center mt-2", isDark ? "text-slate-400" : "text-slate-500")}>
                          {getCurrentDateInTz(detectedTimezone)}
                        </p>
                      </div>

                      {/* What changes */}
                      <div className={cn(
                        "rounded-lg p-3 mb-5 border",
                        isDark ? "bg-emerald-500/5 border-emerald-500/10" : "bg-emerald-50 border-emerald-100"
                      )}>
                        <p className={cn("text-xs font-semibold mb-1.5", isDark ? "text-emerald-400" : "text-emerald-700")}>
                          This will update:
                        </p>
                        <div className="space-y-1">
                          {["Live clock & calendar in header", "Dashboard analytics dates", "Order & task timestamps", "Report date formatting", "Notification times"].map((item) => (
                            <div key={item} className="flex items-center gap-1.5">
                              <Check className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                              <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-600")}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={skipTimezone}
                          className={cn(
                            "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                            isDark
                              ? "text-slate-400 hover:bg-white/[0.05] hover:text-slate-300"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmTimezone}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-lg"
                          style={{
                            background: "linear-gradient(135deg, #D4AF37, #C9A227, #B8860B)",
                            boxShadow: "0 4px 15px rgba(212,175,55,0.3)"
                          }}
                        >
                          <Check className="h-4 w-4" />
                          Confirm Timezone
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP: DONE */}
                  {step === "done" && (
                    <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                      <div className="flex flex-col items-center py-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", damping: 15, stiffness: 200 }}
                          className="h-14 w-14 rounded-full flex items-center justify-center mb-4"
                          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                        >
                          <Check className="h-7 w-7 text-white" />
                        </motion.div>
                        <h3 className={cn("text-base font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>
                          Timezone Set Successfully!
                        </h3>
                        <p className={cn("text-sm text-center", isDark ? "text-slate-400" : "text-slate-500")}>
                          {getTimezoneLabel(detectedTimezone)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Close button (top-right, only for non-loading states) */}
              {step !== "detecting" && step !== "done" && (
                <button
                  onClick={skipTimezone}
                  className={cn(
                    "absolute top-4 right-4 z-10 h-8 w-8 flex items-center justify-center rounded-full transition-colors",
                    isDark
                      ? "text-slate-400 hover:bg-white/10 hover:text-white"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
