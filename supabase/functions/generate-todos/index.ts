import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, createCorsResponse, safeLog, RATE_LIMITS } from '../_shared/mod.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    safeLog('info', `Authenticated request from user: ${authResult.userId}`);

    // Rate limiting check
    const rateLimit = checkRateLimit(req, RATE_LIMITS.ai, authResult.userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ?? new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
    }

    const { patientData, section, model: requestedModel } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    let prompt = "";
    let contextData = "";

    if (section === "all") {
      // Generate todos for entire patient
      contextData = `
Patient Name: ${patientData.name || "Unknown"}
Bed: ${patientData.bed || "N/A"}
Clinical Summary: ${patientData.clinicalSummary || "None"}
Interval Events: ${patientData.intervalEvents || "None"}
Imaging: ${patientData.imaging || "None"}
Labs: ${patientData.labs || "None"}
Systems Review: ${JSON.stringify(patientData.systems || {}, null, 2)}
`;
      prompt = `Based on this patient's complete information, generate a prioritized list of actionable to-do items for the care team. Focus on clinical tasks, follow-ups, pending orders, and important monitoring.`;
    } else {
      // Generate todos for specific section
      const sectionNames: Record<string, string> = {
        clinical_summary: "Clinical Summary",
        interval_events: "Interval Events", 
        imaging: "Imaging",
        labs: "Labs",
        cv: "Cardiovascular",
        resp: "Respiratory",
        neuro: "Neurological",
        gi: "Gastrointestinal",
        renalGU: "Renal/GU",
        heme: "Hematology",
        infectious: "Infectious Disease",
        endo: "Endocrine",
        skinLines: "Skin/Lines",
        dispo: "Disposition"
      };
      
      const sectionName = sectionNames[section] || section;
      
      if (section === "clinical_summary") {
        contextData = patientData.clinicalSummary || "";
      } else if (section === "interval_events") {
        contextData = patientData.intervalEvents || "";
      } else if (section === "imaging") {
        contextData = patientData.imaging || "";
      } else if (section === "labs") {
        contextData = patientData.labs || "";
      } else if (patientData.systems && patientData.systems[section]) {
        contextData = patientData.systems[section];
      }
      
      prompt = `Based on this ${sectionName} information, generate actionable to-do items specific to this area. Focus on follow-ups, pending tasks, and important items to address.`;
    }

    if (!contextData.trim()) {
      return new Response(
        JSON.stringify({ todos: [], message: "No content available to generate todos from." }),
        { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: requestedModel || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a medical assistant helping generate actionable to-do items for patient care. 
Generate concise, specific, and actionable tasks. Each task should be clear and completable.
Return ONLY a JSON array of strings, each string being one to-do item.
Keep each item under 100 characters. Generate 3-7 relevant items based on the content provided.
Do not include explanations or markdown, just the JSON array.`
          },
          {
            role: "user",
            content: `${prompt}\n\nContent:\n${contextData}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON array from the response
    let todos: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        todos = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      safeLog('error', `Failed to parse todos: ${parseError}`);
      // If parsing fails, split by newlines and clean up
      todos = content
        .split('\n')
        .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
        .filter((line: string) => line.length > 0 && line.length < 150);
    }

    return new Response(
      JSON.stringify({ todos }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    safeLog('error', `Error generating todos: ${error}`);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
