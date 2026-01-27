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
import type { PrintTemplate, PrintTemplateType } from "@/types/printTemplates";
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
        <div className="space-y-2">
          {PRINT_TEMPLATES.map((template) => {
            const IconComponent = ICON_MAP[template.icon] || FileText;
            const isSelected = selectedTemplate === template.id;

            return (
              <Card
                key={template.id}
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
                onClick={() => onSelectTemplate(template.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">
                          {template.name}
                        </h4>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {template.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {template.layout.orientation}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {template.layout.columns} col
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {template.sections.filter(s => s.enabled).length} sections
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
      <div className="grid grid-cols-3 gap-2">
        {PRINT_TEMPLATES.slice(0, 6).map((template) => {
          const IconComponent = ICON_MAP[template.icon] || FileText;
          const isSelected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              )}
            >
              <IconComponent className="h-4 w-4" />
              <span className="text-[10px] font-medium leading-tight">
                {template.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Template preview component
interface TemplatePreviewProps {
  template: PrintTemplate;
  className?: string;
}

export function TemplatePreview({ template, className }: TemplatePreviewProps) {
  const enabledSections = template.sections.filter(s => s.enabled);

  return (
    <div className={cn("border rounded-lg p-4 bg-white", className)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b">
          <span className="font-semibold text-sm">{template.name}</span>
          <Badge
            style={{ backgroundColor: template.styling.headerColor }}
            className="text-white text-[10px]"
          >
            {template.layout.orientation}
          </Badge>
        </div>

        <div
          className={cn(
            "grid gap-2",
            template.layout.columns === 1 && "grid-cols-1",
            template.layout.columns === 2 && "grid-cols-2",
            template.layout.columns === 3 && "grid-cols-3"
          )}
        >
          {enabledSections.slice(0, 6).map((section) => (
            <div
              key={section.key}
              className="p-2 rounded border bg-muted/30 text-[10px]"
              style={{
                borderLeftColor: template.styling.headerColor,
                borderLeftWidth: "3px",
              }}
            >
              <div className="font-medium truncate">{section.label}</div>
              <div className="h-2 bg-muted rounded mt-1" />
              <div className="h-2 bg-muted rounded mt-1 w-3/4" />
            </div>
          ))}
        </div>

        {enabledSections.length > 6 && (
          <div className="text-[10px] text-muted-foreground text-center">
            +{enabledSections.length - 6} more sections
          </div>
        )}

        <div className="flex gap-2 text-[10px] text-muted-foreground pt-2 border-t">
          <span>Font: {template.styling.fontSize}pt</span>
          <span>|</span>
          <span>Margins: {template.layout.margins}</span>
          {template.layout.showPageNumbers && (
            <>
              <span>|</span>
              <span>Page #s</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrintTemplateSelector;
