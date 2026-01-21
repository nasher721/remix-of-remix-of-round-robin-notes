import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Eye, 
  EyeOff, 
  FileText, 
  Calendar, 
  ImageIcon, 
  TestTube, 
  Pill, 
  Activity,
  RotateCcw 
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { CLINICAL_SECTIONS, DEFAULT_SECTION_VISIBILITY, type ClinicalSectionKey } from "@/constants/config";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Calendar,
  ImageIcon,
  TestTube,
  Pill,
  Activity,
};

export const SectionVisibilityPanel = () => {
  const { sectionVisibility, setSectionVisibility, resetSectionVisibility } = useSettings();

  const toggleSection = (key: ClinicalSectionKey) => {
    setSectionVisibility({
      ...sectionVisibility,
      [key]: !sectionVisibility[key],
    });
  };

  const allVisible = Object.values(sectionVisibility).every(Boolean);
  const noneVisible = Object.values(sectionVisibility).every(v => !v);

  const toggleAll = () => {
    const newValue = !allVisible;
    const newVisibility = Object.fromEntries(
      CLINICAL_SECTIONS.map(s => [s.key, newValue])
    ) as typeof sectionVisibility;
    setSectionVisibility(newVisibility);
  };

  const visibleCount = Object.values(sectionVisibility).filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {allVisible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Sections</span>
          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
            {visibleCount}/{CLINICAL_SECTIONS.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-popover border border-border shadow-lg z-50" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Section Visibility</h4>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="h-7 px-2 text-xs"
              >
                {allVisible ? 'Hide All' : 'Show All'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSectionVisibility}
                className="h-7 px-2 text-xs text-muted-foreground"
                title="Reset to defaults"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {CLINICAL_SECTIONS.map((section) => {
              const IconComponent = iconMap[section.icon];
              return (
                <div key={section.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" />}
                    <Label htmlFor={section.key} className="text-sm cursor-pointer">
                      {section.label}
                    </Label>
                  </div>
                  <Switch
                    id={section.key}
                    checked={sectionVisibility[section.key]}
                    onCheckedChange={() => toggleSection(section.key)}
                  />
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Toggle which clinical sections appear for all patients.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};