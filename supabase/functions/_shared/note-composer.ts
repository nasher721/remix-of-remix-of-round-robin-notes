/** Shared browser/Edge contracts. Pure functions: no storage, logging or network. */
export const PROFILE_VERSION = "2026-09-13.1";
export const DESTINATIONS = [
  "clinicalSummary",
  "intervalEvents",
  "systems.neuro",
  "systems.cv",
  "systems.resp",
  "systems.renalGU",
  "systems.gi",
  "systems.endo",
  "systems.heme",
  "systems.infectious",
  "systems.skinLines",
  "systems.skin",
  "systems.dispo",
] as const;
export type Destination = typeof DESTINATIONS[number];
export type Mode = "standard" | "concise";
export const LABELS: Record<Destination, string> = {
  clinicalSummary: "",
  intervalEvents: "",
  "systems.neuro": "NEURO",
  "systems.cv": "CV",
  "systems.resp": "RESP",
  "systems.renalGU": "RENAL/GU",
  "systems.gi": "GI",
  "systems.endo": "ENDO",
  "systems.heme": "HEME/ONC",
  "systems.infectious": "ID",
  "systems.skinLines": "L/D/A",
  "systems.skin": "Skin",
  "systems.dispo": "Dispo/Code status",
};
export interface Binding {
  ownerId: string;
  patientId: string;
  sessionId: string;
  requestId: string;
  profileVersion: string;
  mode: Mode;
  sourceVersion: number;
  draftVersion: number;
  chartRevision: number;
}
export interface Source {
  id: string;
  patientId: string;
  type: "chart" | "record" | "attending";
  text: string;
  importedAt: string;
  documentedTime?: string;
  timeKind?: TimeKind;
  assignment: "confirmed" | "quarantined";
  label?: string;
}
export type TimeKind =
  | "specimen"
  | "result"
  | "event"
  | "decision"
  | "document"
  | "undated";
export type ClaimState =
  | "observed"
  | "diagnosis"
  | "interpretation"
  | "planned"
  | "ordered"
  | "scheduled"
  | "administered"
  | "infusing"
  | "held"
  | "stopped"
  | "completed"
  | "removed"
  | "pending"
  | "recommended"
  | "unclear"
  | "correction";
export interface Span {
  sourceId: string;
  start: number;
  end: number;
}
export interface Claim {
  id: string;
  patientId: string;
  concept: string;
  text: string;
  state: ClaimState;
  time?: string;
  timeKind: TimeKind;
  destination: Destination;
  spans: Span[];
  uncertainty: string;
  corrects?: string;
}
export interface NoteBlock {
  id: string;
  destination: Destination;
  kind: "summary" | "interval" | "system" | "problem" | "closing";
  text: string;
  claimIds: string[];
  editVersion: number;
  provenance: "generated" | "clinician" | "saved";
  reviewed?: boolean;
}
export interface ComposeRequest {
  binding: Binding;
  sources: Source[];
  base: NoteBlock[];
  allowedTargets: string[];
  instruction: string;
}
export interface ComposeResponse {
  binding: Binding;
  blocks: NoteBlock[];
  claims: Claim[];
  removals: string[];
  supportedClaimIds: string[];
  conflicts: string[][];
}
export interface AcceptedProjection {
  patientId: string;
  expectedRevision: number;
  operationId: string;
  fields: Partial<Record<Destination, string>>;
  format: { profileVersion: string; mode: Mode };
}

