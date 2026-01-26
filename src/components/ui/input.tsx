import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {startIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10">
            {startIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-border bg-card py-2 text-base transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-border/80",
            startIcon ? "pl-10" : "px-3",
            endIcon ? "pr-10" : "px-3",
            className,
          )}
          ref={ref}
          {...props}
        />
        {endIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10">
            {endIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
