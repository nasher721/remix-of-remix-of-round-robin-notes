import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface FieldChange {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

interface Todo {
  content: string;
  completed: boolean;
  section?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientName, fieldChanges, todos, existingIntervalEvents } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Filter to today's changes only
    const today = new Date().toISOString().split('T')[0];
    const todayChanges = (fieldChanges as FieldChange[])?.filter(change => {
      const changeDate = new Date(change.changed_at).toISOString().split('T')[0];
      return changeDate === today;
    }) || [];

    // Get pending (incomplete) todos
    const pendingTodos = (todos as Todo[])?.filter(t => !t.completed) || [];
    const completedTodayTodos = (todos as Todo[])?.filter(t => t.completed) || [];

    // Check if there's anything to summarize
    if (todayChanges.length === 0 && pendingTodos.length === 0 && completedTodayTodos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No changes or todos to summarize for today.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const todayFormatted = new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    // Build context for AI
    const changesText = todayChanges.length > 0 
      ? todayChanges.map(c => {
          const fieldLabel = formatFieldName(c.field_name);
          const oldVal = c.old_value ? stripHtml(c.old_value).substring(0, 200) : '(empty)';
          const newVal = c.new_value ? stripHtml(c.new_value).substring(0, 200) : '(empty)';
          return `${fieldLabel}: Changed from "${oldVal}" to "${newVal}"`;
        }).join('\n')
      : 'No field changes today.';

    const pendingTodosText = pendingTodos.length > 0
      ? pendingTodos.map(t => `- [ ] ${t.content}${t.section ? ` (${t.section})` : ''}`).join('\n')
      : 'No pending todos.';

    const completedTodosText = completedTodayTodos.length > 0
      ? completedTodayTodos.map(t => `- [x] ${t.content}`).join('\n')
      : '';

    const systemPrompt = `You are a medical documentation expert. Generate a brief daily summary in standard ICU/hospital medical shorthand.

OUTPUT FORMAT:
---
📋 ${todayFormatted} Summary:
• [2-4 bullet points summarizing key changes/updates]
${pendingTodos.length > 0 ? '\n⏳ Pending:\n• [list pending action items in shorthand]' : ''}
${completedTodayTodos.length > 0 ? '\n✓ Done:\n• [list completed items briefly]' : ''}
---

ABBREVIATION GUIDELINES:
- pt = patient, w/ = with, w/o = without
- ↑ = increased, ↓ = decreased, → = progressing to
- dx = diagnosis, tx = treatment, rx = prescription
- f/u = follow up, d/c = discharge, c/o = complains of
- nl = normal, abn = abnormal, wnl = within normal limits
- prn = as needed, qd = daily, bid = twice daily
- Use → for changes/transitions

RULES:
1. Be extremely concise - max 4 bullet points for changes
2. Group related changes together
3. Prioritize clinical significance
4. Use standard medical abbreviations
5. Format todos as actionable items
6. Output ONLY the formatted summary block, nothing else`;

    const userPrompt = `Summarize today's activity for ${patientName || 'this patient'}:

FIELD CHANGES TODAY:
${changesText}

PENDING TODOS:
${pendingTodosText}

${completedTodosText ? `COMPLETED TODAY:\n${completedTodosText}` : ''}`;

    console.log(`Generating daily summary for ${patientName}: ${todayChanges.length} changes, ${pendingTodos.length} pending todos`);

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
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error('No response from AI');
    }

    // Append to existing interval events if present
    let finalContent = summary;
    if (existingIntervalEvents && existingIntervalEvents.trim()) {
      // Check if today's summary already exists and replace it
      const summaryMarkerRegex = new RegExp(`---\\s*\\n📋\\s*${todayFormatted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?---`, 'g');
      if (summaryMarkerRegex.test(existingIntervalEvents)) {
        finalContent = existingIntervalEvents.replace(summaryMarkerRegex, summary);
      } else {
        finalContent = existingIntervalEvents.trim() + '\n\n' + summary;
      }
    }

    console.log(`Successfully generated daily summary: ${summary.length} characters`);

    return new Response(
      JSON.stringify({ summary: finalContent, summaryOnly: summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate daily summary error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate daily summary';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function formatFieldName(fieldName: string): string {
  const labels: Record<string, string> = {
    'clinicalSummary': 'Clinical Summary',
    'intervalEvents': 'Interval Events',
    'imaging': 'Imaging',
    'labs': 'Labs',
    'medications': 'Medications',
    'systems.neuro': 'Neuro',
    'systems.cv': 'CV',
    'systems.resp': 'Resp',
    'systems.renalGU': 'Renal/GU',
    'systems.gi': 'GI',
    'systems.endo': 'Endo',
    'systems.heme': 'Heme',
    'systems.infectious': 'ID',
    'systems.skinLines': 'Skin/Lines',
    'systems.dispo': 'Dispo',
  };
  return labels[fieldName] || fieldName;
}
