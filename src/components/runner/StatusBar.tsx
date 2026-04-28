import { Activity, CheckCircle2, XCircle, Loader2, Clock, Cpu, GitBranch, type LucideIcon } from "lucide-react";
import type { ProjectType, RunStatus } from "@/types/runner";
import { projectTypeMeta } from "@/lib/runnerEngine";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  status: RunStatus;
  projectType: ProjectType | null;
  repoName: string | null;
  elapsedMs: number;
}

const statusMeta: Record<RunStatus, { label: string; color: string; icon: LucideIcon }> = {
  idle: { label: "Idle", color: "text-muted-foreground", icon: Activity },
  cloning: { label: "Cloning", color: "text-info", icon: Loader2 },
  detecting: { label: "Detecting", color: "text-info", icon: Loader2 },
  installing: { label: "Installing", color: "text-warning", icon: Loader2 },
  running: { label: "Running", color: "text-primary", icon: Loader2 },
  success: { label: "Live", color: "text-success", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-destructive", icon: XCircle },
};

export const StatusBar = ({ status, projectType, repoName, elapsedMs }: StatusBarProps) => {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  const isAnimated = ["cloning", "detecting", "installing", "running"].includes(status);

  return (
    <div className="border-t border-border/80 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <div className="container flex items-center justify-between gap-4 h-9 text-[11.5px] font-medium">
        <div className="flex items-center gap-4 flex-wrap">
          <div className={cn("flex items-center gap-1.5", meta.color)}>
            <Icon className={cn("h-3.5 w-3.5", isAnimated && "animate-spin")} />
            <span className="uppercase tracking-wider font-semibold">{meta.label}</span>
          </div>

          {repoName && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              <span className="text-foreground font-mono">{repoName}</span>
            </div>
          )}

          {projectType && projectType !== "unsupported" && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Cpu className="h-3 w-3" />
              <span className={projectTypeMeta[projectType].color}>
                {projectTypeMeta[projectType].label}
              </span>
              <span>·</span>
              <span className="font-mono">port {projectTypeMeta[projectType].port}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          {elapsedMs > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums font-mono">{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          )}
          <div className="hidden md:flex items-center gap-1.5">
            <span>region</span>
            <span className="text-foreground font-mono">us-east-1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
