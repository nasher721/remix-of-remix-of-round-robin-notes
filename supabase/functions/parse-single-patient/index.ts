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

    const systemPrompt = `You organize clinical notes into sections. 

CRITICAL - LINE BREAK RULES:
- Every line in the input that ends with a newline MUST have \\n in the output
- If the input has:
  Line 1
  Line 2
  Line 3
- The output MUST be: "Line 1\\nLine 2\\nLine 3"
- NEVER join lines into a single paragraph
- NEVER remove line breaks

CRITICAL - CONTENT RULES:
- Copy text EXACTLY - do not rephrase or modify
- Do NOT move imaging/labs mentioned within a system section to separate imaging/labs fields
- Keep each piece of text in its original context
- The "imaging" and "labs" fields should ONLY have standalone sections, not content extracted from system notes`;

    const userPrompt = `Organize these notes. PRESERVE EVERY LINE BREAK using \\n in the JSON output. Do NOT merge lines into paragraphs.

INPUT:
${content}`;

    console.log("Calling AI gateway for single patient parsing...");

    // Use tool calling for better structured output
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
        tools: [
          {
            type: "function",
            function: {
              name: "organize_patient_data",
              description: "Organize clinical notes into structured patient data. PRESERVE ALL LINE BREAKS using \\n",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Patient name only" },
                  bed: { type: "string", description: "Room/bed number only" },
                  clinicalSummary: { type: "string", description: "General history, diagnoses. Preserve line breaks with \\n" },
                  intervalEvents: { type: "string", description: "Recent events. Preserve line breaks with \\n" },
                  imaging: { type: "string", description: "ONLY standalone imaging sections, not extracted from systems" },
                  labs: { type: "string", description: "ONLY standalone lab sections, not extracted from systems" },
                  neuro: { type: "string", description: "ALL neuro content including imaging/labs within it. Preserve line breaks with \\n" },
                  cv: { type: "string", description: "ALL cv content. Preserve line breaks with \\n" },
                  resp: { type: "string", description: "ALL resp content. Preserve line breaks with \\n" },
                  renalGU: { type: "string", description: "ALL renal/GU content. Preserve line breaks with \\n" },
                  gi: { type: "string", description: "ALL GI content. Preserve line breaks with \\n" },
                  endo: { type: "string", description: "ALL endo content. Preserve line breaks with \\n" },
                  heme: { type: "string", description: "ALL heme content. Preserve line breaks with \\n" },
                  infectious: { type: "string", description: "ALL ID content. Preserve line breaks with \\n" },
                  skinLines: { type: "string", description: "ALL skin/lines content. Preserve line breaks with \\n" },
                  dispo: { type: "string", description: "ALL disposition content. Preserve line breaks with \\n" }
                },
                required: ["name", "bed", "clinicalSummary", "intervalEvents", "imaging", "labs", "neuro", "cv", "resp", "renalGU", "gi", "endo", "heme", "infectious", "skinLines", "dispo"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "organize_patient_data" } },
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
    
    console.log("AI response received, parsing...");

    let parsedData: any;
    
    // Check for tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }
    
    // Fallback to content parsing if tool call didn't work
    if (!parsedData) {
      let aiContent = aiResponse.choices?.[0]?.message?.content;
      if (!aiContent) {
        console.error("No content in AI response");
        return new Response(
          JSON.stringify({ error: "No response from AI service" }),
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

      try {
        parsedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        // Try to repair common JSON issues
        let repaired = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '')
          .replace(/\t/g, '  ');
        
        try {
          parsedData = JSON.parse(repaired);
        } catch {
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Build the patient object - handle both flat structure (from tool call) and nested structure
    const parsedPatient: ParsedPatient = {
      name: parsedData.name || '',
      bed: parsedData.bed || '',
      clinicalSummary: parsedData.clinicalSummary || '',
      intervalEvents: parsedData.intervalEvents || '',
      imaging: parsedData.imaging || '',
      labs: parsedData.labs || '',
      systems: parsedData.systems || {
        neuro: parsedData.neuro || '',
        cv: parsedData.cv || '',
        resp: parsedData.resp || '',
        renalGU: parsedData.renalGU || '',
        gi: parsedData.gi || '',
        endo: parsedData.endo || '',
        heme: parsedData.heme || '',
        infectious: parsedData.infectious || '',
        skinLines: parsedData.skinLines || '',
        dispo: parsedData.dispo || '',
      },
    };

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
