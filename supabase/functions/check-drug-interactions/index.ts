import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DrugInteractionRequest {
  medications: string[];
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  description: string;
  source: string;
}

interface OpenFDAResult {
  id: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    rxcui?: string[];
  };
  boxed_warning?: string[];
  contraindications?: string[];
  warnings?: string[];
  drug_interactions?: string[];
  precautions?: string[];
}

const OPENFDA_BASE_URL = 'https://api.fda.gov/drug/label.json';
const OPENFDA_API_KEY = Deno.env.get('OPENFDA_API_KEY');

function getOpenFDAUrl(drugName: string): string {
  const encodedDrug = encodeURIComponent(drugName);
  const apiKeyParam = OPENFDA_API_KEY ? `&api_key=${OPENFDA_API_KEY}` : '';
  
  return `${OPENFDA_BASE_URL}?search=openfda.brand_name:"${encodedDrug}"+openfda.generic_name:"${encodedDrug}"&limit=1${apiKeyParam}`;
}

async function fetchDrugInfo(drugName: string): Promise<OpenFDAResult | null> {
  try {
    const response = await fetch(getOpenFDAUrl(drugName));
    
    if (!response.ok) {
      if (response.status === 404) return null;
      if (response.status === 429) {
        throw new Error('OpenFDA rate limit exceeded. Please try again later.');
      }
      throw new Error(`OpenFDA API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0] as OpenFDAResult;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching drug info for ${drugName}:`, error);
    return null;
  }
}

function findDrugMentions(text: string, drugNames: string[]): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const drug of drugNames) {
    const lowerDrug = drug.toLowerCase();
    if (lowerText.includes(lowerDrug) || lowerText.includes(lowerDrug.replace(/\s+/g, ''))) {
      found.push(drug);
    }
  }
  
  return found;
}

function extractInteractionDescription(
  sections: string[] | undefined,
  otherDrug: string
): string | null {
  if (!sections || sections.length === 0) return null;
  
  for (const section of sections) {
    if (section.toLowerCase().includes(otherDrug.toLowerCase())) {
      const sentences = section.split(/[.!?]+/).filter(s => s.trim());
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(otherDrug.toLowerCase())) {
          return sentence.trim() + '.';
        }
      }
      const firstSentence = sentences[0];
      if (firstSentence) {
        return firstSentence.trim() + '.';
      }
    }
  }
  
  return null;
}

async function checkInteraction(
  drug1: string,
  drug2: string
): Promise<DrugInteraction | null> {
  const drug1Info = await fetchDrugInfo(drug1);
  
  if (!drug1Info) return null;
  
  const sections = [
    { field: drug1Info.boxed_warning, severity: 'critical' as const },
    { field: drug1Info.contraindications, severity: 'high' as const },
    { field: drug1Info.warnings, severity: 'moderate' as const },
    { field: drug1Info.drug_interactions, severity: 'low' as const },
  ];
  
  for (const { field, severity } of sections) {
    if (!field) continue;
    
    for (const section of field) {
      const mentions = findDrugMentions(section, [drug2]);
      
      if (mentions.length > 0) {
        const description = extractInteractionDescription(field, drug2);
        
        if (description) {
          return {
            drug1,
            drug2,
            severity,
            description: description.slice(0, 500),
            source: 'OpenFDA Drug Labeling',
          };
        }
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { medications } = body as DrugInteractionRequest;

    if (!Array.isArray(medications) || medications.length < 2) {
      return new Response(
        JSON.stringify({ 
          error: 'At least 2 medications required to check for interactions' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const normalizedMeds = medications
      .map(m => m.trim())
      .filter(m => m.length > 0)
      .map(m => m.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim());

    if (normalizedMeds.length < 2) {
      return new Response(
        JSON.stringify({ 
          error: 'At least 2 valid medication names required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const interactions: DrugInteraction[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < normalizedMeds.length; i++) {
      for (let j = i + 1; j < normalizedMeds.length; j++) {
        const pairKey = [normalizedMeds[i], normalizedMeds[j]].sort().join('|');
        
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const interaction = await checkInteraction(normalizedMeds[i], normalizedMeds[j]);
        
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    interactions.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return new Response(
      JSON.stringify({
        success: true,
        interactions,
        checkedCount: normalizedMeds.length,
        disclaimer: 'This information is for reference only and should not replace professional medical advice. Data sourced from FDA drug labeling.',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Drug interaction check error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        success: false,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
