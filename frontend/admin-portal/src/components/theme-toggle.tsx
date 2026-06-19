"use client";

import * as React from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  readThemePreference,
  setThemePreference,
  themePreferenceEvent,
  type ThemePreference,
} from "@/components/theme-provider";

const themeCycle: ThemePreference[] = ["system", "light", "dark"];
const themeLabels: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function getNextPreference(preference: ThemePreference): ThemePreference {
  const index = themeCycle.indexOf(preference);

  return themeCycle[(index + 1) % themeCycle.length];
}

export function ThemeToggle() {
  const [preference, setPreference] = React.useState<ThemePreference>("system");

  React.useEffect(() => {
    setPreference(readThemePreference());

    const handlePreferenceChange = (event: Event) => {
      if (event instanceof CustomEvent) {
        setPreference(event.detail as ThemePreference);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "theme") {
        setPreference(readThemePreference());
      }
    };

    window.addEventListener(themePreferenceEvent, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(themePreferenceEvent, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const toggleTheme = () => {
    const nextPreference = getNextPreference(preference);

    setPreference(nextPreference);
    setThemePreference(nextPreference);
  };

  const label = themeLabels[preference];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Theme: ${label}. Switch color theme`}
          onClick={toggleTheme}
        >
          {preference === "system" && <Laptop />}
          {preference === "light" && <Sun />}
          {preference === "dark" && <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label} theme</TooltipContent>
    </Tooltip>
  );
}
