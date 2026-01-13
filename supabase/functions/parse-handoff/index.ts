import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

/**
 * Remove duplicate sentences/phrases within a text field
 * Detects repeated phrases (>15 chars) and keeps only first occurrence
 * PRESERVES original line breaks and paragraph structure
 */
function deduplicateText(text: string): string {
  if (!text || text.length < 30) return text;

  // Split by line breaks first to preserve paragraph structure
  const lines = text.split(/\n/);
  const processedLines: string[] = [];
  const seenLines = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Preserve empty lines for paragraph spacing
    if (trimmedLine === '') {
      processedLines.push('');
      continue;
    }
    
    const normalizedLine = trimmedLine.toLowerCase().replace(/\s+/g, ' ');
    
    // Skip if we've seen this exact line
    if (normalizedLine.length > 15 && seenLines.has(normalizedLine)) {
      console.log("Removed duplicate line:", trimmedLine.substring(0, 50) + "...");
      continue;
    }
    
    // Check for substantial substring matches (80%+ overlap)
    let isDuplicate = false;
    for (const existing of seenLines) {
      if (normalizedLine.length > 20 && existing.length > 20) {
        // Check if one contains the other
        if (normalizedLine.includes(existing) || existing.includes(normalizedLine)) {
          isDuplicate = true;
          console.log("Removed overlapping content:", trimmedLine.substring(0, 50) + "...");
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      seenLines.add(normalizedLine);
      processedLines.push(line); // Keep original line with its formatting
    }
  }

  // Rejoin with newlines to preserve original structure
  return processedLines.join('\n').trim();
}

/**
 * Remove repeated phrases within text (stuttering/echoing artifacts)
 * Detects when the same phrase appears multiple times in sequence
 * PRESERVES original line breaks
 */
function removeRepeatedPhrases(text: string): string {
  if (!text || text.length < 20) return text;

  // Process line by line to preserve structure
  const lines = text.split(/\n/);
  const processedLines: string[] = [];
  
  for (const line of lines) {
    if (line.trim() === '') {
      processedLines.push('');
      continue;
    }
    
    // Pattern: detect repeated consecutive phrases of 3+ words within this line
    const words = line.split(/\s+/);
    const result: string[] = [];
    let i = 0;
    
    while (i < words.length) {
      // Try to find repeating patterns of various lengths
      let foundRepeat = false;
      
      for (let patternLen = 3; patternLen <= Math.min(10, Math.floor((words.length - i) / 2)); patternLen++) {
        const pattern = words.slice(i, i + patternLen).join(' ');
        const nextPattern = words.slice(i + patternLen, i + patternLen * 2).join(' ');
        
        if (pattern.length > 10 && pattern === nextPattern) {
          // Found a repeat - add pattern once and skip the duplicate
          result.push(...words.slice(i, i + patternLen));
          i += patternLen * 2;
          foundRepeat = true;
          console.log("Removed repeated phrase:", pattern.substring(0, 50));
          
          // Continue checking for more repeats of the same pattern
          while (i + patternLen <= words.length) {
            const checkPattern = words.slice(i, i + patternLen).join(' ');
            if (checkPattern === pattern) {
              i += patternLen;
              console.log("Removed additional repeat of:", pattern.substring(0, 50));
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
 * Main text cleaning function - applies all deduplication strategies
 * Preserves HTML formatting tags and original line breaks
 */
function cleanPatientText(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Step 1: Normalize escaped newlines to actual newlines
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // Step 2: Remove repeated phrases (OCR stuttering)
  cleaned = removeRepeatedPhrases(cleaned);
  
  // Step 3: Remove duplicate lines
  cleaned = deduplicateText(cleaned);
  
  // Step 4: Clean up horizontal whitespace but PRESERVE newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Step 5: Normalize multiple consecutive blank lines to max 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

/**
 * Deduplicate patients by bed number - keeps the most complete record
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
      // Merge: keep the version with more content, combine if needed
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

Given the content from an Epic Handoff (either as text or scanned page images), extract ALL patients into a structured JSON format. This is critical - you must find EVERY patient in the document.

PATIENT IDENTIFICATION:
- Look for bed/room numbers like "15-ED", "G054-02", "H022-01", or similar patterns
- Each patient section typically starts with a bed number followed by patient name
- Names are often followed by MRN in parentheses and age/sex
- Look for repeating patterns that indicate separate patient entries
- Page breaks may separate patients but one patient may span multiple pages

For each patient, extract:
- bed: The bed/room number (e.g., "15-ED", "G054-02", "H022-01")
- name: Patient's full name
- mrn: Medical Record Number (usually a number in parentheses after the name)
- age: Patient's age (e.g., "65 yo", "72y")
- sex: Patient's sex (M or F)
- handoffSummary: The main handoff summary text (clinical overview, history, plan - but NOT system-specific content or "What we did on rounds")
- intervalEvents: Content from "What we did on rounds" section (or "Rounds update", "Events", "Daily update"). Do NOT include the section header.
- bedStatus: Any bed status information
- systems: Object containing system-based review content. Parse ALL content into appropriate systems:
  - neuro: Neurological (mental status, neuro exams, seizures, sedation, pain, ALSO include brain/spine imaging like CT head, MRI brain)
  - cv: Cardiovascular (heart, BP, rhythms, pressors, fluids, cardiac, ALSO include cardiac labs like troponin, BNP and cardiac imaging like echo, EKG)
  - resp: Respiratory (lungs, ventilator, O2, breathing, pulmonary, ALSO include chest imaging like CXR, CT chest and ABGs)
  - renalGU: Renal/GU (kidneys, creatinine, urine, dialysis, Foley, electrolytes, ALSO include renal labs like BMP, Cr, BUN, electrolytes and renal imaging)
  - gi: GI/Nutrition (abdomen, bowels, diet, TPN, liver, GI bleed, ALSO include liver labs like LFTs, lipase and abdominal imaging)
  - endo: Endocrine (glucose, insulin, thyroid, steroids, ALSO include endocrine labs like A1c, TSH, cortisol)
  - heme: Hematology (blood counts, anticoagulation, transfusions, bleeding, ALSO include heme labs like CBC, coags, INR)
  - infectious: Infectious Disease (cultures, antibiotics, fever, infection, ALSO include ID labs like WBC, procalcitonin, cultures and relevant imaging)
  - skinLines: Skin/Lines (IV access, wounds, pressure ulcers, drains, central lines, PICC, arterial lines)
  - dispo: Disposition (discharge planning, goals of care, family discussions, social work)

IMPORTANT: Do NOT create separate imaging or labs fields. Instead, include all imaging and lab information within the relevant system section where it clinically belongs. For example:
- CT head results go in "neuro"
- Chest X-ray and ABG go in "resp"
- CBC and INR go in "heme"
- BMP and creatinine go in "renalGU"
- Troponin and echo go in "cv"

FORMATTING PRESERVATION (CRITICAL):
- Preserve ALL original line breaks exactly as they appear in the source document using \\n
- Preserve paragraph structure - if there are blank lines between sections, keep them as \\n\\n
- Do NOT collapse multiple lines into a single sentence or paragraph
- Do NOT rewrite or rephrase content - copy it exactly as written
- Preserve bullet points and lists with their original line breaks
- Use <b>text</b> for bold/emphasized text (section headers, important findings)
- Use <u>text</u> for underlined text (diagnoses, key terms)
- Preserve numbered lists (1. 2. 3.) and bullet points (- or •) on their own lines
- Preserve numbered lists (1. 2. 3.) and bullet points (- or •)

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
}

CRITICAL DEDUPLICATION RULES:
- If the same patient/bed appears on multiple pages, MERGE them into ONE entry
- NEVER output the same bed number twice
- NEVER repeat text within a field - each sentence should appear only ONCE
- If you see repeated/duplicated content in the source (OCR artifacts), include it only ONCE
- Remove any stuttering, echoing, or repeated phrases
- Clean up any OCR artifacts or formatting issues
- If a field is missing, use an empty string

SYSTEM MAPPING GUIDANCE:
- Look for section headers like "Neuro:", "CV:", "Pulm:", "Renal:", "GI:", "ID:", "Heme:", "Endo:", "Access:", "Dispo:"
- Also map content based on clinical context even without explicit headers
- "Pulm" or "Pulmonary" maps to "resp"
- "ID" or "Infectious Disease" maps to "infectious"
- "Access" or "Lines" maps to "skinLines"
- Include relevant imaging and labs WITHIN each system section, not separately`;

    // Build message content based on whether we have images or text
    let userContent: any;
    if (images && images.length > 0) {
      // Vision-based OCR: send images to the model
      userContent = [
        { type: "text", text: "Parse these Epic Handoff document pages and extract all patient data with system-based organization. CRITICAL: Each patient/bed should appear only ONCE in the output. Merge content from multiple pages for the same patient. Preserve formatting with HTML tags. Parse content into the appropriate system categories (neuro, cv, resp, renalGU, gi, endo, heme, infectious, skinLines, dispo):" },
        ...images.map((img: string, idx: number) => ({
          type: "image_url",
          image_url: { url: img }
        }))
      ];
    } else {
      userContent = `Parse the following Epic Handoff document and extract all patient data with system-based organization. CRITICAL: Each patient/bed should appear only ONCE. Remove any repeated content. Preserve formatting with HTML tags. Parse content into the appropriate system categories:\n\n${pdfContent}`;
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // LOG RAW RESPONSE for debugging
    console.log("=== RAW AI RESPONSE START ===");
    console.log(content.substring(0, 2000));
    if (content.length > 2000) {
      console.log("... (truncated, total length:", content.length, ")");
    }
    console.log("=== RAW AI RESPONSE END ===");

    // Extract and repair JSON from the response
    let parsedData: { patients: ParsedPatient[] };
    try {
      let jsonStr = content;
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find the JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      jsonStr = jsonMatch[0];
      
      // Try to parse as-is first
      try {
        parsedData = JSON.parse(jsonStr);
      } catch (initialError) {
        console.log("Initial parse failed, attempting repair...");
        
        // Attempt to repair truncated JSON
        const openBraces = (jsonStr.match(/\{/g) || []).length;
        const closeBraces = (jsonStr.match(/\}/g) || []).length;
        const openBrackets = (jsonStr.match(/\[/g) || []).length;
        const closeBrackets = (jsonStr.match(/\]/g) || []).length;
        
        console.log(`Braces: ${openBraces} open, ${closeBraces} close. Brackets: ${openBrackets} open, ${closeBrackets} close`);
        
        // Try a simpler fix: just close the truncated JSON
        let repaired = jsonStr;
        
        // Remove any trailing incomplete property
        repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, '');
        repaired = repaired.replace(/,\s*\{[^}]*$/, '');
        
        const missingBrackets = openBrackets - closeBrackets;
        const missingBraces = openBraces - closeBraces;
        
        repaired += ']'.repeat(Math.max(0, missingBrackets));
        repaired += '}'.repeat(Math.max(0, missingBraces));
        
        console.log("Attempting simple bracket repair...");
        parsedData = JSON.parse(repaired);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Initial parse: ${parsedData.patients?.length || 0} patients`);

    // POST-PROCESSING: Apply deduplication and ensure systems structure
    if (parsedData.patients && parsedData.patients.length > 0) {
      // Step 1: Clean text within each patient's fields and ensure systems structure
      parsedData.patients = parsedData.patients.map(patient => {
        const systems = patient.systems || {};
        return {
          ...patient,
          handoffSummary: cleanPatientText(patient.handoffSummary),
          intervalEvents: cleanPatientText(patient.intervalEvents),
          bedStatus: cleanPatientText(patient.bedStatus),
          systems: {
            neuro: cleanPatientText(systems.neuro || ''),
            cv: cleanPatientText(systems.cv || ''),
            resp: cleanPatientText(systems.resp || ''),
            renalGU: cleanPatientText(systems.renalGU || ''),
            gi: cleanPatientText(systems.gi || ''),
            endo: cleanPatientText(systems.endo || ''),
            heme: cleanPatientText(systems.heme || ''),
            infectious: cleanPatientText(systems.infectious || ''),
            skinLines: cleanPatientText(systems.skinLines || ''),
            dispo: cleanPatientText(systems.dispo || ''),
          },
        };
      });

      // Step 2: Deduplicate patients by bed number
      parsedData.patients = deduplicatePatientsByBed(parsedData.patients);
    }

    console.log(`After deduplication: ${parsedData.patients?.length || 0} patients`);

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Parse handoff error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
