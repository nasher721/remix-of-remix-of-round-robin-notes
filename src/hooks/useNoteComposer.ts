import { useEffect, useRef, useState } from "react";
import type { Patient } from "@/types/patient";
import {
  ComposerSession,
  type ComposerTransport,
} from "@/lib/note-composer/session";

export function useNoteComposer(
  ownerId: string,
  patient: Patient,
  transport: ComposerTransport,
) {
  const latestPatient = useRef(patient);
  const openingOwner = useRef(ownerId);
  latestPatient.current = patient;
  const [session, setSession] = useState<ComposerSession | null>(null);
  useEffect(() => {
    // A new owner must explicitly reopen an authorized chart, never inherit this snapshot.
    if (ownerId !== openingOwner.current) {
      setSession(null);
      return;
    }
    const next = new ComposerSession(ownerId, latestPatient.current, transport);
    setSession(next);
    return () => next.destroy();
  }, [ownerId, patient.id, transport]);
  return session?.ownerId === ownerId && session.patient?.id === patient.id
    ? session
    : null;
}
