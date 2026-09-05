import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePatients } from "@/hooks/usePatients";
import { useCloudAutotexts } from "@/hooks/useAutotexts";
import { useCloudDictionary } from "@/hooks/useCloudDictionary";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAllPatientTodos } from "@/hooks/useAllPatientTodos";
import { usePatientFilter } from "@/hooks/usePatientFilter";
import { useSettings } from "@/contexts/SettingsContext";
import { useIBCCState } from "@/contexts/IBCCContext";
import { ChangeTrackingProvider } from "@/contexts/ChangeTrackingContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { DashboardTodosProvider } from "@/contexts/DashboardTodosContext";
import {
  useSetActivePatientId,
  useSetCurrentPatients,
} from "@/contexts/CurrentPatientsContext";
import { RoundSessionProvider } from "@/contexts/RoundSessionContext";
import { isRoundRunnerEnabled } from "@/lib/round/isRoundRunnerEnabled";
import { PatientListSkeleton } from "@/components/PatientCardSkeleton";
import type { MobileTab } from "@/components/layout";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type { Patient } from "@/types/patient";
import { EdgeHealthProvider } from "@/contexts/EdgeHealthContext";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";
import { PatientRosterStatusBanner } from "@/components/PatientRosterStatusBanner";
import {
  NewPatientSheet,
  type NewPatientSubmitPayload,
} from "@/components/dashboard/NewPatientSheet";
import { syncEngine } from "@/lib/offline/syncEngine";
import { useDashboardLayout } from "@/context/DashboardLayoutContext";
import type { PatientSaveState } from "@/hooks/patients/usePatientMutations";
import type { CaptureState } from "@/lib/decision-scribe/captureController";
import { runDecisionScribePipeline } from "@/lib/decision-scribe/clientPipeline";
import type {
  CaptureBinding,
  DecisionCandidate,
  DecisionDraft,
} from "@/types/decisionScribe";
import type { ComposedDraft } from "@/lib/decision-scribe/draftComposer";
import {
  attest,
  undoDecisionOperation,
  retryDecisionScribeOutbox,
  type AttestationCommitOutcome,
} from "@/lib/decision-scribe/attestationController";
import { decisionScribeOutbox } from "@/lib/decision-scribe/decisionScribeOutbox";
import { usePatientTodos } from "@/hooks/usePatientTodos";
import { ConflictReview } from "@/components/decision-scribe/ConflictReview";
import type { DecisionScribeOutboxEntry } from "@/lib/decision-scribe/decisionScribeOutbox";
import { indexedDBQueue } from "@/lib/offline/indexedDBQueue";
import { mapDecisionCandidate } from "@/lib/decision-scribe/decisionMutationMapping";

const DesktopDashboard = React.lazy(() =>
  import("@/components/dashboard/DesktopDashboard").then((module) => ({
    default: module.DesktopDashboard,
  })),
);
const MobileDashboard = React.lazy(() =>
  import("@/components/dashboard/MobileDashboard").then((module) => ({
    default: module.MobileDashboard,
  })),
);
const DesktopRoundShell = React.lazy(() =>
  import("@/components/round/DesktopRoundShell").then((module) => ({
    default: module.DesktopRoundShell,
  })),
);
const MobileRoundShell = React.lazy(() =>
  import("@/components/round/MobileRoundShell").then((module) => ({
    default: module.MobileRoundShell,
  })),
);

function WorkspaceShellLoading(): React.ReactElement {
  return (
    <div
      className="min-h-screen bg-background p-4 md:p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 h-11 w-full rounded-xl border border-border/15 bg-card animate-pulse" />
        <PatientListSkeleton count={3} />
        <p className="sr-only">Loading workspace. Preparing your rounds.</p>
      </div>
    </div>
  );
}

