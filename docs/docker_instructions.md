# Docker Instructions

A practical guide for installing, running, and managing Docker containers.

## 1. Installation

### macOS / Windows
Download and install **Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/).

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Verify installation:
```bash
docker --version
docker run hello-world
```

## 2. Core Concepts

| Term | Description |
|------|-------------|
| **Image** | Read-only template used to create containers |
| **Container** | A running instance of an image |
| **Dockerfile** | Script with instructions to build an image |
| **Volume** | Persistent storage for containers |
| **Network** | Virtual network for container communication |

## 3. Common Commands

### Images
```bash
docker pull <image>            # Download an image
docker images                  # List local images
docker rmi <image>             # Remove an image
docker build -t myapp:latest . # Build image from Dockerfile
```

### Containers
```bash
docker run -d -p 3000:3000 --name myapp myapp:latest
docker ps                      # List running containers
docker ps -a                   # List all containers
docker stop <container>        # Stop container
docker start <container>       # Start container
docker rm <container>          # Remove container
docker logs -f <container>     # Stream logs
docker exec -it <container> sh # Shell into container
```

### Cleanup
```bash
docker system prune -a         # Remove unused images, containers, networks
docker volume prune            # Remove unused volumes
```

## 4. Writing a Dockerfile

Example for a Node.js app:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t my-node-app .
docker run -p 3000:3000 my-node-app
```

## 5. Docker Compose

Define multi-container apps in `docker-compose.yml`:
```yaml
version: "3.9"
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - dbdata:/var/lib/postgresql/data
volumes:
  dbdata:
```

Run the stack:
```bash
docker compose up -d
docker compose logs -f
docker compose down
```

## 6. Volumes & Networks

```bash
docker volume create mydata
docker run -v mydata:/app/data myapp

docker network create mynet
docker run --network mynet --name api myapp
```

## 7. Best Practices

- Use **small base images** (`alpine`, `distroless`)
- Leverage **layer caching** — copy `package.json` before source code
- Use **multi-stage builds** to keep images lean
- Never store **secrets** in images; use env vars or secret managers
- Always **pin versions** (`node:20-alpine`, not `node:latest`)
- Add a **`.dockerignore`** file (exclude `node_modules`, `.git`, `.env`)

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| `permission denied` on socket | Add user to `docker` group |
| Port already in use | Change host port: `-p 3001:3000` |
| Container exits immediately | Check `docker logs <container>` |
| Out of disk space | Run `docker system prune -a` |

## 9. Useful Resources

- [Official Docs](https://docs.docker.com/)
- [Docker Hub](https://hub.docker.com/)
- [Awesome Docker](https://github.com/veggiemonk/awesome-docker)
