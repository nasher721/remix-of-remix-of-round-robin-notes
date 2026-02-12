import { supabase } from '@/integrations/supabase/client';

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  description: string;
  source: string;
}

export interface DrugInteractionResponse {
  success: boolean;
  interactions: DrugInteraction[];
  checkedCount?: number;
  disclaimer?: string;
  error?: string;
}

export async function checkDrugInteractions(medications: string[]): Promise<DrugInteractionResponse> {
  if (!medications || medications.length < 2) {
    return {
      success: true,
      interactions: [],
      disclaimer: 'At least 2 medications required to check for interactions.',
    };
  }

  const cleanMeds = medications
    .map(m => m.trim())
    .filter(m => m.length > 0);

  if (cleanMeds.length < 2) {
    return {
      success: true,
      interactions: [],
      disclaimer: 'At least 2 valid medication names required.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-drug-interactions', {
      body: { medications: cleanMeds },
    });

    if (error) {
      console.error('Drug interaction check error:', error);
      return {
        success: false,
        interactions: [],
        error: error.message || 'Failed to check drug interactions',
      };
    }

    return data as DrugInteractionResponse;
  } catch (error) {
    console.error('Drug interaction check error:', error);
    return {
      success: false,
      interactions: [],
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

export function getSeverityColor(severity: DrugInteraction['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700';
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600';
  }
}

export function getSeverityIcon(severity: DrugInteraction['severity']): string {
  switch (severity) {
    case 'critical':
      return 'alert-octagon';
    case 'high':
      return 'alert-triangle';
    case 'moderate':
      return 'alert-circle';
    case 'low':
      return 'info';
    default:
      return 'info';
  }
}

export function getSeverityLabel(severity: DrugInteraction['severity']): string {
  switch (severity) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High Severity';
    case 'moderate':
      return 'Moderate';
    case 'low':
      return 'Low Severity';
    default:
      return 'Unknown';
  }
}

export function getSeverityBadgeVariant(severity: DrugInteraction['severity']): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'moderate':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
}
