import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ComposerSession } from "@/lib/note-composer/session";
import {
  type Destination,
  DESTINATIONS,
  LABELS,
  type Mode,
  type NoteBlock,
  serializeBlocks,
  validateFormat,
} from "../../../supabase/functions/_shared/note-composer.ts";
import type { Patient } from "@/types/patient";
import { snapshotBlocks } from "@/lib/note-composer/chart";

interface Props {
  session: ComposerSession;
  generationEnabled: boolean;
  onClose(): void;
  onApplied?(): void;
  onSavePreference?(mode: Mode): Promise<void>;
  onFetchCurrent?(): Promise<Patient>;
  patientChanged?: boolean;
  closeRequest?: number;
}
const label = (id: string) =>
  id === "clinicalSummary"
    ? "Clinical summary"
    : id === "intervalEvents"
    ? "Overnight events"
    : LABELS[id as Destination] ?? id;
function BlockEditor(
  { block, disabled, onChange }: {
    block: NoteBlock;
    disabled: boolean;
    onChange(value: string): void;
  },
) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(88, ref.current.scrollHeight)}px`;
    }
  }, [block.text]);
  return (
    <Textarea
      ref={ref}
      aria-label={label(block.id)}
      value={block.text}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      spellCheck={false}
      className="min-h-[88px] resize-none border-0 bg-transparent px-0 font-mono text-base leading-relaxed shadow-none focus-visible:ring-1"
    />
  );
}
export function NoteComposer(
  {
    session,
    generationEnabled,
    onClose,
    onApplied,
    onSavePreference,
    onFetchCurrent,
    patientChanged,
    closeRequest = 0,
  }: Props,
) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState<
    { source?: string; block?: string } | null
  >(null);
  const [closeReview, setCloseReview] = useState(false);
  const [clear, setClear] = useState<string | null>(null);
  const [target, setTarget] = useState<Destination>("clinicalSummary");
  const [instruction, setInstruction] = useState("");
  const [documentedTime, setDocumentedTime] = useState("");
  const [preference, setPreference] = useState(false);
  const [fresh, setFresh] = useState<Patient | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [extracting, setExtracting] = useState(false);
  const selection = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);
  const lastFocus = useRef<HTMLElement | null>(null);
  const saving = state.saveStatus === "saving";
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        state.saveStatus !== "saved" || state.sources.length > 1 ||
        state.attending || paste
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.saveStatus, state.sources.length, state.attending, paste]);
  useEffect(() => {
    if (patientChanged) {
      session.cancel();
      setCloseReview(true);
    }
  }, [patientChanged, session]);
  useEffect(() => {
    if (closeRequest > 0) setCloseReview(true);
  }, [closeRequest]);
  if (!session.patient) return null;
  const openDrawer = (value: typeof drawer, trigger?: HTMLElement) => {
    lastFocus.current = trigger ?? document.activeElement as HTMLElement;
    setDocumentedTime("");
    setDrawer(value);
  };
  const finish = () => {
    session.destroy();
    onClose();
  };
  const close = () => {
    if (
      state.saveStatus !== "saved" || state.sources.length > 1 ||
      state.attending || paste
    ) setCloseReview(true);
    else finish();
  };
  const apply = async (closeAfter = false) => {
    if (await session.apply(online)) {
      onApplied?.();
      if (closeAfter) finish();
    }
  };
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(session.reviewedText());
      if (alive.current) {
        setNotice("Copied reviewed text. Chart save status is unchanged.");
      }
    } catch (e) {
      if (alive.current) {
        setNotice(
          e instanceof Error &&
            /review|source|ASCII|line|marker|heading|clear|scope/.test(
              e.message,
            )
            ? e.message
            : "Copy failed. Select the plain-text preview and copy manually.",
        );
      }
    }
  };
  const source = state.sources.find((s) => s.id === drawer?.source);
  const evidence = drawer?.block ? state.evidence[drawer.block] : undefined;
  const issues = validateFormat(serializeBlocks(state.blocks));
  const fileChanged = async (file?: File) => {
    if (!file) return;
    setExtracting(true);
    try {
      const { extractPatientListContent } = await import(
        "@/lib/import/extractImportContent"
      );
      const extracted = await extractPatientListContent(file);
      if (!alive.current) return;
      if (extracted.mode !== "text") {
        throw new Error(
          "Images need a verified OCR path. Paste reviewed extracted text instead.",
        );
      }
      const id = session.addSource(extracted.text, file.name);
      openDrawer({ source: id });
    } catch {
      if (alive.current) {
        session.intakeFailed(
          `Could not include "${file.name}". PDF and image OCR are unavailable here. Use text, DOCX, RTF, HTML, JSON, or a spreadsheet, or explicitly exclude the failed source.`,
        );
      }
    } finally {
      if (alive.current) setExtracting(false);
    }
  };
  return (
    <section
      aria-label="Rounding note composer"
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Neuro ICU attending
            </p>
            <h2 className="text-lg font-semibold">
              {session.patient.name || "Active patient"}{" "}
              <span className="font-normal text-muted-foreground">
                / {session.patient.bed || "Bed not assigned"}
              </span>
            </h2>
            {session.patient.mrn && (
              <p className="text-sm">MRN {session.patient.mrn}</p>
            )}
          </div>
          <Button variant="ghost" disabled={saving} onClick={close}>
            Close composer
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void apply()}
            disabled={saving || !online || !!state.proposal}
          >
            Apply reviewed note
          </Button>
          <Button
            variant="outline"
            onClick={() => void doCopy()}
            disabled={saving}
          >
            Copy reviewed note
          </Button>
          <Button
            variant="ghost"
            onClick={() => session.undo()}
            disabled={saving}
          >
            Undo
          </Button>
          <span role="status" className="text-sm font-medium">
            {state.saveStatus === "saved"
              ? "Saved to chart"
              : state.saveStatus === "saving"
              ? "Saving..."
              : state.saveStatus === "conflict"
              ? "Chart conflict - not saved"
              : "Unsaved"}
          </span>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          <aside className="space-y-5">
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Sources and drafts stay temporary. A reload or crash loses unsaved
              work. Apply reviewed content to keep it in the chart.
            </p>
            <section className="space-y-3" aria-label="Source intake">
              <h3 className="font-semibold">1. Add sources</h3>
              <Textarea
                aria-label="Paste source text"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                disabled={saving}
                placeholder="Paste a record, handoff, or update"
                className="min-h-24 text-base"
              />
              <Button
                variant="outline"
                disabled={!paste.trim() || saving}
                onClick={() => {
                  try {
                    const id = session.addSource(paste, "Pasted source");
                    setPaste("");
                    openDrawer({ source: id });
                  } catch {
                    session.intakeFailed(
                      "Source limit exceeded. Use a smaller patient-specific selection or exclude this source.",
                    );
                  }
                }}
              >
                Add pasted source
              </Button>
              <label className="block text-sm font-medium">
                Add a source file<input
                  type="file"
                  aria-label="Add a source file"
                  className="mt-2 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:bg-muted file:px-3"
                  disabled={saving || extracting}
                  onChange={(e) => {
                    void fileChanged(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {extracting && <p role="status">Reading file...</p>}
              {state.sources.map((s) => (
                <div key={s.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-h-11 min-w-0 break-all text-left font-medium underline-offset-4 hover:underline"
                      onClick={(e) =>
                        openDrawer({ source: s.id }, e.currentTarget)}
                    >
                      {s.type === "chart"
                        ? "Existing chart snapshot"
                        : s.label || "Source"}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        session.removeSource(s.id)}
                      aria-label={`Remove ${s.label || "chart source"}`}
                    >
                      Remove
                    </Button>
                  </div>
                  <p
                    className={s.assignment === "confirmed"
                      ? "text-muted-foreground"
                      : "font-medium text-amber-700 dark:text-amber-300"}
                  >
                    {s.assignment === "confirmed"
                      ? "Assigned to this patient"
                      : "Needs patient selection"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.documentedTime
                      ? `Documented: ${s.documentedTime}`
                      : "Clinical time: undated"} · Imported{" "}
                    {new Date(s.importedAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              {state.intakeError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive p-3 text-sm"
                >
                  {state.intakeError}
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => session.excludeFailure()}
                  >
                    Exclude failed source
                  </Button>
                </div>
              )}
            </section>
            <section className="space-y-3">
              <label htmlFor="attending-input" className="font-semibold">
                2. Today's assessment and plan
              </label>
              <Textarea
                aria-label="Today's assessment and plan"
                id="attending-input"
                value={state.attending}
                disabled={saving}
                onChange={(e) => session.setAttending(e.target.value)}
                placeholder="Your interpretation, decisions, corrections, and contingencies"
                className="min-h-40 text-base"
              />
              <p className="text-xs text-muted-foreground">
                Review your input before generating. Dictation is unavailable
                until a service with verified temporary retention is configured.
              </p>
            </section>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                Writing mode<select
                  aria-label="Writing mode"
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-base"
                  value={state.mode}
                  disabled={saving}
                  onChange={(e) => session.setMode(e.target.value as Mode)}
                >
                  <option value="standard">Standard</option>
                  <option value="concise">Concise</option>
                </select>
              </label>
              {onSavePreference && (
                <Button
                  variant="ghost"
                  onClick={() => setPreference(true)}
                >
                  Use this for future notes
                </Button>
              )}
              <Button
                className="min-h-11 w-full"
                disabled={!generationEnabled || !online || saving ||
                  extracting || !!state.stage || patientChanged}
                onClick={() => void session.generate(undefined, "", online)}
              >
                Generate draft
              </Button>
              {state.stage && (
                <div role="status" className="text-sm">
                  {state.stage}
                  <Button variant="ghost" onClick={() => session.cancel()}>
                    Cancel generation
                  </Button>
                </div>
              )}
              {!generationEnabled && (
                <p className="text-sm text-muted-foreground">
                  Generation is unavailable until provider access and
                  temporary-source retention are verified. You can edit and
                  review the note now.
                </p>
              )}
              {!online && (
                <p role="status">
                  Offline. Keep editing here; generation and saving wait for
                  connectivity.
                </p>
              )}
            </div>
          </aside>
          <main className="min-w-0 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">
                3. Review the complete note
              </h3>
              <p className="text-sm text-muted-foreground">
                Edit directly. New records produce proposed changes; your words
                remain protected.
              </p>
            </div>
            {(state.error || notice) && (
              <p role="alert" className="rounded-lg border p-3 text-sm">
                {state.error || notice}
              </p>
            )}
            {state.saveStatus === "conflict" && onFetchCurrent && (
              <div className="rounded-lg border border-amber-500 p-4">
                <p>
                  Review the server chart alongside your local draft. No fields
                  were applied.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    void onFetchCurrent().then(setFresh).catch(() =>
                      setNotice(
                        "Current chart could not be loaded. Retry when connected.",
                      )
                    );
                  }}
                >
                  Load current chart for conflict review
                </Button>
                {fresh && (
                  <>
                    <pre className="my-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm">{serializeBlocks(snapshotBlocks(fresh))}</pre>
                    <Button
                      variant="outline"
                      onClick={() => {
                        session.rebaseChart(fresh);
                        setFresh(null);
                      }}
                    >
                      Merge current chart for review
                    </Button>
                    <p className="text-sm">
                      Merge this revision into the local draft, then resolve any
                      overlapping edits before applying.
                    </p>
                  </>
                )}
              </div>
            )}
            {state.proposal && (
              <section
                aria-label="Proposed changes"
                className="rounded-xl border border-emerald-600/40 bg-emerald-50/30 p-4 dark:bg-emerald-950/20"
              >
                <h4 className="font-semibold">Proposed changes</h4>
                {state.proposal.response.blocks.filter((b) =>
                  b.text !==
                    state.proposal!.base.find((old) => old.id === b.id)?.text
                ).map((b) => (
                  <details
                    key={b.id}
                    className="my-3 rounded-md border bg-background p-3"
                    open
                  >
                    <summary className="min-h-11 cursor-pointer font-medium">
                      {label(b.id)} ·{" "}
                      {state.proposal!.base.some((old) => old.id === b.id)
                        ? "Changed"
                        : "Added"}
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current working text
                    </p>
                    <pre className="whitespace-pre-wrap text-sm">{state.blocks.find(old => old.id === b.id)?.text || '(Empty)'}</pre>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Proposed text
                    </p>
                    <pre className="whitespace-pre-wrap text-sm">{b.text}</pre>
                  </details>
                ))}
                {state.proposal.response.removals.map((id) => (
                  <p key={id} className="my-2 text-sm">
                    Proposed clear: {label(id)}. Existing text:{" "}
                    {state.blocks.find((b) =>
                      b.id === id
                    )?.text}
                  </p>
                ))}
                {state.proposal.response.conflicts.length > 0 && (
                  <p className="text-sm">
                    Sources contain clinical discrepancies. Review the
                    uncertainty and supporting alternatives in the source
                    details before acceptance.
                  </p>
                )}
                {!state.mergeConflicts.length && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => session.acceptProposal()}>
                      Accept proposed changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => session.keepProposal()}
                    >
                      Keep existing note
                    </Button>
                  </div>
                )}
                {state.mergeConflicts.map((id) => (
                  <div
                    key={id}
                    role="group"
                    aria-label={`${label(id)} edit conflict`}
                    className="mt-3 border-t pt-3"
                  >
                    <p>Both you and the proposal changed {label(id)}.</p>
                    <Button
                      variant="outline"
                      onClick={() => session.resolveConflict(id, "keep")}
                    >
                      Keep my {label(id)}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => session.resolveConflict(id, "proposal")}
                    >
                      Use proposed {label(id)}
                    </Button>
                  </div>
                ))}
              </section>
            )}
            <div
              className="rounded-xl border bg-background px-4 py-2 shadow-sm sm:px-6"
              aria-label="Complete editable note"
            >
              {DESTINATIONS.filter((id) =>
                state.blocks.some((b) => b.id === id)
              ).map((id) => {
                const b = state.blocks.find((b) => b.id === id)!;
                return (
                  <section key={id} className="border-b py-4 last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">{label(id)}</h4>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) =>
                            openDrawer({ block: id }, e.currentTarget)}
                        >
                          Sources for {label(id)}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => setClear(id)}
                          aria-label={`Clear ${label(id)}`}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <BlockEditor
                      block={b}
                      disabled={saving}
                      onChange={(text) => session.edit(id, text)}
                    />
                    {b.provenance === "generated"
                      ? (
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!b.reviewed}
                            onChange={(e) =>
                              session.review(id, e.target.checked)}
                          />I reviewed this text against the sources, including
                          any uncertainty
                        </label>
                      )
                      : (
                        <p className="text-xs text-muted-foreground">
                          {b.provenance === "clinician"
                            ? "Clinician-authored text; source verification does not apply to your edits."
                            : "Saved chart content. Original source inspection is unavailable."}
                        </p>
                      )}
                  </section>
                );
              })}
              {!state.blocks.length && (
                <p className="py-6 text-muted-foreground">
                  Add a section to begin writing, or add sources and generate a
                  draft.
                </p>
              )}
            </div>
            <label className="block text-sm">
              Add a note section<select
                aria-label="Add a note section"
                className="ml-2 min-h-11 max-w-full rounded-md border bg-background px-3"
                value="choose"
                disabled={saving}
                onChange={(e) => {
                  if (e.target.value !== "choose") {
                    session.edit(
                      e.target.value as Destination,
                      "",
                    );
                  }
                }}
              >
                <option value="choose">Choose section</option>
                {DESTINATIONS.filter((id) =>
                  !state.blocks.some((b) => b.id === id)
                ).map((id) => <option key={id} value={id}>{label(id)}</option>)}
              </select>
            </label>
            {issues.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Before applying or copying</p>
                {issues.map((issue) => <p key={issue}>{issue}</p>)}
              </div>
            )}
            <details className="rounded-lg border p-3">
              <summary className="min-h-11 cursor-pointer font-medium">
                Focused revision
              </summary>
              <label className="block text-sm">
                Target section<select
                  aria-label="Revision target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as Destination)}
                  className="my-2 min-h-11 w-full rounded-md border bg-background px-3"
                >
                  {DESTINATIONS.map((id) => (
                    <option key={id} value={id}>{label(id)}</option>
                  ))}
                </select>
              </label>
              <Textarea
                aria-label="Revision request"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Shorten the summary, or keep the exact taper"
              />
              <Button
                className="mt-3"
                disabled={!generationEnabled || !instruction.trim() || saving ||
                  !!state.stage || !online}
                onClick={() =>
                  void session.generate(target, instruction, online)}
              >
                Propose focused revision
              </Button>
            </details>
            <details className="rounded-lg border p-3">
              <summary className="min-h-11 cursor-pointer font-medium">
                Plain-text preview
              </summary>
              <pre
                className="select-text whitespace-pre-wrap break-words font-mono text-sm"
                data-testid="composer-plain-text"
              >{serializeBlocks(state.blocks)}</pre>
            </details>
          </main>
        </div>
      </div>
      <Dialog
        open={!!drawer}
        onOpenChange={(open) => {
          if (!open) setDrawer(null);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] max-w-3xl overflow-y-auto"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            lastFocus.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {source
                ? "Review source and patient assignment"
                : "Statement sources"}
            </DialogTitle>
            <DialogDescription>
              Temporary source text for{" "}
              {session.patient.name || "the active patient"}. Import time is not
              clinical time.
            </DialogDescription>
          </DialogHeader>
          {source
            ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Select only the portion belonging to this patient. For a
                  single-patient record, explicitly select all of its text.
                </p>
                <Textarea
                  ref={selection}
                  aria-label="Original source text"
                  readOnly
                  value={source.text}
                  className="min-h-64 font-mono text-sm"
                />
                {source.assignment === "quarantined" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        selection.current?.focus();
                        selection.current?.select();
                      }}
                    >
                      Select all text
                    </Button>
                    <label className="block text-sm">
                      Documented document time, if present<input
                        type="datetime-local"
                        aria-label="Documented document time"
                        value={documentedTime}
                        onChange={(e) => setDocumentedTime(e.target.value)}
                        className="block min-h-11 rounded-md border bg-background px-3"
                      />
                    </label>
                    <Button
                      onClick={() => {
                        try {
                          session.selectSource(
                            source.id,
                            selection.current?.selectionStart ?? 0,
                            selection.current?.selectionEnd ?? 0,
                            documentedTime || undefined,
                          );
                          setDrawer(null);
                        } catch {
                          setNotice(
                            "Select an exact patient-specific excerpt before including the source.",
                          );
                        }
                      }}
                    >
                      Use selected text for this patient
                    </Button>
                  </>
                )}
              </div>
            )
            : evidence
            ? (
              <div className="space-y-4">
                {evidence.claims.map((c) => (
                  <section key={c.id} className="rounded-md border p-3">
                    <p className="font-medium">{c.text}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.state} · {c.time || "Undated"} ({c.timeKind}){" "}
                      {c.uncertainty}
                    </p>
                    {c.spans.map((span, i) => {
                      const s = [...state.sources, {
                        id: "attending",
                        text: state.attending,
                      }].find((s) =>
                        s.id === span.sourceId
                      );
                      return (
                        <pre
                          key={i}
                          className="mt-2 whitespace-pre-wrap text-sm"
                        >{s ? s.text.slice(span.start, span.end) : 'Source inspection unavailable'}</pre>
                      );
                    })}
                  </section>
                ))}
              </div>
            )
            : (
              <p>
                Source inspection unavailable for saved or clinician-edited
                content. No evidence links are reconstructed.
              </p>
            )}
        </DialogContent>
      </Dialog>
      <Dialog open={closeReview} onOpenChange={setCloseReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {patientChanged ? "Patient changed" : "Keep your reviewed work?"}
            </DialogTitle>
            <DialogDescription>
              Apply the reviewed note to this patient's chart, or discard
              temporary sources and unsaved work.
            </DialogDescription>
          </DialogHeader>
          <Button disabled={saving || !online} onClick={() => void apply(true)}>
            Apply reviewed note and close
          </Button>
          <Button variant="destructive" disabled={saving} onClick={finish}>
            Discard temporary work
          </Button>
          <Button variant="outline" onClick={() => setCloseReview(false)}>
            Continue reviewing
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!clear}
        onOpenChange={(open) => {
          if (!open) setClear(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear {clear ? label(clear) : "section"}?</DialogTitle>
            <DialogDescription>
              This explicitly removes the text from the reviewed note. The chart
              changes only when you apply. Attachments remain in the chart.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-sm">{state.blocks.find(b => b.id === clear)?.text}</pre>
          <Button
            variant="destructive"
            onClick={() => {
              session.clearField(clear!);
              setClear(null);
            }}
          >
            Accept field clear
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={preference} onOpenChange={setPreference}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use this for future notes</DialogTitle>
            <DialogDescription>
              Save only this abstract rule: default to{" "}
              {state.mode === "concise" ? "Concise" : "Standard"}{" "}
              mode for new notes. No patient text or edits are saved as
              preferences.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              void onSavePreference?.(state.mode).then(() => {
                setNotice("Style preference saved.");
                setPreference(false);
              }).catch(() => setNotice("Style preference was not saved."));
            }}
          >
            Save style preference
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              session.setMode("standard");
              void onSavePreference?.("standard").then(() => {
                setPreference(false);
                setNotice("Reset to versioned Standard profile.");
              }).catch(() => setNotice("Reset could not be saved."));
            }}
          >
            Reset to versioned profile
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
