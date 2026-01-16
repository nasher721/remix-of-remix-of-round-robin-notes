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
 * Preserve text exactly as provided - only convert CRLF to LF
 */
function preserveText(text: string): string {
  if (!text) return '';
  
  // Only normalize line endings, preserve everything else exactly
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
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

    const systemPrompt = `You are a clinical data organization assistant. Your ONLY job is to take clinical notes and place them into the correct organ-system sections WITHOUT modifying the text.

ABSOLUTE RULES - NO EXCEPTIONS:
1. COPY TEXT EXACTLY AS WRITTEN - character for character, word for word
2. DO NOT rephrase, summarize, reword, or modify ANY text
3. DO NOT extract or move content between sections:
   - If imaging is mentioned within neuro notes, keep it in neuro - do NOT move to imaging field
   - If labs are mentioned within cv notes, keep it in cv - do NOT move to labs field
   - Each piece of text stays in ONE section only - where it originally appeared contextually
4. PRESERVE ALL FORMATTING EXACTLY:
   - Keep every line break (use \\n)
   - Keep every space and indentation
   - Keep every bullet point, dash, number exactly as written
   - Keep blank lines (use \\n\\n)
5. The "imaging" and "labs" fields should ONLY contain text that was written as standalone imaging or labs sections, NOT extracted from system notes
6. If you cannot determine which section text belongs to, put it in clinicalSummary

SECTION DEFINITIONS:
- name: Patient name only
- bed: Room/bed number only
- clinicalSummary: General history, diagnoses, admission reason, text that doesn't fit elsewhere
- intervalEvents: Recent events, overnight updates, what happened recently
- imaging: ONLY standalone imaging sections/paragraphs (not imaging mentioned within system notes)
- labs: ONLY standalone lab sections/paragraphs (not labs mentioned within system notes)
- systems.neuro: ALL neuro content including any imaging/labs mentioned within it
- systems.cv: ALL cv content including any imaging/labs mentioned within it
- systems.resp: ALL resp content including any imaging/labs mentioned within it
- systems.renalGU: ALL renal/GU content including any imaging/labs mentioned within it
- systems.gi: ALL GI content including any imaging/labs mentioned within it
- systems.endo: ALL endo content including any imaging/labs mentioned within it
- systems.heme: ALL heme content including any imaging/labs mentioned within it
- systems.infectious: ALL ID content including any imaging/labs mentioned within it
- systems.skinLines: ALL skin/lines content
- systems.dispo: ALL disposition content

Return JSON:
{
  "name": "",
  "bed": "",
  "clinicalSummary": "",
  "intervalEvents": "",
  "imaging": "",
  "labs": "",
  "systems": {
    "neuro": "",
    "cv": "",
    "resp": "",
    "renalGU": "",
    "gi": "",
    "endo": "",
    "heme": "",
    "infectious": "",
    "skinLines": "",
    "dispo": ""
  }
}`;
    const userPrompt = `Organize these clinical notes into sections. COPY TEXT EXACTLY - do not modify, rephrase, or move content between sections. Keep imaging/labs within their original system context.

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

    // Preserve text exactly as provided
    const cleanedPatient: ParsedPatient = {
      name: preserveText(parsedPatient.name || '').trim(),
      bed: preserveText(parsedPatient.bed || '').trim(),
      clinicalSummary: preserveText(parsedPatient.clinicalSummary || ''),
      intervalEvents: preserveText(parsedPatient.intervalEvents || ''),
      imaging: preserveText(parsedPatient.imaging || ''),
      labs: preserveText(parsedPatient.labs || ''),
      systems: {
        neuro: preserveText(parsedPatient.systems?.neuro || ''),
        cv: preserveText(parsedPatient.systems?.cv || ''),
        resp: preserveText(parsedPatient.systems?.resp || ''),
        renalGU: preserveText(parsedPatient.systems?.renalGU || ''),
        gi: preserveText(parsedPatient.systems?.gi || ''),
        endo: preserveText(parsedPatient.systems?.endo || ''),
        heme: preserveText(parsedPatient.systems?.heme || ''),
        infectious: preserveText(parsedPatient.systems?.infectious || ''),
        skinLines: preserveText(parsedPatient.systems?.skinLines || ''),
        dispo: preserveText(parsedPatient.systems?.dispo || ''),
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
