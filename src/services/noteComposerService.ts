import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionAuthHeaders } from "@/lib/edgeFunctionHeaders";
import type {
  AcceptedProjection,
  ComposeRequest,
  Mode,
} from "@/types/noteComposer";
import type { ComposerTransport } from "@/lib/note-composer/session";
import { parseResponse } from "../../supabase/functions/_shared/note-composer-pipeline.ts";
import { PROFILE_VERSION } from "../../supabase/functions/_shared/note-composer.ts";
import { mapPatientRecord, type PatientRecord } from "./patientService";

async function post(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  const headers = await getEdgeFunctionAuthHeaders({
    "Content-Type": "application/json",
  });
  if (signal.aborted) throw new Error("Cancelled");
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
    signal,
    cache: "no-store",
  });
}
export async function readCompositionStream(
  response: Response,
  stage: (stage: string) => void,
): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error("Composer unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let size = 0;
  let result: unknown;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1000000) throw new Error("Composer response limit");
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        if (!line.trim()) continue;
        let item: Record<string, unknown>;
        try {
          item = JSON.parse(line);
        } catch {
          throw new Error("Composer response contains malformed data");
        }
        if (item.error) throw new Error("Generation could not be verified");
        if (
          typeof item.stage === "string" &&
          ["Reading sources", "Reconciling updates", "Drafting note"].includes(
            item.stage,
          )
        ) stage(item.stage);
        if (item.result) result = item.result;
      }
    }
    if (!result || buffer.trim()) {
      throw new Error("Incomplete composition response");
    }
    return result;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export async function applyComposerPatch(
  patch: AcceptedProjection,
  signal: AbortSignal,
  send = async (body: Record<string, unknown>): Promise<unknown> => {
    const response = await post(
      "rest/v1/rpc/apply_reviewed_note",
      body,
      signal,
    );
    if (!response.ok) throw new Error("Save unconfirmed");
    return response.json();
  },
): Promise<{ revision: number; conflict?: boolean }> {
  const result = await send({
    p_patient_id: patch.patientId,
    p_expected_revision: patch.expectedRevision,
    p_operation_id: patch.operationId,
    p_fields: patch.fields,
    p_format: patch.format,
  });
  if (
    !result || typeof result !== "object" || !("revision" in result) ||
    !Number.isSafeInteger(result.revision)
  ) throw new Error("Invalid save response");
  return result as { revision: number; conflict?: boolean };
}
export const composerTransport: ComposerTransport = {
  async generate(request: ComposeRequest, signal, stage) {
    const bounded = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
    const response = await post(
      "functions/v1/compose-rounding-note",
      request,
      bounded,
    );
    return parseResponse(await readCompositionStream(response, stage), request);
  },
  apply: (patch, signal) =>
    applyComposerPatch(
      patch,
      AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    ),
};
export async function composerCapabilities(
  patientId: string,
  signal: AbortSignal,
): Promise<boolean> {
  const response = await post("functions/v1/compose-rounding-note", {
    action: "capabilities",
    patientId,
  }, signal);
  if (!response.ok) return false;
  try {
    const data = (await response.json()) as { generation?: boolean } | null;
    return data?.generation === true;
  } catch {
    return false;
  }
}
export async function fetchComposerPatient(
  patientId: string,
  ownerId: string,
  signal: AbortSignal,
) {
  const headers = await getEdgeFunctionAuthHeaders();
  const params = new URLSearchParams({
    select: "*",
    id: `eq.${patientId}`,
    user_id: `eq.${ownerId}`,
  });
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/patients?${params}`,
    { headers, signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error("Chart unavailable");
  const rows = await response.json() as PatientRecord[];
  if (rows.length !== 1) throw new Error("Patient access unavailable");
  return mapPatientRecord(rows[0]);
}
export function abstractPreference(
  mode: string,
): { profileVersion: string; mode: Mode } {
  if (mode !== "standard" && mode !== "concise") {
    throw new Error("Invalid style preference");
  }
  return { profileVersion: PROFILE_VERSION, mode };
}
export async function saveComposerPreference(ownerId: string, mode: Mode) {
  const { error } = await supabase.from("user_settings").upsert({
    user_id: ownerId,
    note_composer_mode: abstractPreference(mode).mode,
  }, { onConflict: "user_id" });
  if (error) throw new Error("Preference was not saved");
}
export async function loadComposerPreference(ownerId: string): Promise<Mode> {
  const { data } = await supabase.from("user_settings").select(
    "note_composer_mode",
  ).eq("user_id", ownerId).maybeSingle();
  return data?.note_composer_mode === "concise" ? "concise" : "standard";
}
