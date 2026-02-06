import { useSettings } from "@/contexts/SettingsContext";
import { Button } from "@/components/ui/button";
import { Paintbrush } from "lucide-react";

export function DesignThemeToggle() {
  const { designTheme, setDesignTheme, isMorrow } = useSettings();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setDesignTheme(isMorrow ? 'classic' : 'morrow')}
      className={`gap-1.5 h-8 text-xs ${
        isMorrow
          ? 'text-card-foreground/60 hover:text-card-foreground hover:bg-white/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
      title={`Switch to ${isMorrow ? 'Classic' : 'Morrow'} theme`}
    >
      <Paintbrush className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{isMorrow ? 'Morrow' : 'Classic'}</span>
    </Button>
  );
}
