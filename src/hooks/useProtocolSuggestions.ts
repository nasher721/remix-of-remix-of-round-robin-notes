import { useState, useCallback } from 'react';
import { useLLMClinicalAssistant } from '@/hooks/useLLMClinicalAssistant';
import type { Patient } from '@/types/patient';

interface ProtocolSuggestion {
  protocol: {
    id: string;
    name: string;
    description: string;
    category: string;
    priority: string;
  };
  confidence: number;
  reason: string;
}

export function useProtocolSuggestions() {
  const { processWithAI } = useLLMClinicalAssistant();
  const [suggestions, setSuggestions] = useState<ProtocolSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeProtocols = useCallback(async (patient: Patient) => {
    setIsAnalyzing(true);

    try {
      const context = `
Patient: ${patient.name || 'Unknown'}
Bed: ${patient.bed || 'Unknown'}
Clinical Summary: ${patient.clinicalSummary || 'Not documented'}
Labs: ${patient.labs || 'Not documented'}
Systems Review:
${Object.entries(patient.systems || {}).map(([key, value]) => `${key}: ${value}`).join('\n')}
Medications: ${JSON.stringify(patient.medications || {})}
      `.trim();

      const prompt = `
${context}

Analyze this patient for relevant clinical protocols and bundles.
Consider the patient's current condition, medications, diagnosis, and clinical status.

Relevant protocols include:
- Sepsis 3-Hour Bundle (sepsis, infection, lactate, hypotension)
- VTE Prophylaxis (immobile, bedridden, surgery, trauma)
- VAP Prevention Bundle (ventilated, intubated, mechanical ventilation)
- CAUTI Prevention Bundle (foley, catheter, urinary, indwelling catheter)
- CLABSI Prevention Bundle (central line, picc, cvl, dialysis catheter)
- Delirium Prevention (delirium, confusion, sedation, orientation)
- Pain Management Bundle (pain, analgesic, sedation, recovery)
- Aspirin Thromboprophylaxis (medical patient, orthopedic, hip, knee, surgery)

For each relevant protocol, provide:
1. Protocol name
2. Confidence score (0-100)
3. Brief reasoning (1-2 sentences)

Respond in JSON array:
[
  {
    "protocolName": "Sepsis 3-Hour Bundle",
    "confidence": 85,
    "reason": "Patient has lactate elevation and hypotension"
  },
  {
    "protocolName": "VTE Prophylaxis",
    "confidence": 90,
    "reason": "Patient has hip fracture and requires immobilization"
  }
]

Rules:
- Only include protocols supported by the data
- Be evidence-based and clinically practical
- Consider both immediate needs and preventive measures
- Prioritize critical bundles
- Do not invent protocols
`;

      const result = await processWithAI<ProtocolSuggestion[]>(
        'smart_expand',
        { text: prompt }
      );

      if (result) {
        const enhancedSuggestions = result.map((suggestion) => {
          const protocol = PROTOCOLS.find(p => p.name === suggestion.protocolName);
          return {
            ...suggestion,
            protocol: protocol || {
              id: suggestion.protocolName,
              name: suggestion.protocolName,
              description: 'AI-suggested protocol',
              category: 'prevention',
              priority: 'moderate',
            },
          };
        });
        setSuggestions(enhancedSuggestions);
      }
    } catch (error) {
      console.error('Protocol suggestion error:', error);
      setSuggestions([]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [processWithAI]);

  const addProtocol = useCallback((protocolId: string) => {
    setSuggestions(prev => prev.filter(s => s.protocol.id !== protocolId));
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isAnalyzing,
    analyzeProtocols,
    addProtocol,
    clearSuggestions,
  };
}
