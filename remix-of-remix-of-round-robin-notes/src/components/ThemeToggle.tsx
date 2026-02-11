import * as React from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-3.5 w-3.5 mr-2" />;
      case "dark":
        return <Moon className="h-3.5 w-3.5 mr-2" />;
      default:
        return <Laptop className="h-3.5 w-3.5 mr-2" />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case "light":
        return "Light";
      case "dark":
        return "Dark";
      default:
        return "System";
    }
  };

  return (
    <Select
      value={theme}
      onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
    >
      <SelectTrigger
        className="h-8 w-32 rounded-full text-card-foreground/60 hover:text-card-foreground hover:bg-accent/50 transition-colors border-0"
      >
        {getIcon()}
        <SelectValue placeholder="Select theme" className="text-sm" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5" />
            <span>Light</span>
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5" />
            <span>Dark</span>
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Laptop className="h-3.5 w-3.5" />
            <span>System</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
