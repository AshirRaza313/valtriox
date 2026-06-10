"use client";
import { useState, useEffect } from "react";

export function useCurrentTime(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
