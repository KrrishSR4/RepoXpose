import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"]
  }
});

const docker = new Docker();
const PORT = 3001;
const WORKSPACE_DIR = path.join(__dirname, 'workspace');

// Middleware
app.use(cors());
app.use(express.json());

// Ensure workspace directory exists
fs.ensureDirSync(WORKSPACE_DIR);

// Store active containers
const activeContainers = new Map();

// API Routes
app.post('/api/run', async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL required' });
  }

  const jobId = uuidv4();
  const repoDir = path.join(WORKSPACE_DIR, jobId);

  try {
    // Parse GitHub URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\)]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }

    const [, owner, repoName] = match;
    const cleanRepoName = repoName.replace(/\.git$/, '');

    // Create job directory
    fs.ensureDirSync(repoDir);

    // Initialize job status
    activeContainers.set(jobId, {
      status: 'cloning',
      repoUrl,
      repoName: cleanRepoName,
      owner,
      containerId: null,
      port: null,
      startTime: Date.now()
    });

    // Start cloning process
    cloneRepository(jobId, repoUrl, repoDir);

    res.json({
      success: true,
      jobId,
      repoName: cleanRepoName,
      status: 'cloning'
    });

  } catch (error) {
    console.error('Error starting job:', error);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeContainers.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

app.delete('/api/stop/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const job = activeContainers.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  try {
    // Stop and remove container if exists
    if (job.containerId) {
      const container = docker.getContainer(job.containerId);
      await container.stop({ t: 0 });
      await container.remove();
    }

    // Clean up workspace
    const repoDir = path.join(WORKSPACE_DIR, jobId);
    fs.removeSync(repoDir);

    // Remove from active containers
    activeContainers.delete(jobId);

    // Notify via WebSocket
    io.to(jobId).emit('stopped', { message: 'Container stopped' });

    res.json({ success: true, message: 'Job stopped and cleaned up' });

  } catch (error) {
    console.error('Error stopping job:', error);
    res.status(500).json({ error: 'Failed to stop job' });
  }
});

