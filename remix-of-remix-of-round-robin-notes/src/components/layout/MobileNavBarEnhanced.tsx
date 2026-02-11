import { Home, Plus, BookOpen, Settings, Stethoscope, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTabEnhanced = "patients" | "add" | "clinical" | "reference" | "settings";

interface MobileNavBarEnhancedProps {
  activeTab: MobileTabEnhanced;
  onTabChange: (tab: MobileTabEnhanced) => void;
  patientCount?: number;
  alertCount?: number;
}

export const MobileNavBarEnhanced = ({
  activeTab,
  onTabChange,
  patientCount = 0,
  alertCount = 0,
}: MobileNavBarEnhancedProps) => {
  const tabs: {
    id: MobileTabEnhanced;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: "patients", label: "Patients", icon: Home, badge: patientCount },
    { id: "add", label: "Add", icon: Plus },
    { id: "clinical", label: "Clinical", icon: Stethoscope, badge: alertCount, badgeColor: alertCount > 0 ? "#ef4444" : undefined },
    { id: "reference", label: "Reference", icon: BookOpen },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-1">
        {tabs.map(({ id, label, icon: Icon, badge, badgeColor }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all duration-200 relative group active:scale-95",
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "relative px-3 py-1.5 rounded-full transition-all duration-300",
                activeTab === id ? "bg-primary/10" : "group-hover:bg-secondary/50"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  activeTab === id && "scale-110"
                )}
              />
              {badge !== undefined && badge > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1 shadow-sm border-2 border-background"
                  style={{ backgroundColor: badgeColor || "#3b82f6" }}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium tracking-wide",
                activeTab === id && "font-semibold"
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavBarEnhanced;
