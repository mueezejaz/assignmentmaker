# UniGen — AI University Database Assignment Generator

A full-stack application that generates complete university database assignments using Google Gemini AI. Features a dark crimson gothic UI with real-time job progress via long polling.

---

## Architecture

```
uni-assignment-generator/
├── backend/                   # Node.js / Express
│   ├── server.js              # Entry point
│   ├── queue/
│   │   ├── Queue.js           # In-memory queue (built from scratch)
│   │   └── handlers.js        # Job type handlers
│   ├── routes/
│   │   └── api.js             # REST API routes
│   ├── services/
│   │   ├── gemini.js          # Gemini AI client
│   │   └── assignment.js      # 6-step generation pipeline
│   ├── storage/
│   │   └── storage.js         # Per-user file system storage
│   └── data/                  # Created at runtime: data/<userId>/<jobId>/
│
└── frontend/                  # React + Vite
    └── src/
        ├── App.jsx            # Root component (Clerk + Mock auth)
        ├── components/
        │   ├── Header.jsx
        │   ├── AuthScreen.jsx
        │   ├── ApiKeyModal.jsx
        │   ├── NewJobForm.jsx
        │   ├── JobsSidebar.jsx
        │   ├── JobDetail.jsx
        │   ├── StepLog.jsx
        │   ├── JobResults.jsx
        │   └── Toast.jsx
        ├── hooks/
        │   ├── useJobPoller.js # Long-polling hook
        │   └── useMockAuth.js  # Dev mock auth
        └── lib/
            └── api.js          # Axios API client
```

---

## Setup

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

**Backend** — copy `.env.example` to `.env`:
```env
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**Frontend** — copy `.env.example` to `.env`:
```env
# Clerk Google Auth (optional - leave blank for mock auth)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3. Set Up Clerk (for Google Auth)

1. Go to [clerk.com](https://clerk.com) and create a free app
2. Enable **Google** as a social provider in Clerk dashboard
3. Copy your **Publishable Key** into `frontend/.env`

> **Without Clerk key**: The app uses a mock auth mode — click "Enter as Developer". Perfect for development.

### 4. Run the Application

Open two terminals:

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:5173
```

---

## How It Works

### User Flow

1. **Sign in** with Google (via Clerk) or use mock auth
2. **Enter Gemini API key** — validated against the Gemini API, stored in `data/<userId>/meta.json`
3. **Describe your scenario** (or use the default)
4. **Watch live progress** — long polling shows each generation step in real time
5. **Download files** — all generated artifacts saved to `data/<userId>/<jobId>/`

### Generation Pipeline (6 Steps)

| Step | Action | Output |
|------|--------|--------|
| 1 | Gemini generates Mermaid ERD | `erd.mmd` |
| 2 | Mermaid CLI converts to image | `erd.png` / `erd.svg` |
| 3 | Gemini writes LaTeX report | `report.tex` |
| 4 | Pandoc / officegen converts | `report.docx` |
| 5 | Gemini generates Python code | `create_database.py` |
| 6 | Python script run (Windows) | `StudentAttendanceSystem.accdb` |

### Queue System

Built from scratch in `backend/queue/Queue.js`:
- **In-memory** — all job state lives in RAM
- **Concurrent** — configurable worker concurrency (default: 2)
- **Long polling** — `GET /api/jobs/:id/poll?since=<ts>` blocks up to 25s, returns on update
- **Step logging** — each pipeline step logged with timestamp and state

### Storage

All data stored **locally** on the server:
```
data/
└── user_clerk_abc123/           # sanitized user ID
    ├── meta.json                # API key (base64), settings
    └── job_1234567890-abc/      # one folder per job
        ├── erd.mmd
        ├── erd.png
        ├── report.tex
        ├── report.docx
        ├── create_database.py
        └── job.json             # job metadata
```

---

## Generating the .accdb File

The Python script requires **Windows** with MS Access:

```bash
# On Windows machine:
pip install pyodbc pywin32
python create_database.py
# → Creates StudentAttendanceSystem.accdb
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/api-key` | Save & validate Gemini API key |
| GET | `/api/api-key/status` | Check if key is set |
| DELETE | `/api/api-key` | Remove saved key |
| POST | `/api/jobs` | Create generation job |
| GET | `/api/jobs` | List user's jobs |
| GET | `/api/jobs/:id` | Get job details |
| GET | `/api/jobs/:id/poll?since=` | Long-poll for updates |
| GET | `/api/jobs/:id/files/:name` | Download generated file |
| GET | `/api/jobs/:id/view/:name` | View file inline |

All requests need header: `x-user-id: <userId>`

---

## Tech Stack

- **Frontend**: React 18, Vite, Clerk, Lucide Icons
- **Backend**: Node.js, Express, custom in-memory queue
- **AI**: Google Gemini 1.5 Flash
- **Diagram**: @mermaid-js/mermaid-cli (mmdc)
- **DOCX**: Pandoc (primary) / officegen (fallback)
- **Auth**: Clerk (Google OAuth) / mock auth for dev
- **Storage**: Local filesystem (no database)
