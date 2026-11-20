---
name: dockerize-and-deploy
description: Use when containerising the app or writing deployment steps for a Docker deploy on an Ubuntu AWS EC2 server.
---

# Dockerize and deploy (Ubuntu EC2)

## Files to produce
- `Dockerfile`: small official base (`node:22-bookworm-slim`, `python:3.12-slim`, etc.). Copy dependency files first (cache), install production deps only (`npm ci --omit=dev`), copy source, run as a non-root user, `EXPOSE` the port, add a `HEALTHCHECK` that calls `/healthz`.
- `docker-compose.yml`: `build: .`, `restart: unless-stopped`, `env_file: .env`, `ports`, and a **named volume** for any data (database, uploads).
- `.dockerignore` (node_modules, .env, .git, data, tests).
- `.env.example` with every variable and a comment each. Real `.env` is never committed.
- App must expose `GET /healthz` returning 200.

## Server setup order (put all of it in STEPS.md, nothing skipped)
1. AWS: Ubuntu Server 24.04 LTS, t3.small or bigger, 20 GiB gp3, key pair (.pem).
2. Security group: SSH 22 from My IP only; app port (e.g. 3000) from 0.0.0.0/0. Later: 80/443 for HTTPS. Never open the database port.
3. Elastic IP so the address does not change.
4. SSH in: `chmod 400 key.pem`, `ssh -i key.pem ubuntu@IP`.
5. `sudo apt update && sudo apt upgrade -y`, install `unzip curl ca-certificates openssl nano`, reboot.
6. Install Docker from the official apt repo (docker-ce, docker-compose-plugin), `sudo usermod -aG docker ubuntu`, re-login, `docker run hello-world`.
7. Upload with `scp` or `git clone`, `cp .env.example .env`, generate secrets, `docker compose up -d --build`.
8. Verify: `docker compose ps` shows healthy, `curl localhost:PORT/healthz`, open `http://IP:PORT`.

## Rules
- Docker bypasses `ufw`. The AWS security group is the real firewall.
- Never bake secrets into the image.
- HTTPS: Caddy or Nginx in front, then set secure cookies.
- State clearly if Docker could not be run in your environment, and list what was untested.

Then follow the `write-steps-md` skill.
