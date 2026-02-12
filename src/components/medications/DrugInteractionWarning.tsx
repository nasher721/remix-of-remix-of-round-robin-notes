import React from "react";
import { AlertCircle, AlertTriangle, Info, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DrugInteraction } from "@/services/drug-interaction.service";

interface DrugInteractionWarningProps {
  interaction: DrugInteraction;
  className?: string;
}

const severityConfig = {
  critical: {
    icon: AlertOctagon,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-800",
    iconColor: "text-red-600",
    label: "CRITICAL",
  },
  high: {
    icon: AlertTriangle,
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-800",
    iconColor: "text-orange-600",
    label: "HIGH",
  },
  moderate: {
    icon: AlertCircle,
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    textColor: "text-yellow-800",
    iconColor: "text-yellow-600",
    label: "MODERATE",
  },
  low: {
    icon: Info,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-800",
    iconColor: "text-blue-600",
    label: "LOW",
  },
};

export function DrugInteractionWarning({
  interaction,
  className,
}: DrugInteractionWarningProps): React.ReactElement {
  const config = severityConfig[interaction.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded",
                config.bgColor,
                config.textColor
              )}
            >
              {config.label}
            </span>
            <span className={cn("font-medium text-sm", config.textColor)}>
              {interaction.drug1} + {interaction.drug2}
            </span>
          </div>
          <p className={cn("text-sm", config.textColor)}>{interaction.description}</p>
          <p className="text-xs text-gray-500 mt-1">
            Source: {interaction.source}
          </p>
        </div>
      </div>
    </div>
  );
}

interface DrugInteractionListProps {
  interactions: DrugInteraction[];
  className?: string;
  showDisclaimer?: boolean;
}

export function DrugInteractionList({
  interactions,
  className,
  showDisclaimer = true,
}: DrugInteractionListProps): React.ReactElement | null {
  if (interactions.length === 0) {
    return null;
  }

  const sorted = [...interactions].sort((a, b) => {
    const order = { critical: 0, high: 1, moderate: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="font-medium text-sm text-gray-700">Drug Interactions</h4>
      {sorted.map((interaction, index) => (
        <DrugInteractionWarning key={index} interaction={interaction} />
      ))}
      {showDisclaimer && (
        <p className="text-xs text-gray-500 italic">
          This information is for reference only and should not replace
          professional medical advice.
        </p>
      )}
    </div>
  );
}
