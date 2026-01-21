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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientData, section } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let prompt = "";
    let contextData = "";

    if (section === "all") {
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    let todos: string[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        todos = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse todos:", parseError);
      todos = content
        .split('\n')
        .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
        .filter((line: string) => line.length > 0 && line.length < 150);
    }

    return new Response(
      JSON.stringify({ todos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error generating todos:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
