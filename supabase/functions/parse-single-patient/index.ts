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
 * Convert <BR> markers to actual newlines and normalize line endings
 */
function convertLineBreaks(text: string): string {
  if (!text) return '';
  
  return text
    // Convert <BR> markers to actual newlines
    .replace(/<BR>/g, '\n')
    // Also handle literal \n strings just in case
    .replace(/\\n/g, '\n')
    // Normalize CRLF and CR to LF
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

LINE BREAK RULE - THIS IS CRITICAL:
Use <BR> to represent each line break from the original input.

Example input:
Line one
Line two
Line three

Example output for a field: "Line one<BR>Line two<BR>Line three"

If the input has text on separate lines, the output MUST have <BR> between them. NEVER merge lines into one continuous paragraph.

CONTENT RULES:
- Copy text EXACTLY as written
- Do NOT move imaging/labs from system sections to separate imaging/labs fields
- The "imaging" and "labs" fields should ONLY contain standalone imaging/labs sections`;

    const userPrompt = `Organize these notes. Use <BR> for EVERY line break. Do NOT merge lines together.

INPUT:
${content}`;

    console.log("Calling AI gateway for single patient parsing...");

    // Use gemini-2.5-pro for better instruction following
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "organize_patient_data",
              description: "Organize clinical notes. Use <BR> for line breaks.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Patient name" },
                  bed: { type: "string", description: "Room/bed" },
                  clinicalSummary: { type: "string", description: "History/diagnoses. Use <BR> for line breaks" },
                  intervalEvents: { type: "string", description: "Recent events. Use <BR> for line breaks" },
                  imaging: { type: "string", description: "ONLY standalone imaging sections" },
                  labs: { type: "string", description: "ONLY standalone lab sections" },
                  neuro: { type: "string", description: "ALL neuro content with <BR> for line breaks" },
                  cv: { type: "string", description: "ALL cv content with <BR> for line breaks" },
                  resp: { type: "string", description: "ALL resp content with <BR> for line breaks" },
                  renalGU: { type: "string", description: "ALL renal/GU content with <BR> for line breaks" },
                  gi: { type: "string", description: "ALL GI content with <BR> for line breaks" },
                  endo: { type: "string", description: "ALL endo content with <BR> for line breaks" },
                  heme: { type: "string", description: "ALL heme content with <BR> for line breaks" },
                  infectious: { type: "string", description: "ALL ID content with <BR> for line breaks" },
                  skinLines: { type: "string", description: "ALL skin/lines content with <BR> for line breaks" },
                  dispo: { type: "string", description: "ALL disposition content with <BR> for line breaks" }
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
    console.log("Full AI response:", JSON.stringify(aiResponse, null, 2));

    let parsedData: any;
    
    // Check for tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      console.log("Tool call arguments raw:", toolCall.function.arguments);
      try {
        parsedData = JSON.parse(toolCall.function.arguments);
        console.log("Parsed tool data neuro sample:", parsedData.neuro?.substring(0, 200));
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

    // Convert literal \n to actual newlines
    const cleanedPatient: ParsedPatient = {
      name: convertLineBreaks(parsedPatient.name || '').trim(),
      bed: convertLineBreaks(parsedPatient.bed || '').trim(),
      clinicalSummary: convertLineBreaks(parsedPatient.clinicalSummary || ''),
      intervalEvents: convertLineBreaks(parsedPatient.intervalEvents || ''),
      imaging: convertLineBreaks(parsedPatient.imaging || ''),
      labs: convertLineBreaks(parsedPatient.labs || ''),
      systems: {
        neuro: convertLineBreaks(parsedPatient.systems?.neuro || ''),
        cv: convertLineBreaks(parsedPatient.systems?.cv || ''),
        resp: convertLineBreaks(parsedPatient.systems?.resp || ''),
        renalGU: convertLineBreaks(parsedPatient.systems?.renalGU || ''),
        gi: convertLineBreaks(parsedPatient.systems?.gi || ''),
        endo: convertLineBreaks(parsedPatient.systems?.endo || ''),
        heme: convertLineBreaks(parsedPatient.systems?.heme || ''),
        infectious: convertLineBreaks(parsedPatient.systems?.infectious || ''),
        skinLines: convertLineBreaks(parsedPatient.systems?.skinLines || ''),
        dispo: convertLineBreaks(parsedPatient.systems?.dispo || ''),
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
