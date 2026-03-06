import * as React from "react";
import { Button } from "@/components/ui/button";

export interface RiskNudge {
  label: string;
  description: string;
}

export interface PatientRiskNudgesProps {
  labsText: string;
  onAddTodo: (todo: string) => void;
}

/**
 * PatientRiskNudges - Proactive clinical risk detection
 * 
 * Analyzes lab text for potential clinical risks:
 * - AKI risk (elevated creatinine)
 * - Sepsis risk (elevated WBC + lactate)
 * - Pre-renal AKI (BUN/Cr ratio > 20)
 */
export const PatientRiskNudges = React.memo(function PatientRiskNudges({
  labsText,
  onAddTodo,
}: PatientRiskNudgesProps) {
  const nudges = React.useMemo((): RiskNudge[] => {
    const result: RiskNudge[] = [];
    const text = stripHtml(labsText || '').toLowerCase();

    // AKI risk detection
    if (text.includes('cr:') || text.includes('creatinine')) {
      const crMatch = text.match(/cr[:\s]+([\d.]+)/) || text.match(/creatinine[:\s]+([\d.]+)/);
      if (crMatch && parseFloat(crMatch[1]) > 1.5) {
        result.push({ 
          label: 'AKI risk', 
          description: 'Elevated Cr detected. Consider renal dosing and nephrology consult.' 
        });
      }
    }

    // Sepsis risk detection
    if (text.includes('wbc') && text.includes('lactate')) {
      const wbcMatch = text.match(/wbc[:\s]+([\d.]+)/);
      const lactateMatch = text.match(/lactate[:\s]+([\d.]+)/);
      if (wbcMatch && lactateMatch && (parseFloat(wbcMatch[1]) > 12 || parseFloat(lactateMatch[1]) > 2)) {
        result.push({ 
          label: 'Sepsis risk', 
          description: 'Consider sepsis workup if clinically indicated.' 
        });
      }
    }

    // Pre-renal AKI detection
    if (text.includes('bun') && text.includes('cr')) {
      const bunMatch = text.match(/bun[:\s]+([\d.]+)/);
      const crMatch = text.match(/cr[:\s]+([\d.]+)/);
      if (bunMatch && crMatch) {
        const ratio = parseFloat(bunMatch[1]) / parseFloat(crMatch[1]);
        if (ratio > 20) {
          result.push({ 
            label: 'Pre-renal AKI', 
            description: 'BUN/Cr ratio >20 suggests pre-renal etiology. Consider volume status.' 
          });
        }
      }
    }

    return result;
  }, [labsText]);

  if (nudges.length === 0) return null;

  return (
    <div className="mx-5 mt-2 mb-1 space-y-2 no-print">
      {nudges.map((nudge, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-2"
        >
          <div className="flex-1">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">{nudge.label}</div>
            <div className="text-[11px] text-amber-600 dark:text-amber-300">{nudge.description}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddTodo(`${nudge.label}: ${nudge.description}`)}
            className="h-6 px-2 text-[10px] text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            Add todo
          </Button>
        </div>
      ))}
    </div>
  );
});

/**
 * Strip HTML tags from text for analysis
 */
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
