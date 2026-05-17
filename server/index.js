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
import os from 'os';

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
const TEMP_DIR = path.join(os.homedir(), 'runforge-temp');
const CACHE_DIR = path.join(__dirname, 'cache');

fs.ensureDirSync(CACHE_DIR);

app.use(cors());
app.use(express.json());

fs.emptyDirSync(TEMP_DIR);

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
      logs: [],
      timeout: null
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
  const log = (type, message) => {
    job.logs.push({ type, message });
    io.to(jobId).emit('log', { type, message });
  };

  try {
    // Step 1: Clone repository
    io.to(jobId).emit('status', { status: 'cloning' });
    await cloneRepo(job, repoUrl, workDir);

    // Step 2: Detect project type
    io.to(jobId).emit('status', { status: 'detecting' });
    log('info', 'Scanning repository code and dependencies...');

    // Satisfying scanning delay so the user sees the active scan
    await new Promise(resolve => setTimeout(resolve, 1500));

    const frameworkType = await detectLanguageAndFramework(workDir);
    const projectType = frameworkType;
    const displayString = getFrameworkDisplay(frameworkType);
    job.stack = projectType;
    job.language = displayString;

    log('success', `✓ Detected Tech Stack: ${displayString}`);

    io.to(jobId).emit('status', {
      status: 'detecting',
      projectType: projectType,
      language: displayString
    });

    // Step 3: Direct container execution (no build)
    await runDirectContainer(job, workDir, projectType);

  } catch (error) {
    job.status = 'failed';
    io.to(jobId).emit('status', { status: 'failed' });
    log('error', error.message);
  }
}

function getRepoIdentifier(repoUrl) {
  try {
    const cleanUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
    const parts = cleanUrl.split('/');
    if (parts.length >= 2) {
      const owner = parts[parts.length - 2];
      const name = parts[parts.length - 1];
      return `${owner}_${name}`;
    }
  } catch (e) { }
  return null;
}

async function cloneRepo(job, repoUrl, workDir) {
  const log = (type, message) => {
    job.logs.push({ type, message });
    io.to(job.id).emit('log', { type, message });
  };

  const repoId = getRepoIdentifier(repoUrl);
  if (!repoId) {
    throw new Error('Invalid repository URL');
  }

  const cachePath = path.join(CACHE_DIR, repoId);
  const cacheExists = await fs.pathExists(cachePath);

  if (cacheExists) {
    log('info', 'Found cached version of repository. Updating with latest changes...');
    // Run git pull in cache path
    await new Promise((resolve) => {
      const gitProcess = spawn('git', ['pull'], { cwd: cachePath });
      const timeout = setTimeout(() => {
        gitProcess.kill();
        log('warn', 'Git pull timed out, using existing cache.');
        resolve();
      }, 15 * 1000); // 15 seconds timeout for quick pull

      gitProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          log('success', 'Repository cache updated successfully.');
          resolve();
        } else {
          log('warn', 'Failed to update cache, proceeding with existing files.');
          resolve();
        }
      });
    });
  } else {
    log('info', 'No cache found. Cloning repository to cache...');
    await fs.ensureDir(cachePath);
    await new Promise((resolve, reject) => {
      const gitProcess = spawn('git', ['clone', '--depth=1', '--single-branch', '--no-tags', repoUrl, cachePath]);
      const timeout = setTimeout(() => {
        gitProcess.kill();
        reject(new Error('Git clone timeout after 2 minutes'));
      }, 2 * 60 * 1000);

      gitProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          log('success', 'Repository cloned to cache successfully.');
          resolve();
        } else {
          fs.remove(cachePath).catch(() => { });
          reject(new Error('Git clone failed'));
        }
      });
    });
  }

  // Copy from cache to workspace
  log('info', 'Preparing container workspace...');
  await fs.copy(cachePath, workDir);
  log('success', 'Workspace ready');
}

