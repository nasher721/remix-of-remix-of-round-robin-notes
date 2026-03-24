import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileCoachingBannerProps = {
  message: string;
  className?: string;
};

export const ProfileCoachingBanner = ({ message, className }: ProfileCoachingBannerProps) => {
  if (!message) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-foreground",
        className,
      )}
    >
      <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
      <p className="leading-snug">{message}</p>
    </div>
  );
};
