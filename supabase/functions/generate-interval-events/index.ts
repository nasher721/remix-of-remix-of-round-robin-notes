import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createErrorResponse, checkRateLimit, createCorsResponse, safeLog, RATE_LIMITS } from '../_shared/mod.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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
    
    // Rate limiting check
    const rateLimit = checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ?? new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
    }

    const { systems, existingIntervalEvents, patientName, model: requestedModel } = await req.json();

    if (!systems || typeof systems !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: systems' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build a summary of all system data
    const systemSummaries: string[] = [];
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

    for (const [key, label] of Object.entries(systemLabels)) {
      const content = systems[key];
      if (content && typeof content === 'string' && content.trim()) {
        // Strip HTML tags for cleaner processing
        const cleanContent = content.replace(/<[^>]*>/g, '').trim();
        if (cleanContent) {
          systemSummaries.push(`${label}: ${cleanContent}`);
        }
      }
    }

    if (systemSummaries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No system data to summarize. Add content to system reviews first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    const systemPrompt = `You are a medical documentation expert specializing in creating concise interval event summaries for ICU/hospital patients. Generate a brief daily summary using standard medical abbreviations and shorthand.

REQUIRED FORMAT:
- Start with today's date: "${today}:"
- Use bullet points (•) for each key event/finding
- Use standard medical abbreviations:
  - pt = patient, w/ = with, w/o = without
  - h/o = history of, hx = history
  - dx = diagnosis, tx = treatment, sx = symptoms
  - ↑ = increased, ↓ = decreased
  - nl = normal, abn = abnormal
  - neg = negative, pos = positive
  - q = every, prn = as needed
  - BP = blood pressure, HR = heart rate, RR = respiratory rate
  - f/u = follow up, d/c = discharge
  - y/o = year old

GUIDELINES:
- Be extremely concise - aim for 3-6 bullet points
- Focus on NEW findings, changes, and actions taken today
- Exclude routine stable findings unless clinically relevant
- Group related items together
- Prioritize: 1) Clinical changes 2) New interventions 3) Pending items

${existingIntervalEvents ? `EXISTING INTERVAL EVENTS (add new summary below, do not repeat):\n${existingIntervalEvents}\n` : ''}

Output ONLY the formatted interval events summary. No explanations or headers.`;

    const userPrompt = `Generate today's interval events summary from these system-based rounds notes:\n\n${systemSummaries.join('\n\n')}`;

    safeLog('info', `Generating interval events for ${patientName || 'patient'} from ${systemSummaries.length} systems`);

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
    const generatedEvents = data.choices?.[0]?.message?.content?.trim();

    if (!generatedEvents) {
      throw new Error('No response from AI');
    }

    safeLog('info', `Successfully generated interval events: ${generatedEvents.length} characters`);

    return new Response(
      JSON.stringify({ intervalEvents: generatedEvents }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    safeLog('error', `Generate interval events error: ${error}`);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate interval events';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
