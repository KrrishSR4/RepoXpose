import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const docker = new Docker();
const PORT = 3001;
const TEMP_DIR = path.join(__dirname, 'temp');

// Pre-pull base images at startup
async function pullBaseImages() {
  try {
    console.log('Pre-pulling base images...');
    await docker.pull('node:18-alpine', (err, stream) => {
      if (err) console.error('Error pulling node:18-alpine:', err);
      else console.log('node:18-alpine pulled successfully');
    });
    await docker.pull('python:3.10-alpine', (err, stream) => {
      if (err) console.error('Error pulling python:3.10-alpine:', err);
      else console.log('python:3.10-alpine pulled successfully');
    });
  } catch (error) {
    console.error('Error pre-pulling images:', error);
  }
}
pullBaseImages();

app.use(cors());
app.use(express.json());

fs.ensureDirSync(TEMP_DIR);

const activeJobs = new Map();

// API endpoint to accept GitHub URL
app.post('/api/execute', async (req, res) => {
  const { repoUrl } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'GitHub URL required' });
  }

  const jobId = uuidv4();
  const workDir = path.join(TEMP_DIR, jobId);

  try {
    fs.ensureDirSync(workDir);

    const job = {
      id: jobId,
      repoUrl,
      workDir,
      status: 'cloning',
      stack: null,
      port: null,
      containerId: null,
      logs: []
    };

    activeJobs.set(jobId, job);

    // Start execution
    executeRepository(jobId, repoUrl, workDir);

    res.json({
      jobId,
      status: 'started'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get job status
app.get('/api/job/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Stop and cleanup job
app.delete('/api/job/:jobId', async (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  await cleanupJob(job);
  activeJobs.delete(req.params.jobId);

  res.json({ status: 'stopped' });
});

// WebSocket for real-time logs
io.on('connection', (socket) => {
  socket.on('join-job', (jobId) => {
    socket.join(jobId);
  });
});

async function executeRepository(jobId, repoUrl, workDir) {
  const job = activeJobs.get(jobId);

  try {
    // Step 1: Clone repository
    await cloneRepo(job, repoUrl, workDir);

    // Step 2: Detect project type
    const projectType = await detectProjectType(workDir);
    job.stack = projectType;

    // Step 3: Generate or use Dockerfile
    await prepareDockerfile(workDir, projectType);

    // Step 4: Build and run container
    await buildAndRun(job, workDir, projectType);

  } catch (error) {
    job.status = 'failed';
    job.logs.push({ type: 'error', message: error.message });
    io.to(jobId).emit('log', { type: 'error', message: error.message });
  }
}

async function cloneRepo(job, repoUrl, workDir) {
  return new Promise((resolve, reject) => {
    job.status = 'cloning';
    const log = (type, message) => {
      job.logs.push({ type, message });
      io.to(job.id).emit('log', { type, message });
    };

    log('info', `Cloning ${repoUrl}...`);

    const gitProcess = spawn('git', ['clone', repoUrl, workDir]);

    gitProcess.stdout.on('data', (data) => {
      log('info', data.toString().trim());
    });

    gitProcess.stderr.on('data', (data) => {
      log('info', data.toString().trim());
    });

    gitProcess.on('close', (code) => {
      if (code === 0) {
        log('success', 'Repository cloned successfully');
        resolve();
      } else {
        reject(new Error('Git clone failed'));
      }
    });
  });
}

async function detectProjectType(workDir) {
  const files = fs.readdirSync(workDir);

  if (files.includes('Dockerfile')) {
    return 'docker';
  } else if (files.includes('package.json')) {
    return 'node';
  } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
    return 'python';
  }

  throw new Error('Unsupported project type');
}

async function prepareDockerfile(workDir, projectType) {
  if (projectType === 'docker') {
    return; // Use existing Dockerfile
  }

  let dockerfile = '';

  if (projectType === 'node') {
    dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --prefer-offline --no-audit --progress=false

COPY . .

EXPOSE 3000

CMD ["npm","start"]`;
  } else if (projectType === 'python') {
    dockerfile = `FROM python:3.10-alpine
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python","app.py"]`;
  }

  await fs.writeFile(path.join(workDir, 'Dockerfile'), dockerfile);
}

async function buildAndRun(job, workDir, projectType) {
  const log = (type, message) => {
    job.logs.push({ type, message });
    io.to(job.id).emit('log', { type, message });
  };

  try {
    // Get random port
    const hostPort = getAvailablePort();
    const containerPort = projectType === 'node' ? 3000 : 5000;
    job.port = hostPort;

    // Build image
    job.status = 'building';
    log('info', 'Starting Docker build...');

    const buildStream = await docker.buildImage({
      context: workDir,
      src: fs.readdirSync(workDir)
    }, { t: `temp-app-${job.id}`, forcerm: true });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Build timeout after 5 minutes'));
      }, 5 * 60 * 1000);

      docker.modem.followProgress(buildStream, (err, res) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(res);
      }, (event) => {
        if (event.stream) {
          const message = event.stream.trim();
          if (message) {
            log('info', message);
          }
        }
        if (event.error) {
          clearTimeout(timeout);
          reject(new Error(event.error));
        }
      });
    });

    log('success', 'Image built successfully');

    // Run container
    job.status = 'running';
    log('info', 'Running container...');

    const container = await docker.createContainer({
      Image: `temp-app-${job.id}`,
      ExposedPorts: { [`${containerPort}/tcp`]: {} },
      HostConfig: {
        PortBindings: { [`${containerPort}/tcp`]: [{ HostPort: `${hostPort}` }] },
        AutoRemove: true
      }
    });

    await container.start();
    job.containerId = container.id;
    job.status = 'running';

    log('success', `Container running on port ${hostPort}`);

    // Stream logs
    streamLogs(job, container);

    // Auto cleanup after 10 minutes
    setTimeout(() => {
      cleanupJob(job);
    }, 10 * 60 * 1000);

  } catch (error) {
    job.status = 'failed';
    log('error', error.message);
  }
}

async function streamLogs(job, container) {
  try {
    const logsStream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      timestamps: false
    });

    logsStream.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (message) {
        job.logs.push({ type: 'info', message });
        io.to(job.id).emit('log', { type: 'info', message });
      }
    });
  } catch (error) {
    console.log('Could not stream logs:', error.message);
  }
}

async function cleanupJob(job) {
  try {
    // Stop container
    if (job.containerId) {
      const container = docker.getContainer(job.containerId);
      await container.stop({ t: 0 });
    }

    // Remove temp folder
    await fs.remove(job.workDir);

    job.status = 'stopped';
    io.to(job.id).emit('log', { type: 'info', message: 'Job cleaned up' });

  } catch (error) {
    console.log('Cleanup error:', error.message);
  }
}

function getAvailablePort() {
  // Return a random port between 3001-3999
  return Math.floor(Math.random() * 999) + 3001;
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
