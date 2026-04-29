"use client"

import * as React from "react"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/ui/themes"
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"

function ClerkProviderWithTheme({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()

  return (
    <ClerkProvider
      appearance={{
        theme: resolvedTheme === "dark" ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  )
}

export function Providers({
  children,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ClerkProviderWithTheme>
        <TooltipProvider>{children}</TooltipProvider>
      </ClerkProviderWithTheme>
    </NextThemesProvider>
  )
}
