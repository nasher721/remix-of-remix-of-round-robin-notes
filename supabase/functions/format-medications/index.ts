import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, createCorsResponse, safeLog, RATE_LIMITS, parseAndValidateBody, requireString, safeErrorMessage, MissingAPIKeyError, handleOptions, jsonResponse } from '../_shared/mod.ts';
import { getLLMConfig } from '../_shared/llm-client.ts';

interface MedicationCategories {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}`;
  const startMs = performance.now();

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ('error' in authResult) {
      return authResult.error;
    }
    const userId = authResult.userId;
    safeLog('info', `Authenticated request from user: ${userId}`, { requestId, function: 'format-medications' });
    // Rate limiting check
    const rateLimit = checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ?? jsonResponse(req, { error: 'Rate limit exceeded' }, 429);
    }

    const bodyResult = await parseAndValidateBody<{ medications?: string; model?: string }>(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { medications, model: requestedModel } = bodyResult.data;

    const medsCheck = requireString(medications, 'medications');
    if (typeof medsCheck !== 'string') {
      return jsonResponse(req, { error: medsCheck.error }, 400);
    }
    const validMedications = medsCheck;

    const llmConfig = getLLMConfig();
    if (!llmConfig.apiKey) {
      safeLog('error', "No LLM API key configured");
      // #region agent log
      fetch('http://127.0.0.1:7607/ingest/d75c0a89-7404-4c0b-b79f-4d4b97fa1340',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f153a7'},body:JSON.stringify({sessionId:'f153a7',runId:'initial',hypothesisId:'H1',location:'format-medications/index.ts:apiKey',message:'No LLM API key in format-medications',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return jsonResponse(req, { error: "AI service not configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to Supabase secrets." }, 500);
    }
    const OPENAI_API_KEY = llmConfig.apiKey;

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

    const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: requestedModel || llmConfig.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse and format these medications:\n\n${validMedications}` },
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
      safeLog('error', `AI gateway error: ${response.status} ${errorText}`);
      // #region agent log
      fetch('http://127.0.0.1:7607/ingest/d75c0a89-7404-4c0b-b79f-4d4b97fa1340',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f153a7'},body:JSON.stringify({sessionId:'f153a7',runId:'initial',hypothesisId:'H2',location:'format-medications/index.ts:llm',message:'Non-OK response from LLM in format-medications',data:{status:response.status,body:errorText.slice(0,500)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (response.status === 429) {
        return jsonResponse(req, { error: "Rate limit exceeded. Please try again." }, 429);
      }
      if (response.status === 402) {
        return jsonResponse(req, { error: "AI credits exhausted. Please add credits." }, 402);
      }

      return jsonResponse(req, { error: "Failed to process medications" }, 500);
    }

    const aiResponse = await response.json();
    safeLog('info', "AI response received for medications");

    let parsedMeds: MedicationCategories = {
      infusions: [],
      scheduled: [],
      prn: [],
      rawText: validMedications,
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
          rawText: validMedications,
        };
      } catch (e) {
        safeLog('error', `Failed to parse tool call arguments: ${e}`);
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
              rawText: validMedications,
            };
          }
        } catch (e) {
          safeLog('error', `Failed to parse content JSON: ${e}`);
        }
      }
    }

    const durationMs = Math.round(performance.now() - startMs);
    safeLog('info', 'format-medications completed', { requestId, function: 'format-medications', durationMs, status: 'success' });

    return jsonResponse(req, { medications: parsedMeds });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startMs);
    safeLog('error', `Error in format-medications: ${error}`, { requestId, function: 'format-medications', durationMs, status: 'error' });
    if (error instanceof MissingAPIKeyError) {
      return jsonResponse(req, { error: error.message, code: 'MISSING_API_KEY' }, 503);
    }
    return createErrorResponse(req, safeErrorMessage(error, 'Failed to format medications'), 500);
  }
});
