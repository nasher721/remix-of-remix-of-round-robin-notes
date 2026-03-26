import * as React from "react";
import {
  FileText,
  List,
  FileSpreadsheet,
  MessageSquare,
  ArrowRightLeft,
  ClipboardCheck,
  Heart,
  Activity,
  Zap,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PrintTemplateType } from "@/types/printTemplates";
import { PRINT_TEMPLATES } from "@/types/printTemplates";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  List,
  FileSpreadsheet,
  MessageSquare,
  ArrowRightLeft,
  ClipboardCheck,
  Heart,
  Activity,
  Zap,
};

interface PrintTemplateSelectorProps {
  selectedTemplate: PrintTemplateType;
  onSelectTemplate: (template: PrintTemplateType) => void;
  className?: string;
}

function MiniLayoutPreview({
  template,
  isSelected,
}: {
  template: (typeof PRINT_TEMPLATES)[0];
  isSelected: boolean;
}) {
  const enabledSectionsCount = template.sections.filter((s) => s.enabled).length;
  const isPortrait = template.layout.orientation === "portrait";
  const headerColor = template.styling.headerColor;
  const accentColor = template.styling.accentColor;
  const visibleSections = Math.min(enabledSectionsCount, 5);
  const hasMore = enabledSectionsCount > 5;

  const sectionWidths = React.useMemo(
    () => Array.from({ length: visibleSections }, () => 60 + Math.random() * 30),
    [visibleSections]
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded border bg-muted/30",
        isPortrait ? "w-12 h-16" : "w-16 h-10"
      )}
      style={{
        borderColor: isSelected ? accentColor : undefined,
      }}
    >
      <div
        className="h-2.5 w-full"
        style={{ backgroundColor: headerColor }}
      />
      <div className="flex flex-col gap-0.5 p-1">
        {sectionWidths.map((width) => (
          <div
            key={template.id + '-' + Math.round(width)}
            className="h-1 bg-muted-foreground/30 rounded-sm"
            style={{ width: `${width}%` }}
          />
        ))}
        {hasMore && (
          <div className="text-[6px] text-muted-foreground leading-none mt-0.5">
            +{enabledSectionsCount - 5}
          </div>
        )}
      </div>
      <div
        className={cn(
          "absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
          isPortrait ? "bg-blue-400" : "bg-amber-400"
        )}
      />
    </div>
  );
}

export function PrintTemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  className,
}: PrintTemplateSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Print Templates</h3>
        <Badge variant="outline" className="text-xs">
          {PRINT_TEMPLATES.length} available
        </Badge>
      </div>

      <ScrollArea className="h-[400px] pr-3">
        <div className="space-y-1.5">
          {PRINT_TEMPLATES.map((template) => {
            const IconComponent = ICON_MAP[template.icon] || FileText;
            const isSelected = selectedTemplate === template.id;
            const enabledSectionsCount = template.sections.filter((s) => s.enabled).length;

            return (
              <Card
                key={template.id}
                className={cn(
                  "cursor-pointer transition-all duration-150",
                  "hover:shadow-sm hover:scale-[1.01]",
                  "border-l-4"
                )}
                style={{
                  borderLeftColor: template.styling.headerColor,
                  borderColor: isSelected ? template.styling.accentColor : undefined,
                  boxShadow: isSelected
                    ? `0 0 0 1px ${template.styling.accentColor}`
                    : undefined,
                }}
                onClick={() => onSelectTemplate(template.id)}
              >
                <CardContent className="p-2.5">
                  <div className="flex items-start gap-2.5">
                    {/* Mini layout preview */}
                    <MiniLayoutPreview
                      template={template}
                      isSelected={isSelected}
                    />

                    {/* Icon */}
                    <div
                      className={cn(
                        "p-1.5 rounded-md flex-shrink-0 transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-medium truncate">
                          {template.name}
                        </h4>
                        {isSelected && (
                          <Check
                            className="h-3 w-3 text-primary flex-shrink-0"
                            style={{ color: template.styling.accentColor }}
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 font-normal"
                        >
                          {template.layout.orientation === "portrait" ? "P" : "L"}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 font-normal"
                        >
                          {template.layout.columns}c
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 font-normal"
                        >
                          {enabledSectionsCount}s
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// Compact version for mobile or smaller spaces
export function PrintTemplateSelectorCompact({
  selectedTemplate,
  onSelectTemplate,
  className,
}: PrintTemplateSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Template
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {PRINT_TEMPLATES.slice(0, 6).map((template) => {
          const IconComponent = ICON_MAP[template.icon] || FileText;
          const isSelected = selectedTemplate === template.id;

          return (
            <button
              type="button"
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border text-left transition-all duration-150",
                "hover:shadow-sm active:scale-[0.98]",
                isSelected
                  ? "border-2 bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
              style={{
                borderColor: isSelected ? template.styling.accentColor : undefined,
                borderLeftWidth: isSelected ? "4px" : undefined,
                borderLeftColor: isSelected ? template.styling.headerColor : undefined,
              }}
            >
              <div
                className={cn(
                  "p-1 rounded flex-shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <IconComponent className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-medium leading-tight truncate">
                {template.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PrintTemplateSelector;
