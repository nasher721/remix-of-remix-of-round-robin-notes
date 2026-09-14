import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useNoteComposer } from "@/hooks/useNoteComposer";
import type { Patient } from "@/types/patient";
import { NoteComposer } from "./NoteComposer";
import {
  composerCapabilities,
  composerTransport,
  fetchComposerPatient,
  loadComposerPreference,
  saveComposerPreference,
} from "@/services/noteComposerService";

function ComposerBody(
  { ownerId, patient, patientChanged, closeRequest, onClose }: {
    ownerId: string;
    patient: Patient;
    patientChanged: boolean;
    closeRequest: number;
    onClose(): void;
  },
) {
  const queryClient = useQueryClient();
  const transport = useMemo(() => composerTransport, []);
  const session = useNoteComposer(ownerId, patient, transport);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    setEnabled(false);
    void composerCapabilities(patient.id, abort.signal).then((value) => {
      if (!abort.signal.aborted) setEnabled(value);
    }).catch(() => {});
    return () => abort.abort();
  }, [patient.id, ownerId]);
  useEffect(() => {
    let active = true;
    if (session && !patient.noteFormat) {
      void loadComposerPreference(ownerId).then((mode) => {
        if (
          active && session.state.saveStatus === "saved" &&
          !session.state.attending
        ) session.setMode(mode);
      });
    }
    return () => {
      active = false;
    };
  }, [session, ownerId, patient.noteFormat]);
  if (!session) return <p className="p-6">Opening composer...</p>;
  return (
    <NoteComposer
      session={session}
      generationEnabled={enabled}
      patientChanged={patientChanged}
      closeRequest={closeRequest}
      onClose={onClose}
      onApplied={() => {
        void queryClient.invalidateQueries({ queryKey: ["patients"] });
      }}
      onFetchCurrent={() =>
        fetchComposerPatient(patient.id, ownerId, AbortSignal.timeout(30000))}
      onSavePreference={(mode) => saveComposerPreference(ownerId, mode)}
    />
  );
}
function AuthenticatedComposer(
  props: {
    patient: Patient;
    patientChanged: boolean;
    closeRequest: number;
    onClose(): void;
  },
) {
  const { user } = useAuth();
  const { onClose } = props;
  const openingOwner = useRef(user?.id);
  const ownerChanged = !user || user.id !== openingOwner.current;
  useEffect(() => {
    if (ownerChanged) onClose();
  }, [ownerChanged, onClose]);
  if (ownerChanged) return null;
  if (!user) return <p className="p-6">Sign in to open the chart composer.</p>;
  return <ComposerBody key={user.id} ownerId={user.id} {...props} />;
}
export function NoteComposerLauncher({ patient }: { patient: Patient }) {
  const [snapshot, setSnapshot] = useState<Patient | null>(null);
  const [closeRequest, setCloseRequest] = useState(0);
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11"
        onClick={() => {
          setSnapshot(structuredClone(patient));
          setCloseRequest(0);
        }}
      >
        Compose rounding note
      </Button>
      <Dialog
        open={!!snapshot}
        onOpenChange={(open) => {
          if (!open) setCloseRequest((value) => value + 1);
        }}
      >
        <DialogContent
          onKeyDown={(e) => e.stopPropagation()}
          className="h-[100dvh] max-h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[94dvh] sm:w-[96vw] sm:max-w-[1440px] sm:rounded-xl [&>button]:hidden"
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setCloseRequest((value) => value + 1);
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Compose rounding note</DialogTitle>
          <DialogDescription className="sr-only">
            Temporary patient-specific source review and note editing.
          </DialogDescription>
          {snapshot && (
            <AuthenticatedComposer
              patient={snapshot}
              patientChanged={snapshot.id !== patient.id}
              closeRequest={closeRequest}
              onClose={() => setSnapshot(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
