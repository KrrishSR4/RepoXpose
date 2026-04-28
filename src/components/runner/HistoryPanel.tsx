import { History, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { RunHistoryItem } from "@/types/runner";
import { projectTypeMeta } from "@/lib/runnerEngine";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  history: RunHistoryItem[];
  onSelect: (url: string) => void;
}

export const HistoryPanel = ({ history, onSelect }: HistoryPanelProps) => {
  return (
    <div className="panel h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 h-10 panel-header flex-shrink-0">
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          <span>Recent runs</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{history.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {history.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-4">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              No runs yet.<br />
              <span className="text-muted-foreground/60">History will appear here.</span>
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {history.map((item) => (
              <HistoryRow key={item.id} item={item} onClick={() => onSelect(item.repoUrl)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryRow = ({ item, onClick }: { item: RunHistoryItem; onClick: () => void }) => {
  const Icon = item.status === "success" ? CheckCircle2 : item.status === "failed" ? XCircle : Loader2;
  const color = item.status === "success" ? "text-success" : item.status === "failed" ? "text-destructive" : "text-primary";
  const meta = projectTypeMeta[item.projectType];
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors group"
    >
      <div className="flex items-center gap-2 mb-0.5">
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} strokeWidth={2.25} />
        <span className="text-[12.5px] font-medium truncate flex-1">{item.repoName}</span>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {(item.durationMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[10.5px] font-mono pl-5 text-muted-foreground">
        <span className={meta.color}>{meta.label}</span>
        {item.port ? (
          <>
            <span>·</span>
            <span>:{item.port}</span>
          </>
        ) : null}
        <span className="ml-auto">
          {new Date(item.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </button>
  );
};