// WebSocket for real-time logs
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-job', (jobId) => {
    socket.join(jobId);
    console.log(`Client ${socket.id} joined job ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper Functions
async function cloneRepository(jobId, repoUrl, repoDir) {
  const job = activeContainers.get(jobId);

  try {
    // Send initial logs
    io.to(jobId).emit('log', {
      type: 'system',
      message: `╔════════════════════════════════════════════╗`
    });
    io.to(jobId).emit('log', {
      type: 'system',
      message: `║  RepoXpose · Paste. Run. Reveal.          ║`
    });
    io.to(jobId).emit('log', {
      type: 'system',
      message: `╚════════════════════════════════════════════╝`
    });

    // Update job status
    job.status = 'cloning';
    io.to(jobId).emit('status', { status: 'cloning' });

    // Clone repository (simplified version)
    const { spawn } = await import('child_process');
    const gitProcess = spawn('git', ['clone', repoUrl, repoDir]);

    gitProcess.stdout.on('data', (data) => {
      io.to(jobId).emit('log', {
        type: 'info',
        message: data.toString().trim()
      });
    });

    gitProcess.stderr.on('data', (data) => {
      io.to(jobId).emit('log', {
        type: 'info',
        message: data.toString().trim()
      });
    });

    gitProcess.on('close', async (code) => {
      if (code === 0) {
        io.to(jobId).emit('log', {
          type: 'success',
          message: '✓ Repository cloned successfully'
        });

        // Detect project type and build container
        await detectAndRunProject(jobId, repoDir);
      } else {
        io.to(jobId).emit('log', {
          type: 'error',
          message: '✗ Failed to clone repository'
        });
        job.status = 'failed';
        io.to(jobId).emit('status', { status: 'failed' });
      }
    });

  } catch (error) {
    console.error('Clone error:', error);
    io.to(jobId).emit('log', {
      type: 'error',
      message: `✗ Clone failed: ${error.message}`
    });
    job.status = 'failed';
    io.to(jobId).emit('status', { status: 'failed' });
  }
}

async function detectAndRunProject(jobId, repoDir) {
  const job = activeContainers.get(jobId);

  try {
    // Update status
    job.status = 'detecting';
    io.to(jobId).emit('status', { status: 'detecting' });

    io.to(jobId).emit('log', {
      type: 'command',
      message: `$ cd ${job.repoName} && ls`
    });

    // Check for project files
    const packageJsonPath = path.join(repoDir, 'package.json');
    const requirementsPath = path.join(repoDir, 'requirements.txt');
    const dockerfilePath = path.join(repoDir, 'Dockerfile');

    let projectType = 'unsupported';
    let port = null;

    if (await fs.pathExists(dockerfilePath)) {
      projectType = 'docker';
      io.to(jobId).emit('log', {
        type: 'success',
        message: '✓ Detected: Docker project (Dockerfile found)'
      });
    } else if (await fs.pathExists(packageJsonPath)) {
      projectType = 'node';
      port = 3000;
      io.to(jobId).emit('log', {
        type: 'success',
        message: '✓ Detected: Node.js project (package.json found)'
      });
    } else if (await fs.pathExists(requirementsPath)) {
      projectType = 'python';
      port = 5000;
      io.to(jobId).emit('log', {
        type: 'success',
        message: '✓ Detected: Python project (requirements.txt found)'
      });
    } else {
      io.to(jobId).emit('log', {
        type: 'error',
        message: '✗ Unsupported project type'
      });
      job.status = 'failed';
      io.to(jobId).emit('status', { status: 'failed' });
      return;
    }

    job.projectType = projectType;
    job.port = port;

    // Build and run container
    await buildAndRunContainer(jobId, repoDir, projectType, port);

  } catch (error) {
    console.error('Detection error:', error);
    job.status = 'failed';
    io.to(jobId).emit('status', { status: 'failed' });
  }
}

async function buildAndRunContainer(jobId, repoDir, projectType, port) {
  const job = activeContainers.get(jobId);

  try {
    job.status = 'installing';
    io.to(jobId).emit('status', { status: 'installing' });

    let dockerfile = '';

    if (projectType === 'docker') {
      // Use existing Dockerfile
      dockerfile = await fs.readFile(path.join(repoDir, 'Dockerfile'), 'utf8');
    } else if (projectType === 'node') {
      // Generate Node.js Dockerfile
      dockerfile = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE ${port}
CMD ["npm", "run", "dev"]`;
    } else if (projectType === 'python') {
      // Generate Python Dockerfile
      dockerfile = `FROM python:3.10-alpine
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE ${port}
CMD ["python", "app.py"]`;
    }

    // Write Dockerfile if not exists
    if (projectType !== 'docker') {
      await fs.writeFile(path.join(repoDir, 'Dockerfile'), dockerfile);
    }

    // Build image
    io.to(jobId).emit('log', {
      type: 'command',
      message: `$ docker build -t repoxpose-${jobId} .`
    });

    const buildStream = await docker.buildImage({
      context: repoDir,
      src: fs.readdirSync(repoDir)
    }, { t: `repoxpose-${jobId}` });

    await new Promise((resolve, reject) => {
      docker.modem.followProgress(buildStream, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }, (event) => {
        if (event.stream) {
          io.to(jobId).emit('log', {
            type: 'info',
            message: event.stream.trim()
          });
        }
      });
    });

    io.to(jobId).emit('log', {
      type: 'success',
      message: `✓ Image built: repoxpose-${jobId}`
    });

    // Run container
    job.status = 'running';
    io.to(jobId).emit('status', { status: 'running' });

    io.to(jobId).emit('log', {
      type: 'command',
      message: `$ docker run -p ${port}:${port} repoxpose-${jobId}`
    });

    const container = await docker.createContainer({
      Image: `repoxpose-${jobId}`,
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig: {
        PortBindings: { [`${port}/tcp`]: [{ HostPort: `${port}` }] }
      }
    });

    await container.start();

    job.containerId = container.id;
    job.status = 'success';

    io.to(jobId).emit('log', {
      type: 'success',
      message: `▶ Application is live on port ${port}`
    });

    io.to(jobId).emit('status', {
      status: 'success',
      port,
      containerId: container.id
    });

    // Stream logs from container
    const logsStream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      timestamps: false
    });

    logsStream.on('data', (chunk) => {
      const log = chunk.toString().trim();
      if (log) {
        io.to(jobId).emit('log', {
          type: 'info',
          message: log
        });
      }
    });

  } catch (error) {
    console.error('Container error:', error);
    job.status = 'failed';
    io.to(jobId).emit('status', { status: 'failed' });
    io.to(jobId).emit('log', {
      type: 'error',
      message: `✗ Container failed: ${error.message}`
    });
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`RepoXpose Server running on http://localhost:${PORT}`);
  console.log('Docker integration ready');
});
