import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, transformType, customPrompt } = await req.json();

    if (!text || !transformType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: text and transformType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (transformType) {
      case 'comma-list':
        systemPrompt = `You are a text formatting assistant. Convert the given text into a comma-delimited list. 
- Extract distinct items, concepts, or elements from the text
- Format them as a clean comma-separated list
- Remove redundant words and keep each item concise
- Do not add any explanation, just output the comma-separated list`;
        userPrompt = `Convert this text to a comma-delimited list:\n\n${text}`;
        break;

      case 'medical-shorthand':
        systemPrompt = `You are a medical documentation expert. Rewrite the given text using standard medical abbreviations and shorthand.
Common abbreviations to use:
- patient → pt, patients → pts
- with → w/, without → w/o
- history → hx, history of → h/o
- diagnosis → dx, treatment → tx, symptoms → sx
- before → pre, after → post
- bilateral → b/l, left → L, right → R
- increase → ↑, decrease → ↓
- normal → nl, abnormal → abn
- negative → neg, positive → pos
- times/frequency → x (e.g., "three times" → "3x")
- every → q (e.g., "every day" → "qd")
- as needed → prn
- immediately → stat
- by mouth → PO, intravenous → IV, intramuscular → IM
- blood pressure → BP, heart rate → HR, respiratory rate → RR
- chief complaint → CC, review of systems → ROS
- physical exam → PE, vital signs → VS
- follow up → f/u, discharge → d/c
- year old → y/o (e.g., "65 year old" → "65 y/o")

Output ONLY the rewritten text in medical shorthand. No explanations.`;
        userPrompt = `Rewrite in medical shorthand:\n\n${text}`;
        break;

      case 'custom':
        if (!customPrompt) {
          return new Response(
            JSON.stringify({ error: 'Custom prompt required for custom transformation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        systemPrompt = `You are a helpful text transformation assistant. Apply the user's requested transformation to the given text. Output ONLY the transformed text without any explanations or commentary.`;
        userPrompt = `${customPrompt}\n\nText to transform:\n${text}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid transformType' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Processing ${transformType} transformation for ${text.length} characters`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const transformedText = data.choices?.[0]?.message?.content?.trim();

    if (!transformedText) {
      throw new Error('No response from AI');
    }

    console.log(`Successfully transformed text: ${transformedText.length} characters`);

    return new Response(
      JSON.stringify({ transformedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transform text error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to transform text';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
