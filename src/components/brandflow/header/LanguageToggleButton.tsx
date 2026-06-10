"use client";

import React from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function LanguageToggleButton({
  language,
  setLanguage,
  appTheme,
  textSecondary,
}: {
  language: "en" | "ur";
  setLanguage: (l: "en" | "ur") => void;
  appTheme: string;
  textSecondary: string;
}) {
  const toggleLang = () => setLanguage(language === "en" ? "ur" : "en");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLang}
          className={cn(
            "relative h-8 w-8 rounded-lg transition-colors",
            appTheme === "light"
              ? "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/10"
          )}
        >
          <Globe className="h-4 w-4" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 items-center justify-center rounded-full bg-slate-200 text-[7px] font-bold text-slate-600 px-1 leading-none">
            {language === "en" ? "EN" : "UR"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {language === "en" ? "Roman Urdu mein switch karein" : "English mein switch karein"}
      </TooltipContent>
    </Tooltip>
  );
}
