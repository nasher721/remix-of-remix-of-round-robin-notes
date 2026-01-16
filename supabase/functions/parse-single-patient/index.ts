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
  name: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
}

/**
 * Remove duplicate lines while preserving structure
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
      continue;
    }
    
    let isDuplicate = false;
    for (const existing of seenLines) {
      if (normalizedLine.length > 20 && existing.length > 20) {
        if (normalizedLine.includes(existing) || existing.includes(normalizedLine)) {
          isDuplicate = true;
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
 * Clean patient text fields
 */
function cleanPatientText(text: string): string {
  if (!text) return '';
  
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+/g, ' ');
  
  cleaned = deduplicateText(cleaned);
  
  return cleaned.trim();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a clinical data extraction assistant. Your task is to parse unstructured clinical notes and organize them into a structured format for a single patient.

CRITICAL FORMATTING RULES:
1. PRESERVE all original line breaks, paragraph structure, and whitespace patterns
2. Use \\n for line breaks and \\n\\n for paragraph breaks in JSON strings
3. Do NOT merge separate lines or paragraphs into continuous text
4. Keep bullet points, numbered lists, and indentation patterns

EXTRACTION RULES:
1. Extract patient name if present (or leave empty if not found)
2. Extract bed/room number if present (or leave empty if not found)
3. Clinical Summary: Overall patient history, diagnoses, admission reason
4. Interval Events: Recent developments, overnight events, "what happened on rounds"
5. Imaging: Any imaging studies mentioned (CT, MRI, X-ray, Echo, etc.)
6. Labs: Any laboratory values or trends mentioned
7. Systems: Organize organ-system specific information:
   - neuro: Neurological findings, mental status, sedation
   - cv: Cardiovascular - vitals, pressors, cardiac issues
   - resp: Respiratory - ventilator settings, oxygen, lung findings
   - renalGU: Renal/GU - creatinine, urine output, dialysis
   - gi: GI - diet, bowel function, liver, nutrition
   - endo: Endocrine - glucose, insulin, thyroid
   - heme: Hematology - blood counts, anticoagulation, transfusions
   - infectious: Infectious disease - antibiotics, cultures, fever
   - skinLines: Skin/Lines - wounds, IV access, drains
   - dispo: Disposition - discharge planning, goals of care

Return a JSON object with this exact structure:
{
  "name": "Patient Name or empty string",
  "bed": "Bed/Room number or empty string",
  "clinicalSummary": "Overall summary preserving formatting",
  "intervalEvents": "Recent events preserving formatting",
  "imaging": "Imaging findings or empty string",
  "labs": "Lab values or empty string",
  "systems": {
    "neuro": "content or empty string",
    "cv": "content or empty string",
    "resp": "content or empty string",
    "renalGU": "content or empty string",
    "gi": "content or empty string",
    "endo": "content or empty string",
    "heme": "content or empty string",
    "infectious": "content or empty string",
    "skinLines": "content or empty string",
    "dispo": "content or empty string"
  }
}`;

    const userPrompt = `Parse the following clinical notes for a single patient and organize into the structured format. Preserve all original formatting and line breaks.

CLINICAL NOTES:
${content}`;

    console.log("Calling AI gateway for single patient parsing...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to process clinical notes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    let aiContent = aiResponse.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "No response from AI service" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response received, parsing JSON...");

    // Extract JSON from response
    let jsonStr = aiContent;
    const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find JSON object directly
      const startIdx = aiContent.indexOf('{');
      const endIdx = aiContent.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = aiContent.substring(startIdx, endIdx + 1);
      }
    }

    let parsedPatient: ParsedPatient;
    try {
      parsedPatient = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.log("Attempting JSON repair...");
      
      // Try to repair common JSON issues
      let repaired = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '')
        .replace(/\t/g, '  ');
      
      try {
        parsedPatient = JSON.parse(repaired);
      } catch {
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Clean and validate the parsed data
    const cleanedPatient: ParsedPatient = {
      name: cleanPatientText(parsedPatient.name || ''),
      bed: cleanPatientText(parsedPatient.bed || ''),
      clinicalSummary: cleanPatientText(parsedPatient.clinicalSummary || ''),
      intervalEvents: cleanPatientText(parsedPatient.intervalEvents || ''),
      imaging: cleanPatientText(parsedPatient.imaging || ''),
      labs: cleanPatientText(parsedPatient.labs || ''),
      systems: {
        neuro: cleanPatientText(parsedPatient.systems?.neuro || ''),
        cv: cleanPatientText(parsedPatient.systems?.cv || ''),
        resp: cleanPatientText(parsedPatient.systems?.resp || ''),
        renalGU: cleanPatientText(parsedPatient.systems?.renalGU || ''),
        gi: cleanPatientText(parsedPatient.systems?.gi || ''),
        endo: cleanPatientText(parsedPatient.systems?.endo || ''),
        heme: cleanPatientText(parsedPatient.systems?.heme || ''),
        infectious: cleanPatientText(parsedPatient.systems?.infectious || ''),
        skinLines: cleanPatientText(parsedPatient.systems?.skinLines || ''),
        dispo: cleanPatientText(parsedPatient.systems?.dispo || ''),
      },
    };

    console.log("Successfully parsed patient data");

    return new Response(
      JSON.stringify({ patient: cleanedPatient }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-single-patient:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
