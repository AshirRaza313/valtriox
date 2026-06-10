"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"
import { useValtrioxStore } from "@/store/brandflow-store"

const Toaster = ({ ...props }: ToasterProps) => {
  const appTheme = useValtrioxStore((s) => s.appTheme)
  // Map our theme to sonner's expected values
  const theme = appTheme === "light" ? "light" : "dark"

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
