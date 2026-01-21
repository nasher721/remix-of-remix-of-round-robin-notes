import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Dynamic CORS configuration
const ALLOWED_ORIGINS = [
  'https://id-preview--ef738429-6422-423b-9027-a14e31e88b4d.lovable.app',
  'https://ef738429-6422-423b-9027-a14e31e88b4d.lovableproject.com',
];

const isLovableOrigin = (origin: string): boolean => {
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
         /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);
};

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLovableOrigin(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface PatientSystems {
  neuro: string;
  cv: string;
  resp: string;
  renalGU: string;
  gi: string;
  endo: string;
  heme: string;
  infectious: string;
  skinLines: string;
  dispo: string;
}

interface MedicationCategories {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText?: string;
}

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  intervalEvents: string;
  bedStatus: string;
  systems: PatientSystems;
  medications?: MedicationCategories;
}

/**
 * Remove duplicate sentences/phrases within a text field
 */
function deduplicateText(text: string): string {
  if (!text || text.length < 30) return text;

  const lines = text.split(/\n/);
  const processedLines: string[] = [];
  const seenLines = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '') {
      processedLines.push('');
      continue;
    }
    
    const normalizedLine = trimmedLine.toLowerCase().replace(/\s+/g, ' ');
    
    if (normalizedLine.length > 15 && seenLines.has(normalizedLine)) {
      console.log("Removed duplicate line:", trimmedLine.substring(0, 50) + "...");
      continue;
    }
    
    let isDuplicate = false;
    for (const existing of seenLines) {
      if (normalizedLine.length > 20 && existing.length > 20) {
        if (normalizedLine.includes(existing) || existing.includes(normalizedLine)) {
          isDuplicate = true;
          console.log("Removed overlapping content:", trimmedLine.substring(0, 50) + "...");
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      seenLines.add(normalizedLine);
      processedLines.push(line);
    }
  }

  return processedLines.join('\n').trim();
}

/**
 * Remove repeated phrases within text
 */
function removeRepeatedPhrases(text: string): string {
  if (!text || text.length < 20) return text;

  const lines = text.split(/\n/);
  const processedLines: string[] = [];
  
  for (const line of lines) {
    if (line.trim() === '') {
      processedLines.push('');
      continue;
    }
    
    const words = line.split(/\s+/);
    const result: string[] = [];
    let i = 0;
    
    while (i < words.length) {
      let foundRepeat = false;
      
      for (let patternLen = 3; patternLen <= Math.min(10, Math.floor((words.length - i) / 2)); patternLen++) {
        const pattern = words.slice(i, i + patternLen).join(' ');
        const nextPattern = words.slice(i + patternLen, i + patternLen * 2).join(' ');
        
        if (pattern.length > 10 && pattern === nextPattern) {
          result.push(...words.slice(i, i + patternLen));
          i += patternLen * 2;
          foundRepeat = true;
          console.log("Removed repeated phrase:", pattern.substring(0, 50));
          
          while (i + patternLen <= words.length) {
            const checkPattern = words.slice(i, i + patternLen).join(' ');
            if (checkPattern === pattern) {
              i += patternLen;
            } else {
              break;
            }
          }
          break;
        }
      }
      
      if (!foundRepeat) {
        result.push(words[i]);
        i++;
      }
    }
    
    processedLines.push(result.join(' '));
  }
  
  return processedLines.join('\n');
}

/**
 * Main text cleaning function
 */
