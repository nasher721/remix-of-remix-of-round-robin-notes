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

CRITICAL INSTRUCTIONS:
- Parse ALL patients from the document - do not stop early
- Clean up any OCR artifacts or formatting issues
- Preserve the complete text for each section
- Separate "What we did on rounds" into intervalEvents, not handoffSummary
- If a field is missing, use an empty string
- Look for bed numbers throughout the ENTIRE document to ensure no patients are missed
- If text seems garbled or incomplete, extract what you can and continue to the next patient`;

    // Build message content based on whether we have images or text
    let userContent: any;
    if (images && images.length > 0) {
      // Vision-based OCR: send images to the model
      userContent = [
        { type: "text", text: "Parse these Epic Handoff document pages and extract all patient data. Read the text in the images carefully:" },
        ...images.map((img: string) => ({
          type: "image_url",
          image_url: { url: img }
        }))
      ];
    } else {
      userContent = `Parse the following Epic Handoff document and extract all patient data:\n\n${pdfContent}`;
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

    console.log("AI response received, parsing JSON...");

    // Extract JSON from the response
    let parsedData: { patients: ParsedPatient[] };
    try {
      // Try to find JSON in the response
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

    console.log(`Successfully parsed ${parsedData.patients?.length || 0} patients`);

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
