import { useState, type FormEvent } from "react";
import { Github, Play, Loader2, Square, RotateCw, AlertCircle, X, PanelRightClose, PanelRightOpen } from "lucide-react";
import { isValidGithubUrl } from "@/lib/runnerEngine";
import type { RunStatus } from "@/types/runner";
import { cn } from "@/lib/utils";

interface RepoInputBarProps {
  onRun: (url: string) => void;
  onStop: () => void;
  onRetry: () => void;
  status: RunStatus;
  currentUrl: string;
  showPreview: boolean;
  onTogglePreview: () => void;
}

const examples = [
  "vercel/next.js",
  "pallets/flask",
  "expressjs/express",
];

export const RepoInputBar = ({
  onRun, onStop, onRetry, status, currentUrl, showPreview, onTogglePreview,
}: RepoInputBarProps) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isRunning = status !== "idle" && status !== "success" && status !== "failed";
  const isDone = status === "success" || status === "failed";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return setError("Please enter a GitHub repository URL");
    if (!isValidGithubUrl(url)) return setError("Invalid GitHub URL · format: https://github.com/owner/repo");
    setError(null);
    onRun(url.trim());
  };

  return (
    <div className="border-b border-border/80 bg-background-elevated/40 backdrop-blur-sm">
      <div className="container py-3">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className={cn(
              "flex items-center h-9 rounded-md border bg-input transition-colors",
              "border-border focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15"
            )}>
              <div className="flex items-center justify-center w-9 h-full text-muted-foreground">
                <Github className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null); }}
                placeholder="https://github.com/owner/repository"
                disabled={isRunning}
                className="flex-1 h-full bg-transparent border-0 outline-none text-[13px] font-mono placeholder:text-muted-foreground/60 disabled:opacity-50"
                aria-label="GitHub repository URL"
              />
              {url && !isRunning && (
                <button
                  type="button"
                  onClick={() => { setUrl(""); setError(null); }}
                  className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Clear input"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {error && (
              <div className="absolute left-0 top-full mt-1 flex items-center gap-1.5 text-[11px] font-medium text-destructive animate-fade-in">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isRunning && !isDone && (
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-hover transition-colors"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Run
              </button>
            )}
            {isRunning && (
              <>
                <button
                  type="button"
                  disabled
                  className="inline-flex h-9 items-center gap-1.5 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold opacity-90"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running
                </button>
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md border border-border text-[13px] font-medium text-foreground hover:border-destructive/50 hover:text-destructive transition-colors"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop
                </button>
              </>
            )}
            {isDone && (
              <>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md border border-border text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary-hover transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  New run
                </button>
              </>
            )}

            <div className="hidden md:block w-px h-6 bg-border mx-1" />

            <button
              type="button"
              onClick={onTogglePreview}
              className={cn(
                "hidden md:inline-flex h-9 items-center gap-1.5 px-3 rounded-md border text-[13px] font-medium transition-colors",
                showPreview
                  ? "border-border text-foreground hover:bg-muted"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview
                ? <PanelRightClose className="h-3.5 w-3.5" />
                : <PanelRightOpen className="h-3.5 w-3.5" />}
              <span>{showPreview ? "Hide preview" : "Show preview"}</span>
            </button>
          </div>
        </form>

        {!currentUrl && !isRunning && (
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-muted-foreground font-medium">Try:</span>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setUrl(`https://github.com/${ex}`)}
                className="px-2 py-0.5 rounded font-mono text-[11px] border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
