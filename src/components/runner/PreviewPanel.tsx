import { useEffect, useState } from "react";
import { Globe, RefreshCw, ExternalLink, Loader2, Lock, Server, X } from "lucide-react";
import type { RunStatus, ProjectType } from "@/types/runner";
import { projectTypeMeta } from "@/lib/runnerEngine";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  status: RunStatus;
  projectType: ProjectType | null;
  repoName: string | null;
  onClose: () => void;
  port?: number | null;
}

export const PreviewPanel = ({ status, projectType, repoName, onClose, port: propsPort }: PreviewPanelProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const port = propsPort || (projectType ? projectTypeMeta[projectType].port : null);
  const previewUrl = port ? `http://localhost:${port}` : "";

  const isLive = status === "success";
  const isBuilding = status === "cloning" || status === "detecting" || status === "installing" || status === "running";

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-2 h-10 panel-header flex-shrink-0">
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={!isLive}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Reload"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isBuilding && "animate-spin")} />
        </button>

        <div className="flex-1 flex items-center gap-2 h-7 px-2.5 rounded-md bg-background border border-border text-[12px] font-mono">
          <Lock className={cn("h-3 w-3 flex-shrink-0", isLive ? "text-success" : "text-muted-foreground/60")} />
          <span className={cn("truncate", isLive ? "text-foreground" : "text-muted-foreground/70")}>
            {previewUrl || "—"}
          </span>
          {port && (
            <span className="ml-auto text-[10px] px-1.5 py-px rounded bg-primary/12 text-primary border border-primary/25 font-semibold">
              :{port}
            </span>
          )}
        </div>

        <a
          href={previewUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
            !isLive && "opacity-30 pointer-events-none"
          )}
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="w-px h-5 bg-border mx-0.5" />

        <button
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Close preview"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 relative bg-muted/40 dark:bg-terminal-bg overflow-hidden">
        {status === "idle" && <IdleState />}
        {isBuilding && <BuildingState status={status} />}
        {status === "failed" && <FailedState />}
        {isLive && port && (
          <LivePreview key={refreshKey} previewUrl={previewUrl} />
        )}
      </div>
    </div>
  );
};

const IdleState = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="text-center max-w-xs p-8">
      <div className="mx-auto w-12 h-12 mb-4 rounded-lg border border-border bg-background flex items-center justify-center">
        <Globe className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <h3 className="text-[14px] font-semibold mb-1">Live preview</h3>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Your running application will appear here once the container is ready.
      </p>
    </div>
  </div>
);

const BuildingState = ({ status }: { status: RunStatus }) => {
  const messages: Partial<Record<RunStatus, string>> = {
    cloning: "Cloning repository",
    detecting: "Analyzing project",
    installing: "Installing dependencies",
    running: "Starting application",
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 mb-4 rounded-lg border border-border bg-background flex items-center justify-center">
          <Server className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <p className="text-[13px] font-semibold mb-1 flex items-center justify-center gap-2" key={status}>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          {messages[status] || "Working"}
        </p>
        <p className="text-[11.5px] text-muted-foreground">
          This may take a few moments
        </p>
      </div>
    </div>
  );
};

const FailedState = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="text-center max-w-xs p-8">
      <div className="mx-auto w-12 h-12 mb-4 rounded-lg border border-destructive/30 bg-destructive/10 flex items-center justify-center text-destructive">
        <X className="h-5 w-5" strokeWidth={2.5} />
      </div>
      <h3 className="text-[14px] font-semibold mb-1 text-destructive">Execution failed</h3>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        The container exited unexpectedly. Check the logs for details.
      </p>
    </div>
  </div>
);

const LivePreview = ({ previewUrl }: { previewUrl: string }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="absolute inset-0 bg-white h-full w-full">
      <iframe
        src={previewUrl}
        className="h-full w-full border-0 bg-white"
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};
