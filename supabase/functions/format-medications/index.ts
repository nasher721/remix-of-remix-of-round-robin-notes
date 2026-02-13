import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MedicationCategories {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText: string;
}

// Authentication helper
async function authenticateRequest(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseClient.auth.getClaims(token);
  
  if (error || !data?.claims) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { userId: data.claims.sub as string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    console.log(`Authenticated request from user: ${authResult.userId}`);

    const { medications, model: requestedModel } = await req.json();

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
   - Examples: Norepinephrine, Propofol drip, Insulin gtt, Heparin infusion

2. PRN (As Needed): Any medication with:
   - Keywords: "PRN", "as needed", "p.r.n.", "when", "if needed"
   - Examples: Morphine PRN, Ondansetron as needed

3. SCHEDULED: All other regular medications
   - Includes: daily, BID, TID, QID, q6h, q8h, etc.

FORMATTING RULES (CRITICAL):
- Capitalize the first letter of each drug name
- Remove brand names if generic is known (keep just one name)
- Remove suffixes like "sulfate", "HCl", "hydrochloride", "sodium" unless critical
- Remove indication text like "for pain", "for blood pressure", "for nausea"
- Use abbreviations: "mg" not "milligrams", "mcg" not "micrograms"
- Keep dosing frequency: daily, BID, TID, q6h, q8h, etc.
- For infusions, include the rate: "5 mcg/kg/min" or "10 units/hr"
- Format: "DrugName Dose Route Frequency" (e.g., "Metoprolol 25 mg PO BID")
- If route is obvious (oral meds = PO), you can omit it

OUTPUT FORMAT:
Return a JSON object with three arrays: infusions, scheduled, prn
Each array contains formatted medication strings.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: requestedModel || "google/gemini-3-flash-preview",
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

    // Parse tool call response
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
