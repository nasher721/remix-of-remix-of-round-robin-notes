import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// Comprehensive medical vocabulary hints for Whisper
const WHISPER_MEDICAL_PROMPT = `Medical clinical documentation transcription. ICU critical care rounding notes.
Common terms: patient, history, diagnosis, treatment, assessment, plan, medications, vitals.
Abbreviations: BP, HR, RR, SpO2, MAP, CVP, PEEP, FiO2, GCS, BMP, CBC, ABG, EKG, CT, MRI.
Labs: creatinine, BUN, sodium, potassium, hemoglobin, hematocrit, platelets, WBC, lactate, troponin, BNP.
Medications: norepinephrine, vasopressin, propofol, fentanyl, midazolam, heparin, insulin, vancomycin, piperacillin-tazobactam, meropenem.
Diagnoses: sepsis, ARDS, acute kidney injury, heart failure, pneumonia, stroke, myocardial infarction, respiratory failure.
Procedures: intubation, central line, arterial line, chest tube, bronchoscopy, dialysis, CRRT.`;

// Medical terminology enhancement prompt - Enhanced with GPT-4 capabilities
const MEDICAL_ENHANCEMENT_PROMPT = `You are an expert medical transcription assistant specializing in ICU and critical care documentation. Your task is to enhance and correct medical dictation for clinical accuracy.

TRANSFORMATION RULES:
1. Medical Terminology Correction:
   - Fix phonetic medical terms (e.g., "die a bee tees" → "diabetes", "new moan ya" → "pneumonia")
   - Correct drug name pronunciations (e.g., "van co my sin" → "vancomycin", "lee vo flox a sin" → "levofloxacin")

2. Abbreviation Handling:
   - Expand spoken abbreviations appropriately (e.g., "bee pee" → "BP", "see oh pee dee" → "COPD")
   - Use standard medical abbreviations: BP, HR, RR, SpO2, MAP, GCS, BMP, CBC, etc.

3. Numerical Formatting:
   - Vital signs: "blood pressure one twenty over eighty" → "BP 120/80"
   - Lab values: "hemoglobin twelve point five" → "Hgb 12.5", "creatinine one point two" → "Cr 1.2"
   - Vent settings: "peep of eight, fi oh two forty percent" → "PEEP 8, FiO2 40%"
   - Doses: "norepinephrine at point one mics per kilo per minute" → "norepinephrine 0.1 mcg/kg/min"

4. Clinical Context:
   - Understand clinical context to disambiguate terms
   - "patient is a fib" → "patient is in afib" (atrial fibrillation)
   - "patient is stable" remains "patient is stable"

5. Formatting Standards:
   - Use proper capitalization for medical terms
   - Format lists with commas or bullet points
   - Keep sentences clinically clear and concise

6. Preservation Rules:
   - NEVER change clinical meaning or add information
   - If uncertain about a term, keep the original transcription
   - Maintain all clinical details exactly as dictated

Return ONLY the corrected text, no explanations or commentary.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio, mimeType = 'audio/webm', enhanceMedical = true } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Received audio data, processing...');
    console.log('MIME type:', mimeType);
    console.log('Enhance medical:', enhanceMedical);

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    console.log('Processed audio size:', binaryAudio.length, 'bytes');
    
    // Prepare form data for Whisper API with enhanced medical prompting
    const formData = new FormData();
    const blob = new Blob([binaryAudio.buffer as ArrayBuffer], { type: mimeType });
    formData.append('file', blob, `audio.${mimeType.split('/')[1] || 'webm'}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('prompt', WHISPER_MEDICAL_PROMPT);

    // Transcribe with Whisper via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // First, transcribe using Whisper through OpenAI-compatible endpoint
    // Since Lovable AI doesn't have Whisper, we'll use the chat model to process
    // For now, we'll simulate with a direct transcription approach
    
    // Use Lovable AI for transcription enhancement
    const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY') || ''}`,
      },
      body: formData,
    });

    let rawTranscript = '';
    
    // If OpenAI key is available, use Whisper
    if (transcribeResponse.ok) {
      const whisperResult = await transcribeResponse.json();
      rawTranscript = whisperResult.text;
      console.log('Whisper transcription:', rawTranscript);
    } else {
      // Fallback: Use Lovable AI to process audio description
      // This won't work for actual audio, so we need a different approach
      console.log('Whisper not available, checking for alternative...');
      
      // For demo purposes, return an error asking for OpenAI key
      return new Response(
        JSON.stringify({ 
          error: 'Audio transcription requires OPENAI_API_KEY secret to be configured for Whisper API access.',
          needsApiKey: true 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If medical enhancement is requested, use GPT-4 (preferred) or Lovable AI (fallback)
    let finalText = rawTranscript;
    let enhancementModel = 'none';

    if (enhanceMedical && rawTranscript) {
      console.log('Enhancing medical terminology...');

      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

      // Try GPT-4 first for better medical understanding
      if (OPENAI_API_KEY) {
        try {
          const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini', // Fast and cost-effective for enhancement
              messages: [
                { role: 'system', content: MEDICAL_ENHANCEMENT_PROMPT },
                { role: 'user', content: rawTranscript }
              ],
              temperature: 0.1,
              max_tokens: 2000,
            }),
          });

          if (gptResponse.ok) {
            const gptResult = await gptResponse.json();
            finalText = gptResult.choices?.[0]?.message?.content || rawTranscript;
            enhancementModel = 'gpt-4o-mini';
            console.log('GPT-4 enhanced transcription:', finalText);
          } else {
            console.log('GPT-4 enhancement failed, falling back to Lovable AI');
          }
        } catch (err) {
          console.error('GPT-4 enhancement error:', err);
        }
      }

      // Fallback to Lovable AI if GPT-4 didn't work
      if (enhancementModel === 'none' && LOVABLE_API_KEY) {
        const enhanceResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: MEDICAL_ENHANCEMENT_PROMPT },
              { role: 'user', content: rawTranscript }
            ],
            temperature: 0.1,
            max_tokens: 2000,
          }),
        });

        if (enhanceResponse.ok) {
          const enhanceResult = await enhanceResponse.json();
          finalText = enhanceResult.choices?.[0]?.message?.content || rawTranscript;
          enhancementModel = 'gemini-3-flash';
          console.log('Lovable AI enhanced transcription:', finalText);
        } else {
          console.error('Enhancement failed, using raw transcription');
        }
      }
    }

    return new Response(
      JSON.stringify({
        text: finalText,
        rawText: rawTranscript,
        enhanced: enhanceMedical && finalText !== rawTranscript,
        enhancementModel: enhancementModel !== 'none' ? enhancementModel : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
