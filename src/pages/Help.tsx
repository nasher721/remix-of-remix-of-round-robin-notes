import React, { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { MermaidDiagram } from "@/components/diagrams/MermaidDiagram";

type Diagram = {
  id: string;
  title: string;
  summary: string;
  code: string;
};

const diagrams: Diagram[] = [
  {
    id: "rounding-flow",
    title: "Rounding flow",
    summary: "Patient selection, editing, and offline/online save path.",
    code: `flowchart TD
    A[Patient List] --> B[Select Patient]
    B --> C[Edit Systems/Meds/Labs]
    C --> D{Online?}
    D -->|Yes| E[Save via Supabase]
    D -->|No| F[Queue Offline Mutation]
    F --> G[Background Sync]
    E --> H[Success]
    G -->|Success| H
    G -->|Fail| I[Retry/Surface Error]
    I --> G`,
  },
  {
    id: "auth-flow",
    title: "Auth and request lifecycle",
    summary: "Token fetch/refresh for Supabase-backed data calls.",
    code: `sequenceDiagram
    autonumber
    actor U as User
    participant App
    participant Supa as Supabase Auth
    participant DB
    U->>App: Open app
    App->>Supa: getSession()
    alt no session
        App->>Supa: signInWithPassword
    end
    Supa-->>App: access + refresh token
    App->>DB: fetch patients (JWT)
    DB-->>App: data / 401
    App->>Supa: refreshToken() on 401`,
  },
  {
    id: "patient-erd",
    title: "Patient data ERD (trimmed)",
    summary: "Core patient records with todos and field history." ,
    code: `erDiagram
    patients ||--o{ patient_todos : has
    patients ||--o{ patient_field_history : tracks
    patients {
        uuid id PK
        text name
        text bed
        jsonb systems
        jsonb medications
        jsonb field_timestamps
    }
    patient_todos {
        uuid id PK
        uuid patient_id FK
        text body
        boolean done
    }
    patient_field_history {
        uuid id PK
        uuid patient_id FK
        text field
        text value
        timestamptz changed_at
    }`,
  },
  {
    id: "offline-state",
    title: "Offline/editor state machine",
    summary: "Mutation queue states for offline edits and retries.",
    code: `stateDiagram-v2
    [*] --> Idle
    Idle --> Editing: field change
    Editing --> Queued: offline
    Editing --> Syncing: online save
    Queued --> Syncing: reconnect
    Syncing --> Synced: success
    Syncing --> Error: failure
    Error --> Syncing: retry
    Error --> Failed: give up`,
  },
  {
    id: "export-pipeline",
    title: "Export pipeline",
    summary: "Formatting to edge function to downloadable output.",
    code: `flowchart LR
    UI[Export Action] --> F[Format content]
    F --> EF[Edge Function]
    EF --> PDF[PDF/HTML output]
    PDF --> DL[Download/Share]`,
  },
];

function Help(): React.ReactElement {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const openSet = useMemo(() => new Set(openItems), [openItems]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary">Help & Diagrams</p>
        <h1 className="text-3xl font-bold tracking-tight">Visualize key flows</h1>
        <p className="text-muted-foreground">
          Mermaid diagrams for core application flows. Expand a section to render the diagram on demand.
          Source snippets are included for version control and updates.
        </p>
        <p className="text-sm text-muted-foreground">
          Developer docs: see <code>docs/architecture.md</code> for the same diagrams in markdown.
        </p>
      </header>

      <Separator />

      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-3">
        {diagrams.map((diagram) => (
          <AccordionItem key={diagram.id} value={diagram.id} className="rounded-lg border bg-card px-4">
            <AccordionTrigger className="text-left text-base font-semibold">
              <div className="flex flex-col text-left">
                <span>{diagram.title}</span>
                <span className="text-sm font-normal text-muted-foreground">{diagram.summary}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="mt-2">
                {openSet.has(diagram.id) ? (
                  <MermaidDiagram code={diagram.code} title={diagram.title} />
                ) : (
                  <p className="text-sm text-muted-foreground">Open to render diagram.</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </main>
  );
}

export default Help;
