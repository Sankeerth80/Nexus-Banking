"use client";

import * as React from "react";

type ThemeMode = "light" | "dark";

const themeStorageKey = "theme";
const darkQuery = "(prefers-color-scheme: dark)";

function readSystemTheme(): ThemeMode {
  return window.matchMedia(darkQuery).matches ? "dark" : "light";
}

function readStoredTheme(): ThemeMode | null {
  const storedTheme = window.localStorage.getItem(themeStorageKey);

  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : null;
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia(darkQuery);

    const applyResolvedTheme = () => {
      applyTheme(readStoredTheme() ?? readSystemTheme());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) {
        applyResolvedTheme();
      }
    };

    const handleSystemThemeChange = () => {
      if (!readStoredTheme()) {
        applyResolvedTheme();
      }
    };

    applyResolvedTheme();
    window.addEventListener("storage", handleStorage);
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  return <>{children}</>;
}
