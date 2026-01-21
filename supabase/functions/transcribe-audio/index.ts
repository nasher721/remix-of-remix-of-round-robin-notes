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

// Medical terminology enhancement prompt
const MEDICAL_ENHANCEMENT_PROMPT = `You are a medical transcription assistant. Your task is to enhance and correct medical dictation.

Rules:
1. Fix medical terminology spelling
2. Expand common medical abbreviations when spoken
3. Format vital signs properly
4. Format lab values properly
5. Use standard medical abbreviations where appropriate
6. Preserve the clinical meaning exactly
7. Keep formatting clean and readable
8. If unsure about a term, keep the original transcription

Return ONLY the corrected text, no explanations.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
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
    
    // Prepare form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([binaryAudio.buffer as ArrayBuffer], { type: mimeType });
    formData.append('file', blob, `audio.${mimeType.split('/')[1] || 'webm'}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('prompt', 'Medical clinical documentation. Patient assessment, vital signs, medications, diagnoses, treatment plans.');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Transcribe using Whisper through OpenAI
    const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY') || ''}`,
      },
      body: formData,
    });

    let rawTranscript = '';
    
    if (transcribeResponse.ok) {
      const whisperResult = await transcribeResponse.json();
      rawTranscript = whisperResult.text;
      console.log('Whisper transcription:', rawTranscript);
    } else {
      console.log('Whisper not available');
      return new Response(
        JSON.stringify({ 
          error: 'Audio transcription service unavailable. Please configure the required API access.',
          needsApiKey: true 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If medical enhancement is requested, use Lovable AI
    let finalText = rawTranscript;
    
    if (enhanceMedical && rawTranscript) {
      console.log('Enhancing medical terminology...');
      
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
        console.log('Enhanced transcription:', finalText);
      } else {
        console.error('Enhancement failed, using raw transcription');
      }
    }

    return new Response(
      JSON.stringify({ 
        text: finalText,
        rawText: rawTranscript,
        enhanced: enhanceMedical && finalText !== rawTranscript
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
