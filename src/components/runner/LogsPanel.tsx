import { useEffect, useRef } from "react";
import { Copy, Download, Trash2, Terminal, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { LogEntry, RunStatus } from "@/types/runner";
import { cn } from "@/lib/utils";

interface LogsPanelProps {
  logs: LogEntry[];
  status: RunStatus;
  onClear: () => void;
}

const levelStyles: Record<LogEntry["level"], string> = {
  info: "text-[hsl(220_15%_82%)]",
  success: "text-[hsl(137_60%_60%)]",
  warn: "text-[hsl(38_92%_62%)]",
  error: "text-[hsl(358_75%_68%)]",
  command: "text-[hsl(137_65%_65%)] font-semibold",
  system: "text-[hsl(200_75%_65%)]",
};

const levelPrefix: Record<LogEntry["level"], string> = {
  info: " ",
  success: "✓",
  warn: "!",
  error: "✗",
  command: "›",
  system: "▶",
};

export const LogsPanel = ({ logs, status, onClear }: LogsPanelProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const isStreaming = status === "cloning" || status === "detecting" || status === "installing" || status === "running";

  const copyLogs = async () => {
    const text = logs.map(l => `[${new Date(l.ts).toISOString()}] ${l.text}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Logs copied");
  };

  const downloadLogs = () => {
    const text = logs.map(l => `[${new Date(l.ts).toISOString()}] ${l.text}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repoxpose-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs downloaded");
  };

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 panel-header flex-shrink-0">
        <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span>Execution log</span>
          {isStreaming && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5 text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-medium">streaming</span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton onClick={copyLogs} title="Copy logs" disabled={logs.length === 0}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={downloadLogs} title="Download logs" disabled={logs.length === 0}>
            <Download className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton onClick={onClear} title="Clear" disabled={logs.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[12px] leading-relaxed bg-terminal-bg text-terminal-fg"
      >
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="px-3 py-2.5">
            {logs.map((log, i) => (
              <LogLine key={log.id} log={log} index={i} />
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-[hsl(137_65%_65%)] mt-1">
                <ChevronRight className="h-3 w-3" />
                <span className="terminal-cursor" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 h-7 border-t border-terminal-border bg-terminal-header text-terminal-fg/70 flex items-center justify-between text-[10.5px] font-mono flex-shrink-0">
        <span>{logs.length} lines</span>
        <span className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>BASH</span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            ws://server/logs
          </span>
        </span>
      </div>
    </div>
  );
};

const LogLine = ({ log, index }: { log: LogEntry; index: number }) => {
  const time = new Date(log.ts).toLocaleTimeString("en-GB", { hour12: false });
  const isError = log.level === "error";
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-1.5 py-px -mx-1.5 rounded animate-slide-in-left",
        isError && "bg-destructive/8 border-l-2 border-destructive/60 pl-1"
      )}
      style={{ animationDelay: `${Math.min(index * 6, 150)}ms` }}
    >
      <span className="text-terminal-fg/40 select-none flex-shrink-0 text-[10.5px] tabular-nums mt-0.5">
        {time}
      </span>
      <span className={cn("flex-shrink-0 select-none w-3 text-center font-bold", levelStyles[log.level])}>
        {levelPrefix[log.level]}
      </span>
      <span className={cn("whitespace-pre-wrap break-all flex-1", levelStyles[log.level])}>
        {log.text}
      </span>
    </div>
  );
};

const EmptyState = () => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
    <Terminal className="h-10 w-10 text-terminal-fg/30" strokeWidth={1.25} />
    <div>
      <p className="text-[13px] font-medium text-terminal-fg/80">Awaiting execution</p>
      <p className="text-[11px] text-terminal-fg/50 mt-1">
        Enter a repository URL and press Run
      </p>
    </div>
  </div>
);

const IconButton = ({
  children, onClick, title, disabled,
}: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
  >
    {children}
  </button>
);
