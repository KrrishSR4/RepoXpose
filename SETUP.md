# 🚀 RepoXpose Setup Guide

## Prerequisites

1. **Docker Desktop** installed and running
2. **Node.js** (v18+) installed
3. **Git** installed

## Quick Setup

### 1. Install Dependencies

```bash
# Frontend dependencies
cd /path/to/Repoxpose
npm install

# Backend dependencies  
cd server
npm install
```

### 2. Start Servers

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```
Server will start on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd /path/to/Repoxpose
npm run dev
```
Frontend will start on `http://localhost:8080`

### 3. Test It

1. Open `http://localhost:8080`
2. Enter a GitHub URL (e.g., `https://github.com/vercel/next.js`)
3. Click "Run"
4. Watch real Docker execution!

## How It Works

```
Frontend (React:8080) → Backend (Node.js:3001) → Docker Engine
        ↓                      ↓                      ↓
   WebSocket Logs        Real Containers      Live Preview
```

## Features

✅ **Real Docker Integration** - Not simulation!  
✅ **Live Log Streaming** - Via WebSocket  
✅ **Project Detection** - Node.js, Python, Docker  
✅ **Container Management** - Auto cleanup  
✅ **Preview URLs** - localhost:port access  

## Architecture

### Backend API Endpoints

- `POST /api/run` - Start repository execution
- `GET /api/status/:jobId` - Get job status  
- `DELETE /api/stop/:jobId` - Stop and cleanup job
- `WebSocket /logs/:jobId` - Real-time log streaming

### Docker Flow

1. Clone repository to `server/workspace/{jobId}`
2. Detect project type (package.json, requirements.txt, Dockerfile)
3. Generate or use existing Dockerfile
4. Build container image
5. Run container with port mapping
6. Stream logs via WebSocket
7. Expose preview on localhost:port

## Security Features

- Isolated Docker containers
- Auto cleanup after completion
- Resource limits (can be extended)
- No privileged mode
- Temporary workspace cleanup

## Troubleshooting

### Docker Not Running
```bash
# Check Docker status
docker --version
docker ps
```

### Backend Connection Error
```bash
# Check if backend is running
curl http://localhost:3001
```

### Port Conflicts
```bash
# Check what's using ports
netstat -an | grep :3001
netstat -an | grep :8080
```

## Development

### Project Structure
```
Repoxpose/
├── src/                    # Frontend React code
│   ├── hooks/
│   │   ├── useRunner.ts    # Original simulation
│   │   └── useRunnerReal.ts # Real Docker integration
│   ├── components/         # UI components
│   └── pages/             # Main pages
├── server/                # Backend Node.js code
│   ├── index.js          # Main server file
│   ├── package.json      # Backend dependencies
│   └── workspace/        # Temporary repo clones
└── docs/                 # Documentation
```

### Switching Between Simulation and Real Docker

**To use simulation:**
```typescript
// In src/pages/Index.tsx
import { useRunner } from "@/hooks/useRunner";
const runner = useRunner();
```

**To use real Docker:**
```typescript
// In src/pages/Index.tsx  
import { useRunnerReal } from "@/hooks/useRunnerReal";
const runner = useRunnerReal();
```

## Next Steps

- [ ] Add reverse proxy for custom preview URLs
- [ ] Implement security limits and quotas
- [ ] Add more project types (Go, Java, PHP)
- [ ] Auto port detection
- [ ] Container health monitoring

## Support

If you face any issues:
1. Check Docker is running
2. Verify both servers are started
3. Check browser console for errors
4. Review backend terminal logs