// Inner component that uses all contexts
function IndexContent(): React.ReactElement | null {
  useNetworkStatus();
  const isMobile = useIsMobile();
  const { setCurrentPatient } = useIBCCState();
  const { user, loading: authLoading, signOut } = useAuth();
  React.useEffect(() => {
    decisionScribeOutbox.setOwner(user?.id ?? null);
  }, [user?.id]);
  const { sortBy } = useSettings();
  const {
    patients,
    loading: patientsLoading,
    patientVerification,
    addPatientWithData,
    updatePatient,
    removePatient,
    duplicatePatient,
    toggleCollapse,
    collapseAll,
    clearAll,
    importPatients,
    refetch: refetchPatients,
    patientSaveStates,
  } = usePatients();
  const {
    autotexts,
    templates,
    addAutotext,
    removeAutotext,
    addTemplate,
    removeTemplate,
  } = useCloudAutotexts();
  const { customDictionary, importDictionary } = useCloudDictionary();
  const setCurrentPatients = useSetCurrentPatients();
  const setActivePatientId = useSetActivePatientId();
  const { patientListViewMode, setPatientListViewMode } = useDashboardLayout();

  // Sync dashboard patients to shared context so UnifiedAIChatbot (and others) use the same source
  React.useEffect(() => {
    setCurrentPatients(patients);
    return () => setCurrentPatients([]);
  }, [patients, setCurrentPatients]);

  // Fetch todos for all patients for print/export
  const patientIds = React.useMemo(() => patients.map((p) => p.id), [patients]);
  const { todosMap, verification: todosVerification } =
    useAllPatientTodos(patientIds);

  // Patient filtering and sorting
  const { searchQuery, setSearchQuery, filter, setFilter, filteredPatients } =
    usePatientFilter({
      patients,
      sortBy,
      currentUserId: user?.id,
    });

  const [lastSaved, setLastSaved] = React.useState<Date>(new Date());
  const [newPatientSheetOpen, setNewPatientSheetOpen] = React.useState(false);
  const [desktopSelectedPatientId, setDesktopSelectedPatientId] =
    React.useState<string | null>(null);
  const [decisionScribeNotice, setDecisionScribeNotice] = React.useState<
    string | null
  >(null);
  const [lastDecisionScribeEntryId, setLastDecisionScribeEntryId] =
    React.useState<string | null>(null);
  const [decisionScribeConflicts, setDecisionScribeConflicts] = React.useState<
    DecisionScribeOutboxEntry[]
  >([]);
  React.useEffect(() => {
    if (!user?.id) {
      setDecisionScribeConflicts([]);
      return;
    }
    const refresh = async () => {
      try {
        setDecisionScribeConflicts(
          (await decisionScribeOutbox.list(user.id)).filter(
            (entry) => entry.status === "conflict" && entry.conflict,
          ),
        );
      } catch {
        setDecisionScribeNotice(
          "Decision Scribe outbox is unavailable. Approved changes remain blocked until it can be read safely.",
        );
      }
    };
    void refresh();
    const unsubscribe = decisionScribeOutbox.subscribe(
      (entries) => {
        setDecisionScribeConflicts(
          entries.filter(
            (entry) => entry.status === "conflict" && entry.conflict,
          ),
        );
      },
      () => {
        setDecisionScribeNotice(
          "Decision Scribe outbox is unavailable. Approved changes remain blocked until it can be read safely.",
        );
      },
    );
    return () => {
      unsubscribe();
    };
  }, [user?.id]);
  const [decisionDraft, setDecisionDraft] =
    React.useState<ComposedDraft | null>(null);
  const handleDecisionCaptureStopped = React.useCallback(
    (state: CaptureState) => {
      if (state.lifecycle === "review") {
        setDecisionScribeNotice(
          "Capture stopped. Review is unavailable until a validated decision draft is prepared.",
        );
      } else if (state.reason) {
        setDecisionScribeNotice(
          `Decision Scribe stopped safely: ${state.reason}`,
        );
      }
    },
    [],
  );
  const handleDecisionCaptureAudio = React.useCallback(
    async (
      _state: CaptureState,
      audio: Blob | undefined,
      _mime: string | undefined,
      binding: CaptureBinding,
      patient: Patient,
    ) => {
      if (!audio) {
        setDecisionScribeNotice(
          "Capture stopped without audio. No review was created.",
        );
        return;
      }
      setDecisionScribeNotice("Preparing a provisional decision review…");
      try {
        const result = await runDecisionScribePipeline(audio, binding, {
          patientId: patient.id,
          snapshotId: binding.patientSnapshotId,
          capturedAt: binding.patientSnapshotCapturedAt,
          clinicalSummary: patient.clinicalSummary,
          systems: { ...patient.systems },
        });
        const draft = result.draft as ComposedDraft;
        setDecisionDraft({
          ...draft,
          candidates: draft.candidates.map((candidate) =>
            candidate.destination === "medications" && !candidate.currentValue
              ? {
                  ...candidate,
                  currentValue: JSON.stringify(patient.medications),
                }
              : candidate,
          ),
        });
        setDecisionScribeNotice(null);
      } catch {
        setDecisionDraft(null);
        setDecisionScribeNotice(
          "Decision review could not be prepared. No changes were saved.",
        );
      }
    },
    [],
  );

  // Mobile-specific state
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("patients");
  const [selectedPatientState, setSelectedPatientState] = React.useState<{
    ownerId: string;
    patient: Patient;
  } | null>(null);
  const selectedPatient =
    selectedPatientState && selectedPatientState.ownerId === user?.id
      ? selectedPatientState.patient
      : null;
  const setSelectedPatient = React.useCallback(
    (patient: Patient | null) => {
      setSelectedPatientState(
        patient && user ? { ownerId: user.id, patient } : null,
      );
    },
    [user],
  );
  React.useEffect(() => {
    const activePatientId = isMobile
      ? selectedPatient?.id
      : desktopSelectedPatientId;
    if (
      decisionDraft &&
      activePatientId &&
      decisionDraft.binding.patientId !== activePatientId
    ) {
      setDecisionDraft(null);
      setDecisionScribeNotice(
        "Patient changed. The provisional review was discarded safely.",
      );
    }
  }, [decisionDraft, desktopSelectedPatientId, isMobile, selectedPatient?.id]);

  React.useEffect(() => {
    setSelectedPatientState(null);
  }, [user?.id]);

  React.useEffect(() => {
    if (isMobile !== false) return;
    if (filteredPatients.length === 0) {
      setDesktopSelectedPatientId(null);
      return;
    }
    setDesktopSelectedPatientId((prev) => {
      if (prev && filteredPatients.some((p) => p.id === prev)) return prev;
      return filteredPatients[0]?.id ?? null;
    });
  }, [isMobile, filteredPatients]);

  const navigate = useNavigate();

  // Update last saved time when patients change
  React.useEffect(() => {
    if (patients.length > 0) {
      setLastSaved(new Date());
    }
  }, [patients]);

  // IBCC context: mobile uses selected patient; desktop uses two-pane selection
  const currentPatient = React.useMemo(() => {
    if (isMobile === undefined) return undefined;
    if (isMobile && selectedPatient) return selectedPatient;
    if (!isMobile && filteredPatients.length > 0) {
      const picked = desktopSelectedPatientId
        ? filteredPatients.find((p) => p.id === desktopSelectedPatientId)
        : undefined;
      return picked ?? filteredPatients[0];
    }
    return undefined;
  }, [filteredPatients, isMobile, selectedPatient, desktopSelectedPatientId]);

  const decisionTodos = usePatientTodos(currentPatient?.id ?? null, {
    initialTodos: currentPatient
      ? (todosMap[currentPatient.id] ?? [])
      : undefined,
  });
  const commitDecisionCandidateRef = React.useRef<
    | ((
        candidate: DecisionCandidate,
        attestation: import("@/types/decisionScribe").Attestation,
        operationId?: string,
      ) => Promise<AttestationCommitOutcome>)
    | null
  >(null);

  // Update IBCC context with current patient for context-aware suggestions
  React.useEffect(() => {
    setCurrentPatient(currentPatient);
    setActivePatientId(currentPatient?.id ?? null);
    return () => setActivePatientId(null);
  }, [currentPatient, setCurrentPatient, setActivePatientId]);

  const handleUpdatePatient = React.useCallback(
    (id: string, field: string, value: unknown) =>
      updatePatient(id, field, value),
    [updatePatient],
  );

  const commitDecisionCandidate = React.useCallback(
    async (
      candidate: DecisionCandidate,
      attestation: import("@/types/decisionScribe").Attestation,
      operationId?: string,
    ): Promise<AttestationCommitOutcome> => {
      if (
        !user ||
        !currentPatient ||
        currentPatient.id !== attestation.patientId ||
        user.id !== attestation.physicianId
      )
        throw new Error("Decision Scribe owner or patient changed");
      if (candidate.destination === "todo") {
        const mutation = mapDecisionCandidate(
          candidate,
          currentPatient,
          operationId ?? candidate.id,
        );
        if (mutation.kind !== "todo")
          throw new Error("Decision mapping produced an invalid todo mutation");
        if (candidate.changeType === "remove") {
          await decisionTodos.deleteTodo(mutation.content);
        } else {
          await decisionTodos.addTodo(
            mutation.content,
            null,
            mutation.id.replace("decision-", ""),
          );
        }
      } else {
        const mutation = mapDecisionCandidate(
          candidate,
          currentPatient,
          operationId ?? candidate.id,
        );
        if (mutation.kind !== "patient")
          throw new Error(
            "Decision mapping produced an invalid patient mutation",
          );
        await updatePatient(
          currentPatient.id,
          mutation.field,
          mutation.value,
          operationId,
        );
      }
      if (operationId) {
        const queued = (await indexedDBQueue.getQueue()).find(
          (mutation) =>
            mutation.ownerId === user.id &&
            mutation.operationId === operationId,
        );
        if (queued?.status === "pending") return "queued";
        if (queued?.conflictData) {
          const server = queued.conflictData.serverData as Record<
            string,
            unknown
          > | null;
          const serverValue =
            candidate.destination === "systems" &&
            server &&
            typeof server.systems === "object" &&
            server.systems !== null
              ? (server.systems as Record<string, unknown>)[
                  candidate.changeType ?? "notes"
                ]
              : candidate.destination === "clinicalSummary"
                ? server?.clinical_summary
                : server?.[candidate.destination];
          return {
            status: "conflict",
            conflict: {
              mine: candidate.proposedContent,
              theirs: typeof serverValue === "string" ? serverValue : undefined,
            },
          };
        }
      }
      return "committed";
    },
    [currentPatient, decisionTodos, updatePatient, user],
  );
  commitDecisionCandidateRef.current = commitDecisionCandidate;
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const drain = () => {
      if (!cancelled && commitDecisionCandidateRef.current)
        void retryDecisionScribeOutbox(user.id, (operation) =>
          commitDecisionCandidateRef.current!(
            operation.candidate as DecisionCandidate,
            operation.attestation,
            operation.operationId,
          ),
        ).catch(() => {
          setDecisionScribeNotice(
            "Decision Scribe outbox is unavailable. Approved changes remain blocked until it can be read safely.",
          );
        });
    };
    drain();
    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", drain);
    return () => {
      cancelled = true;
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", drain);
    };
  }, [user?.id]);

  const handleDecisionAttest = React.useCallback(
    async (candidates: DecisionCandidate[]) => {
      if (!user || !currentPatient || !decisionDraft) return;
      decisionScribeOutbox.setOwner(user.id);
      try {
        const result = await attest(
          {
            ownerId: user.id,
            physicianId: user.id,
            draft: { ...decisionDraft, candidates },
            binding: decisionDraft.binding,
            patientSnapshotId: decisionDraft.binding.patientSnapshotId,
            approvedCandidateIds: candidates.map((candidate) => candidate.id),
            approvedCandidates: candidates,
          },
          { commit: commitDecisionCandidate },
        );
        setDecisionDraft((draft) =>
          result.status === "committed"
            ? null
            : draft
              ? { ...draft, status: "review" }
              : draft,
        );
        setDecisionScribeNotice(
          result.status === "committed"
            ? "Approved changes saved."
            : result.status === "conflict"
              ? "Approved changes need conflict resolution."
              : "Approved changes queued for sync.",
        );
        if (result.status === "committed" || result.status === "queued") {
          const firstCandidateId = result.candidateIds[0];
          setLastDecisionScribeEntryId(
            firstCandidateId
              ? `decision-${result.attestation.draftId}-${firstCandidateId}-${result.attestation.patientId}`
              : null,
          );
        }
      } catch (error) {
        setDecisionScribeNotice(
          error instanceof Error
            ? error.message
            : "Attestation failed. No changes were saved.",
        );
      }
    },
    [commitDecisionCandidate, currentPatient, decisionDraft, user],
  );

  const handleRemovePatient = React.useCallback(
    (id: string) => removePatient(id),
    [removePatient],
  );

  const handleDuplicatePatient = React.useCallback(
    (id: string) => duplicatePatient(id),
    [duplicatePatient],
  );

  const handleToggleCollapse = React.useCallback(
    (id: string) => toggleCollapse(id),
    [toggleCollapse],
  );

  const handleAddPatient = React.useCallback(() => {
    setNewPatientSheetOpen(true);
  }, []);

  const handleNewPatientSubmit = React.useCallback(
    async (data: NewPatientSubmitPayload) => {
      await addPatientWithData(data);
    },
    [addPatientWithData],
  );

  const handleRefetchPatients = React.useCallback(async () => {
    try {
      await syncEngine.sync();
    } catch (e) {
      console.error("[Sync] Offline queue sync failed:", e);
    }
    await refetchPatients({ force: true });
  }, [refetchPatients]);

  const handleSignOut = React.useCallback(async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }, [navigate, signOut]);

  // Build dashboard context value (todosMap is in DashboardTodosContext to reduce re-renders)
  const dashboardContextValue = React.useMemo(
    () => ({
      user,
      patients,
      filteredPatients,
      searchQuery,
      setSearchQuery,
      filter,
      setFilter,
      autotexts,
      templates,
      customDictionary,
      onAddPatient: handleAddPatient,
      onAddPatientWithData: addPatientWithData,
      onUpdatePatient: handleUpdatePatient,
      onRemovePatient: handleRemovePatient,
      onDuplicatePatient: handleDuplicatePatient,
      onToggleCollapse: handleToggleCollapse,
      onCollapseAll: collapseAll,
      onClearAll: clearAll,
      onImportPatients: importPatients,
      onRefetchPatients: handleRefetchPatients,
      desktopSelectedPatientId,
      setDesktopSelectedPatientId,
      onAddAutotext: addAutotext,
      onRemoveAutotext: removeAutotext,
      onAddTemplate: addTemplate,
      onRemoveTemplate: removeTemplate,
      onImportDictionary: importDictionary,
      onSignOut: handleSignOut,
      onPatientSelect: setSelectedPatient,
      selectedPatient,
      mobileTab,
      setMobileTab,
      lastSaved,
      patientListViewMode,
      setPatientListViewMode,
      patientSaveStates,
      patientVerification,
    }),
    [
      user,
      patients,
      filteredPatients,
      searchQuery,
      setSearchQuery,
      filter,
      setFilter,
      autotexts,
      templates,
      customDictionary,
      handleAddPatient,
      addPatientWithData,
      handleUpdatePatient,
      handleRemovePatient,
      handleDuplicatePatient,
      handleToggleCollapse,
      collapseAll,
      clearAll,
      importPatients,
      handleRefetchPatients,
      desktopSelectedPatientId,
      setDesktopSelectedPatientId,
      addAutotext,
      removeAutotext,
      addTemplate,
      removeTemplate,
      importDictionary,
      handleSignOut,
      setSelectedPatient,
      selectedPatient,
      mobileTab,
      setMobileTab,
      lastSaved,
      patientListViewMode,
      setPatientListViewMode,
      patientSaveStates,
      patientVerification,
    ],
  );

  if (
    authLoading ||
    patientsLoading ||
    patientVerification === "loading" ||
    isMobile === undefined ||
    (patientIds.length > 0 && todosVerification === "loading")
  ) {
    return (
      <div
        className="min-h-screen bg-background"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {/* Header skeleton */}
        <div className="border-b border-border/15 bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-28 rounded-xl bg-muted animate-pulse" />
              <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
            </div>
          </div>
        </div>
        {/* Content skeleton */}
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
          <div className="mb-5 h-11 w-full rounded-xl border border-border/15 bg-card animate-pulse" />
          <div className="mb-6 flex gap-2">
            <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          </div>
          <PatientListSkeleton count={3} />
          <p className="sr-only">Loading workspace. Preparing your rounds.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const dataVerificationBlocked =
    patientVerification === "stale" || todosVerification === "stale";

  const dashboard = isMobile ? (
    <DashboardProvider {...dashboardContextValue}>
      <DashboardTodosProvider
        todosMap={todosMap}
        verification={todosVerification}
      >
        <MobileShellGate
          userId={user.id}
          patientIds={patientIds}
          patientSaveStates={patientSaveStates}
          dataVerificationBlocked={dataVerificationBlocked}
          onCaptureStopped={handleDecisionCaptureStopped}
          onCaptureAudio={handleDecisionCaptureAudio}
          decisionDraft={decisionDraft}
          onDecisionDraftChange={(candidates: DecisionCandidate[]) =>
            setDecisionDraft((draft) =>
              draft ? { ...draft, candidates } : draft,
            )
          }
          onDecisionAttest={handleDecisionAttest}
        />
      </DashboardTodosProvider>
    </DashboardProvider>
  ) : (
    <DashboardProvider {...dashboardContextValue}>
      <DashboardTodosProvider
        todosMap={todosMap}
        verification={todosVerification}
      >
        <DesktopShellGate
          userId={user.id}
          patientIds={patientIds}
          patientSaveStates={patientSaveStates}
          dataVerificationBlocked={dataVerificationBlocked}
          onCaptureStopped={handleDecisionCaptureStopped}
          onCaptureAudio={handleDecisionCaptureAudio}
          decisionDraft={decisionDraft}
          onDecisionDraftChange={(candidates: DecisionCandidate[]) =>
            setDecisionDraft((draft) =>
              draft ? { ...draft, candidates } : draft,
            )
          }
          onDecisionAttest={handleDecisionAttest}
        />
      </DashboardTodosProvider>
    </DashboardProvider>
  );

  return (
    <EdgeHealthProvider>
      <BackendStatusBanner />
      {decisionScribeNotice && (
        <p
          role="status"
          className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100"
        >
          <span>{decisionScribeNotice}</span>
          {lastDecisionScribeEntryId && user?.id && currentPatient && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                void undoDecisionOperation(
                  user.id,
                  lastDecisionScribeEntryId,
                  (operation) =>
                    commitDecisionCandidateRef.current!(
                      operation.candidate as DecisionCandidate,
                      operation.attestation,
                      operation.operationId,
                    ),
                )
                  .then((result) => {
                    setDecisionScribeNotice(
                      result.status === "undone"
                        ? "Last Decision Scribe change undone."
                        : result.status === "queued"
                          ? "Undo queued for sync."
                          : (result.reason ?? "Undo unavailable."),
                    );
                    if (result.status === "undone")
                      setLastDecisionScribeEntryId(null);
                  })
                  .catch(() => {
                    setDecisionScribeNotice(
                      "Undo could not be completed. No additional change was saved.",
                    );
                  });
              }}
            >
              Undo last change
            </button>
          )}
        </p>
      )}
      {decisionScribeConflicts[0]?.conflict && (
        <ConflictReview
          mine={decisionScribeConflicts[0].conflict.mine}
          theirs={decisionScribeConflicts[0].conflict.theirs}
          onResolve={(choice, merged) =>
            void (async () => {
              try {
                const entry = decisionScribeConflicts[0];
                await decisionScribeOutbox.resolveConflict(
                  entry.id,
                  choice,
                  merged,
                  user.id,
                );
                if (commitDecisionCandidateRef.current)
                  await retryDecisionScribeOutbox(user.id, (operation) =>
                    commitDecisionCandidateRef.current!(
                      operation.candidate as DecisionCandidate,
                      operation.attestation,
                      operation.operationId,
                    ),
                  );
              } catch {
                setDecisionScribeNotice(
                  "Decision Scribe outbox is unavailable. Approved changes remain blocked until it can be read safely.",
                );
              }
            })()
          }
        />
      )}
      <PatientRosterStatusBanner
        verification={patientVerification}
        onRetry={handleRefetchPatients}
      />
      <NewPatientSheet
        open={newPatientSheetOpen}
        onOpenChange={setNewPatientSheetOpen}
        onSubmit={handleNewPatientSubmit}
      />
      <React.Suspense fallback={<WorkspaceShellLoading />}>
        {dashboard}
      </React.Suspense>
    </EdgeHealthProvider>
  );
}

