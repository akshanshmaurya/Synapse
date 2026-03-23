# Synapse

**An AI mentorship platform that measures genuine understanding — not just activity.**

![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18.3-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128.0-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![Tests](https://img.shields.io/badge/Tests-77_passing-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-52%25-yellow)

---

## Table of Contents

- [The Problem](#the-problem)
- [What Synapse Does Differently](#what-synapse-does-differently)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Multi-Agent Pipeline](#multi-agent-pipeline)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [API Reference](#api-reference)
- [Performance Considerations](#performance-considerations)
- [Security Architecture](#security-architecture)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Future Roadmap](#future-roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## The Problem

Most learning platforms equate **effort with understanding**. They count sessions watched, quizzes completed, and streaks maintained. A user who chats daily gets a higher "progress" score than one who studied deeply once — regardless of whether they understood anything.

This creates a fundamental measurement problem: **activity metrics reward engagement, not comprehension.**

### Target Users

- Self-directed learners who want honest feedback on whether they're actually understanding material
- Professionals transitioning to new domains who need adaptive guidance pacing
- Anyone who has experienced the gap between "I feel like I'm learning" and "I can actually apply this"

---

## What Synapse Does Differently

Synapse is built on a single invariant: **you cannot game your way to a higher clarity score.**

| Behavior | Effect on Clarity Score |
|----------|----------------------|
| Chatting frequently | No change |
| Asking many questions | No change |
| Being polite and engaged | No change |
| Completing sessions | No change |
| Correctly paraphrasing a concept | Increase |
| Applying a concept to a new example | Increase |
| Answering "why" or "how" correctly | Increase |
| Saying "I'm confused" or "I don't get it" | Score **locked** — cannot increase until demonstrated understanding |

The last rule is a **hard-coded fail-safe** — it cannot be overridden by the LLM. If a user expresses confusion, the system blocks any clarity increase, forces the understanding delta to zero or negative, and prevents the confusion trend from showing "improving." This is enforced in code, not by prompt engineering.

---

## Features

### Mentorship Chat

| Feature | Description |
|---------|-------------|
| Context-Aware Responses | Remembers goals, struggles, learning pace, and progress across all sessions |
| 6 Adaptive Strategies | encourage, teach, challenge, reflect, support, celebrate — selected per message based on clarity score and confusion trend |
| Adaptive Pacing | Slows down and simplifies when clarity < 40%; challenges when clarity > 70% |
| Adaptive Tone | warm, gentle, direct, curious, or affirming — set by the Planner Agent based on detected user emotion |
| Session History | Chat sessions auto-named by topic via the Planner's `chat_intent` field |
| Voice Output | Optional text-to-speech via ElevenLabs |

### Learning Roadmaps

| Feature | Description |
|---------|-------------|
| AI-Generated Pathways | 3–4 stages, each with 3–5 actionable steps, personalized to goals and experience level |
| Step Types | learn, practice, build, reflect, milestone — each with UI hints (color, icon, estimated time) |
| Interactive Tracking | Mark steps complete, flag as stuck / unclear / needs help |
| Adaptive Regeneration | When a user reports difficulty, the Evaluator analyzes feedback and the Executor regenerates a gentler path |

### Analytics Dashboard

| Feature | Description |
|---------|-------------|
| Momentum State | starting / building / steady / accelerating — derived from evaluation history, **not** session counts |
| Effort Metrics | Sessions, streak, persistence — tracked separately to avoid conflating activity with understanding |
| Recent Signals | Observable patterns (recurring struggles, new topics, clarity improvements) — observations, not praise |
| Daily Nurture | Contextual reflective prompt, only shown when the user has been active today |

### Cognitive Trace System

Every AI decision is logged with four fields:

| Field | What It Captures |
|-------|-----------------|
| `input_summary` | What the agent received |
| `decision` | What choice was made |
| `reasoning` | Why that choice was made |
| `output_summary` | What was produced |

This answers two questions: *"Why did the system respond this way?"* and *"What influenced that decision?"*

### User Profile & Growth Tracking

| Feature | Description |
|---------|-------------|
| Growth Stage | seedling → growing → branching → flourishing |
| Interests & Goals | Editable, used to personalize every agent response |
| Learning Pace | slow / moderate / fast — auto-adjusted by the Evaluator based on evaluation history |
| Learner Traits | Perseverance and frustration tolerance derived from long-term evaluation patterns |

---

## System Architecture

### High-Level Overview

```mermaid
flowchart TB
    subgraph FE["Frontend — React + Vite + TypeScript"]
        LP[Landing Page]
        AUTH[Auth Pages]
        OB[Onboarding Wizard]
        DASH[Dashboard]
        MENTOR[Mentor Chat]
        ROAD[Roadmap View]
        ANALYTICS[Analytics]
        PROFILE[Profile]
        TRACE_UI[Cognitive Trace Panel]
    end

    subgraph BE["Backend — FastAPI + Python"]
        API[API Routes + Middleware]
        ORCH[Agent Orchestrator]
        subgraph Agents["Multi-Agent System"]
            MEM[Memory Agent]
            PLAN[Planner Agent]
            EXEC[Executor Agent]
            EVAL[Evaluator Agent]
        end
        CHAT_SVC[Chat Service]
        DASH_SVC[Dashboard Service]
        TRACE_SVC[Trace Service]
        TTS_SVC[TTS Service]
    end

    subgraph EXT["External Services"]
        MONGO[(MongoDB Atlas)]
        GEMINI[Google Gemini 2.5 Flash]
        ELEVEN[ElevenLabs TTS]
    end

    FE -->|REST + JWT HttpOnly Cookies| API
    API --> ORCH
    ORCH --> MEM --> PLAN --> EXEC
    EXEC -.->|async background| EVAL
    EVAL -.->|updates| MEM
    API --> CHAT_SVC & DASH_SVC & TRACE_SVC & TTS_SVC

    MEM -->|Read/Write| MONGO
    CHAT_SVC -->|Messages| MONGO
    TRACE_SVC -->|Logs| MONGO
    PLAN -->|Strategy| GEMINI
    EXEC -->|Generation| GEMINI
    TTS_SVC -->|Audio| ELEVEN
```

### Data Flow — Login Through Chat

```mermaid
sequenceDiagram
    participant Client as Frontend
    participant API as FastAPI
    participant DB as MongoDB
    participant LLM as Gemini

    Client->>API: POST /api/auth/login (email, password)
    API->>DB: Find user by email
    API->>API: Verify bcrypt(SHA256(password))
    API->>DB: Store hashed refresh token (TTL index)
    API-->>Client: Set HttpOnly cookies (access + refresh)

    Client->>API: POST /api/chat (message, chat_id?)
    API->>DB: Save user message (sync)
    API->>DB: Load user memory (profile, struggles, evaluations)
    API->>LLM: Planner prompt (context + message)
    LLM-->>API: Strategy JSON (tone, pacing, verbosity)
    API->>LLM: Executor prompt (strategy + context + message)
    LLM-->>API: Mentor response (constrained to max_lines)
    API->>DB: Save mentor response (sync)
    API-->>Client: Response + chat_id + evaluation metadata

    Note over API,DB: Background (non-blocking):
    API->>LLM: Evaluator scores clarity (0-100)
    API->>DB: Store evaluation, update effort metrics
    API->>DB: Update struggles if detected
```

### Key Architectural Decision: Synchronous Persistence

User messages and mentor responses are saved to MongoDB **before** the response is returned to the client. Background tasks (evaluation, struggle detection, learner trait analysis) run asynchronously after the response is delivered.

**Why:** If a background task fails, no user data is lost. The evaluation can be retried or skipped without affecting the conversation record.

---

## Multi-Agent Pipeline

Four agents with distinct responsibilities process every user message:

```mermaid
flowchart LR
    MSG[User Message] --> SAVE[Save to DB<br/>sync]
    SAVE --> MEM[Memory Agent<br/>Load Context]
    MEM -->|profile + struggles<br/>+ eval history| PLAN[Planner Agent<br/>Decide Strategy]
    PLAN -->|strategy JSON<br/>tone + pacing| EXEC[Executor Agent<br/>Generate Response]
    EXEC --> PERSIST[Save Response<br/>sync]
    PERSIST --> RETURN[Return to User]

    EXEC -.->|async| EVAL[Evaluator Agent<br/>Score Clarity]
    EVAL -.->|update| MEM

    subgraph Trace["Cognitive Trace Logging"]
        MEM -.-> LOG[Trace Logs]
        PLAN -.-> LOG
        EXEC -.-> LOG
        EVAL -.-> LOG
    end
```

### Agent Responsibilities

**Memory Agent** — *The Librarian*
- Retrieves user profile, active struggles, evaluation history (last 20), recent interactions, and chat context
- Persists evaluation results, effort metrics, and learner traits
- Generates AI-summarized user context for LLM consumption
- Updates struggles (topic, count, severity, last seen)

**Planner Agent** — *The Strategist*
- Receives user context + current message + latest clarity score + confusion trend
- Outputs a structured JSON decision (not prose):
  ```json
  {
    "strategy": "teach",
    "tone": "curious",
    "pacing": "slow",
    "verbosity": "detailed",
    "max_lines": 8,
    "detected_emotion": "confused",
    "should_ask_question": true,
    "chat_intent": "understanding recursion",
    "memory_update": { "new_interest": null, "new_goal": null }
  }
  ```
- Strategy selection logic:
  - Clarity < 40% → supportive strategy, slower pace
  - Clarity ≥ 70% → can challenge, accelerated pace
  - Worsening confusion trend → slow down, check gaps

**Executor Agent** — *The Voice*
- Generates the mentor response constrained by the Planner's controls
- Enforces line limits (6–8 default, 4 brief, 12 detailed)
- Also generates learning roadmaps (3–4 stages, 3–5 steps each) with UI hints
- On error: returns a generic supportive fallback ("I'm with you. Tell me more...")

**Evaluator Agent** — *The Judge*
- Scores clarity (0–100), understanding delta (-10 to +10), confusion trend
- Detects struggles by topic with severity levels (mild / moderate / significant)
- Enforces the **confusion fail-safe** (hard-coded, not prompt-dependent):
  - Explicit confusion markers → clarity locked, delta ≤ 0, trend cannot be "improving"
- Recommends pace adjustments and stage changes
- Runs asynchronously — does not block the user's response

---

## Tech Stack

### Frontend

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | React | 18.3 | UI framework |
| Language | TypeScript | 5.8 | Type safety |
| Build Tool | Vite | 7.3 | Fast HMR and builds (SWC compiler) |
| Styling | TailwindCSS | 3.4 | Utility-first CSS |
| Components | shadcn/ui | latest | 49 accessible UI components (Radix primitives) |
| Animations | Framer Motion | 12.x | Layout and scroll animations |
| Routing | React Router | 6.30 | Client-side routing with v7 future flags |
| Server State | TanStack Query | 5.83 | Data fetching, caching, synchronization |
| Forms | React Hook Form + Zod | 7.x / 3.x | Schema-validated form handling |
| Charts | Recharts | 3.8 | Data visualization (clarity trends, session activity) |
| Icons | Lucide React | 0.462 | SVG icon library |
| Markdown | React Markdown | 10.x | Render mentor responses |

### Backend

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Framework | FastAPI | 0.128 | Async ASGI web framework |
| Server | Uvicorn | 0.40 | ASGI server |
| Language | Python | 3.11 | Backend runtime |
| Database Driver | Motor | 3.7 | Async MongoDB driver |
| AI/LLM | Google Generative AI | 0.8.6 | Gemini 2.5 Flash — multi-agent backbone |
| TTS | ElevenLabs | latest | Text-to-speech (optional) |
| Validation | Pydantic v2 | 2.12 | Request/response models, settings |
| Auth | python-jose | 3.5 | JWT token creation and verification |
| Passwords | passlib + bcrypt | 1.7 / 5.0 | `bcrypt(SHA256(password))` — avoids 72-byte limit |
| HTTP Client | httpx | 0.28 | Async external HTTP calls |
| Settings | pydantic-settings | 2.x | Environment-based configuration |

### Infrastructure

| Service | Purpose |
|---------|---------|
| MongoDB Atlas | Document database — users, memory, chats, messages, roadmaps, traces |
| GitHub Actions | CI — lint (ruff) + test (pytest) + coverage on push to main/dev |
| Docker | Backend containerization (python:3.11-slim, health check, non-root) |

---

## Project Structure

```
synapse/
├── src/                                 # React Frontend
│   ├── main.tsx                         # Entry point
│   ├── App.tsx                          # Root component, routing, providers
│   ├── index.css                        # Brand design system (15.6 KB)
│   │
│   ├── config/
│   │   └── env.ts                       # VITE_API_URL / VITE_WS_URL resolution
│   │
│   ├── pages/
│   │   ├── LandingPage.tsx              # Marketing page with parallax + glassmorphism
│   │   ├── SignInPage.tsx               # Login form (split layout)
│   │   ├── SignUpPage.tsx               # Registration form with password validation
│   │   ├── OnboardingPage.tsx           # 4-step calibration wizard
│   │   ├── DashboardPage.tsx            # Growth dashboard ("Your Garden")
│   │   ├── MentorPage.tsx              # Chat interface with evaluation tags
│   │   ├── RoadmapPage.tsx              # Learning pathway visualization
│   │   ├── ProfilePage.tsx              # User profile ("Your Roots")
│   │   ├── AnalyticsPage.tsx            # Charts: clarity trend, session activity, struggles
│   │   └── NotFound.tsx                 # 404 handler
│   │
│   ├── components/
│   │   ├── Logo.tsx                     # Brand wordmark (Playfair Display SC)
│   │   ├── ProtectedRoute.tsx           # Auth + onboarding guard
│   │   ├── Sidebar.tsx                  # Navigation sidebar (indexed: 01–05)
│   │   ├── CognitiveTracePanel.tsx      # AI reasoning display
│   │   └── ui/                          # 49 shadcn/ui components
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx              # Global auth state (login, signup, logout, onboarding)
│   │
│   ├── services/
│   │   └── api.ts                       # HTTP client (all API calls, credentials: include)
│   │
│   ├── hooks/
│   │   ├── use-mentor-socket.ts         # WebSocket connection (auto-reconnect)
│   │   └── use-mobile.tsx               # Mobile breakpoint detection (768px)
│   │
│   └── lib/
│       └── utils.ts                     # cn() — Tailwind class merging
│
├── backend/                             # FastAPI Backend
│   ├── app/
│   │   ├── main.py                      # FastAPI app, CORS, middleware, global error handlers
│   │   │
│   │   ├── agents/
│   │   │   ├── memory_agent.py          # Context retrieval, struggle tracking, evaluation storage
│   │   │   ├── planner_agent.py         # Strategy decision (JSON output, fence stripping)
│   │   │   ├── executor_agent.py        # Response + roadmap generation (line-constrained)
│   │   │   └── evaluator_agent.py       # Clarity scoring, confusion fail-safe, struggle detection
│   │   │
│   │   ├── services/
│   │   │   ├── agent_orchestrator.py    # 8-step pipeline coordination + trace logging
│   │   │   ├── chat_service.py          # Message CRUD, context window (10 msgs, 2000 tokens)
│   │   │   ├── dashboard_service.py     # Derived insights (read-only, no DB writes)
│   │   │   ├── trace_service.py         # Structured cognitive trace logging
│   │   │   ├── tts.py                   # ElevenLabs integration (Rachel voice, flash_v2_5)
│   │   │   ├── llm_utils.py            # Gemini config, exponential backoff retry (3x)
│   │   │   └── prompt_templates.py      # Shared LLM prompts
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.py                  # Signup, login, logout, refresh, change-password
│   │   │   ├── onboarding.py            # Status check, questions, completion
│   │   │   ├── chat_history.py          # Session CRUD, message pagination
│   │   │   ├── roadmap.py               # Generate, feedback, regenerate, history
│   │   │   └── trace.py                 # Trace retrieval (admin-only)
│   │   │
│   │   ├── models/
│   │   │   ├── user.py                  # UserCreate, UserInDB, UserResponse
│   │   │   ├── memory.py               # UserProfile, Struggle, EvaluationSnapshot, EffortMetrics
│   │   │   ├── chat.py                  # ChatSession, ChatMessage, MessageSender enum
│   │   │   ├── roadmap.py               # RoadmapStage, RoadmapStep, RoadmapFeedback
│   │   │   └── session.py               # SessionInDB (refresh token storage)
│   │   │
│   │   ├── auth/
│   │   │   ├── dependencies.py          # get_current_user, get_current_user_optional, require_role
│   │   │   ├── jwt_handler.py           # create_access_token, verify_token, decode_token
│   │   │   └── password.py              # hash_password, verify_password (SHA256 + bcrypt)
│   │   │
│   │   ├── db/
│   │   │   └── mongodb.py              # Motor connection, retry logic (3x, 2s), index creation
│   │   │
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic Settings (all env vars)
│   │   │   ├── middleware.py            # CSP, HSTS, X-Frame-Options, X-Content-Type-Options
│   │   │   └── rate_limiter.py          # IP-based sliding window (in-memory)
│   │   │
│   │   └── utils/
│   │       └── logger.py               # Structured logging (container-friendly)
│   │
│   ├── tests/                           # 77 tests, < 5s runtime
│   │   ├── conftest.py                  # Shared fixtures, mock factories
│   │   ├── test_jwt.py                  # 15 tests — token lifecycle
│   │   ├── test_agents_pipeline.py      # 15 tests — full agent pipeline (mocked LLM)
│   │   ├── test_api_endpoints.py        # 11 tests — endpoint auth requirements
│   │   ├── test_auth.py                 # 10 tests — auth workflow
│   │   ├── test_evaluator_memory.py     # 9 tests — evaluator memory updates
│   │   ├── test_errors.py              # 8 tests — error standardization
│   │   ├── test_password.py            # 7 tests — hash roundtrip
│   │   ├── test_evaluator_logic.py      # 6 tests — clarity fail-safe invariants
│   │   ├── test_analytics.py            # 6 tests — dashboard insights
│   │   ├── test_rate_limiter.py         # 5 tests — sliding window
│   │   └── test_websocket.py            # 2 tests — WebSocket connection
│   │
│   ├── requirements.txt                 # Production deps (pinned versions)
│   ├── requirements-dev.txt             # Test/lint deps
│   ├── pyproject.toml                   # Ruff + pytest + coverage config
│   ├── Dockerfile                       # python:3.11-slim, health check, port 8000
│   └── .env.example                     # All backend env vars documented
│
├── .github/workflows/
│   └── ci.yml                           # Lint (ruff) → Test (pytest) → Coverage
│
├── index.html                           # Vite entry, OG meta, font imports
├── package.json                         # Frontend deps
├── vite.config.ts                       # Dev server port 8080, SWC
├── tailwind.config.ts                   # Brand colors, fonts, animations
├── tsconfig.json                        # Path aliases (@/ → src/)
├── eslint.config.js                     # ESLint flat config
├── .env.example                         # VITE_API_URL, VITE_WS_URL
├── BRAND_GUIDELINES.md                  # Typography, color palette, design philosophy
├── CHANGELOG.md                         # Version history (2.1.0 → 3.0.0)
├── SECURITY.md                          # Security policy + vulnerability reporting
├── CONTRIBUTING.md                      # Development workflow, code standards
├── CODE_OF_CONDUCT.md                   # Contributor Covenant
└── LICENSE                              # MIT (2026, Akshansh Maurya)
```

---

## How It Works

### User Journey — Step by Step

#### 1. Registration

```
POST /api/auth/signup { email, password }
  → SHA256(password) → bcrypt(hash)
  → Insert user document
  → Initialize empty UserMemory (profile, struggles, progress)
  → Create JWT access token (30 min) + refresh token (7 days)
  → Store hashed refresh token in sessions collection (TTL auto-delete)
  → Set HttpOnly cookies → return user info
```

#### 2. Onboarding (4-step wizard)

The user answers four calibration questions:

| Step | Question | Values |
|------|----------|--------|
| 1 | What brings you here? | Free text |
| 2 | What kind of guidance? | career / skills / goals / confidence / balance |
| 3 | Where are you on your journey? | beginner / intermediate / advanced |
| 4 | What mentoring style feels right? | gentle / supportive / direct / challenging |

These answers configure the Planner Agent's initial strategy baseline and set the user's learning pace.

#### 3. First Chat Message

When a user sends their first message, the full multi-agent pipeline executes:

```
User sends: "I want to learn Python but I'm overwhelmed by all the resources"
  │
  ├─ [Step 1] Save user message to MongoDB (sync)
  │
  ├─ [Step 2] Memory Agent loads context:
  │    Profile: { stage: "seedling", pace: "moderate", interests: [], goals: [] }
  │    Struggles: []
  │    Evaluation history: []
  │    Recent chat: []
  │
  ├─ [Step 3] Planner Agent decides:
  │    Strategy: "support"
  │    Tone: "warm"
  │    Pacing: "slow"
  │    Detected emotion: "overwhelmed"
  │    Max lines: 6
  │    Memory update: { new_goal: "Learn Python" }
  │
  ├─ [Step 4] Executor Agent generates response (6 lines max, warm tone)
  │
  ├─ [Step 5] Save mentor response to MongoDB (sync)
  │
  ├─ [Step 6] Set chat title: "Learning Python — Getting Started"
  │
  └─ [Step 7] Return response to client
       │
       └─ [Background, non-blocking]:
            ├─ Evaluator: clarity_score = 35, trend = "stable", delta = 0
            ├─ Memory: append "Learn Python" to goals
            ├─ Effort: total_sessions += 1
            └─ Struggle detection: "resource overwhelm" (mild)
```

#### 4. Roadmap Generation

```
User requests roadmap for "Become a Python developer"
  │
  ├─ Archive existing active roadmaps
  │
  ├─ Executor Agent generates nested JSON:
  │    3–4 stages, each with 3–5 steps
  │    Step types: learn, practice, build, reflect, milestone
  │    UI hints: { color: "#5C6B4A", icon: "sprout", priority: "high" }
  │
  ├─ Assign UUIDs to all stages and steps
  │
  ├─ Insert roadmap document
  │
  └─ Update user memory: progress.current_roadmap_id
```

#### 5. Roadmap Feedback Loop

When a user flags a step as "stuck":

```
User submits: { step_id, feedback_type: "stuck", message: "I can't figure out classes" }
  │
  ├─ Evaluator analyzes all feedback: action = "regenerate"
  │    Recommended: slow down pace, add prerequisites
  │
  ├─ Executor regenerates a gentler roadmap version
  │    Breaks complex steps into smaller pieces
  │    Adds prerequisite steps
  │
  ├─ Archive old roadmap, insert new as active
  │
  └─ Memory updates: learning_pace = "slow", new struggle: "OOP concepts"
```

#### 6. Dashboard Computation

The dashboard derives display content from raw data signals — it **never writes** to the database:

```
GET /api/user/dashboard
  │
  ├─ Momentum (from evaluation history):
  │    Average clarity (last 5 evals) + confusion trend →
  │    accelerating (70+, improving) | steady (50+) | building (30+, improving) | struggling
  │
  ├─ Effort (from effort metrics — tracked separately):
  │    Sessions this week, total sessions, consistency streak, persistence label
  │
  ├─ Next Bloom (from roadmap or inferred goals):
  │    First non-completed step, or next inferred goal
  │
  ├─ Recent Signals (from struggles, interactions, progress):
  │    Recurring struggles (count ≥ 3), new topics, session milestones,
  │    clarity improvements, consistency patterns
  │
  └─ Daily Nurture (contextual prompt if active today):
       Struggle-focused, goal-focused, or reflective
```

---

## Installation & Setup

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Frontend runtime |
| Python | 3.10+ (3.11 recommended) | Backend runtime |
| MongoDB Atlas | Free tier works | [Create cluster](https://www.mongodb.com/atlas) |
| Google AI Studio API Key | — | [Get key](https://aistudio.google.com/app/apikey) |
| ElevenLabs API Key | Optional | For voice output |

### 1. Clone and Install

```bash
git clone https://github.com/akshanshmaurya/synapse.git
cd synapse

# Frontend
npm install

# Backend
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
pip install -r requirements-dev.txt    # for testing
```

### 2. Configure Environment

**Frontend** — create `.env` in project root:

```env
VITE_API_URL=http://localhost:8000
# VITE_WS_URL is auto-derived from VITE_API_URL if omitted
```

**Backend** — create `backend/.env`:

```env
# Required
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
MONGODB_DB=synapse
JWT_SECRET=<run: python -c "import secrets; print(secrets.token_urlsafe(64))">
GEMINI_API_KEY=<your-gemini-api-key>

# Optional
ELEVENLABS_API_KEY=<your-elevenlabs-key>
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:8080
COOKIE_DOMAIN=
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. Start Development Servers

```bash
# Terminal 1 — Backend (from backend/ directory)
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend (from project root)
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

---

## Usage Guide

### First-Time User Flow

1. **Sign Up** — Create account at `/signup`
2. **Onboarding** — Answer 4 calibration questions (auto-redirected)
3. **Dashboard** — View your "Garden" at `/dashboard`
4. **Chat** — Start a mentorship session at `/mentor`
5. **Roadmap** — Generate a learning path at `/roadmap`

### Chat Interface

- Type a message and press Enter or click Send
- Mentor responses show evaluation tags: clarity score, confusion trend, engagement level
- Chat sessions are auto-named and visible in the sidebar
- Create new sessions or continue previous ones
- Delete sessions via the sidebar

### Roadmap

- Enter a learning goal (e.g., "Master React") and generate
- Track progress by marking steps as complete
- Report difficulty by flagging steps as stuck/unclear/needs help
- The system will regenerate a gentler path when needed

### Profile

- View and edit interests and goals
- See your growth stage and learning pace
- Review your onboarding answers

---

## API Reference

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/signup` | POST | No | Create account, initialize memory, set cookies |
| `/api/auth/login` | POST | No | Authenticate, set HttpOnly cookies (rate: 5/min) |
| `/api/auth/logout` | POST | No | Clear session and cookies |
| `/api/auth/refresh` | POST | No | Rotate access + refresh tokens |
| `/api/auth/change-password` | POST | Yes | Update password, invalidate all sessions |

### User

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/user/me` | GET | Yes | Current user info + onboarding status |
| `/api/user/memory` | GET | Yes | Full user memory document |
| `/api/user/profile` | PUT | Yes | Update interests and goals |
| `/api/user/dashboard` | GET | Yes | Dashboard insights (momentum, effort, signals, nurture) |

### Onboarding

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/onboarding/status` | GET | Yes | Check onboarding completion |
| `/api/onboarding/questions` | GET | No | Get wizard question structure |
| `/api/onboarding/complete` | POST | Yes | Submit wizard answers |

### Chat

| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|------------|-------------|
| `/api/chat` | POST | Yes | 30/min | Mentor chat (full agent pipeline) |
| `/api/chat/guest` | POST | No | 10/min | Trial chat (no auth, no persistence) |
| `/api/chats` | GET | Yes | — | List chat sessions (paginated) |
| `/api/chats` | POST | Yes | — | Create new chat session |
| `/api/chats/{id}/messages` | GET | Yes | — | Get messages (cursor-based pagination) |
| `/api/chats/{id}` | PATCH | Yes | — | Update chat title |
| `/api/chats/{id}` | DELETE | Yes | — | Delete chat session |
| `/ws/chat/{session_id}` | WS | Cookie | — | Real-time streaming (3-word chunks, 50ms) |

### Roadmap

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/roadmap/current` | GET | Yes | Active roadmap |
| `/api/roadmap/history` | GET | Yes | Archived roadmaps |
| `/api/roadmap/generate` | POST | Yes | Generate new roadmap from goal |
| `/api/roadmap/feedback` | POST | Yes | Submit step feedback (stuck/unclear/needs help) |
| `/api/roadmap/regenerate` | POST | Yes | Regenerate based on evaluator analysis |

### Analytics & Traces

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/analytics/learning` | GET | Yes | Clarity trends, session activity, struggles |
| `/api/traces` | GET | Yes | Cognitive trace logs (admin-only) |
| `/api/tts` | POST | Yes | Text-to-speech via ElevenLabs |

### Error Response Format

All errors return a consistent structure:

```json
{
  "error": true,
  "code": "BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | RATE_LIMIT_EXCEEDED | INTERNAL_ERROR",
  "message": "Human-readable error description"
}
```

---

## Performance Considerations

### Current Architecture

| Area | Current Design | Impact |
|------|---------------|--------|
| LLM Calls per Message | 2 (Planner + Executor), 1 async (Evaluator) | ~2–4s latency per chat message |
| Context Window | Last 10 messages, 2000 token budget | Bounded memory usage per request |
| Evaluation History | Last 20 stored per user (`$slice` on push) | Constant storage per user |
| WebSocket Streaming | 3-word chunks with 50ms delays | Simulated typing effect |
| Rate Limiter | In-memory sliding window per IP | No external dependency, per-process only |

### Optimization Opportunities

| Optimization | Current State | Recommendation |
|-------------|--------------|----------------|
| Rate Limiter | In-memory, per-process | Redis-backed for multi-worker deployments |
| LLM Request Timeout | No explicit timeout | Add timeout to prevent hung request accumulation |
| Planner Caching | No caching | Cache strategy decisions for similar context patterns |
| Active Chat Context | Fetched from DB every message | In-memory cache for active sessions |
| Dashboard Computation | Full memory document fetch | Denormalize common fields for large-scale users |
| Background Tasks | Fire-and-forget | Add dead-letter queue for failed evaluations |

### Database Indexes

| Collection | Index | Type |
|-----------|-------|------|
| `users` | `email` | Unique |
| `sessions` | `expires_at` | TTL (auto-delete expired tokens) |
| `chats` | `user_id` + `updated_at` | Compound (sorted listing) |
| `messages` | `chat_id` + `timestamp` | Compound (ordered retrieval) |
| `roadmaps` | `user_id` | Normal |
| `user_memory` | `user_id` | Normal |

---

## Security Architecture

### Defense Layers

| Layer | Mechanism | Details |
|-------|-----------|---------|
| **Transport** | HSTS | Strict-Transport-Security in production |
| **Authentication** | JWT in HttpOnly cookies | Not accessible via JavaScript (XSS-immune storage) |
| **Token Lifecycle** | Access: 30 min, Refresh: 7 days | Refresh rotation on each use, old session deleted |
| **Password Hashing** | `bcrypt(SHA256(password))` | SHA256 pre-hash avoids bcrypt's 72-byte truncation |
| **Account Lockout** | 5 failed attempts → 15 min lock | Prevents brute-force |
| **Rate Limiting** | Sliding window per IP | Login: 5/min, Chat: 30/min, Guest: 10/min |
| **CORS** | Configurable origin allowlist | `CORS_ORIGINS` env var, comma-separated |
| **CSP** | Content-Security-Policy header | Restricts scripts, styles, connections |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options | nosniff, DENY |
| **Input Validation** | Pydantic v2 models | Length constraints, type enforcement on all requests |
| **Secret Management** | Environment variables only | No hardcoded secrets in codebase |
| **Session Cleanup** | MongoDB TTL index | Expired refresh tokens auto-deleted |

### Security Trade-offs

| Decision | Why |
|----------|-----|
| HttpOnly cookies over localStorage | Immune to XSS token theft; requires `credentials: 'include'` on client |
| In-memory rate limiter | No Redis dependency; trade-off: not distributed across workers |
| No CSRF token | Mitigated by SameSite=Lax cookies + CORS allowlist + JSON-only API |

---

## Testing

### Test Suite Overview — 77 Tests, < 5 Seconds

```
pytest -q --tb=short --cov=app --cov-report=term
```

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `test_jwt.py` | 15 | Token creation, expiry, type claims, verification, invalid tokens |
| `test_agents_pipeline.py` | 15 | Planner JSON parsing, Executor fallbacks, Evaluator fail-safe, struggle detection |
| `test_api_endpoints.py` | 11 | Auth-required endpoints reject unauthenticated, public endpoints accessible, input validation |
| `test_auth.py` | 10 | Signup, login, lockout, refresh, logout, change-password |
| `test_evaluator_memory.py` | 9 | Evaluation storage, pace adjustment, struggle tracking |
| `test_errors.py` | 8 | Validation (422), auth (401/403), rate limit (429), not found (404) |
| `test_password.py` | 7 | Hash creation, verification roundtrip, type enforcement |
| `test_evaluator_logic.py` | 6 | Confusion fail-safe invariants, clarity capping, edge cases |
| `test_analytics.py` | 6 | Dashboard insight computation |
| `test_rate_limiter.py` | 5 | Sliding window, IP isolation, window expiration |
| `test_websocket.py` | 2 | WebSocket connection and messaging |

### Module Coverage

| Module | Coverage |
|--------|----------|
| `auth/password.py` | 100% |
| `auth/jwt_handler.py` | 97% |
| `core/rate_limiter.py` | 97% |
| `core/config.py` | 100% |
| `core/middleware.py` | 93% |
| `models/*` | 100% |

### Design Decisions

- **All agent tests use mocked LLM responses** — zero Gemini API calls during CI
- `dashboard_service.py` is excluded from coverage (`omit` in pyproject.toml) — complex heuristic decision tree
- Tests marked with `@pytest.mark.requires_db` can be skipped when MongoDB is unavailable
- Minimum coverage threshold: 30% (configured in pyproject.toml)

### Running Tests

```bash
cd backend

# All tests
pytest -q

# With coverage
pytest --cov=app --cov-report=term

# Skip DB-dependent tests
pytest -m "not requires_db" -q

# Single file
pytest tests/test_evaluator_logic.py -v

# Specific test
pytest tests/test_agents_pipeline.py::test_confusion_failsafe -v
```

### CI Pipeline

Every push to `main`/`dev` and every pull request triggers:

```
GitHub Actions (ubuntu-latest, Python 3.11):
  Step 1: ruff check app/ tests/          → Lint
  Step 2: pytest --cov=app --cov-report=term  → 77 tests + coverage
```

---

## Known Limitations

### Architecture

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| Rate limiter is in-memory | Not shared across multiple Uvicorn workers or pods | Swap to Redis-backed store for distributed deployments |
| No explicit LLM request timeout | Hung Gemini requests could accumulate | Add timeout parameter to `generate_with_retry()` |
| Evaluation is eventually consistent | Clarity score may be stale during rapid consecutive messages | Background tasks complete within seconds; acceptable for non-real-time metrics |
| No concurrency control on memory updates | Concurrent background tasks could race on nested document updates | MongoDB atomic operators (`$inc`, `$push`) handle most cases |

### Frontend

| Limitation | Impact |
|-----------|--------|
| TypeScript strict mode is OFF | `noImplicitAny: false` allows looser typing than production-grade |
| No React Error Boundaries | Unhandled component errors crash the page |
| No loading skeletons | Pages show full spinner instead of progressive loading |
| WebSocket hook prepared but not primary | Chat uses REST polling; WebSocket endpoint exists but is secondary |
| No frontend test suite | `vitest.config.ts` exists but no test files in `src/` |

### Backend

| Limitation | Impact |
|-----------|--------|
| Hardcoded Gemini model name in agents | Model upgrades require editing multiple files |
| Repeated JSON cleaning logic across agents | ````json` fence stripping duplicated in 3 agent files |
| Dashboard service excluded from test coverage | Complex heuristic logic not validated in CI |
| No request logging middleware | No visibility into request duration or LLM latency distribution |

---

## Future Roadmap

### Near-Term

- [ ] Redis-backed rate limiter for horizontal scaling
- [ ] LLM request timeout (prevent hung connections)
- [ ] Shared JSON parsing utility across agents
- [ ] Move hardcoded constants (model name, context window size) to config
- [ ] React Error Boundaries for resilient UI
- [ ] Frontend test suite (Vitest + React Testing Library)
- [ ] Enable TypeScript strict mode

### Medium-Term

- [ ] Request logging middleware (request duration, LLM latency)
- [ ] Prometheus metrics endpoint for observability
- [ ] Loading skeletons for progressive UI rendering
- [ ] Chat message search across sessions
- [ ] Planner strategy caching for similar contexts
- [ ] Active chat context caching (reduce DB reads)
- [ ] Accessibility audit (WCAG 2.1 AA)

### Long-Term

- [ ] Multi-model support (swap Gemini for other LLMs)
- [ ] Collaborative learning (shared roadmaps, group sessions)
- [ ] Mobile application (React Native or PWA)
- [ ] Offline-first with sync
- [ ] Admin dashboard for system-wide analytics
- [ ] Plugin architecture for custom agents

---

## Contributing

### Development Workflow

```bash
# 1. Fork the repository
# 2. Clone your fork
git clone https://github.com/your-username/synapse.git
cd synapse

# 3. Create a feature branch
git checkout -b feature/your-feature

# 4. Make changes, lint, and test
npm run lint                           # Frontend
ruff check app/ tests/                 # Backend
pytest -q                              # Backend tests

# 5. Commit and push
git commit -m "Add your feature"
git push origin feature/your-feature

# 6. Open a Pull Request against main
```

### Code Quality Checks

| Check | Frontend | Backend |
|-------|----------|---------|
| Lint | `npm run lint` | `ruff check app/ tests/` |
| Type Check | `tsc --noEmit` | pyright (via `pyrightconfig.json`) |
| Test | — | `pytest -q` |
| Coverage | — | `pytest --cov=app --cov-report=term` |
| Format | Prettier | Black (line length: 120) |
| Docker | — | `docker build -t synapse-backend backend/` |

### Branch Strategy

- `main` — Production-ready, CI must pass
- `dev` — Integration branch
- `feature/*` — Feature branches (PR against main)

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full guidelines and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for community standards.

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 Akshansh Maurya

---

<p align="center">
  <strong>Synapse</strong> — Built with intention for intentional learners.
  <br>
  <sub>FastAPI + React + Google Gemini | Measures understanding, not activity.</sub>
</p>
