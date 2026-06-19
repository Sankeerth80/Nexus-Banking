"use client";

import * as React from "react";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

const themeStorageKey = "theme";
const darkQuery = "(prefers-color-scheme: dark)";
export const themePreferenceEvent = "nexus-theme-preference";

function readSystemTheme(): ThemeMode {
  return window.matchMedia(darkQuery).matches ? "dark" : "light";
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function readThemePreference(): ThemePreference {
  const storedTheme = window.localStorage.getItem(themeStorageKey);

  return isThemePreference(storedTheme) ? storedTheme : "system";
}

function resolveTheme(preference: ThemePreference): ThemeMode {
  return preference === "system" ? readSystemTheme() : preference;
}

export function applyThemePreference(preference: ThemePreference) {
  const resolvedTheme = resolveTheme(preference);
  const root = document.documentElement;

  root.classList.add("theme-transition");
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolvedTheme;
  window.dispatchEvent(
    new CustomEvent<ThemePreference>(themePreferenceEvent, {
      detail: preference,
    }),
  );
}

export function setThemePreference(preference: ThemePreference) {
  window.localStorage.setItem(themeStorageKey, preference);
  applyThemePreference(preference);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia(darkQuery);

    const applyResolvedTheme = () => {
      applyThemePreference(readThemePreference());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) {
        applyResolvedTheme();
      }
    };

    const handleSystemThemeChange = () => {
      if (readThemePreference() === "system") {
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
