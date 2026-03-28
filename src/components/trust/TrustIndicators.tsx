import type { ReactNode } from "react";
import { Shield, Lock, FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TrustBadgeProps {
  icon: ReactNode;
  label: string;
  description: string;
  testId: string;
  variant?: "default" | "secondary" | "outline";
}

function TrustBadge({ icon, label, description, testId, variant = "secondary" }: TrustBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-testid={testId}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "bg-muted/50 hover:bg-muted transition-colors cursor-help",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          )}
          aria-describedby={`${testId}-tooltip`}
          type="button"
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent id={`${testId}-tooltip`} side="top" className="max-w-xs">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export interface TrustIndicatorsProps {
  className?: string;
}

export function TrustIndicators({ className }: TrustIndicatorsProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <TrustBadge
        testId="hipaa-badge"
        icon={<Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
        label="HIPAA Aligned"
        description="We follow HIPAA security and privacy practices for protecting health information. Note: This indicates alignment with HIPAA standards, not formal certification."
        variant="secondary"
      />
      
      <TrustBadge
        testId="encryption-badge"
        icon={<Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />}
        label="Encrypted"
        description="Data is encrypted in transit (TLS/SSL) and at rest using Supabase's enterprise-grade encryption to protect your clinical data."
        variant="secondary"
      />
      
      <TrustBadge
        testId="audit-badge"
        icon={<FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
        label="Audit Logged"
        description="All data access and changes are logged for accountability. Field-level change tracking provides comprehensive audit trails."
        variant="secondary"
      />
      
      <Link
        to="/security"
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          "text-muted-foreground hover:text-foreground transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        aria-label="Learn more about our security practices"
      >
        <span>Security</span>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}
