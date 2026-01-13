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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative",
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-6 w-6" />
              {id === "patients" && patientCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-1">
                  {patientCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
            {activeTab === id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
