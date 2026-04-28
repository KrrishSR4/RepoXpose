# 🐳 Docker Execution Flow - RepoXpose

This document explains how RepoXpose clones, detects, and runs any GitHub repository inside an isolated Docker environment.

---

## ⚙️ Overview

For every repository:

1. Clone the repo
2. Detect project type
3. Generate runtime instructions
4. Run inside a Docker container
5. Stream logs + expose preview

---

## 📦 Step 1: Clone Repository

```bash
git clone <repo_url>
cd <repo_name>
```

---

## 🔍 Step 2: Detect Project Type

Detection is based on files:

* `package.json` → Node.js
* `requirements.txt` / `pyproject.toml` → Python
* `Dockerfile` → Use directly
* else → unsupported

---

## 🐳 Step 3: Docker Execution Strategy

### Case 1: If Dockerfile exists

```bash
docker build -t repoxpose-app .
docker run -p 3000:3000 repoxpose-app
```

---

### Case 2: Node.js Project

#### Dockerfile (generated dynamically)

```Dockerfile
FROM node:18

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 3000

CMD ["npm","run","dev"]
```

#### Run:

```bash
docker build -t repoxpose-node .
docker run -p 3000:3000 repoxpose-node
```

---

### Case 3: Python Project

#### Dockerfile (generated dynamically)

```Dockerfile
FROM python:3.10

WORKDIR /app
COPY . .

RUN pip install -r requirements.txt

EXPOSE 5000

CMD ["python","app.py"]
```

#### Run:

```bash
docker build -t repoxpose-python .
docker run -p 5000:5000 repoxpose-python
```

---

## 📡 Step 4: Logs Streaming

* Capture container stdout/stderr
* Stream via WebSocket to frontend

---

## 🌐 Step 5: Preview Handling

* Detect running port (3000, 5000, etc.)
* Map container port to host
* Serve via reverse proxy

Example:

```
https://<project>-3000.repoxpose.app
```

---

## 🔐 Security Measures

* Run containers in isolation
* Limit CPU & memory
* Disable privileged mode
* Set execution timeout
* Auto-stop containers after inactivity

---

## 🧠 Future Improvements

* Multi-language support (Go, Java, PHP)
* Auto port detection
* Smart retry on failure
* AI-based error fixing

---

## 🚀 Summary

RepoXpose uses Docker to:

* Safely run unknown code
* Ensure consistent environments
* Enable live preview and logs

All executions are sandboxed and temporary.
