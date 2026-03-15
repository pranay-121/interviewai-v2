# InterviewAI v2 — Complete Setup Guide

## Quick Start (5 minutes)

### 1. Setup environment
```bash
cp .env.example .env
# Edit .env — set SECRET_KEY, POSTGRES_PASSWORD, ANTHROPIC_API_KEY
```

### 2. Generate SECRET_KEY
```bash
openssl rand -hex 32
# Paste output into .env as SECRET_KEY
```

### 3. Start backend services
```bash
docker compose up -d db redis minio ollama
```

### 4. Install & run frontend (on your Mac directly)
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### 5. Install & run backend (in conda env)
```bash
conda activate interviewai
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 6. Open app
```
http://localhost:3000
```

---

## AI Provider Options

### Option A: Claude API (Recommended for deployment - cloud)
```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Get your key free at: https://console.anthropic.com

### Option B: Ollama (Local - completely free)
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```
Then pull models:
```bash
ollama pull llama3:8b
```

---

## Deployment (Production)

### Frontend → Vercel (free)
```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_API_URL to your backend URL
```

### Backend → Render (free tier)
1. Push code to GitHub
2. Connect repo to render.com
3. Set environment variables from .env
4. Deploy

### Database → Railway (free tier)
1. Create PostgreSQL service
2. Copy DATABASE_URL to your backend env vars

---

## All Pages
- `/` — Landing page
- `/login` — Sign in
- `/register` — Create account
- `/dashboard` — Main dashboard with stats
- `/interview` — Start AI mock interview
- `/resume` — Upload & analyze resume
- `/playground` — Coding practice
- `/companies` — Company prep guides
- `/social` — Friends & groups
- `/history` — Past interviews

## API Endpoints
- `POST /auth/register` — Create account
- `POST /auth/login` — Login
- `GET /users/me` — Profile + stats
- `POST /interviews/start` — Start interview
- `POST /interviews/{id}/answer` — Submit answer
- `GET /interviews/history` — Past sessions
- `POST /agents/resume` — Analyze resume
- `GET /companies` — Company list
- `GET /health` — Health check (no auth needed)
