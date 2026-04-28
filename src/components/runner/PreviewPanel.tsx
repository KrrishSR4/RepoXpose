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
}

export const PreviewPanel = ({ status, projectType, repoName, onClose }: PreviewPanelProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const port = projectType ? projectTypeMeta[projectType].port : null;
  const previewUrl = repoName && port ? `https://${repoName}-${port}.sandbox.repoxpose.app` : "";

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
          href="#"
          onClick={(e) => e.preventDefault()}
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
        {isLive && projectType && repoName && (
          <LivePreview key={refreshKey} projectType={projectType} repoName={repoName} port={port!} />
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

const LivePreview = ({ projectType, repoName, port }: { projectType: ProjectType; repoName: string; port: number }) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <div className="absolute inset-0 animate-fade-in">
        <MockPreview projectType={projectType} repoName={repoName} port={port} />
      </div>
    </>
  );
};

const MockPreview = ({ projectType, repoName, port }: { projectType: ProjectType; repoName: string; port: number }) => {
  if (projectType === "node") {
    return (
      <div className="h-full w-full overflow-auto bg-white text-slate-900">
        <div className="min-h-full p-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-xs font-mono text-slate-500 mb-2">localhost:{port}</div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 mb-2">
              {repoName}
            </h1>
            <p className="text-slate-600 mb-8 text-sm">A React + Vite application running inside a sandboxed container.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "Framework", v: "React 18" }, { l: "Bundler", v: "Vite 5" },
                { l: "Status", v: "Running" }, { l: "Uptime", v: "00:00:12" },
              ].map(c => (
                <div key={c.l} className="bg-slate-50 rounded-md p-3 border border-slate-200">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{c.l}</div>
                  <div className="text-sm font-semibold mt-0.5 text-slate-900">{c.v}</div>
                </div>
              ))}
            </div>
            <button className="mt-6 px-4 py-2 rounded-md bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800">
              Get started
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (projectType === "python") {
    return (
      <div className="h-full w-full overflow-auto bg-white text-slate-900">
        <div className="min-h-full p-10">
          <div className="max-w-2xl mx-auto">
            <div className="text-xs font-mono text-slate-500 mb-2">localhost:{port}</div>
            <h1 className="text-2xl font-semibold mb-2">Flask · {repoName}</h1>
            <p className="text-slate-600 text-sm">Hello, World! This Python application is running in a Docker container.</p>
            <ul className="mt-5 space-y-1.5 text-[13px]">
              <li className="p-2.5 rounded-md bg-slate-50 border border-slate-200 font-mono">server: gunicorn 21.2.0</li>
              <li className="p-2.5 rounded-md bg-slate-50 border border-slate-200 font-mono">workers: 4</li>
              <li className="p-2.5 rounded-md bg-slate-50 border border-slate-200 font-mono">bound: 0.0.0.0:{port}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full w-full overflow-auto bg-slate-950 text-slate-100 font-mono text-sm p-10">
      <div className="max-w-2xl">
        <div className="text-xs text-slate-500 mb-2">localhost:{port}</div>
        <pre className="text-emerald-400">
{`{
  "service": "${repoName}",
  "status": "healthy",
  "port": ${port},
  "uptime_s": 14,
  "version": "1.0.0"
}`}
        </pre>
      </div>
    </div>
  );
};
