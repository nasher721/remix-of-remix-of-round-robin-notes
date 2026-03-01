import React, { useEffect, useId, useRef, useState } from "react";

type MermaidDiagramProps = {
  code: string;
  title?: string;
};

type RenderState = "idle" | "loading" | "ready" | "error";

export function MermaidDiagram({ code, title }: MermaidDiagramProps): React.ReactElement {
  const id = useId().replace(/[:]/g, "-");
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>("idle");

  useEffect(() => {
    let cancelled = false;

    if (typeof window === "undefined") {
      return () => {};
    }

    setState("loading");

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

        if (cancelled || !containerRef.current) return;

        const { svg } = await mermaid.render(`mermaid-${id}`, code);
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
        setState("ready");
      } catch (error) {
        console.error("Mermaid render failed", error);
        if (!cancelled) {
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [code, id]);

  return (
    <div className="space-y-2">
      {title ? <p className="text-sm font-medium text-muted-foreground">{title}</p> : null}
      <div className="rounded-md border bg-muted/30 p-4" aria-live="polite">
        {typeof window === "undefined" ? (
          <p className="text-sm text-muted-foreground">Diagram renders on the client.</p>
        ) : (
          <>
            {state === "loading" && (
              <p className="text-sm text-muted-foreground">Rendering diagram…</p>
            )}
            {state === "error" && (
              <p className="text-sm text-destructive">Unable to render diagram.</p>
            )}
            <div ref={containerRef} className="overflow-x-auto" />
          </>
        )}
      </div>
      <details className="rounded-md border bg-muted/30 p-3">
        <summary className="cursor-pointer text-sm font-medium">View Mermaid source</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs font-mono leading-5">{code}</pre>
      </details>
    </div>
  );
}

export default MermaidDiagram;