// Wrap with ChangeTrackingProvider (SettingsProvider is now at App level)
function Index(): React.ReactElement {
  return (
    <ChangeTrackingProvider>
      <IndexContent />
    </ChangeTrackingProvider>
  );
}

/**
 * Desktop strangler: Focus-first Round shell by default when enabled.
 * Classic workbench remains a secondary escape hatch from ToolsSheet.
 * RoundSessionProvider stays mounted so roster position survives workbench hops.
 */
function DesktopShellGate({
  userId,
  patientIds,
  patientSaveStates,
  dataVerificationBlocked,
  onCaptureStopped,
  onCaptureAudio,
  decisionDraft,
  onDecisionDraftChange,
  onDecisionAttest,
}: {
  userId: string;
  patientIds: readonly string[];
  patientSaveStates: Readonly<Record<string, PatientSaveState>>;
  dataVerificationBlocked: boolean;
  onCaptureStopped: (state: CaptureState) => void;
  onCaptureAudio: (
    state: CaptureState,
    audio: Blob | undefined,
    mimeType: string | undefined,
    binding: CaptureBinding,
    patient: Patient,
  ) => void;
  decisionDraft: ComposedDraft | null;
  onDecisionDraftChange: (candidates: DecisionCandidate[]) => void;
  onDecisionAttest: (candidates: DecisionCandidate[]) => void;
}): React.ReactElement {
  const roundRunnerOn = isRoundRunnerEnabled();
  const [useClassicWorkbench, setUseClassicWorkbench] = React.useState(false);

  const handleOpenWorkbench = React.useCallback(() => {
    setUseClassicWorkbench(true);
  }, []);

  const handleBackToRound = React.useCallback(() => {
    setUseClassicWorkbench(false);
  }, []);

  if (!roundRunnerOn) {
    return <DesktopDashboard />;
  }

  return (
    <RoundSessionProvider
      userId={userId}
      patientIds={patientIds}
      patientSaveStates={patientSaveStates}
      dataVerificationBlocked={dataVerificationBlocked}
    >
      {useClassicWorkbench ? (
        <div className="relative" data-testid="classic-desktop-shell">
          <div className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-border/30 bg-background/95 px-3 py-1.5 text-xs backdrop-blur">
            <span className="text-muted-foreground">
              Classic workbench (legacy). Prefer Round Tools for demoted panels.
            </span>
            <button
              type="button"
              className="rounded-md border border-border/40 px-2.5 py-1 font-medium text-foreground hover:bg-secondary/60"
              onClick={handleBackToRound}
              aria-label="Back to Round Focus"
            >
              Back to Round
            </button>
          </div>
          <DesktopDashboard />
        </div>
      ) : (
        <DesktopRoundShell
          onOpenWorkbench={handleOpenWorkbench}
          onCaptureStopped={onCaptureStopped}
          onCaptureAudio={onCaptureAudio}
          decisionDraft={decisionDraft}
          onDecisionDraftChange={onDecisionDraftChange}
          onDecisionAttest={onDecisionAttest}
        />
      )}
    </RoundSessionProvider>
  );
}

