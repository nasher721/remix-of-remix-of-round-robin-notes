import { Home, Plus, BookOpen, Settings, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "patients" | "add" | "reference" | "settings";

interface MobileNavBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  patientCount?: number;
}

export const MobileNavBar = ({ activeTab, onTabChange, patientCount = 0 }: MobileNavBarProps) => {
  const tabs: { id: MobileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "patients", label: "Patients", icon: Home },
    { id: "add", label: "Add", icon: Plus },
    { id: "reference", label: "Reference", icon: BookOpen },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200 relative active:scale-95",
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground/60"
            )}
          >
            {activeTab === id && (
              <span className="absolute top-0 left-1/4 right-1/4 h-[2px] rounded-full bg-primary" />
            )}
            <div
              className={cn(
                "relative px-4 py-1.5 rounded-2xl transition-all duration-200",
                activeTab === id && "bg-primary/8"
              )}
            >
              <Icon className={cn("h-5 w-5", activeTab === id && "text-primary")} />
              {id === "patients" && patientCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] flex items-center justify-center text-[9px] font-bold bg-primary text-primary-foreground rounded-full px-0.5 border-2 border-background">
                  {patientCount}
                </span>
              )}
            </div>
            <span className={cn(
              "text-[10px] tracking-wide transition-colors",
              activeTab === id ? "font-semibold text-primary" : "font-medium"
            )}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
