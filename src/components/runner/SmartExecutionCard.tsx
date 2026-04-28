import { useState } from "react";
import { Zap, CheckCircle2, XCircle, Loader2, RotateCcw, Copy, Check, Package, Cpu, Clock, Network } from "lucide-react";
import type { ExecutionInfo } from "@/hooks/useRunner";
import { projectTypeMeta } from "@/lib/runnerEngine";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SmartExecutionCardProps {
  info: ExecutionInfo;
  onRetry: () => void;
}

export const SmartExecutionCard = ({ info, onRetry }: SmartExecutionCardProps) => {
  const [copied, setCopied] = useState(false);
  const isSuccess = info.status === "success";
  const isFailed = info.status === "failed";
  const isRunning = info.status === "running";

  const stackMeta = projectTypeMeta[info.stack];

  const statusConfig = {
    running: { label: "Running", dot: "bg-warning", badge: "bg-warning/15 text-warning border-warning/30", Icon: Loader2, iconCls: "text-warning animate-spin" },
    success: { label: "Success", dot: "bg-success", badge: "bg-success/15 text-success border-success/30", Icon: CheckCircle2, iconCls: "text-success" },
    failed:  { label: "Failed",  dot: "bg-destructive", badge: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle, iconCls: "text-destructive" },
  }[info.status];

  const copyFix = async () => {
    if (!info.fixCommand) return;
    await navigator.clipboard.writeText(info.fixCommand);
    setCopied(true);
    toast.success("Fix command copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border overflow-hidden animate-fade-in",
        "backdrop-blur-xl bg-background-elevated/60 border-border/70",
        "shadow-sm"
      )}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[2px]",
          isSuccess && "bg-success",
          isFailed && "bg-destructive",
          isRunning && "bg-warning",
        )}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-border/60 bg-background/40">
        <div className="flex items-center gap-2 text-[12px] font-medium">
          <Zap className={cn("h-3.5 w-3.5", isSuccess ? "text-success" : isFailed ? "text-destructive" : "text-warning")} strokeWidth={2.25} />
          <span>{isFailed ? "Build Failed" : "Execution Summary"}</span>
        </div>
        <div className={cn("flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-[10px] font-mono tabular-nums", statusConfig.badge)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dot, isRunning && "animate-pulse")} />
          {statusConfig.label}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <MetaTile icon={Cpu} label="Stack" value={stackMeta.label} valueClass={stackMeta.color} />
          <MetaTile
            icon={Network}
            label="Port"
            value={info.port ? `:${info.port}` : "—"}
            mono
          />
          <MetaTile
            icon={Clock}
            label="Startup"
            value={info.startupMs !== null ? `${(info.startupMs / 1000).toFixed(1)}s` : "…"}
            mono
          />
          <MetaTile
            icon={Package}
            label="Deps"
            value={info.dependencies.toString()}
            mono
          />
        </div>

        {/* Failure details */}
        {isFailed && (
          <div className="space-y-2 pt-1">
            {info.errorReason && (
              <div className="rounded-md border border-destructive/25 bg-destructive/5 p-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-destructive/80 mb-1">Reason</div>
                <div className="text-[12px] leading-relaxed text-foreground/90">{info.errorReason}</div>
              </div>
            )}
            {info.suggestedFix && (
              <div className="rounded-md border border-success/25 bg-success/5 p-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-success/90 mb-1">Suggested Fix</div>
                <div className="text-[12px] leading-relaxed text-foreground/90 mb-1.5">{info.suggestedFix}</div>
                {info.fixCommand && (
                  <div className="flex items-center gap-1.5 rounded bg-terminal-bg border border-terminal-border px-2 py-1.5 font-mono text-[11.5px] text-terminal-fg">
                    <span className="text-success">$</span>
                    <span className="flex-1 truncate">{info.fixCommand}</span>
                    <button
                      onClick={copyFix}
                      className="p-0.5 rounded hover:bg-white/10 text-terminal-fg/70 hover:text-terminal-fg transition-colors"
                      aria-label="Copy fix command"
                    >
                      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onRetry}
              className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-border/70 bg-background/60 hover:bg-muted text-[12px] font-medium transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry build
            </button>
          </div>
        )}

        {isSuccess && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
            <statusConfig.Icon className={cn("h-3 w-3", statusConfig.iconCls)} />
            <span>Live on <span className="font-mono text-foreground/80">localhost:{info.port}</span></span>
          </div>
        )}
      </div>
    </div>
  );
};

const MetaTile = ({
  icon: Icon, label, value, valueClass, mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) => (
  <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
    <div className="flex items-center gap-1 text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </div>
    <div className={cn("text-[12.5px] font-semibold truncate", mono && "font-mono tabular-nums", valueClass)}>
      {value}
    </div>
  </div>
);
