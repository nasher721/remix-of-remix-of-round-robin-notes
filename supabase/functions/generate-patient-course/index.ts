import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, createCorsResponse, safeLog, RATE_LIMITS, parseAndValidateBody, safeErrorMessage } from '../_shared/mod.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

interface PatientData {
  name: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
}

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
    const userId = authResult.userId;
    safeLog('info', `Authenticated request from user: ${userId}`);
    const rateLimit = checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ?? new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
    }

    const bodyResult = await parseAndValidateBody<{ patientData?: PatientData; existingCourse?: string; model?: string }>(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { patientData, existingCourse, model: requestedModel } = bodyResult.data;

    if (!patientData) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: patientData' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build comprehensive patient data summary
    const patientContent: string[] = [];

    if (patientData.clinicalSummary) {
      const cleanSummary = patientData.clinicalSummary.replace(/<[^>]*>/g, '').trim();
      if (cleanSummary) patientContent.push(`Clinical Summary: ${cleanSummary}`);
    }

    if (patientData.intervalEvents) {
      const cleanEvents = patientData.intervalEvents.replace(/<[^>]*>/g, '').trim();
      if (cleanEvents) patientContent.push(`Interval Events:\n${cleanEvents}`);
    }

    if (patientData.imaging) {
      const cleanImaging = patientData.imaging.replace(/<[^>]*>/g, '').trim();
      if (cleanImaging) patientContent.push(`Imaging: ${cleanImaging}`);
    }

    if (patientData.labs) {
      const cleanLabs = patientData.labs.replace(/<[^>]*>/g, '').trim();
      if (cleanLabs) patientContent.push(`Labs: ${cleanLabs}`);
    }

    const systemLabels: Record<string, string> = {
      neuro: "Neuro",
      cv: "CV",
      resp: "Resp",
      renalGU: "Renal/GU",
      gi: "GI",
      endo: "Endo",
      heme: "Heme",
      infectious: "ID",
      skinLines: "Skin/Lines",
      dispo: "Dispo",
    };

    if (patientData.systems) {
      const systemNotes: string[] = [];
      for (const [key, label] of Object.entries(systemLabels)) {
        const content = patientData.systems[key as keyof PatientSystems];
        if (content && typeof content === 'string') {
          const cleanContent = content.replace(/<[^>]*>/g, '').trim();
          if (cleanContent) {
            systemNotes.push(`${label}: ${cleanContent}`);
          }
        }
      }
      if (systemNotes.length > 0) {
        patientContent.push(`Systems Review:\n${systemNotes.join('\n')}`);
      }
    }

    if (patientContent.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No patient data to generate course from. Add clinical notes first.' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a medical documentation expert creating a chronological hospital course summary for ICU/hospital patients.

REQUIRED FORMAT:
- Organize events chronologically by DATE (most recent first)
- Use this structure for each date:
  **[Date]** (e.g., **Mon, Jan 15**)
  Brief prose paragraph summarizing key events that day in medical shorthand

MEDICAL SHORTHAND TO USE:
- pt = patient, w/ = with, w/o = without
- h/o = history of, hx = history, dx = diagnosis
- tx = treatment, rx = medications, sx = symptoms
- ↑ = increased, ↓ = decreased
- nl = normal, abn = abnormal
- neg = negative, pos = positive
- s/p = status post, c/b = complicated by
- AMS = altered mental status, WNL = within normal limits
- HD# = hospital day number
- q = every, prn = as needed
- d/c = discontinue/discharge, f/u = follow up

STYLE GUIDELINES:
- Write in prose style, not bullet points
- Be concise but comprehensive
- Highlight significant clinical changes and interventions
- Group related events within each date
- Use professional medical terminology
- If dates can be inferred from interval events format, use those
- If no dates are available, organize by clinical progression

${existingCourse ? `EXISTING COURSE (update/expand as needed):\n${existingCourse}\n` : ''}

Output ONLY the formatted course summary. No explanations or headers outside the date structure.`;

    const userPrompt = `Generate a chronological hospital course for ${patientData.name || 'this patient'} from the following clinical data:\n\n${patientContent.join('\n\n')}`;

    safeLog('info', `Generating patient course for ${patientData.name || 'patient'}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: requestedModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      safeLog('error', `AI gateway error: ${response.status} ${errorText}`);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedCourse = data.choices?.[0]?.message?.content?.trim();

    if (!generatedCourse) {
      throw new Error('No response from AI');
    }

    safeLog('info', `Successfully generated patient course: ${generatedCourse.length} characters`);

    return new Response(
      JSON.stringify({ course: generatedCourse }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    safeLog('error', `Generate patient course error: ${error}`);
    return createErrorResponse(req, safeErrorMessage(error, 'Failed to generate patient course'), 500);
  }
});
