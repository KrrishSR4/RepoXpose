import { useCallback, useEffect, useRef, useState } from "react";
import type { LogEntry, ProjectType, RunHistoryItem, RunStatus, RunStep } from "@/types/runner";
import { buildScript, buildSteps, detectProjectType, makeLog, parseRepo, projectTypeMeta } from "@/lib/runnerEngine";
import { toast } from "sonner";

export interface ExecutionInfo {
  status: "running" | "success" | "failed";
  stack: ProjectType;
  port: number | null;
  startupMs: number | null;
  dependencies: number;
  errorReason?: string;
  suggestedFix?: string;
  fixCommand?: string;
}

export function useRunner() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState<string | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [executionInfo, setExecutionInfo] = useState<ExecutionInfo | null>(null);

  const timeoutsRef = useRef<number[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach(t => window.clearTimeout(t));
    timeoutsRef.current = [];
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const run = useCallback((url: string) => {
    const parsed = parseRepo(url);
    if (!parsed) {
      toast.error("Invalid GitHub URL");
      return;
    }

    clearTimers();
    setRepoUrl(url);
    setRepoName(parsed.name);
    setLogs([]);
    setElapsedMs(0);
    startedAtRef.current = Date.now();

    const type = detectProjectType(parsed.name);
    setProjectType(type);
    const initialSteps = buildSteps(type);
    setSteps(initialSteps);
    setStatus("cloning");

    // Seed deterministic dependency count from repo name
    const seed = parsed.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const depCount = type === "node" ? 180 + (seed % 260) : type === "python" ? 8 + (seed % 28) : 12 + (seed % 20);
    const portEarly = type === "node" ? 3000 : type === "python" ? 5000 : 8000;

    setExecutionInfo({
      status: "running",
      stack: type,
      port: portEarly,
      startupMs: null,
      dependencies: depCount,
    });

    // start elapsed ticker
    tickerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);

    setLogs([
      makeLog("system", `╔════════════════════════════════════════════╗`),
      makeLog("system", `║  RepoXpose · Paste. Run. Reveal.          ║`),
      makeLog("system", `╚════════════════════════════════════════════╝`),
      makeLog("info", `Repository: ${parsed.owner}/${parsed.name}`),
      makeLog("info", `Job ID: job_${Math.random().toString(36).slice(2, 12)}`),
    ]);

    const script = buildScript(parsed, type);
    let cumulative = 0;

    script.forEach((entry) => {
      cumulative += entry.delay;
      const t = window.setTimeout(() => {
        setLogs(prev => [...prev, makeLog(entry.level, entry.text)]);

        if (entry.step && entry.stepStatus) {
          setSteps(prev => prev.map(s =>
            s.id === entry.step ? { ...s, status: entry.stepStatus! } : s
          ));
          // Map step to overall status
          if (entry.stepStatus === "active") {
            const statusMap: Record<string, RunStatus> = {
              clone: "cloning", detect: "detecting",
              install: "installing", build: "installing", run: "running"
            };
            const newStatus = statusMap[entry.step];
            if (newStatus) setStatus(newStatus);
          }
        }
      }, cumulative);
      timeoutsRef.current.push(t);
    });

    // Final completion
    const finalT = window.setTimeout(() => {
      setStatus("success");
      const duration = Date.now() - startedAtRef.current;
      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      setElapsedMs(duration);

      const port = type === "node" ? 3000 : type === "python" ? 5000 : 8000;
      setHistory(prev => [{
        id: `run-${Date.now()}`,
        repoUrl: url,
        repoName: parsed.name,
        projectType: type,
        status: "success" as RunStatus,
        startedAt: startedAtRef.current,
        durationMs: duration,
        port,
      }, ...prev].slice(0, 10));

      toast.success(`${parsed.name} is live`, {
        description: `Running on port ${port}`,
      });

      setExecutionInfo({
        status: "success",
        stack: type,
        port,
        startupMs: duration,
        dependencies: depCount,
      });
    }, cumulative + 400);
    timeoutsRef.current.push(finalT);
  }, [clearTimers]);

  const stop = useCallback(() => {
    clearTimers();
    setStatus("failed");
    setSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "failed" } : s));
    const missingModules = ["axios", "express", "lodash", "dotenv", "react-router-dom"];
    const missing = missingModules[Math.floor(Math.random() * missingModules.length)];
    setLogs(prev => [...prev,
      makeLog("error", `✗ Error: Cannot find module '${missing}'`),
      makeLog("error", `✗ Build failed — missing dependency`),
      makeLog("system", "▶ Container terminated"),
    ]);
    setExecutionInfo(prev => prev ? {
      ...prev,
      status: "failed",
      startupMs: Date.now() - startedAtRef.current,
      errorReason: `Module not found: '${missing}' is not installed in the container.`,
      suggestedFix: `Install the missing dependency and retry the build.`,
      fixCommand: prev.stack === "python" ? `pip install ${missing}` : `npm install ${missing}`,
    } : prev);
    toast.warning("Execution stopped");
  }, [clearTimers]);

  const retry = useCallback(() => {
    if (repoUrl) run(repoUrl);
  }, [repoUrl, run]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    status, logs, steps, projectType, repoName, repoUrl, history, elapsedMs, executionInfo,
    run, stop, retry, clearLogs,
  };
}
