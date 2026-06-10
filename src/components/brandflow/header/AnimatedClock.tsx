"use client";

import React, { useState, useEffect } from "react";

export function AnimatedClock({ className }: { className?: string }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  // Calculate rotation angles for clock hands
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;

  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
    >
      {/* Clock face */}
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      {/* Hour markers */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1="16"
          y1="3.5"
          x2="16"
          y2="5.5"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.5"
          transform={`rotate(${i * 60} 16 16)`}
        />
      ))}
      {/* Hour hand */}
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        transform={`rotate(${hourDeg} 16 16)`}
      />
      {/* Minute hand */}
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        transform={`rotate(${minuteDeg} 16 16)`}
      />
      {/* Second hand */}
      <line
        x1="16"
        y1="17"
        x2="16"
        y2="5"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinecap="round"
        transform={`rotate(${secondDeg} 16 16)`}
        className="opacity-70"
      />
      {/* Center dot */}
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}
