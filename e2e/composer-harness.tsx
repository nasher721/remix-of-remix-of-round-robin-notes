import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { NoteComposer } from "../src/components/note-composer/NoteComposer";
import { useNoteComposer } from "../src/hooks/useNoteComposer";
import {
  defaultMedications,
  defaultSystems,
  type Patient,
} from "../src/types/patient";
import type { ComposerTransport } from "../src/lib/note-composer/session";
import "../src/index.css";
const initial: Patient = {
  id: "synthetic-a",
  name: "Synthetic patient A",
  mrn: "",
  bed: "TEST 01",
  patientNumber: 1,
  clinicalSummary: "68F w documented intracerebral hemorrhage",
  intervalEvents: "",
  imaging: "Synthetic imaging",
  labs: "Synthetic lab",
  systems: {
    ...defaultSystems,
    neuro: "NC q2h\n\n# Intracerebral hemorrhage\nCTH stable",
  },
  medications: { ...defaultMedications, scheduled: ["Synthetic medication"] },
  fieldTimestamps: {},
  revision: 1,
  createdAt: "",
  lastModified: "",
  collapsed: false,
};
export function Harness() {
  const [patient, setPatient] = useState(initial);
  const [open, setOpen] = useState(true);
  const [owner, setOwner] = useState("synthetic-owner");
  const [fail, setFail] = useState(false);
  const transport = useMemo<ComposerTransport>(() => ({
    async generate(request, signal, stage) {
      stage("Reconciling updates");
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 500);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Cancelled"));
        }, { once: true });
      });
      if (fail) throw new Error("Synthetic retry case");
      stage("Drafting note");
      const s = request.sources.find((s) => s.id === "attending")!;
      const destination = request.allowedTargets[0] as "clinicalSummary";
      return {
        binding: request.binding,
        blocks: [{
          id: destination,
          destination,
          kind: "summary",
          text: s.text,
          claimIds: ["synthetic-claim"],
          editVersion: 0,
          provenance: "generated",
        }],
        claims: [{
          id: "synthetic-claim",
          patientId: request.binding.patientId,
          concept: "assessment",
          text: s.text,
          state: "interpretation",
          timeKind: "undated",
          destination,
          spans: [{ sourceId: s.id, start: 0, end: s.text.length }],
          uncertainty: "",
        }],
        removals: [],
        supportedClaimIds: ["synthetic-claim"],
        conflicts: [],
      };
    },
    async apply(patch) {
      setPatient((previous) => {
        const next = structuredClone(previous);
        for (const [field, text] of Object.entries(patch.fields)) {
          if (field.startsWith("systems.")) {
            (next.systems as Record<string, string>)[field.slice(8)] = text!;
          } else next[field as "clinicalSummary" | "intervalEvents"] = text!;
        }
        return {
          ...next,
          revision: (previous.revision ?? 0) + 1,
          noteFormat: patch.format,
        };
      });
      return { revision: patch.expectedRevision + 1 };
    },
  }), [fail]);
  return (
    <div className="h-screen">
      <div className="flex flex-wrap gap-3 border-b bg-muted p-2 text-sm">
        <span>SYNTHETIC DATA ONLY</span>
        <button
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Toggle dark
        </button>
        <button onClick={() => setOpen(true)}>Reopen composer</button>
        <button
          onClick={() =>
            setPatient({
              ...initial,
              id: "synthetic-b",
              name: "Synthetic patient B",
              clinicalSummary: "Second patient only",
            })}
        >
          Switch patient
        </button>
        <button
          onClick={() => {
            setOwner("signed-out");
            setOpen(false);
          }}
        >
          Sign out
        </button>
        <label>
          <input
            type="checkbox"
            checked={fail}
            onChange={(e) => setFail(e.target.checked)}
          />Simulate failure
        </label>
      </div>
      {open && (
        <SessionView
          owner={owner}
          patient={patient}
          transport={transport}
          onClose={() => setOpen(false)}
        />
      )}
      <output data-testid="saved-composer-chart" className="sr-only">
        {JSON.stringify(patient)}
      </output>
    </div>
  );
}
export function SessionView(
  { owner, patient, transport, onClose }: {
    owner: string;
    patient: Patient;
    transport: ComposerTransport;
    onClose(): void;
  },
) {
  const session = useNoteComposer(owner, patient, transport);
  return session
    ? (
      <div className="h-[calc(100dvh-52px)]">
        <NoteComposer session={session} generationEnabled onClose={onClose} />
      </div>
    )
    : null;
}
createRoot(document.getElementById("root")!).render(<Harness />);
