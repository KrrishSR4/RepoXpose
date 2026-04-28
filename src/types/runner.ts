export type ProjectType = "node" | "python" | "docker" | "unsupported";

export type RunStatus = "idle" | "cloning" | "detecting" | "installing" | "running" | "success" | "failed";

export type LogLevel = "info" | "success" | "warn" | "error" | "command" | "system";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  text: string;
}

export interface RunStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
}

export interface RunHistoryItem {
  id: string;
  repoUrl: string;
  repoName: string;
  projectType: ProjectType;
  status: RunStatus;
  startedAt: number;
  durationMs: number;
  port: number | null;
}
