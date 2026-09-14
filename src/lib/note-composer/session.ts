import type { Patient } from "@/types/patient";
import { chartSource, projectReviewed, snapshotBlocks } from "./chart";
import {
  type AcceptedProjection,
  type Claim,
  type ComposeRequest,
  type ComposeResponse,
  type Destination,
  DESTINATIONS,
  mergeProposal,
  type Mode,
  type NoteBlock,
  PROFILE_VERSION,
  serializeBlocks,
  type Source,
  validateFormat,
  validateGenerated,
} from "../../../supabase/functions/_shared/note-composer.ts";
import { parseResponse } from "../../../supabase/functions/_shared/note-composer-pipeline.ts";
export interface ComposerTransport {
  generate(
    request: ComposeRequest,
    signal: AbortSignal,
    stage: (stage: string) => void,
  ): Promise<ComposeResponse>;
  apply(
    patch: AcceptedProjection,
    signal: AbortSignal,
  ): Promise<{ revision: number; conflict?: boolean }>;
}
interface Proposal {
  base: NoteBlock[];
  response: ComposeResponse;
  allowed: string[];
}
export interface ComposerState {
  blocks: NoteBlock[];
  sources: Source[];
  attending: string;
  mode: Mode;
  proposal: Proposal | null;
  mergeConflicts: string[];
  clears: string[];
  error: string;
  intakeError: string;
  stage: string;
  saveStatus: "saved" | "unsaved" | "saving" | "conflict";
  version: number;
  evidence: Record<string, { claims: Claim[]; supported: string[] }>;
}
/** Owns temporary data only in memory. No browser persistence or generic AI hooks. */
export class ComposerSession {
  state: ComposerState;
  private listeners = new Set<() => void>();
  private generation: AbortController | null = null;
  private saving: AbortController | null = null;
  private alive = true;
  private sourceVersion = 0;
  private sessionId = crypto.randomUUID();
  private undoStack: {
    blocks: NoteBlock[];
    clears: string[];
    evidence: ComposerState["evidence"];
  }[] = [];
  private pendingPatch: AcceptedProjection | null = null;
  constructor(
    readonly ownerId: string,
    public patient: Patient,
    private transport: ComposerTransport,
  ) {
    this.patient = structuredClone(patient);
    this.state = {
      blocks: snapshotBlocks(patient),
      sources: [chartSource(patient, new Date().toISOString())],
      attending: "",
      mode: patient.noteFormat?.mode ?? "standard",
      proposal: null,
      mergeConflicts: [],
      clears: [],
      error: "",
      intakeError: "",
      stage: "",
      saveStatus: "saved",
      version: 0,
      evidence: {},
    };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.state;
  private update(patch: Partial<ComposerState>) {
    if (!this.alive) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private checkpoint() {
    this.undoStack.push({
      blocks: this.state.blocks,
      clears: this.state.clears,
      evidence: this.state.evidence,
    });
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.pendingPatch = null;
  }
  private changedSources(patch: Partial<ComposerState>) {
    this.cancel();
    this.sourceVersion++;
    this.update({
      ...patch,
      proposal: null,
      mergeConflicts: [],
      evidence: {},
      blocks: this.state.blocks.map((b) =>
        b.provenance === "generated" ? { ...b, reviewed: false } : b
      ),
      saveStatus: "unsaved",
    });
  }
  setAttending(text: string) {
    if (this.state.saveStatus === "saving") return;
    this.changedSources({ attending: text });
  }
  setMode(mode: Mode) {
    if (mode === this.state.mode || this.state.saveStatus === "saving") return;
    this.cancel();
    this.pendingPatch = null;
    this.update({ mode, proposal: null, saveStatus: "unsaved" });
  }
  addSource(text: string, label: string): string {
    if (!this.alive) throw new Error("Session closed");
    if (
      !text.trim() ||
      text.length + this.state.sources.reduce((n, s) => n + s.text.length, 0) >
        200000 ||
      this.state.sources.length >= 29
    ) {
      throw new Error(
        "Source limit exceeded. Select a smaller patient-specific excerpt.",
      );
    }
    const id = crypto.randomUUID();
    this.changedSources({
      sources: [...this.state.sources, {
        id,
        patientId: this.patient.id,
        type: "record",
        text,
        label,
        importedAt: new Date().toISOString(),
        assignment: "quarantined",
      }],
    });
    return id;
  }
  selectSource(
    id: string,
    start: number,
    end: number,
    documentedTime?: string,
  ) {
    const s = this.state.sources.find((s) => s.id === id);
    if (
      !s || s.type !== "record" || !Number.isInteger(start) ||
      !Number.isInteger(end) || start < 0 || end <= start || end > s.text.length
    ) throw new Error("Select this patient's exact source text first");
    if (documentedTime && !Number.isFinite(Date.parse(documentedTime))) {
      throw new Error("Invalid documented time");
    }
    this.changedSources({
      sources: this.state.sources.map((s) =>
        s.id === id
          ? {
            ...s,
            text: s.text.slice(start, end),
            assignment: "confirmed",
            documentedTime: documentedTime || undefined,
            timeKind: documentedTime ? "document" : "undated",
          }
          : s
      ),
    });
  }
  removeSource(id: string) {
    this.changedSources({
      sources: this.state.sources.filter((s) => s.id !== id),
    });
  }
  intakeFailed(message: string) {
    this.cancel();
    this.update({ intakeError: message, error: message });
  }
  excludeFailure() {
    this.update({ intakeError: "", error: "" });
  }
  private allSources(): Source[] {
    return [
      ...this.state.sources,
      ...(this.state.attending.trim()
        ? [{
          id: "attending",
          patientId: this.patient.id,
          type: "attending" as const,
          text: this.state.attending,
          importedAt: new Date().toISOString(),
          assignment: "confirmed" as const,
        }]
        : []),
    ];
  }
  edit(destination: Destination, text: string) {
    if (!this.alive || this.state.saveStatus === "saving") return;
    this.checkpoint();
    const old = this.state.blocks.find((b) => b.id === destination);
    const next: NoteBlock = {
      id: destination,
      destination,
      kind: old?.kind ?? "system",
      text,
      claimIds: [],
      editVersion: (old?.editVersion ?? 0) + 1,
      provenance: "clinician",
      reviewed: true,
    };
    this.update({
      blocks: old
        ? this.state.blocks.map((b) => b.id === destination ? next : b)
        : [...this.state.blocks, next],
      version: this.state.version + 1,
      saveStatus: "unsaved",
      error: "",
    });
  }
  clearField(id: string) {
    this.checkpoint();
    this.update({
      blocks: this.state.blocks.filter((b) => b.id !== id),
      clears: [...new Set([...this.state.clears, id])],
      version: this.state.version + 1,
      saveStatus: "unsaved",
    });
  }
  review(id: string, reviewed: boolean) {
    this.update({
      blocks: this.state.blocks.map((b) =>
        b.id === id ? { ...b, reviewed } : b
      ),
    });
  }
  cancel() {
    this.generation?.abort();
    this.generation = null;
    this.update({ stage: "" });
  }
  async generate(target?: Destination, instruction = "", online = true) {
    if (!this.alive || this.state.saveStatus === "saving") return;
    this.cancel();
    if (
      !online || this.state.intakeError ||
      this.state.sources.some((s) => s.assignment !== "confirmed")
    ) {
      this.update({
        error: !online
          ? "You are offline. Keep editing and retry when connected."
          : "Review, replace, or explicitly exclude every source before generating.",
      });
      return;
    }
    const abort = new AbortController();
    this.generation = abort;
    const request: ComposeRequest = {
      binding: {
        ownerId: this.ownerId,
        patientId: this.patient.id,
        sessionId: this.sessionId,
        requestId: crypto.randomUUID(),
        profileVersion: PROFILE_VERSION,
        mode: this.state.mode,
        sourceVersion: this.sourceVersion,
        draftVersion: this.state.version,
        chartRevision: this.patient.revision ?? 0,
      },
      sources: this.allSources(),
      base: this.state.blocks,
      allowedTargets: target ? [target] : [...DESTINATIONS],
      instruction,
    };
    this.update({ stage: "Reading sources", error: "" });
    try {
      const response = await this.transport.generate(
        request,
        abort.signal,
        (stage) => {
          if (
            this.alive && this.generation === abort && !abort.signal.aborted
          ) this.update({ stage });
        },
      );
      if (!this.alive || abort.signal.aborted || this.generation !== abort) {
        return;
      }
      const checked = parseResponse(response, request);
      this.update({
        proposal: {
          base: request.base,
          response: checked,
          allowed: request.allowedTargets,
        },
        stage: "",
        saveStatus: "unsaved",
      });
    } catch {
      if (this.alive && !abort.signal.aborted && this.generation === abort) {
        this.update({
          stage: "",
          error:
            "Generation failed or could not be verified. Your draft is unchanged. Retry or edit manually.",
        });
      }
    } finally {
      if (this.generation === abort) this.generation = null;
    }
  }
  acceptProposal() {
    const proposal = this.state.proposal;
    if (!proposal) return;
    this.checkpoint();
    const merged = mergeProposal(
      proposal.base,
      this.state.blocks,
      proposal.response.blocks,
      proposal.allowed,
      proposal.response.removals,
    );
    const evidence = { ...this.state.evidence };
    for (const b of proposal.response.blocks) {
      if (!merged.conflicts.includes(b.id)) {
        evidence[b.id] = {
          claims: proposal.response.claims.filter((c) =>
            b.claimIds.includes(c.id)
          ),
          supported: proposal.response.supportedClaimIds,
        };
      }
    }
    this.update({
      blocks: merged.blocks,
      evidence,
      mergeConflicts: merged.conflicts,
      clears: [
        ...new Set([
          ...this.state.clears,
          ...proposal.response.removals.filter((id) =>
            !merged.conflicts.includes(id)
          ),
        ]),
      ],
      proposal: merged.conflicts.length ? proposal : null,
      version: this.state.version + 1,
      saveStatus: "unsaved",
    });
  }
  keepProposal() {
    this.update({ proposal: null, mergeConflicts: [] });
  }
  resolveConflict(id: string, choice: "keep" | "proposal") {
    const p = this.state.proposal;
    if (!p) return;
    this.checkpoint();
    let blocks = this.state.blocks, clears = this.state.clears;
    const evidence = { ...this.state.evidence };
    if (choice === "proposal") {
      const next = p.response.blocks.find((b) => b.id === id);
      blocks = blocks.filter((b) => b.id !== id);
      if (next) {
        blocks = [...blocks, next];
        evidence[id] = {
          claims: p.response.claims.filter((c) => next.claimIds.includes(c.id)),
          supported: p.response.supportedClaimIds,
        };
      } else clears = [...clears, id];
    }
    const remaining = this.state.mergeConflicts.filter((x) => x !== id);
    this.update({
      blocks,
      clears,
      evidence,
      mergeConflicts: remaining,
      proposal: remaining.length ? p : null,
      version: this.state.version + 1,
      saveStatus: "unsaved",
    });
  }
  reviewedText(): string {
    if (this.state.proposal || this.state.mergeConflicts.length) {
      throw new Error("Review the proposed changes first");
    }
    for (
      const b of this.state.blocks.filter((b) => b.provenance === "generated")
    ) {
      const evidence = this.state.evidence[b.id];
      if (!b.reviewed || !evidence) {
        throw new Error("Review the generated text and its sources first");
      }
      if (
        validateGenerated(
          [b],
          evidence.claims,
          this.allSources(),
          this.patient.id,
          evidence.supported,
        ).length
      ) {
        throw new Error(
          "Source support is unavailable. Revise or regenerate this block.",
        );
      }
    }
    const text = serializeBlocks(this.state.blocks);
    const errors = validateFormat(text);
    if (errors.length) throw new Error(errors[0]);
    projectReviewed(
      this.patient,
      this.state.blocks,
      this.state.clears,
      this.state.mode,
      "review",
    );
    return text;
  }
  async apply(online = true): Promise<boolean> {
    if (!this.alive || this.state.saveStatus === "saving") return false;
    if (!online) {
      this.update({
        error: "You are offline. Application waits for connectivity.",
      });
      return false;
    }
    try {
      this.reviewedText();
    } catch (e) {
      this.update({
        error: e instanceof Error ? e.message : "Review the note first",
      });
      return false;
    }
    this.cancel();
    const patch = this.pendingPatch ??
      projectReviewed(
        this.patient,
        this.state.blocks,
        this.state.clears,
        this.state.mode,
        crypto.randomUUID(),
      );
    this.pendingPatch = patch;
    const abort = new AbortController();
    this.saving = abort;
    this.update({ saveStatus: "saving", error: "" });
    try {
      const result = await this.transport.apply(patch, abort.signal);
      if (!this.alive || abort.signal.aborted) return false;
      if (result.conflict) {
        this.update({
          saveStatus: "conflict",
          error:
            "Chart changed on the server. Review the current chart before retrying.",
        });
        return false;
      }
      for (const [field, value] of Object.entries(patch.fields)) {
        if (field.startsWith("systems.")) {
          (this.patient.systems as Record<string, string>)[field.slice(8)] =
            value!;
        } else {this.patient[field as "clinicalSummary" | "intervalEvents"] =
            value!;}
      }
      this.patient.revision = result.revision;
      this.patient.noteFormat = patch.format;
      this.pendingPatch = null;
      this.update({ saveStatus: "saved", clears: [] });
      return true;
    } catch {
      if (this.alive) {
        this.update({
          saveStatus: "unsaved",
          error:
            "Save could not be confirmed. Retry to check the same operation safely.",
        });
      }
      return false;
    } finally {
      this.saving = null;
    }
  }
  undo() {
    if (this.state.saveStatus === "saving") return;
    const previous = this.undoStack.pop();
    if (previous) {
      this.pendingPatch = null;
      this.update({
        ...previous,
        version: this.state.version + 1,
        saveStatus: "unsaved",
      });
    }
  }
  rebaseChart(fresh: Patient) {
    if (fresh.id !== this.patient.id || this.state.saveStatus === "saving") {
      return;
    }
    this.cancel();
    this.checkpoint();
    const base = snapshotBlocks(this.patient), remote = snapshotBlocks(fresh);
    const removals = base.filter((b) => !remote.some((r) => r.id === b.id)).map(
      (b) => b.id,
    );
    const merged = mergeProposal(base, this.state.blocks, remote, [
      ...DESTINATIONS,
    ], removals);
    this.patient = structuredClone(fresh);
    const response: ComposeResponse = {
      binding: {
        ownerId: this.ownerId,
        patientId: fresh.id,
        sessionId: this.sessionId,
        requestId: crypto.randomUUID(),
        profileVersion: PROFILE_VERSION,
        mode: this.state.mode,
        sourceVersion: this.sourceVersion,
        draftVersion: this.state.version,
        chartRevision: fresh.revision ?? 0,
      },
      blocks: remote,
      removals,
      claims: [],
      conflicts: [],
      supportedClaimIds: [],
    };
    this.update({
      blocks: merged.blocks,
      mergeConflicts: merged.conflicts,
      proposal: merged.conflicts.length
        ? { base, response, allowed: [...DESTINATIONS] }
        : null,
      clears: this.state.clears.filter((id) =>
        !merged.blocks.some((b) => b.id === id)
      ),
      saveStatus: "unsaved",
      version: this.state.version + 1,
      error: "",
    });
  }
  destroy() {
    this.cancel();
    this.saving?.abort();
    this.alive = false;
    this.undoStack = [];
    this.pendingPatch = null;
    this.patient = null as unknown as Patient;
    this.state = {
      ...this.state,
      sources: [],
      attending: "",
      blocks: [],
      evidence: {},
      proposal: null,
      error: "",
      intakeError: "",
      clears: [],
      mergeConflicts: [],
    };
    this.listeners.clear();
  }
}
