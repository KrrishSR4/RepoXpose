import { Check, Circle, Loader2, X } from "lucide-react";
import type { RunStep } from "@/types/runner";
import { cn } from "@/lib/utils";

interface StepsRailProps {
  steps: RunStep[];
}

export const StepsRail = ({ steps }: StepsRailProps) => {
  if (steps.length === 0) return null;

  return (
    <div className="border-b border-border/70 bg-card/40 backdrop-blur-sm">
      <div className="container py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
              <StepBadge step={step} />
              {i < steps.length - 1 && (
                <div className={cn(
                  "h-px w-5 sm:w-6 transition-colors",
                  step.status === "done" ? "bg-success/50" : "bg-border"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StepBadge = ({ step }: { step: RunStep }) => {
  const Icon = step.status === "done" ? Check
    : step.status === "active" ? Loader2
    : step.status === "failed" ? X
    : Circle;

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors",
      step.status === "pending" && "text-muted-foreground/70",
      step.status === "active" && "text-primary bg-primary/10 border border-primary/25",
      step.status === "done" && "text-success bg-success/8 border border-success/20",
      step.status === "failed" && "text-destructive bg-destructive/10 border border-destructive/25",
      (step.status === "active" || step.status === "done" || step.status === "failed") || "border border-transparent",
    )}>
      <Icon className={cn(
        "h-3 w-3 flex-shrink-0",
        step.status === "active" && "animate-spin",
        step.status === "pending" && "fill-current opacity-30"
      )} strokeWidth={2.5} />
      <span className="whitespace-nowrap">{step.label}</span>
    </div>
  );
};
