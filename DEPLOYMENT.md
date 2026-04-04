# Deployment Guide — Resume Skill Gap Analyzer

Complete step-by-step guide to deploy RSGA on **AWS Lightsail** (Ubuntu 24.04).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [AWS Lightsail Setup](#3-aws-lightsail-setup)
4. [Server Configuration](#4-server-configuration)
5. [Clone & Configure](#5-clone--configure)
6. [Generate Secrets](#6-generate-secrets)
7. [Configure Environment](#7-configure-environment)
8. [Build & Launch](#8-build--launch)
9. [Database Setup](#9-database-setup)
10. [Verify Deployment](#10-verify-deployment)
11. [Domain & DNS](#11-domain--dns)
12. [TLS / SSL Certificates](#12-tls--ssl-certificates)
13. [CI/CD Pipeline (GitHub Actions)](#13-cicd-pipeline-github-actions)
14. [Monitoring & Logs](#14-monitoring--logs)
15. [Backup & Restore](#15-backup--restore)
16. [Updating the Application](#16-updating-the-application)
17. [Troubleshooting](#17-troubleshooting)
18. [Cost Breakdown](#18-cost-breakdown)

---

## 1. Architecture Overview

```
Internet
   │
   ▼
[ Nginx ] ─── port 80/443 ─── TLS termination, rate limiting, static caching
   │
   ├──► [ Frontend ]   Next.js standalone (port 3000)
   │
   ├──► [ Backend ]    FastAPI + Gunicorn/Uvicorn (port 8000)
   │       │
   │       ├──► [ PostgreSQL 16 ]   Primary data store
   │       ├──► [ Redis 7 ]         Cache, sessions, Celery broker
   │       └──► [ Celery Worker ]   Background analysis jobs
   │               └── [ Celery Beat ]  Scheduled tasks (backups, cleanup)
   │
   └──► [ WebSocket ]  Real-time analysis progress updates
```

All services run as Docker containers on a single AWS Lightsail instance.

**External Services Required:**
- **OpenAI API** — GPT-4o for skill extraction and gap analysis
- **SMTP Provider** — Email verification, password reset (Gmail, SendGrid, etc.)
- **Stripe** *(optional)* — Billing integration

---

## 2. Prerequisites

### Accounts You Need

- [ ] **AWS Account** — [aws.amazon.com](https://aws.amazon.com/) (credit/debit card required)
- [ ] **GitHub Account** — Repository hosted here for CI/CD
- [ ] **Domain Name** — From any registrar (Namecheap, GoDaddy, Route 53, etc.)
- [ ] **OpenAI API Key** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- [ ] **SMTP Credentials** — Gmail App Password, SendGrid, or similar
- [ ] **Stripe Keys** *(optional)* — [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)

### Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Instance | Lightsail $20/mo | Lightsail $40/mo |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 vCPU | 2 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 80 GB SSD | 160 GB SSD |
| Bandwidth | 3 TB/mo (included) | 4 TB/mo (included) |

---

## 3. AWS Lightsail Setup

### 3.1 Create a Lightsail Instance

1. Sign in to the [AWS Lightsail Console](https://lightsail.aws.amazon.com/)
2. Click **Create instance**
3. Configure the instance:

   | Setting | Value |
   |---------|-------|
   | Region | Pick closest to your users (e.g., `us-east-1` Virginia) |
   | Platform | **Linux/Unix** |
   | Blueprint | **OS Only > Ubuntu 24.04 LTS** |
   | Instance plan | **$20/mo** (2 vCPU, 4 GB RAM, 80 GB SSD) |
   | Instance name | `rsga-prod` |

4. Click **Create instance**
5. Wait 1-2 minutes for the instance to start

### 3.2 Attach a Static IP

A static IP ensures your server keeps the same public IP even after restarts.

1. In the Lightsail console, go to **Networking** tab
2. Click **Create static IP**
3. Attach it to your `rsga-prod` instance
4. Name it `rsga-static-ip`
5. **Write down this IP** — you'll use it throughout: `YOUR_STATIC_IP`

> Static IPs are free in Lightsail while attached to an instance.

### 3.3 Open Firewall Ports

1. Click your `rsga-prod` instance
2. Go to the **Networking** tab
3. Under **IPv4 Firewall**, click **Add rule** for each:

   | Application | Protocol | Port Range |
   |-------------|----------|------------|
   | HTTP | TCP | 80 |
   | HTTPS | TCP | 443 |
   | SSH | TCP | 22 *(already open by default)* |

4. Under **IPv6 Firewall**, add the same HTTP and HTTPS rules

---

## 4. Server Configuration

### 4.1 Connect via SSH

**Option A — Lightsail browser terminal (quickest):**

Click the orange terminal icon next to your instance in the Lightsail console.

**Option B — Local terminal (recommended for ongoing use):**

1. Download the SSH key from Lightsail:
   - Go to **Account > SSH Keys**
   - Download the default key for your region (e.g., `LightsailDefaultKey-us-east-1.pem`)

2. Connect from your local machine:
   ```bash
   # Fix key permissions
   chmod 400 ~/Downloads/LightsailDefaultKey-us-east-1.pem

   # Connect
   ssh -i ~/Downloads/LightsailDefaultKey-us-east-1.pem ubuntu@YOUR_STATIC_IP
   ```

**Option C — Set up your own SSH key (best for CI/CD):**

```bash
# On your local machine — generate a deploy key
ssh-keygen -t ed25519 -f ~/.ssh/rsga_deploy -C "deploy@rsga"

# Copy public key to server
ssh-copy-id -i ~/.ssh/rsga_deploy.pub -o "IdentityFile=~/Downloads/LightsailDefaultKey-us-east-1.pem" ubuntu@YOUR_STATIC_IP

# Now you can connect with your own key
ssh -i ~/.ssh/rsga_deploy ubuntu@YOUR_STATIC_IP
```

### 4.2 Update the System

```bash
sudo apt update && sudo apt upgrade -y
```

### 4.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Apply group change (avoids logout/login)
newgrp docker

# Verify installation
docker --version
docker compose version
```

Expected output:
```
Docker version 27.x.x
Docker Compose version v2.x.x
```

### 4.4 Configure System Limits

Optimize the server for running multiple containers:

```bash
# Increase file descriptor limits
echo "ubuntu soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "ubuntu hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize swap (Lightsail instances have limited RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap is active
free -h
```

---

## 5. Clone & Configure

```bash
# Create project directory
sudo mkdir -p /opt/rsga && sudo chown ubuntu:ubuntu /opt/rsga
cd /opt/rsga

# Clone your repository
git clone https://github.com/YOUR_GITHUB_USERNAME/resume-skill-gap-analyzer.git .
```

---

## 6. Generate Secrets

Run these commands to generate all the secrets you'll need:

```bash
echo "=== Copy these values ==="
echo ""
echo "SECRET_KEY:        $(python3 -c 'import secrets; print(secrets.token_hex(32))')"
echo "JWT_SECRET_KEY:    $(python3 -c 'import secrets; print(secrets.token_hex(32))')"
echo "POSTGRES_PASSWORD: $(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"
echo "REDIS_PASSWORD:    $(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"
echo ""
echo "=== Save these somewhere safe ==="
```

Copy and save all four values — you'll need them in the next step.

---

## 7. Configure Environment

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in every placeholder. Here's a reference for the critical values:

### Application

```env
APP_NAME=resume-skill-gap-analyzer
APP_ENV=production
DEBUG=false
LOG_LEVEL=WARNING
```

### Backend

```env
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_WORKERS=4
SECRET_KEY=<paste-your-generated-secret-key>
ALLOWED_ORIGINS=http://YOUR_STATIC_IP
```

### Frontend

```env
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_WS_URL=/ws
```

### Database

```env
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=skill_gap_analyzer
POSTGRES_USER=rsga_app
POSTGRES_PASSWORD=<paste-your-generated-db-password>
DATABASE_URL=postgresql+asyncpg://rsga_app:<paste-your-generated-db-password>@postgres:5432/skill_gap_analyzer
```

### Redis

```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<paste-your-generated-redis-password>
REDIS_URL=redis://:<paste-your-generated-redis-password>@redis:6379/0
```

### AI / LLM

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

AI_FALLBACK_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-YOUR_ANTHROPIC_KEY
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### JWT Auth

```env
JWT_SECRET_KEY=<paste-your-generated-jwt-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

### Celery (Task Queue)

```env
CELERY_BROKER_URL=redis://:<paste-your-generated-redis-password>@redis:6379/1
CELERY_RESULT_BACKEND=redis://:<paste-your-generated-redis-password>@redis:6379/2
```

### Email (SMTP)

```env
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=your@gmail.com
SMTP_FROM_NAME=SkillGap
SMTP_USE_TLS=true
```

> **Gmail App Password:** Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), generate an app password for "Mail", and use it as `SMTP_PASSWORD`.

### File Upload

```env
MAX_UPLOAD_SIZE_MB=10
ALLOWED_FILE_TYPES=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

> **Important:** Docker Compose `.env` files do NOT support `${VAR}` interpolation. Every URL must contain the actual password hardcoded inline.

---

## 8. Build & Launch

### First-time build

```bash
cd /opt/rsga

# Build and start all services (takes 5-10 minutes on first build)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### Watch build progress

```bash
# Follow the logs (Ctrl+C to stop watching)
docker compose -f docker-compose.prod.yml logs -f
```

### Verify all containers are running

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see 7 containers, all showing `Up (healthy)`:

| Container | Service | Port |
|-----------|---------|------|
| `rsga-postgres` | PostgreSQL 16 | 5432 (internal) |
| `rsga-redis` | Redis 7 | 6379 (internal) |
| `rsga-backend` | FastAPI + Gunicorn | 8000 (internal) |
| `rsga-worker` | Celery Worker | — |
| `rsga-beat` | Celery Beat Scheduler | — |
| `rsga-frontend` | Next.js Standalone | 3000 (internal) |
| `rsga-nginx` | Nginx Reverse Proxy | **80, 443** (exposed) |

> If a container keeps restarting, check its logs: `docker compose -f docker-compose.prod.yml logs <service-name>`

---

## 9. Database Setup

### 9.1 Run Migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend alembic upgrade head
```

Expected output: `INFO [alembic.runtime.migration] Running upgrade ... -> ...`

### 9.2 Seed the Skill Taxonomy

```bash
docker cp scripts/seed_skills.py rsga-backend:/app/seed_skills.py
docker exec rsga-backend python /app/seed_skills.py
```

### 9.3 Create Your Admin User

1. Open `http://YOUR_STATIC_IP` in a browser and register an account
2. Promote it to admin:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend python promote_user.py your@email.com admin
```

---

## 10. Verify Deployment

### Health checks from the server

```bash
# Backend API health
curl http://localhost/api/v1/health

# Frontend (should return HTML)
curl -s http://localhost/ | head -5
```

### Test from your browser

Open `http://YOUR_STATIC_IP` and run through the full flow:

1. Register a new account
2. Check email for verification (if SMTP configured)
3. Upload a resume (PDF or DOCX)
4. Enter a job description
5. Submit an analysis
6. Watch real-time progress via WebSocket
7. View the completed skill gap analysis

If everything works, proceed to set up your domain and HTTPS.

---

## 11. Domain & DNS

### 11.1 Option A: Using AWS Route 53

1. Go to [Route 53 Console](https://console.aws.amazon.com/route53/)
2. Click **Registered domains > Register domain** (or transfer an existing one)
3. After registration, go to **Hosted zones > your domain**
4. Create an **A record**:
   - **Record name:** Leave blank (for root domain) or enter a subdomain
   - **Record type:** A
   - **Value:** `YOUR_STATIC_IP`
   - **TTL:** 300

### 11.1 Option B: Using Any Domain Registrar

In your registrar's DNS settings (Namecheap, GoDaddy, Cloudflare, etc.), add:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_STATIC_IP` | 300 |
| A | `www` | `YOUR_STATIC_IP` | 300 |

### 11.2 Update Nginx Config

Edit the nginx config to use your domain instead of `_`:

```bash
nano /opt/rsga/infrastructure/nginx/nginx.prod.conf
```

Find both `server_name _;` lines and replace with:

```nginx
server_name yourdomain.com www.yourdomain.com;
```

### 11.3 Update Environment

```bash
nano /opt/rsga/.env.production
```

Update these values:

```env
ALLOWED_ORIGINS=https://yourdomain.com
SITE_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### 11.4 Restart Services

```bash
docker restart rsga-nginx rsga-backend
```

### 11.5 Verify DNS

```bash
# Check DNS propagation (may take a few minutes)
dig yourdomain.com +short
# Should return: YOUR_STATIC_IP
```

---

## 12. TLS / SSL Certificates

### 12.1 Install Certbot

```bash
sudo apt install certbot -y
```

### 12.2 Get Certificate from Let's Encrypt

```bash
# Stop nginx to free port 80
docker stop rsga-nginx

# Request certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certs to project
mkdir -p /opt/rsga/infrastructure/nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/rsga/infrastructure/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/rsga/infrastructure/nginx/ssl/
sudo chown ubuntu:ubuntu /opt/rsga/infrastructure/nginx/ssl/*.pem

# Start nginx again
docker start rsga-nginx
```

### 12.3 Enable HTTPS Redirect in Nginx

Edit `infrastructure/nginx/nginx.prod.conf` and in the port-80 server block, replace the HTTP frontend proxy with a redirect:

```nginx
# In the server { listen 80; ... } block, change:

    # location / {
    #     set $frontend_url http://frontend:3000;
    #     proxy_pass $frontend_url;
    #     ...
    # }

    # To:
    location / {
        return 301 https://$host$request_uri;
    }
```

Restart nginx:

```bash
docker restart rsga-nginx
```

### 12.4 Set Up Auto-Renewal

```bash
sudo crontab -e
```

Add this line:

```cron
0 3 1,15 * * certbot renew --quiet --pre-hook "docker stop rsga-nginx" --post-hook "cp /etc/letsencrypt/live/yourdomain.com/*.pem /opt/rsga/infrastructure/nginx/ssl/ && chown ubuntu:ubuntu /opt/rsga/infrastructure/nginx/ssl/*.pem && docker start rsga-nginx"
```

This checks for renewal on the 1st and 15th of every month at 3 AM.

### 12.5 Verify HTTPS

```bash
# Test from the server
curl -I https://yourdomain.com

# Check certificate details
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates
```

---

## 13. CI/CD Pipeline (GitHub Actions)

The project includes automated deployment via GitHub Actions. Every push to `main` triggers a build and deploy.

### 13.1 Generate a Deploy SSH Key

On your **local machine**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rsga_ci -C "github-actions@rsga" -N ""
```

Copy the **public** key to the server:

```bash
ssh -i ~/Downloads/LightsailDefaultKey-us-east-1.pem ubuntu@YOUR_STATIC_IP \
  "echo '$(cat ~/.ssh/rsga_ci.pub)' >> ~/.ssh/authorized_keys"
```

### 13.2 Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scope: `write:packages`
4. Copy the token

### 13.3 Add GitHub Repository Secrets

Go to your repo **Settings > Secrets and variables > Actions** and add:

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | `YOUR_STATIC_IP` |
| `DEPLOY_USER` | `ubuntu` |
| `DEPLOY_KEY` | Contents of `~/.ssh/rsga_ci` (the **private** key) |
| `DEPLOY_PATH` | `/opt/rsga` |
| `GHCR_TOKEN` | The GitHub PAT from step 13.2 |

### 13.4 How the Pipeline Works

1. **Push to `main`** triggers CI (lint + test + build)
2. If CI passes, the **Deploy** job:
   - Builds production Docker images
   - Pushes them to GitHub Container Registry (GHCR)
   - SSHs into the Lightsail server
   - Pulls new images
   - Runs database migrations (`alembic upgrade head`)
   - Rolling restart (zero downtime)

### 13.5 Manual Deploy

You can also trigger a deploy manually:

1. Go to your repo's **Actions** tab
2. Click **Deploy** workflow
3. Click **Run workflow**
4. Select environment (`production` or `staging`)

---

## 14. Monitoring & Logs

### View logs

```bash
# All services (live)
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f frontend

# Last 100 lines of a service
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Resource usage

```bash
# Live container stats (CPU, memory, network)
docker stats

# Disk usage
df -h

# Docker disk usage
docker system df
```

### Connect to database

```bash
docker exec -it rsga-postgres psql -U rsga_app -d skill_gap_analyzer
```

### Connect to Redis

```bash
docker exec -it rsga-redis redis-cli -a YOUR_REDIS_PASSWORD
```

### Check container health

```bash
# Quick status
docker compose -f docker-compose.prod.yml ps

# Detailed health check
docker inspect --format='{{.State.Health.Status}}' rsga-backend
docker inspect --format='{{.State.Health.Status}}' rsga-postgres
docker inspect --format='{{.State.Health.Status}}' rsga-redis
```

---

## 15. Backup & Restore

### Manual database backup

```bash
# Backup to compressed file
docker exec rsga-postgres pg_dump -U rsga_app skill_gap_analyzer \
  | gzip > /opt/rsga/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore from backup

```bash
# Restore (replace filename with your backup)
gunzip -c backup_20260404_030000.sql.gz \
  | docker exec -i rsga-postgres psql -U rsga_app skill_gap_analyzer
```

### Automated backups

Celery Beat runs scheduled backup tasks automatically. Configure in `.env.production`:

```env
BACKUP_RETENTION_COUNT=7
BACKUP_DIR=/app/storage/backups
```

Extract backups from the container:

```bash
docker cp rsga-backend:/app/storage/backups/ ./local-backups/
```

### Offsite backup (recommended)

Copy backups to S3 for safekeeping:

```bash
# Install AWS CLI
sudo apt install awscli -y

# Upload to S3 (create an S3 bucket first via AWS Console)
aws s3 cp backup_20260404.sql.gz s3://your-backup-bucket/rsga/
```

Or set up a cron job:

```bash
sudo crontab -e
# Add:
0 4 * * * docker exec rsga-postgres pg_dump -U rsga_app skill_gap_analyzer | gzip | aws s3 cp - s3://your-backup-bucket/rsga/backup_$(date +\%Y\%m\%d).sql.gz
```

---

## 16. Updating the Application

### Manual update

```bash
cd /opt/rsga

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Run any new migrations
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend alembic upgrade head
```

### Via CI/CD (recommended)

Push to `main` — GitHub Actions handles everything automatically.

### Rollback

If something goes wrong after an update:

```bash
# Check recent commits
git log --oneline -10

# Revert to a previous commit
git checkout <commit-hash>

# Rebuild
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## 17. Troubleshooting

### Container won't start

```bash
# Check logs for the failing container
docker compose -f docker-compose.prod.yml logs <service-name>

# Check if ports are in use
sudo lsof -i :80
sudo lsof -i :443
```

### Database connection errors

```bash
# Verify postgres is healthy
docker compose -f docker-compose.prod.yml ps postgres

# Test connection from backend container
docker exec rsga-backend python -c "
from app.db.session import async_engine
import asyncio
async def test():
    async with async_engine.connect() as conn:
        print('DB connected!')
asyncio.run(test())
"
```

### Redis connection errors

```bash
# Verify redis is healthy
docker exec rsga-redis redis-cli -a YOUR_REDIS_PASSWORD ping
# Should return: PONG
```

### Celery workers not processing tasks

```bash
# Check worker logs
docker compose -f docker-compose.prod.yml logs worker

# Verify broker connection
docker exec rsga-worker celery -A app.workers.celery_app inspect ping
```

### Frontend shows blank page

```bash
# Check frontend logs
docker compose -f docker-compose.prod.yml logs frontend

# Verify the standalone build exists
docker exec rsga-frontend ls -la /app/server.js
```

### Out of memory (OOM)

```bash
# Check if any container was killed
docker inspect --format='{{.State.OOMKilled}}' rsga-backend

# Check available memory
free -h

# If swap isn't configured, add it (see Section 4.4)
```

### TLS certificate issues

```bash
# Check cert expiry
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates

# Test nginx config
docker exec rsga-nginx nginx -t

# Force renewal
sudo certbot renew --force-renewal
```

### Disk space full

```bash
# Check disk usage
df -h

# Clean unused Docker resources
docker system prune -af

# Clean old Docker volumes (careful — this removes unused data volumes)
docker volume prune -f
```

### Full reset (nuclear option — destroys all data)

```bash
# Stop everything and remove volumes
docker compose -f docker-compose.prod.yml down -v

# Rebuild from scratch
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Re-run migrations and seed
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend alembic upgrade head
docker cp scripts/seed_skills.py rsga-backend:/app/seed_skills.py
docker exec rsga-backend python /app/seed_skills.py
```

---

## 18. Cost Breakdown

### Monthly Costs

| Service | Cost |
|---------|------|
| AWS Lightsail (4 GB, 2 vCPU) | $20/mo |
| Static IP | Free (while attached) |
| Bandwidth (3 TB included) | $0 |
| Let's Encrypt TLS | Free |
| **Infrastructure Total** | **$20/mo** |

### Additional Costs (usage-based)

| Service | Estimated Cost |
|---------|---------------|
| OpenAI API (GPT-4o) | $5-20/mo depending on volume |
| Domain name (.com) | ~$12/year |
| Route 53 hosted zone *(if using)* | $0.50/mo |
| S3 backup bucket *(optional)* | ~$1/mo |

### Scaling Up

If you outgrow the $20 plan:

| Lightsail Plan | Specs | Price |
|----------------|-------|-------|
| Current | 2 vCPU, 4 GB RAM, 80 GB SSD | $20/mo |
| Upgrade 1 | 2 vCPU, 8 GB RAM, 160 GB SSD | $40/mo |
| Upgrade 2 | 4 vCPU, 16 GB RAM, 320 GB SSD | $80/mo |

To upgrade: Lightsail Console > Instance > click **Snapshot** > create a new instance from the snapshot with a larger plan.

---

## Quick Reference

```bash
# ── Lifecycle ────────────────────────────────────────────────
# Start all services
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# ── Logs ─────────────────────────────────────────────────────
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f backend

# ── Database ─────────────────────────────────────────────────
# Run migrations
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend alembic upgrade head

# Backup
docker exec rsga-postgres pg_dump -U rsga_app skill_gap_analyzer | gzip > backup.sql.gz

# Connect to DB shell
docker exec -it rsga-postgres psql -U rsga_app -d skill_gap_analyzer

# ── Admin ────────────────────────────────────────────────────
# Promote user to admin
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec backend python promote_user.py email@example.com admin

# ── Maintenance ──────────────────────────────────────────────
# Check container health
docker compose -f docker-compose.prod.yml ps

# Resource usage
docker stats

# Clean unused Docker resources
docker system prune -af
```
