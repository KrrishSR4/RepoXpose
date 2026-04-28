import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { LogEntry, ProjectType, RunHistoryItem, RunStatus, RunStep } from "@/types/runner";
import { buildSteps, makeLog, parseRepo, projectTypeMeta } from "@/lib/runnerEngine";
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

export function useRunnerReal() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState<string | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [executionInfo, setExecutionInfo] = useState<ExecutionInfo | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to backend server');
    });

    socket.on('log', (data: { type: string; message: string }) => {
      const logEntry = makeLog(data.type as LogEntry['level'], data.message);
      setLogs(prev => [...prev, logEntry]);
    });

    socket.on('status', (data: { status: RunStatus; port?: number; containerId?: string }) => {
      setStatus(data.status);

      // Update steps based on status
      setSteps(prev => prev.map(step => {
        const stepMap: Record<RunStatus, string> = {
          idle: 'pending',
          cloning: 'clone',
          detecting: 'detect',
          installing: 'install',
          running: 'run',
          success: 'done',
          failed: 'failed'
        };

        const targetStep = stepMap[data.status];
        return step.id === targetStep ? { ...step, status: data.status === 'failed' ? 'failed' : 'active' } : step;
      }));

      if (data.status === 'success' && data.port) {
        setExecutionInfo({
          status: 'success',
          stack: projectType || 'node',
          port: data.port,
          startupMs: Date.now() - startedAtRef.current,
          dependencies: 0
        });

        // Add to history
        if (repoName && repoUrl) {
          setHistory(prev => [{
            id: `run-${Date.now()}`,
            repoUrl,
            repoName,
            projectType: projectType || 'node',
            status: 'success' as RunStatus,
            startedAt: startedAtRef.current,
            durationMs: Date.now() - startedAtRef.current,
            port: data.port
          }, ...prev].slice(0, 10));
        }

        toast.success(`${repoName} is live`, {
          description: `Running on port ${data.port}`,
        });
      }
    });

    socket.on('stopped', () => {
      setStatus('failed');
      toast.warning('Execution stopped');
    });

    return () => {
      socket.disconnect();
    };
  }, [projectType, repoName, repoUrl]);

  // Start elapsed time ticker
  useEffect(() => {
    if (status === 'cloning' || status === 'detecting' || status === 'installing' || status === 'running') {
      startedAtRef.current = Date.now();
      tickerRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 100);
    } else {
      if (tickerRef.current !== null) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }

    return () => {
      if (tickerRef.current !== null) {
        clearInterval(tickerRef.current);
      }
    };
  }, [status]);

  const run = useCallback(async (url: string) => {
    const parsed = parseRepo(url);
    if (!parsed) {
      toast.error("Invalid GitHub URL");
      return;
    }

    try {
      // Clear previous state
      setLogs([]);
      setElapsedMs(0);
      setRepoUrl(url);
      setRepoName(parsed.name);

      // Detect project type for UI
      const type = detectProjectType(parsed.name);
      setProjectType(type);
      setSteps(buildSteps(type));

      // Call backend API
      const response = await fetch('http://localhost:3001/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl: url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start job');
      }

      // Join WebSocket room for this job
      setCurrentJobId(data.jobId);
      socketRef.current?.emit('join-job', data.jobId);

      // Set initial status
      setStatus('cloning');
      setExecutionInfo({
        status: 'running',
        stack: type,
        port: type === 'node' ? 3000 : type === 'python' ? 5000 : 8000,
        startupMs: null,
        dependencies: 0
      });

      // Add initial logs
      setLogs([
        makeLog("system", `╔════════════════════════════════════════════╗`),
        makeLog("system", `║  RepoXpose · Paste. Run. Reveal.          ║`),
        makeLog("system", `╚════════════════════════════════════════════╝`),
        makeLog("info", `Repository: ${parsed.owner}/${parsed.name}`),
        makeLog("info", `Job ID: ${data.jobId}`),
      ]);

    } catch (error) {
      console.error('Run error:', error);
      toast.error(error.message || 'Failed to start repository');
      setStatus('failed');
    }
  }, []);

  const stop = useCallback(async () => {
    if (!currentJobId) return;

    try {
      const response = await fetch(`http://localhost:3001/api/job/${currentJobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to stop job');
      }

      setStatus('failed');
      setCurrentJobId(null);

    } catch (error) {
      console.error('Stop error:', error);
      toast.error('Failed to stop execution');
    }
  }, [currentJobId]);

  const retry = useCallback(() => {
    if (repoUrl) run(repoUrl);
  }, [repoUrl, run]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    status,
    logs,
    steps,
    projectType,
    repoName,
    repoUrl,
    history,
    elapsedMs,
    executionInfo,
    run,
    stop,
    retry,
    clearLogs,
  };
}

// Helper function to detect project type (moved from runnerEngine)
function detectProjectType(repoName: string): ProjectType {
  // Simple hash-based detection for demo
  // In real implementation, this would be done by backend
  const hash = repoName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const types: ProjectType[] = ["node", "node", "python", "docker", "node"];
  return types[hash % types.length];
}