async function detectLanguageAndFramework(workDir) {
  try {
    const files = fs.readdirSync(workDir);

    if (files.includes('Dockerfile')) {
      return 'Docker Container (Custom Dockerfile)';
    }

    if (files.includes('package.json')) {
      try {
        const pkg = await fs.readJson(path.join(workDir, 'package.json'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['next']) return 'nextjs';
        if (deps['nuxt']) return 'nuxtjs';
        if (deps['react'] && deps['vite']) return 'react-vite';
        if (deps['react'] && (deps['react-scripts'] || pkg.scripts?.start)) return 'react-cra';
        if (deps['react']) return 'react';
        if (deps['@angular/core']) return 'angular';
        if (deps['vue'] && deps['vite']) return 'vue-vite';
        if (deps['vue']) return 'vue';
        if (deps['svelte']) return 'svelte';
        if (deps['solid-js']) return 'solid';
        if (deps['astro']) return 'astro';
        if (deps['remix-run']) return 'remix';
        if (deps['express']) return 'express';
        if (deps['fastify']) return 'fastify';
        if (deps['koa']) return 'koa';
        return 'node';
      } catch (e) {
        return 'node';
      }
    }

    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      try {
        let reqs = '';
        if (files.includes('requirements.txt')) {
          reqs = await fs.readFile(path.join(workDir, 'requirements.txt'), 'utf8');
        }
        const lowerReqs = reqs.toLowerCase();
        if (lowerReqs.includes('django')) return 'django';
        if (lowerReqs.includes('flask')) return 'flask';
        if (lowerReqs.includes('fastapi')) return 'fastapi';
        return 'python';
      } catch (e) {
        return 'python';
      }
    }

    if (files.includes('index.html') || files.some(f => f.endsWith('.html'))) {
      return 'static';
    }
  } catch (err) { }
  return 'unknown';
}

function getFrameworkDisplay(frameworkType) {
  const displayNames = {
    'nextjs': 'Next.js (React Framework)',
    'nuxtjs': 'Nuxt.js (Vue Framework)',
    'react-vite': 'React + Vite (TypeScript/JavaScript)',
    'react-cra': 'React (Create React App)',
    'react': 'React.js (JavaScript Library)',
    'angular': 'Angular (TypeScript Framework)',
    'vue-vite': 'Vue + Vite (JavaScript Framework)',
    'vue': 'Vue.js (JavaScript Framework)',
    'svelte': 'Svelte (JavaScript Framework)',
    'solid': 'SolidJS (JavaScript Framework)',
    'astro': 'Astro (Web Framework)',
    'remix': 'Remix (React Framework)',
    'express': 'Node.js (Express Backend)',
    'fastify': 'Node.js (Fastify Backend)',
    'koa': 'Node.js (Koa Backend)',
    'node': 'Node.js (JavaScript/TypeScript)',
    'django': 'Python (Django Framework)',
    'flask': 'Python (Flask Web Framework)',
    'fastapi': 'Python (FastAPI Framework)',
    'python': 'Python (Standard Web App)',
    'static': 'HTML5 / CSS3 / JavaScript (Static Website)',
    'docker': 'Docker Container (Custom Dockerfile)',
    'unknown': 'Unknown Project Type'
  };
  return displayNames[frameworkType] || frameworkType;
}

function getFrameworkConfig(frameworkType) {
  const configs = {
    'nextjs': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 3000 },
    'nuxtjs': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 3000 },
    'react-vite': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 5173 },
    'react-cra': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm start', port: 3000 },
    'react': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm start', port: 3000 },
    'angular': { image: 'node:18-alpine', installCmd: 'npm install && npx -y @angular/cli install', startCmd: 'npx ng serve --host 0.0.0.0', port: 4200 },
    'vue-vite': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 5173 },
    'vue': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run serve', port: 8080 },
    'svelte': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 5173 },
    'solid': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 5173 },
    'astro': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 4321 },
    'remix': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm run dev', port: 3000 },
    'express': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm start', port: 3000 },
    'fastify': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm start', port: 3000 },
    'koa': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm start', port: 3000 },
    'node': { image: 'node:18-alpine', installCmd: 'npm install', startCmd: 'npm start', port: 3000 },
    'django': { image: 'python:3.10-alpine', installCmd: 'pip install -r requirements.txt', startCmd: 'python manage.py runserver 0.0.0.0:8000', port: 8000 },
    'flask': { image: 'python:3.10-alpine', installCmd: 'pip install -r requirements.txt', startCmd: 'python app.py', port: 5000 },
    'fastapi': { image: 'python:3.10-alpine', installCmd: 'pip install -r requirements.txt', startCmd: 'uvicorn app:app --host 0.0.0.0 --port 8000', port: 8000 },
    'python': { image: 'python:3.10-alpine', installCmd: 'pip install -r requirements.txt', startCmd: 'python app.py', port: 5000 },
    'static': { image: 'nginx:alpine', installCmd: null, startCmd: null, port: 80 }
  };
  return configs[frameworkType] || configs['node'];
}

