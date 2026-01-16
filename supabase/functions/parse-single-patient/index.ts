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
 * Normalize text formatting without removing any content
 */
function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
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

CRITICAL RULES - INCLUDE ALL TEXT:
1. YOU MUST INCLUDE ALL TEXT from the input - do NOT summarize, shorten, or omit any information
2. PRESERVE all original line breaks, paragraph structure, and whitespace patterns
3. Use \\n for line breaks and \\n\\n for paragraph breaks in JSON strings
4. Do NOT merge separate lines or paragraphs into continuous text
5. Keep bullet points, numbered lists, and indentation patterns
6. If text doesn't clearly fit a category, include it in clinicalSummary
7. Text can appear in MULTIPLE sections if it's relevant to multiple systems

EXTRACTION RULES:
1. Extract patient name if present (or leave empty if not found)
2. Extract bed/room number if present (or leave empty if not found)
3. Clinical Summary: Overall patient history, diagnoses, admission reason, and ANY text that doesn't fit other categories
4. Interval Events: Recent developments, overnight events, "what happened on rounds"
5. Imaging: Any imaging studies mentioned (CT, MRI, X-ray, Echo, etc.) - include full descriptions
6. Labs: Any laboratory values or trends mentioned - include ALL lab values
7. Systems: Organize organ-system specific information (include ALL relevant details):
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
  "clinicalSummary": "Overall summary preserving ALL formatting and content",
  "intervalEvents": "Recent events preserving ALL formatting",
  "imaging": "ALL imaging findings or empty string",
  "labs": "ALL lab values or empty string",
  "systems": {
    "neuro": "ALL neuro content or empty string",
    "cv": "ALL cv content or empty string",
    "resp": "ALL resp content or empty string",
    "renalGU": "ALL renal content or empty string",
    "gi": "ALL gi content or empty string",
    "endo": "ALL endo content or empty string",
    "heme": "ALL heme content or empty string",
    "infectious": "ALL ID content or empty string",
    "skinLines": "ALL skin/lines content or empty string",
    "dispo": "ALL dispo content or empty string"
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

    // Normalize text formatting without removing any content
    const cleanedPatient: ParsedPatient = {
      name: normalizeText(parsedPatient.name || ''),
      bed: normalizeText(parsedPatient.bed || ''),
      clinicalSummary: normalizeText(parsedPatient.clinicalSummary || ''),
      intervalEvents: normalizeText(parsedPatient.intervalEvents || ''),
      imaging: normalizeText(parsedPatient.imaging || ''),
      labs: normalizeText(parsedPatient.labs || ''),
      systems: {
        neuro: normalizeText(parsedPatient.systems?.neuro || ''),
        cv: normalizeText(parsedPatient.systems?.cv || ''),
        resp: normalizeText(parsedPatient.systems?.resp || ''),
        renalGU: normalizeText(parsedPatient.systems?.renalGU || ''),
        gi: normalizeText(parsedPatient.systems?.gi || ''),
        endo: normalizeText(parsedPatient.systems?.endo || ''),
        heme: normalizeText(parsedPatient.systems?.heme || ''),
        infectious: normalizeText(parsedPatient.systems?.infectious || ''),
        skinLines: normalizeText(parsedPatient.systems?.skinLines || ''),
        dispo: normalizeText(parsedPatient.systems?.dispo || ''),
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
