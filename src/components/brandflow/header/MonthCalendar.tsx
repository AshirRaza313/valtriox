"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MonthCalendar({
  appTheme,
  textPrimary,
  textSecondary,
}: {
  appTheme: string;
  textPrimary: string;
  textSecondary: string;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number | null) =>
    d !== null && d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="w-72 p-3">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-colors",
            appTheme === "light" ? "hover:bg-slate-100 text-slate-600" : "hover:bg-white/10 text-slate-400"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className={cn("text-sm font-semibold", textPrimary)}>{monthName}</span>
        <button
          onClick={nextMonth}
          className={cn("h-7 w-7 rounded-md flex items-center justify-center transition-colors",
            appTheme === "light" ? "hover:bg-slate-100 text-slate-600" : "hover:bg-white/10 text-slate-400"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map((d) => (
          <div
            key={d}
            className={cn("text-center text-[11px] font-medium py-1", textSecondary)}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => (
          <div
            key={i}
            className={cn(
              "h-8 flex items-center justify-center text-[12px] rounded-md transition-colors",
              day === null && "invisible",
              isToday(day)
                ? appTheme === "premium-dark"
                  ? "bg-amber-500 text-white font-bold"
                  : appTheme === "dark"
                  ? "bg-blue-500 text-white font-bold"
                  : "bg-amber-500 text-white font-bold"
                : appTheme === "light"
                ? "text-slate-700 hover:bg-slate-100"
                : "text-slate-300 hover:bg-white/8"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={cn("mt-3 pt-2 border-t text-center", appTheme === "premium-dark" ? "border-white/8" : "border-slate-100")}>
        <button
          onClick={() => setViewDate(new Date())}
          className={cn("text-[11px] font-medium transition-colors",
            appTheme === "premium-dark" ? "text-amber-400 hover:text-amber-300" : "text-amber-600 hover:text-amber-500"
          )}
        >
          Go to Today
        </button>
      </div>
    </div>
  );
}