export function matchesBinding(a: Binding, b: Binding): boolean {
  return ([
    "ownerId",
    "patientId",
    "sessionId",
    "requestId",
    "profileVersion",
    "mode",
    "sourceVersion",
    "draftVersion",
    "chartRevision",
  ] as const).every((key) => a[key] === b[key]);
}
export function reconcileClaims(
  claims: Claim[],
): { current: Claim[]; historical: Claim[]; conflicts: string[][] } {
  const superseded = new Set(
    claims.filter((c) =>
      c.state === "correction" &&
      claims.some((old) =>
        old.id === c.corrects && old.patientId === c.patientId &&
        old.concept === c.concept
      )
    ).map((c) => c.corrects),
  );
  const historical: Claim[] = claims.filter((c) => superseded.has(c.id));
  const groups = new Map<string, Claim[]>();
  for (const c of claims.filter((c) => !superseded.has(c.id))) {
    const key = JSON.stringify([c.patientId, c.concept, c.state, c.timeKind]);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const current: Claim[] = [], conflicts: string[][] = [];
  for (const group of groups.values()) {
    // Only actual lab timestamps support deterministic newest-result selection.
    const timed = group.filter((c) =>
      c.time && Number.isFinite(Date.parse(c.time))
    );
    const latest = Math.max(...timed.map((c) => Date.parse(c.time!)));
    const kept = group.filter((c) => {
      if (
        (c.timeKind === "specimen" || c.timeKind === "result") && c.time &&
        Date.parse(c.time) < latest
      ) {
        historical.push(c);
        return false;
      }
      return true;
    });
    current.push(...kept);
    if (new Set(kept.map((c) => c.text)).size > 1) {
      conflicts.push(kept.map((c) => c.id));
    }
  }
  return { current, historical, conflicts };
}
export function validateEvidence(
  claims: Claim[],
  sources: Source[],
  patientId: string,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (new Set(sources.map((s) => s.id)).size !== sources.length) {
    errors.push("Duplicate source identifier");
  }
  for (const c of claims) {
    if (ids.has(c.id) || c.patientId !== patientId || !c.spans.length) {
      errors.push("Invalid claim attribution");
    }
    ids.add(c.id);
    for (const span of c.spans) {
      const s = sources.find((s) => s.id === span.sourceId);
      if (
        !s || s.patientId !== patientId || s.assignment !== "confirmed" ||
        !Number.isInteger(span.start) || !Number.isInteger(span.end) ||
        span.start < 0 || span.end <= span.start || span.end > s.text.length
      ) errors.push("Invalid source reference");
    }
  }
  return [...new Set(errors)];
}
export function serializeBlocks(blocks: NoteBlock[]): string {
  const ordinary: string[] = [], closing: string[] = [];
  for (const destination of DESTINATIONS) {
    const body = blocks.filter((b) => b.destination === destination && b.text)
      .map((b) => b.text).join("\n\n");
    if (!body) continue;
    const label = LABELS[destination];
    if (DESTINATIONS.indexOf(destination) >= 10) {
      closing.push(`${label}: ${body}`);
    } else ordinary.push(label ? `${label}\n${body}` : body);
  }
  if (closing.length) ordinary.push(closing.join("\n"));
  return ordinary.join("\n\n");
}
export function validateFormat(text: string): string[] {
  const errors: string[] = [];
  if (/[^\x20-\x7E\n]|;|```/.test(text)) {
    errors.push("Use ASCII plain text, no semicolons or code fences");
  }
  if (/^\s*(?:[-*+]\s|\d+[.)]\s|\[[ xX]\])/m.test(text)) {
    errors.push("Remove list markers");
  }
  if (
    /\b(?:not documented|unknown patient|no current .+ documented)\b/i.test(
      text,
    )
  ) errors.push("Remove unsupported placeholder wording");
  const lines = text.split("\n");
  const systemLabels = DESTINATIONS.slice(2, 10).map((d) => LABELS[d]);
  let previousSystem = -1;
  for (let i = 0; i < lines.length; i++) {
    const index = systemLabels.indexOf(lines[i]);
    if (index >= 0) {
      if (index <= previousSystem) {
        errors.push("Systems must appear once in profile order");
      }
      previousSystem = index;
      if (!lines[i + 1]?.trim() || systemLabels.includes(lines[i + 1])) {
        errors.push("Remove empty system headings");
      }
    }
    if (/^# /.test(lines[i])) {
      const prior = lines[i - 1];
      if (
        prior && !/^# [^:]+:/.test(prior) && !systemLabels.includes(prior) &&
        !/^# [^:]+$/.test(prior)
      ) {
        errors.push(
          "Leave a blank line before a problem after exam or multiline content",
        );
      }
      if (
        /^# [^:]+:/.test(lines[i]) && prior === "" &&
        /^# [^:]+:/.test(lines[i - 2] ?? "")
      ) errors.push("Keep adjacent simple problems together");
    }
  }
  const closing = lines.filter((l) =>
    /^(L\/D\/A|Skin|Dispo\/Code status):/.test(l)
  );
  if (closing.length) {
    const expected = ["L/D/A:", "Skin:", "Dispo/Code status:"].filter((label) =>
      closing.some((l) => l.startsWith(label))
    );
    if (
      closing.length !== expected.length || closing.some((line, i) =>
        !line.startsWith(expected[i])
      ) || !text.endsWith(closing.join("\n"))
    ) errors.push("Closing lines must be consecutive and ordered");
  }
  return [...new Set(errors)];
}
export function mergeProposal(
  base: NoteBlock[],
  current: NoteBlock[],
  proposed: NoteBlock[],
  allowed: string[],
  removals: string[],
): { blocks: NoteBlock[]; conflicts: string[] } {
  for (const b of proposed) {
    if (
      !allowed.includes(b.id) &&
      JSON.stringify(b) !== JSON.stringify(base.find((old) => old.id === b.id))
    ) throw new Error("Proposal changed content outside scope");
  }
  if (
    removals.some((id) =>
      !allowed.includes(id) || !base.some((b) => b.id === id) ||
      proposed.some((b) => b.id === id)
    )
  ) throw new Error("Invalid removal scope");
  const blocks = [...current], conflicts: string[] = [];
  for (const id of new Set([...proposed.map((b) => b.id), ...removals])) {
    if (!allowed.includes(id)) continue;
    const old = base.find((b) => b.id === id),
      local = current.find((b) => b.id === id),
      next = proposed.find((b) => b.id === id);
    const nextText = removals.includes(id) ? undefined : next?.text;
    if (nextText === old?.text) continue;
    if (local?.text !== old?.text && local?.text !== nextText) {
      conflicts.push(id);
      continue;
    }
    const at = blocks.findIndex((b) => b.id === id);
    if (at >= 0) {
      if (next) blocks[at] = next;
      else blocks.splice(at, 1);
    } else if (next) blocks.push(next);
  }
  return { blocks, conflicts };
}
export function validateGenerated(
  blocks: NoteBlock[],
  claims: Claim[],
  sources: Source[],
  patientId: string,
  supportedClaimIds: string[],
): string[] {
  const errors = validateEvidence(claims, sources, patientId);
  const seen = new Set<string>();
  for (const b of blocks) {
    if (
      seen.has(b.id) || b.id !== b.destination ||
      !DESTINATIONS.includes(b.destination) || !b.text.trim()
    ) errors.push("Invalid note block");
    seen.add(b.id);
    if (
      !b.claimIds.length ||
      b.claimIds.some((id) =>
        !claims.some((c) => c.id === id && c.destination === b.destination) ||
        !supportedClaimIds.includes(id)
      )
    ) errors.push("Unsupported generated assertion");
  }
  return [...new Set([...errors, ...validateFormat(serializeBlocks(blocks))])];
}