/**
 * Mobile strangler: Focus-first Round shell by default when enabled.
 * Classic workbench remains a secondary escape hatch from ToolsSheet.
 * RoundSessionProvider stays mounted so roster position survives workbench hops.
 */
function MobileShellGate({
  userId,
  patientIds,
  patientSaveStates,
  dataVerificationBlocked,
  onCaptureStopped,
  onCaptureAudio,
  decisionDraft,
  onDecisionDraftChange,
  onDecisionAttest,
}: {
  userId: string;
  patientIds: readonly string[];
  patientSaveStates: Readonly<Record<string, PatientSaveState>>;
  dataVerificationBlocked: boolean;
  onCaptureStopped: (state: CaptureState) => void;
  onCaptureAudio: (
    state: CaptureState,
    audio: Blob | undefined,
    mimeType: string | undefined,
    binding: CaptureBinding,
    patient: Patient,
  ) => void;
  decisionDraft: ComposedDraft | null;
  onDecisionDraftChange: (candidates: DecisionCandidate[]) => void;
  onDecisionAttest: (candidates: DecisionCandidate[]) => void;
}): React.ReactElement {
  const roundRunnerOn = isRoundRunnerEnabled();
  const [useClassicWorkbench, setUseClassicWorkbench] = React.useState(false);

  const handleOpenWorkbench = React.useCallback(() => {
    setUseClassicWorkbench(true);
  }, []);

  const handleBackToRound = React.useCallback(() => {
    setUseClassicWorkbench(false);
  }, []);

  if (!roundRunnerOn) {
    return <MobileDashboard />;
  }

  return (
    <RoundSessionProvider
      userId={userId}
      patientIds={patientIds}
      patientSaveStates={patientSaveStates}
      dataVerificationBlocked={dataVerificationBlocked}
    >
      {useClassicWorkbench ? (
        <div className="relative" data-testid="classic-mobile-shell">
          <div className="sticky top-0 z-50 flex min-h-11 items-center justify-between gap-2 border-b border-border/30 bg-background/95 px-3 py-2 text-sm backdrop-blur safe-area-top">
            <span className="text-foreground/75">
              Classic workbench (legacy). Prefer Round Home / Tools / End Round.
            </span>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-md border border-border/40 px-3 py-2 font-medium text-foreground hover:bg-secondary/60"
              onClick={handleBackToRound}
              aria-label="Back to Round Focus"
            >
              Back to Round
            </button>
          </div>
          <MobileDashboard />
        </div>
      ) : (
        <MobileRoundShell
          onOpenWorkbench={handleOpenWorkbench}
          onCaptureStopped={onCaptureStopped}
          onCaptureAudio={onCaptureAudio}
          decisionDraft={decisionDraft}
          onDecisionDraftChange={onDecisionDraftChange}
          onDecisionAttest={onDecisionAttest}
        />
      )}
    </RoundSessionProvider>
  );
}

export default Index;