async function detectProjectType(workDir) {
  return await detectLanguageAndFramework(workDir);
}

async function runDirectContainer(job, workDir, projectType) {
  const log = (type, message) => {
    job.logs.push({ type, message });
    io.to(job.id).emit('log', { type, message });
  };

  try {
    // Get framework-specific configuration
    const frameworkConfig = getFrameworkConfig(projectType);

    // Get random port
    const hostPort = getAvailablePort();
    const containerPort = frameworkConfig.port;
    job.port = hostPort;

    job.status = 'running';
    io.to(job.id).emit('status', { status: 'running' });
    log('info', `Starting container for ${getFrameworkDisplay(projectType)}...`);

    const image = frameworkConfig.image;
    const installCmd = frameworkConfig.installCmd;
    const startCmd = frameworkConfig.startCmd;

    let command = null;
    if (installCmd && startCmd) {
      command = `${installCmd} && ${startCmd}`;
    } else if (startCmd) {
      command = startCmd;
    }

    if (projectType !== 'static') {
      io.to(job.id).emit('status', { status: 'installing' });
      log('info', 'Installing dependencies and starting application...');
    } else {
      log('info', 'Starting Nginx web server...');
    }

    const normalizedWorkDir = path.resolve(workDir);
    const workingDir = projectType === 'static' ? '/usr/share/nginx/html' : '/app';

    const containerOptions = {
      Image: image,
      WorkingDir: workingDir,
      ExposedPorts: { [`${containerPort}/tcp`]: {} },
      HostConfig: {
        Binds: [`${normalizedWorkDir}:${workingDir}`],
        PortBindings: { [`${containerPort}/tcp`]: [{ HostPort: `${hostPort}` }] },
        AutoRemove: true
      }
    };

    if (command) {
      containerOptions.Cmd = ['sh', '-c', command];
    }

    const container = await docker.createContainer(containerOptions);

    await container.start();
    job.containerId = container.id;
    job.status = 'success';

    log('success', `Container running on port ${hostPort}`);
    io.to(job.id).emit('status', {
      status: 'success',
      port: hostPort,
      containerId: container.id,
      projectType: projectType,
      language: job.language || projectType
    });

    // Stream logs
    streamLogs(job, container);

    // Add timeout safety
    const timeout = setTimeout(() => {
      log('info', 'Execution timeout reached (5 minutes)');
      cleanupJob(job);
    }, 5 * 60 * 1000);

    // Store timeout for cleanup
    job.timeout = timeout;

  } catch (error) {
    job.status = 'failed';
    io.to(job.id).emit('status', { status: 'failed' });
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
    // Clear timeout if exists
    if (job.timeout) {
      clearTimeout(job.timeout);
    }

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

// Pre-pull common Docker images on server boot to minimize first-run latency
function prePullImages() {
  const images = ['node:18-alpine', 'python:3.10-alpine', 'nginx:alpine'];
  console.log('Starting background pre-pull of common Docker images...');

  images.forEach(image => {
    docker.pull(image)
      .then(stream => {
        docker.modem.followProgress(stream, (err, output) => {
          if (err) {
            console.log(`[Pre-pull Error] Failed to complete pull for ${image}:`, err.message);
          } else {
            console.log(`[Pre-pull Success] Image fully prepared: ${image}`);
          }
        });
      })
      .catch(err => {
        console.log(`[Pre-pull Error] Failed to initiate pull for ${image}:`, err.message);
      });
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Run image pre-pulling in background
  prePullImages();
});
