import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  intervalEvents: string;
  bedStatus: string;
}

/**
 * Remove duplicate sentences/phrases within a text field
 * Detects repeated phrases (>15 chars) and keeps only first occurrence
 */
function deduplicateText(text: string): string {
  if (!text || text.length < 30) return text;

  // Split into sentences (by period, newline, or semicolon)
  const sentences = text.split(/(?<=[.!?\n;])\s*/).filter(s => s.trim().length > 0);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const sentence of sentences) {
    const normalized = sentence.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Skip if we've seen this exact sentence
    if (normalized.length > 15 && seen.has(normalized)) {
      console.log("Removed duplicate sentence:", sentence.substring(0, 50) + "...");
      continue;
    }
    
    // Check for substantial substring matches (80%+ overlap)
    let isDuplicate = false;
    for (const existing of seen) {
      if (normalized.length > 20 && existing.length > 20) {
        // Check if one contains the other
        if (normalized.includes(existing) || existing.includes(normalized)) {
          isDuplicate = true;
          console.log("Removed overlapping content:", sentence.substring(0, 50) + "...");
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      seen.add(normalized);
      result.push(sentence);
    }
  }

  return result.join(' ').trim();
}

/**
 * Remove repeated phrases within text (stuttering/echoing artifacts)
 * Detects when the same phrase appears multiple times in sequence
 */
function removeRepeatedPhrases(text: string): string {
  if (!text || text.length < 20) return text;

  // Remove consecutive duplicate words/phrases
  let cleaned = text;
  
  // Pattern: detect repeated consecutive phrases of 3+ words
  const words = text.split(/\s+/);
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
  
  return result.join(' ');
}

/**
 * Main text cleaning function - applies all deduplication strategies
 */
function cleanPatientText(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Step 1: Remove repeated phrases (OCR stuttering)
  cleaned = removeRepeatedPhrases(cleaned);
  
  // Step 2: Remove duplicate sentences
  cleaned = deduplicateText(cleaned);
  
  // Step 3: Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
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

    const systemPrompt = `You are an expert medical data extraction assistant. Your task is to parse Epic Handoff documents and extract structured patient data.

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
- handoffSummary: The main handoff summary text (clinical overview, history, plan - but NOT the "What we did on rounds" section)
- intervalEvents: The content from the "What we did on rounds" section (or similar like "Rounds update", "Events", "Daily update"). IMPORTANT: Do NOT include the section header (e.g., "What we did on rounds:") - only include the actual content.
- bedStatus: Any bed status information (if present)

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
      "bedStatus": "string"
    }
  ]
}

CRITICAL DEDUPLICATION RULES:
- If the same patient/bed appears on multiple pages, MERGE them into ONE entry
- NEVER output the same bed number twice
- NEVER repeat text within a field - each sentence should appear only ONCE
- If you see repeated/duplicated content in the source (OCR artifacts), include it only ONCE
- Remove any stuttering, echoing, or repeated phrases
- Do NOT repeat sentences or paragraphs - each piece of clinical information should appear exactly once
- Clean up any OCR artifacts or formatting issues
- If a field is missing, use an empty string`;

    // Build message content based on whether we have images or text
    let userContent: any;
    if (images && images.length > 0) {
      // Vision-based OCR: send images to the model
      userContent = [
        { type: "text", text: "Parse these Epic Handoff document pages and extract all patient data. CRITICAL: Each patient/bed should appear only ONCE in the output. Merge content from multiple pages for the same patient. Remove any repeated text. Read the text in the images carefully:" },
        ...images.map((img: string, idx: number) => ({
          type: "image_url",
          image_url: { url: img }
        }))
      ];
    } else {
      userContent = `Parse the following Epic Handoff document and extract all patient data. CRITICAL: Each patient/bed should appear only ONCE. Remove any repeated content:\n\n${pdfContent}`;
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

    // Extract JSON from the response
    let parsedData: { patients: ParsedPatient[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Initial parse: ${parsedData.patients?.length || 0} patients`);

    // POST-PROCESSING: Apply deduplication at multiple levels
    if (parsedData.patients && parsedData.patients.length > 0) {
      // Step 1: Clean text within each patient's fields
      parsedData.patients = parsedData.patients.map(patient => ({
        ...patient,
        handoffSummary: cleanPatientText(patient.handoffSummary),
        intervalEvents: cleanPatientText(patient.intervalEvents),
        bedStatus: cleanPatientText(patient.bedStatus),
      }));

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
