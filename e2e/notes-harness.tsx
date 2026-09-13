import * as React from "react";
import { createRoot } from "react-dom/client";
import { ContinuousNoteEditor } from "../src/components/notes/ContinuousNoteEditor";
import { NoteEditorModeControl } from "../src/components/notes/NoteEditorModeControl";
import { useNoteEditorMode } from "../src/hooks/useNoteEditorMode";
import { defaultMedications, defaultSystems, type Patient } from "../src/types/patient";
import { DEFAULT_SYSTEMS } from "../src/hooks/useSystemsConfig";
import { sanitizeHtml } from "../src/lib/sanitize";
import "../src/index.css";

const initialPatient: Patient = {
  id: "synthetic-1", name: "Demo patient", patientNumber: 1, mrn: "", bed: "TEST 01",
  clinicalSummary: "<p><strong>Synthetic rounding note.</strong> Practice editing here.</p>",
  intervalEvents: "<p>Imaging reviewed with the team.</p>", imaging: "", labs: "",
  systems: { ...defaultSystems, neuro: "<p>Enter your assessment and plan.</p>" },
  medications: { ...defaultMedications, scheduled: ["Demo medication A", "Demo medication B"] },
  fieldTimestamps: {}, collapsed: false, createdAt: "", lastModified: "",
};

export function Harness() {
  const [patient, setPatient] = React.useState(initialPatient);
  const [mode, setMode] = useNoteEditorMode();
  const [tracked, setTracked] = React.useState(false);
  const update = (_id: string, field: string, value: unknown) => setPatient((previous) => {
    if (field.startsWith("systems.")) return { ...previous, systems: { ...previous.systems, [field.slice(8)]: value } };
    return { ...previous, [field]: value };
  });
  return <main className="min-h-screen bg-muted/30 p-3 text-foreground sm:p-6">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-medium text-muted-foreground">LOCAL PREVIEW · SYNTHETIC DATA</p><h1 className="text-xl font-semibold">{patient.name} <span className="text-muted-foreground">/ {patient.bed}</span></h1></div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => document.documentElement.classList.toggle("dark")}>Toggle theme</button>
          <button onClick={() => setTracked((value) => !value)}>Toggle tracking</button>
          <button onClick={() => setPatient({ ...initialPatient, id: "synthetic-2", name: "Second patient", clinicalSummary: "Second patient only" })}>Switch patient</button>
        </div>
      </header>
      <NoteEditorModeControl mode={mode} onChange={setMode} />
      {mode === "continuous" ? <ContinuousNoteEditor patient={patient} systems={DEFAULT_SYSTEMS} onUpdate={update}
        autotexts={[{ shortcut: ".followup", expansion: "Follow-up: ", category: "General" }]}
        changeTracking={{ enabled: tracked,
          wrapWithMarkup: (text) => `<span data-marked="true" data-date="2026-09-11" style="background-color: #fef08a33">${text}</span>`,
          wrapHtmlWithMarkup: (html) => `<span data-marked="true" data-date="2026-09-11" style="background-color: #fef08a33">${html}</span>` }} />
        : <section className="rounded-xl border bg-background p-5"><h2>Clinical summary</h2>
          <div role="textbox" aria-label="Separate clinical summary" contentEditable suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(patient.clinicalSummary) }}
            onInput={(event) => update(patient.id, "clinicalSummary", event.currentTarget.innerHTML)} /></section>}
      <div data-testid="chart-state" className="sr-only">{JSON.stringify(patient)}</div>
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
