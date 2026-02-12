import React, { useState } from "react";
import { Pill, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DrugInteractionList } from "./DrugInteractionWarning";
import {
  checkDrugInteractions,
  DrugInteraction,
} from "@/services/drug-interaction.service";

interface OpenFDACheckerProps {
  medications: string[];
  className?: string;
}

export function OpenFDAChecker({
  medications,
  className,
}: OpenFDACheckerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validMeds = medications.filter((m) => m && m.trim().length > 0);

  const handleCheckInteractions = async () => {
    if (validMeds.length < 2) {
      setError("At least 2 medications required to check interactions");
      return;
    }

    setIsLoading(true);
    setError(null);
    setInteractions([]);

    try {
      const result = await checkDrugInteractions(validMeds);
      if (result.success) {
        setInteractions(result.interactions);
      } else {
        setError(result.error || "Failed to check interactions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const interactionCount = interactions.length;
  const criticalCount = interactions.filter((i) => i.severity === "critical").length;
  const highCount = interactions.filter((i) => i.severity === "high").length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={validMeds.length < 2}
        >
          <Pill className="h-4 w-4 mr-2" />
          Check Interactions
          {interactionCount > 0 && (
            <span
              className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                criticalCount > 0
                  ? "bg-red-100 text-red-700"
                  : highCount > 0
                  ? "bg-orange-100 text-orange-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {interactionCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Drug Interaction Checker
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="text-sm text-gray-600">
            Checking {validMeds.length} medications for interactions
            <ul className="mt-2 list-disc list-inside text-xs text-gray-500">
              {validMeds.slice(0, 5).map((med, i) => (
                <li key={i}>{med}</li>
              ))}
              {validMeds.length > 5 && (
                <li className="text-gray-400">
                  +{validMeds.length - 5} more...
                </li>
              )}
            </ul>
          </div>

          <Button
            onClick={handleCheckInteractions}
            disabled={isLoading || validMeds.length < 2}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              "Check for Interactions"
            )}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {interactions.length > 0 && (
            <DrugInteractionList interactions={interactions} />
          )}

          {!isLoading && !error && interactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Pill className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Click "Check for Interactions" to analyze medications</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
