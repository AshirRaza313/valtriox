// ============================================================================
// Extended Utility Functions — Phase 6: Extracted from duplicated code
// ============================================================================

/**
 * Safely convert a value to a Date object.
 * Returns null if the value cannot be converted to a valid Date.
 * Extracted from 3 duplicated implementations across the codebase.
 */
export function safeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Build a WhatsApp deep link (wa.me) from a phone number.
 * Extracted from 10+ duplicated implementations across the codebase.
 */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const base = `https://wa.me/${cleanPhone}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
}

/**
 * Format a date as a human-readable "time ago" string.
 * Extracted from 4+ duplicated implementations across the codebase.
 */
export function formatTimeAgo(date: Date | string | number): string {
  const now = Date.now();
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diffMs = now - then;

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  if (diffMs < MINUTE) return "just now";
  if (diffMs < HOUR) return `${Math.floor(diffMs / MINUTE)}m ago`;
  if (diffMs < DAY) return `${Math.floor(diffMs / HOUR)}h ago`;
  if (diffMs < WEEK) return `${Math.floor(diffMs / DAY)}d ago`;
  if (diffMs < MONTH) return `${Math.floor(diffMs / WEEK)}w ago`;
  if (diffMs < YEAR) return `${Math.floor(diffMs / MONTH)}mo ago`;
  return `${Math.floor(diffMs / YEAR)}y ago`;
}

/** Millisecond constants for time calculations */
export const MS = {
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
  WEEK: 604_800_000,
} as const;
