import { supabase } from "@/integrations/supabase/client";
import { composeDecisionDraft } from "./draftComposer";
import type { CaptureBinding, DecisionDraft, TemporaryTranscriptSegment } from "@/types/decisionScribe";
import type { CurrentPatientSnapshot } from "./decisionEngine";

export interface DecisionScribePipelineResult { draft: DecisionDraft; }
const validSegments = (value: unknown): value is TemporaryTranscriptSegment[] => Array.isArray(value) && value.every((item) => item && typeof item === "object" && typeof (item as TemporaryTranscriptSegment).text === "string" && (item as TemporaryTranscriptSegment).text.trim() && Number.isFinite((item as TemporaryTranscriptSegment).startMs) && Number.isFinite((item as TemporaryTranscriptSegment).endMs));
/** Calls the two ephemeral edge boundaries; only the sanitized provisional draft escapes. */
export async function runDecisionScribePipeline(audio: Blob, binding: CaptureBinding, snapshot: CurrentPatientSnapshot): Promise<DecisionScribePipelineResult> {
  let bytes: Uint8Array | undefined;
  let segments: TemporaryTranscriptSegment[] | undefined;
  try {
    bytes = new Uint8Array(await audio.arrayBuffer());
    const transcription = await supabase.functions.invoke<{ binding: CaptureBinding; segments: TemporaryTranscriptSegment[] }>("transcribe-decision-audio", { body: { audio: `data:${audio.type || "audio/webm"};base64,${btoa(String.fromCharCode(...bytes))}`, mimeType: audio.type || "audio/webm", binding } });
    if (transcription.error || !transcription.data || !validSegments(transcription.data.segments)) throw new Error("Transcription unavailable");
    segments = transcription.data.segments;
    const composed = await supabase.functions.invoke<{ draft?: DecisionDraft }>("compose-decision-draft", { body: { binding: transcription.data.binding, snapshot, segments } });
    if (composed.error || !composed.data?.draft || composed.data.draft.provenance !== "provisional") throw new Error("Decision review unavailable");
    return { draft: composeDecisionDraft(composed.data.draft.candidates, binding) };
  } finally {
    bytes?.fill(0); bytes = undefined;
    if (segments) { segments.forEach((segment) => { segment.text = ""; }); segments.length = 0; segments = undefined; }
  }
}
