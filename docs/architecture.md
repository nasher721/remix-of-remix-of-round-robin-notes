## Architecture Diagrams (Mermaid)

These Mermaid diagrams illustrate core flows in Round Robin Notes. View directly in GitHub or any Mermaid-enabled markdown renderer.

### Rendering notes
- Diagrams are in fenced ```mermaid code blocks.
- For local preview, use a Mermaid-enabled markdown viewer or open the in-app Help page (/help) which renders them client-side.

### Rounding flow
```mermaid
flowchart TD
    A[Patient List] --> B[Select Patient]
    B --> C[Edit Systems/Meds/Labs]
    C --> D{Online?}
    D -->|Yes| E[Save via Supabase]
    D -->|No| F[Queue Offline Mutation]
    F --> G[Background Sync]
    E --> H[Success]
    G -->|Success| H
    G -->|Fail| I[Retry/Surface Error]
    I --> G
```

### Auth and request lifecycle
```mermaid
sequenceDiagram
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
    App->>Supa: refreshToken() on 401
```

### Patient data ERD (trimmed)
```mermaid
erDiagram
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
    }
```

### Offline/editor state machine
```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Editing: field change
    Editing --> Queued: offline
    Editing --> Syncing: online save
    Queued --> Syncing: reconnect
    Syncing --> Synced: success
    Syncing --> Error: failure
    Error --> Syncing: retry
    Error --> Failed: give up
```

### Export pipeline
```mermaid
flowchart LR
    UI[Export Action] --> F[Format content]
    F --> EF[Edge Function]
    EF --> PDF[PDF/HTML output]
    PDF --> DL[Download/Share]
```
