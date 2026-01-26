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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 safe-area-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 relative group active:scale-95",
              activeTab === id
                ? "text-primary dark:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "relative px-4 py-1 rounded-full transition-all duration-300",
              activeTab === id ? "bg-primary/10 dark:bg-primary/20" : "group-hover:bg-secondary/50"
            )}>
              <Icon className={cn("h-5 w-5 transition-transform", activeTab === id && "scale-105")} />
              {id === "patients" && patientCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-0.5 shadow-sm border border-background">
                  {patientCount}
                </span>
              )}
            </div>
            <span className={cn("text-[10px] font-medium tracking-wide", activeTab === id && "font-semibold")}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
