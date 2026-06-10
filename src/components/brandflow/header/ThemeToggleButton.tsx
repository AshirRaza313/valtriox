"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ThemeToggleButton({
  appTheme,
  setAppTheme,
  textSecondary,
}: {
  appTheme: "light" | "dark" | "premium-dark";
  setAppTheme: (t: "light" | "dark" | "premium-dark") => void;
  textSecondary: string;
}) {
  const cycleTheme = () => {
    if (appTheme === "premium-dark") setAppTheme("dark");
    else if (appTheme === "dark") setAppTheme("light");
    else setAppTheme("premium-dark");
  };

  const icon =
    appTheme === "premium-dark" ? (
      <Moon className="h-4 w-4 text-amber-400" />
    ) : appTheme === "dark" ? (
      <Moon className="h-4 w-4 text-blue-400" />
    ) : (
      <Sun className="h-4 w-4 text-amber-500" />
    );

  const label =
    appTheme === "premium-dark" ? "Premium Dark" : appTheme === "dark" ? "Dark" : "Light";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          className={cn(
            "relative h-8 w-8 rounded-lg transition-colors",
            appTheme === "light"
              ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/10"
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Theme: {label} - click to switch
      </TooltipContent>
    </Tooltip>
  );
}