function cleanPatientText(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  cleaned = cleaned.replace(/\\n/g, '\n');
  cleaned = removeRepeatedPhrases(cleaned);
  cleaned = deduplicateText(cleaned);
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

/**
 * Merge medication arrays
 */
function mergeMedications(
  a: MedicationCategories | undefined,
  b: MedicationCategories | undefined
): MedicationCategories {
  const mergeArrays = (arr1: string[] = [], arr2: string[] = []): string[] => {
    const combined = [...arr1, ...arr2];
    return [...new Set(combined)];
  };

  return {
    infusions: mergeArrays(a?.infusions, b?.infusions),
    scheduled: mergeArrays(a?.scheduled, b?.scheduled),
    prn: mergeArrays(a?.prn, b?.prn),
  };
}

/**
 * Deduplicate patients by bed number
 */
function deduplicatePatientsByBed(patients: ParsedPatient[]): ParsedPatient[] {
  const bedMap = new Map<string, ParsedPatient>();
  
  for (const patient of patients) {
    const normalizedBed = patient.bed.trim().toLowerCase();
    
    if (!normalizedBed) {
      console.log("Skipping patient with empty bed:", patient.name);
      continue;
    }
    
    const existing = bedMap.get(normalizedBed);
    
    if (!existing) {
      bedMap.set(normalizedBed, patient);
    } else {
      console.log(`Merging duplicate bed ${patient.bed}: existing vs new`);
      
      const merged: ParsedPatient = {
        bed: patient.bed || existing.bed,
        name: patient.name || existing.name,
        mrn: patient.mrn || existing.mrn,
        age: patient.age || existing.age,
        sex: patient.sex || existing.sex,
        handoffSummary: (patient.handoffSummary?.length || 0) > (existing.handoffSummary?.length || 0) 
          ? patient.handoffSummary 
          : existing.handoffSummary,
        intervalEvents: (patient.intervalEvents?.length || 0) > (existing.intervalEvents?.length || 0)
          ? patient.intervalEvents
          : existing.intervalEvents,
        bedStatus: patient.bedStatus || existing.bedStatus,
        medications: mergeMedications(patient.medications, existing.medications),
        systems: {
          neuro: patient.systems?.neuro || existing.systems?.neuro || '',
          cv: patient.systems?.cv || existing.systems?.cv || '',
          resp: patient.systems?.resp || existing.systems?.resp || '',
          renalGU: patient.systems?.renalGU || existing.systems?.renalGU || '',
          gi: patient.systems?.gi || existing.systems?.gi || '',
          endo: patient.systems?.endo || existing.systems?.endo || '',
          heme: patient.systems?.heme || existing.systems?.heme || '',
          infectious: patient.systems?.infectious || existing.systems?.infectious || '',
          skinLines: patient.systems?.skinLines || existing.systems?.skinLines || '',
          dispo: patient.systems?.dispo || existing.systems?.dispo || '',
        },
      };
      
      bedMap.set(normalizedBed, merged);
    }
  }
  
  const result = Array.from(bedMap.values());
  console.log(`Deduplication: ${patients.length} patients -> ${result.length} unique beds`);
  
  return result;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfContent, images } = await req.json();

    if (!pdfContent && (!images || images.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "PDF content or images are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Parsing Epic handoff content...", images ? `(${images.length} images)` : "(text)");

    const systemPrompt = `You are an expert medical data extraction assistant. Your task is to parse Epic Handoff documents and extract structured patient data with system-based organization.

Given the content from an Epic Handoff (either as text or scanned page images), extract ALL patients into a structured JSON format.

PATIENT IDENTIFICATION:
- Look for bed/room numbers like "15-ED", "G054-02", "H022-01", or similar patterns
- Each patient section typically starts with a bed number followed by patient name
- Names are often followed by MRN in parentheses and age/sex

For each patient, extract:
- bed: The bed/room number
- name: Patient's full name
- mrn: Medical Record Number
- age: Patient's age
- sex: Patient's sex (M or F)
- handoffSummary: The main handoff summary text
- intervalEvents: Content from "What we did on rounds" section
- bedStatus: Any bed status information
- medications: STRUCTURED OBJECT with three arrays (infusions, scheduled, prn)
- systems: Object containing system-based review content

MEDICATION PARSING:
1. INFUSIONS: "mcg/kg/min", "mg/hr", "units/hr", "mL/hr", "titrate", "gtt", "drip"
2. SCHEDULED: daily, BID, TID, QID, q6h, q8h, q12h
3. PRN: "PRN", "as needed", "p.r.n."

Return ONLY valid JSON in this exact format:
{
  "patients": [
    {
      "bed": "string",
      "name": "string",
      "mrn": "string",
      "age": "string",
      "sex": "string",
      "handoffSummary": "string",
      "intervalEvents": "string",
      "bedStatus": "string",
      "medications": {
        "infusions": ["string array"],
        "scheduled": ["string array"],
        "prn": ["string array"]
      },
      "systems": {
        "neuro": "string",
        "cv": "string",
        "resp": "string",
        "renalGU": "string",
        "gi": "string",
        "endo": "string",
        "heme": "string",
        "infectious": "string",
        "skinLines": "string",
        "dispo": "string"
      }
    }
  ]
}`;

    let userContent: any;
    if (images && images.length > 0) {
      userContent = [
        { type: "text", text: "Parse these Epic Handoff document pages and extract all patient data with system-based organization. Each patient/bed should appear only ONCE:" },
        ...images.map((img: string) => ({
          type: "image_url",
          image_url: { url: img }
        }))
      ];
    } else {
      userContent = `Parse the following Epic Handoff document and extract all patient data:\n\n${pdfContent}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process handoff" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let aiContent = data.choices?.[0]?.message?.content;

    if (!aiContent) {
      return new Response(
        JSON.stringify({ success: false, error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract JSON from response
    let jsonStr = aiContent;
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const startIdx = aiContent.indexOf('{');
      const endIdx = aiContent.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = aiContent.substring(startIdx, endIdx + 1);
      }
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean and deduplicate patients
    let patients: ParsedPatient[] = parsedData.patients || [];
    
    patients = patients.map((p: ParsedPatient) => ({
      ...p,
      handoffSummary: cleanPatientText(p.handoffSummary),
      intervalEvents: cleanPatientText(p.intervalEvents),
      systems: {
        neuro: cleanPatientText(p.systems?.neuro || ''),
        cv: cleanPatientText(p.systems?.cv || ''),
        resp: cleanPatientText(p.systems?.resp || ''),
        renalGU: cleanPatientText(p.systems?.renalGU || ''),
        gi: cleanPatientText(p.systems?.gi || ''),
        endo: cleanPatientText(p.systems?.endo || ''),
        heme: cleanPatientText(p.systems?.heme || ''),
        infectious: cleanPatientText(p.systems?.infectious || ''),
        skinLines: cleanPatientText(p.systems?.skinLines || ''),
        dispo: cleanPatientText(p.systems?.dispo || ''),
      },
    }));

    patients = deduplicatePatientsByBed(patients);

    console.log(`Successfully parsed ${patients.length} patients`);

    return new Response(
      JSON.stringify({ success: true, patients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-handoff:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
