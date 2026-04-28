import type { LogEntry, LogLevel, ProjectType, RunStep } from "@/types/runner";

let logCounter = 0;
export const makeLog = (level: LogLevel, text: string): LogEntry => ({
  id: `log-${Date.now()}-${++logCounter}`,
  ts: Date.now(),
  level,
  text,
});

export function parseRepo(url: string): { owner: string; name: string } | null {
  try {
    const u = new URL(url.trim());
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], name: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export const isValidGithubUrl = (url: string) => parseRepo(url) !== null;

// Pseudo-random but deterministic from repo name
function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function detectProjectType(repoName: string): ProjectType {
  const h = hashString(repoName.toLowerCase());
  const types: ProjectType[] = ["node", "node", "python", "docker", "node"];
  return types[h % types.length];
}

export const projectTypeMeta: Record<ProjectType, { label: string; file: string; port: number; color: string }> = {
  node: { label: "Node.js", file: "package.json", port: 3000, color: "text-success" },
  python: { label: "Python", file: "requirements.txt", port: 5000, color: "text-info" },
  docker: { label: "Docker", file: "Dockerfile", port: 8000, color: "text-primary" },
  unsupported: { label: "Unsupported", file: "—", port: 0, color: "text-destructive" },
};

export const buildSteps = (type: ProjectType): RunStep[] => {
  const base: RunStep[] = [
    { id: "clone", label: "Clone repository", status: "pending" },
    { id: "detect", label: "Detect project type", status: "pending" },
  ];
  if (type === "node") {
    base.push(
      { id: "install", label: "Install dependencies (npm install)", status: "pending" },
      { id: "run", label: "Run dev server (npm run dev)", status: "pending" },
    );
  } else if (type === "python") {
    base.push(
      { id: "install", label: "Install dependencies (pip install)", status: "pending" },
      { id: "run", label: "Start app (python app.py)", status: "pending" },
    );
  } else if (type === "docker") {
    base.push(
      { id: "build", label: "Build image (docker build .)", status: "pending" },
      { id: "run", label: "Run container (docker run)", status: "pending" },
    );
  }
  return base;
};

interface ScriptedLog {
  delay: number;
  level: LogLevel;
  text: string;
  step?: string;
  stepStatus?: "active" | "done" | "failed";
}

export function buildScript(repo: { owner: string; name: string }, type: ProjectType): ScriptedLog[] {
  const repoUrl = `https://github.com/${repo.owner}/${repo.name}.git`;
  const port = projectTypeMeta[type].port;

  const script: ScriptedLog[] = [
    { delay: 200, level: "system", text: `▶ Provisioning isolated Docker sandbox...` },
    { delay: 350, level: "info", text: `Container ID: c8f${Math.random().toString(16).slice(2, 10)}` },
    { delay: 250, level: "info", text: `Image: alpine:3.19` },
    { delay: 300, level: "command", text: `$ git clone ${repoUrl}`, step: "clone", stepStatus: "active" },
    { delay: 400, level: "info", text: `Cloning into '${repo.name}'...` },
    { delay: 350, level: "info", text: `remote: Enumerating objects: 1247, done.` },
    { delay: 300, level: "info", text: `remote: Counting objects: 100% (1247/1247), done.` },
    { delay: 400, level: "info", text: `remote: Compressing objects: 100% (842/842), done.` },
    { delay: 500, level: "info", text: `Receiving objects: 100% (1247/1247), 4.21 MiB | 8.42 MiB/s, done.` },
    { delay: 250, level: "success", text: `✓ Repository cloned successfully`, step: "clone", stepStatus: "done" },
    { delay: 300, level: "command", text: `$ cd ${repo.name} && ls`, step: "detect", stepStatus: "active" },
  ];

  if (type === "node") {
    script.push(
      { delay: 250, level: "info", text: `package.json  src/  public/  vite.config.ts  README.md` },
      { delay: 200, level: "success", text: `✓ Detected: Node.js project (package.json found)`, step: "detect", stepStatus: "done" },
      { delay: 300, level: "command", text: `$ npm install`, step: "install", stepStatus: "active" },
      { delay: 400, level: "info", text: `npm warn deprecated inflight@1.0.6: This module is not supported` },
      { delay: 600, level: "info", text: `added 312 packages in 14s` },
      { delay: 500, level: "info", text: `┌─ vulnerabilities ──────────┐` },
      { delay: 200, level: "info", text: `│  found 0 vulnerabilities   │` },
      { delay: 200, level: "info", text: `└────────────────────────────┘` },
      { delay: 300, level: "success", text: `✓ Dependencies installed`, step: "install", stepStatus: "done" },
      { delay: 400, level: "command", text: `$ npm run dev`, step: "run", stepStatus: "active" },
      { delay: 500, level: "info", text: `> ${repo.name}@1.0.0 dev` },
      { delay: 200, level: "info", text: `> vite` },
      { delay: 600, level: "info", text: `  VITE v5.4.10  ready in 412 ms` },
      { delay: 200, level: "success", text: `  ➜  Local:   http://localhost:${port}/` },
      { delay: 200, level: "info", text: `  ➜  Network: use --host to expose` },
      { delay: 300, level: "system", text: `▶ Application is live on port ${port}`, step: "run", stepStatus: "done" },
    );
  } else if (type === "python") {
    script.push(
      { delay: 250, level: "info", text: `app.py  requirements.txt  templates/  static/` },
      { delay: 200, level: "success", text: `✓ Detected: Python project (requirements.txt found)`, step: "detect", stepStatus: "done" },
      { delay: 300, level: "command", text: `$ pip install -r requirements.txt`, step: "install", stepStatus: "active" },
      { delay: 400, level: "info", text: `Collecting flask==3.0.0` },
      { delay: 350, level: "info", text: `  Downloading flask-3.0.0-py3-none-any.whl (99 kB)` },
      { delay: 300, level: "info", text: `Collecting gunicorn==21.2.0` },
      { delay: 400, level: "info", text: `Installing collected packages: werkzeug, jinja2, flask, gunicorn` },
      { delay: 500, level: "success", text: `Successfully installed flask-3.0.0 gunicorn-21.2.0`, step: "install", stepStatus: "done" },
      { delay: 300, level: "command", text: `$ python app.py`, step: "run", stepStatus: "active" },
      { delay: 500, level: "info", text: ` * Serving Flask app 'app'` },
      { delay: 200, level: "info", text: ` * Debug mode: on` },
      { delay: 200, level: "warn", text: `WARNING: This is a development server. Do not use in production.` },
      { delay: 200, level: "success", text: ` * Running on http://0.0.0.0:${port}` },
      { delay: 300, level: "system", text: `▶ Application is live on port ${port}`, step: "run", stepStatus: "done" },
    );
  } else if (type === "docker") {
    script.push(
      { delay: 250, level: "info", text: `Dockerfile  docker-compose.yml  src/  README.md` },
      { delay: 200, level: "success", text: `✓ Detected: Dockerfile found, using container build`, step: "detect", stepStatus: "done" },
      { delay: 300, level: "command", text: `$ docker build -t ${repo.name}:latest .`, step: "build", stepStatus: "active" },
      { delay: 400, level: "info", text: `[+] Building 18.4s (12/12) FINISHED` },
      { delay: 200, level: "info", text: ` => [internal] load build definition from Dockerfile` },
      { delay: 250, level: "info", text: ` => [1/6] FROM docker.io/library/node:20-alpine` },
      { delay: 400, level: "info", text: ` => [2/6] WORKDIR /app` },
      { delay: 350, level: "info", text: ` => [3/6] COPY package*.json ./` },
      { delay: 500, level: "info", text: ` => [4/6] RUN npm ci --only=production` },
      { delay: 300, level: "info", text: ` => exporting layers` },
      { delay: 250, level: "success", text: `✓ Image built: ${repo.name}:latest`, step: "build", stepStatus: "done" },
      { delay: 300, level: "command", text: `$ docker run -p ${port}:${port} ${repo.name}:latest`, step: "run", stepStatus: "active" },
      { delay: 500, level: "info", text: `Server listening on 0.0.0.0:${port}` },
      { delay: 200, level: "info", text: `Health check: OK` },
      { delay: 300, level: "system", text: `▶ Container running on port ${port}`, step: "run", stepStatus: "done" },
    );
  }

  return script;
}
