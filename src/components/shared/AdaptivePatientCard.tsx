import React, { createContext, useContext, ReactNode, useState } from "react";
import { Patient } from "@/types/patient";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-mobile";
import { Patient } from "@/types/patient";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-mobile";

// Context for the adaptive component
interface AdaptiveContextValue {
  patient: Patient;
  variant: "mobile" | "tablet" | "desktop";
  isCompact: boolean;
}

const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

function useAdaptive() {
  const context = useContext(AdaptiveContext);
  if (!context) {
    throw new Error("useAdaptive must be used within an Adaptive component");
  }
  return context;
}

// Root component - determines variant based on viewport
interface AdaptiveProps {
  patient: Patient;
  children: ReactNode;
  className?: string;
  forceVariant?: "mobile" | "tablet" | "desktop";
}

export function AdaptivePatientCard({
  patient,
  children,
  className,
  forceVariant,
}: AdaptiveProps) {
  const breakpoint = useBreakpoint();
  
  // Determine variant based on breakpoint
  const variant = forceVariant || (
    breakpoint === "mobile" ? "mobile" :
    breakpoint === "tablet" ? "tablet" : "desktop"
  );
  
  const isCompact = variant === "mobile";

  return (
    <AdaptiveContext.Provider value={{ patient, variant, isCompact }}>
      <div
        className={cn(
          "rounded-lg border bg-card",
          variant === "mobile" && "p-3",
          variant === "tablet" && "p-4",
          variant === "desktop" && "p-5",
          className
        )}
        data-variant={variant}
      >
        {children}
      </div>
    </AdaptiveContext.Provider>
  );
}

// Header component - adapts layout
interface HeaderProps {
  children?: ReactNode;
  className?: string;
}

AdaptivePatientCard.Header = function Header({ children, className }: HeaderProps) {
  const { patient, variant } = useAdaptive();
  
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        variant === "mobile" && "flex-col",
        variant !== "mobile" && "flex-row justify-between",
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          "font-semibold truncate",
          variant === "mobile" && "text-base",
          variant !== "mobile" && "text-lg"
        )}>
          {patient.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {patient.bed} • {patient.diagnosis}
        </p>
      </div>
      {children}
    </div>
  );
};

// Actions component - adapts button visibility
interface ActionsProps {
  children?: ReactNode;
  className?: string;
}

AdaptivePatientCard.Actions = function Actions({ children, className }: ActionsProps) {
  const { variant } = useAdaptive();
  
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        variant === "mobile" && "flex-wrap justify-end",
        variant !== "mobile" && "flex-nowrap",
        className
      )}
    >
      {children}
    </div>
  );
};

// Content component - handles main content area
interface ContentProps {
  children: ReactNode;
  className?: string;
}

AdaptivePatientCard.Content = function Content({ children, className }: ContentProps) {
  const { variant } = useAdaptive();
  
  return (
    <div
      className={cn(
        "mt-3",
        variant === "desktop" && "grid grid-cols-2 gap-4",
        variant === "tablet" && "grid grid-cols-2 gap-3",
        variant === "mobile" && "space-y-3",
        className
      )}
    >
      {children}
    </div>
  );
};

// Section component - for grouping related content
interface SectionProps {
  title: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

AdaptivePatientCard.Section = function Section({
  title,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
}: SectionProps) {
  const { variant, isCompact } = useAdaptive();
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  
  // On mobile, sections are collapsible by default
  const canCollapse = collapsible || isCompact;
  
  if (canCollapse && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full text-left p-2 rounded-md hover:bg-secondary/50",
          className
        )}
      >
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground ml-2">(tap to expand)</span>
      </button>
    );
  }
  
  return (
    <div className={cn(
      "rounded-md",
      variant !== "mobile" && "border p-3",
      className
    )}>
      <div
        className={cn(
          "flex items-center justify-between",
          canCollapse && "cursor-pointer"
        )}
        onClick={canCollapse ? () => setIsOpen(false) : undefined}
      >
        <h4 className={cn(
          "font-medium",
          variant === "mobile" && "text-xs uppercase tracking-wider text-muted-foreground mb-2",
          variant !== "mobile" && "text-sm mb-2"
        )}>
          {title}
        </h4>
        {canCollapse && (
          <span className="text-xs text-muted-foreground">tap to collapse</span>
        )}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
};

// Footer component - for actions at the bottom
interface FooterProps {
  children?: ReactNode;
  className?: string;
}

AdaptivePatientCard.Footer = function Footer({ children, className }: FooterProps) {
  const { variant } = useAdaptive();
  
  return (
    <div
      className={cn(
        "mt-4 pt-3 border-t flex items-center",
        variant === "mobile" && "flex-col gap-2",
        variant !== "mobile" && "flex-row justify-between",
        className
      )}
    >
      {children}
    </div>
  );
};

// Export the hooks for external use
export { useAdaptive };
