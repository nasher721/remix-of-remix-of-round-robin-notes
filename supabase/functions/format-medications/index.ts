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

interface MedicationCategories {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { medications } = await req.json();

    if (!medications || typeof medications !== "string") {
      return new Response(
        JSON.stringify({ error: "Medications text is required" }),
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

    const systemPrompt = `You are a medication formatting expert. Parse medication lists into structured categories.

CATEGORIZATION RULES:
1. INFUSIONS: Any medication with these indicators:
   - "mcg/kg/min", "mg/hr", "units/hr", "mL/hr"
   - Keywords: "titrate", "gtt", "drip", "infusion", "continuous"

2. PRN (As Needed): Any medication with:
   - Keywords: "PRN", "as needed", "p.r.n.", "when", "if needed"

3. SCHEDULED: All other regular medications
   - Includes: daily, BID, TID, QID, q6h, q8h, etc.

FORMATTING RULES:
- Capitalize the first letter of each drug name
- Remove brand names if generic is known
- Remove suffixes like "sulfate", "HCl" unless critical
- Remove indication text like "for pain"
- Use abbreviations: "mg" not "milligrams"
- Format: "DrugName Dose Route Frequency"

OUTPUT FORMAT:
Return a JSON object with three arrays: infusions, scheduled, prn`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse and format these medications:\n\n${medications}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_medications",
              description: "Categorize and format medications into infusions, scheduled, and PRN",
              parameters: {
                type: "object",
                properties: {
                  infusions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Continuous infusion medications with rates",
                  },
                  scheduled: {
                    type: "array",
                    items: { type: "string" },
                    description: "Regularly scheduled medications",
                  },
                  prn: {
                    type: "array",
                    items: { type: "string" },
                    description: "As-needed medications",
                  },
                },
                required: ["infusions", "scheduled", "prn"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "categorize_medications" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to process medications" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI response for medications:", JSON.stringify(aiResponse, null, 2));

    let parsedMeds: MedicationCategories = {
      infusions: [],
      scheduled: [],
      prn: [],
      rawText: medications,
    };

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        parsedMeds = {
          infusions: args.infusions || [],
          scheduled: args.scheduled || [],
          prn: args.prn || [],
          rawText: medications,
        };
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }

    // Fallback: parse from content if tool call didn't work
    if (
      parsedMeds.infusions.length === 0 &&
      parsedMeds.scheduled.length === 0 &&
      parsedMeds.prn.length === 0
    ) {
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            parsedMeds = {
              infusions: parsed.infusions || [],
              scheduled: parsed.scheduled || [],
              prn: parsed.prn || [],
              rawText: medications,
            };
          }
        } catch (e) {
          console.error("Failed to parse content JSON:", e);
        }
      }
    }

    console.log("Parsed medications:", parsedMeds);

    return new Response(JSON.stringify({ medications: parsedMeds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in format-medications:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
