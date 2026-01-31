# 🧠 Synapse — Your AI Growth Mentor

> A calm, intelligent AI mentor that guides your personal and professional growth through thoughtful conversations and personalized learning roadmaps.

![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18.3-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.10+-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
- [Project Structure](#project-structure)
- [Features](#features)
- [User Flow](#user-flow)
- [API Reference](#api-reference)
- [Brand Guidelines](#brand-guidelines)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## 🌟 Overview

Synapse is an AI-powered mentorship platform that provides:

- **Personalized Guidance** — Understands your goals and adapts to your learning style
- **Learning Roadmaps** — AI-generated pathways broken into actionable steps
- **Progress Tracking** — Momentum analysis and pattern recognition
- **Calm Experience** — Designed to be thoughtful, not overwhelming

---

## 🏗 Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite)"]
        LP[Landing Page]
        AUTH[Auth Pages]
        OB[Onboarding]
        DASH[Dashboard]
        MENTOR[Mentor Chat]
        TRACE_UI[Cognitive Trace Panel]
        ROAD[Roadmap]
        PROF[Profile]
    end
    
    subgraph Backend["Backend (FastAPI)"]
        API[API Routes]
        subgraph Agents["Agent System"]
            MEM[Memory Agent]
            PLAN[Planner Agent]
            EXEC[Executor Agent]
            EVAL[Evaluator Agent]
        end
        DASH_SVC[Dashboard Service]
        TRACE_SVC[Trace Service]
    end
    
    subgraph External["External Services"]
        MONGO[(MongoDB Atlas)]
        GEMINI[Google Gemini AI]
        ELEVEN[ElevenLabs TTS]
    end
    
    Frontend --> |HTTP/REST| API
    API --> Agents
    API --> DASH_SVC
    API --> TRACE_SVC
    
    MEM --> |Reads/Writes| MONGO
    TRACE_SVC --> |Logs| MONGO
    
    PLAN --> GEMINI
    EXEC --> GEMINI
    API --> ELEVEN
    
    MENTOR --> API
    TRACE_UI --> |Polls| TRACE_SVC
```

### Agent Pipeline

```mermaid
flowchart LR
    MSG[User Message] --> MEM[Memory Agent]
    MEM --> |context| PLAN[Planner Agent]
    PLAN --> |strategy| EXEC[Executor Agent]
    EXEC --> |response| EVAL[Evaluator Agent]
    EVAL --> |updates| MEM
    
    subgraph Logging["Cognitive Trace System"]
        MEM -.-> |"[DB WRITE]"| LOG[Trace Logs]
        PLAN -.-> |"[STRATEGY]"| LOG
        EXEC -.-> |"[RESPONSE]"| LOG
        EVAL -.-> |"[SCORE]"| LOG
    end
    
    EXEC --> RESP[Mentor Response]
```

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| TailwindCSS | Styling |
| shadcn/ui | Component Library |
| Framer Motion | Animations |
| React Router | Navigation |
| **Trace Panel** | **System Visualization** |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI | Web Framework |
| Python 3.10+ | Language |
| Motor | Async MongoDB Driver |
| Google Gemini | AI/LLM |
| ElevenLabs | Text-to-Speech |
| Pydantic | Data Validation |
| **TraceService** | **Cognitive Logging** |
| python-jose | JWT Auth |

### Database
| Service | Usage |
|---------|-------|
| MongoDB Atlas | Primary Database |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)
- **MongoDB Atlas** account (free tier works)
- **Google AI Studio** API key
- *(Optional)* ElevenLabs API key for TTS

### Frontend Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/gentle-guide.git
cd gentle-guide

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

**Frontend runs at:** `http://localhost:5173`

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create environment file
cp .env.example .env
# Edit .env with your credentials

# 6. Start server
python -m uvicorn app.main:app --reload --port 8000
```

**Backend runs at:** `http://localhost:8000`  
**API Docs:** `http://localhost:8000/docs`

### Environment Variables

Create `backend/.env`:

```bash
# Required
GEMINI_API_KEY=your_google_ai_key
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=synapse
JWT_SECRET_KEY=your-64-byte-secure-secret-key

# Optional
ELEVENLABS_API_KEY=your_elevenlabs_key
```

---

## 📁 Project Structure

```
gentle-guide/
├── 📂 src/                      # Frontend source
│   ├── 📂 components/           # Reusable UI components
│   │   ├── Logo.tsx             # Brand wordmark component
│   │   ├── ProtectedRoute.tsx   # Auth guard
│   │   └── ui/                  # shadcn/ui components
│   ├── 📂 contexts/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── 📂 pages/
│   │   ├── LandingPage.tsx      # Marketing page
│   │   ├── SignInPage.tsx       # Login
│   │   ├── SignUpPage.tsx       # Registration
│   │   ├── OnboardingPage.tsx   # User setup wizard
│   │   ├── DashboardPage.tsx    # Progress overview
│   │   ├── MentorPage.tsx       # Chat interface
│   │   ├── RoadmapPage.tsx      # Learning pathways
│   │   └── ProfilePage.tsx      # User settings
│   ├── 📂 services/
│   │   └── api.ts               # API service layer
│   ├── App.tsx                  # Root component
│   └── index.css                # Brand design system
├── 📂 backend/
│   ├── 📂 app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── 📂 agents/           # AI agent system
│   │   │   ├── memory_agent.py
│   │   │   ├── planner_agent.py
│   │   │   ├── executor_agent.py
│   │   │   └── evaluator_agent.py
│   │   ├── 📂 auth/             # Authentication
│   │   ├── 📂 db/               # Database connection
│   │   ├── 📂 models/           # Pydantic models
│   │   ├── 📂 routes/           # API endpoints
│   │   └── 📂 services/         # Business logic
│   │       └── dashboard_service.py
│   ├── requirements.txt
│   └── .env
├── 📂 docs/                     # Documentation
│   ├── BACKEND_ANALYSIS.md
│   └── FRONTEND_ANALYSIS.md
├── 📄 BRAND_GUIDELINES.md       # Design system
├── 📄 package.json
└── 📄 README.md
```

---

## ✨ Features

### 🧠 Cognitive Trace System ("Jury Mode")
- **Live Visualization** — See the AI "think" in real-time
- **Defensible Reasoning** — Logs every decision (Strategy, Response, Score)
- **Data Transparency** — Explicit indicators for Database Reads/Writes
- **Safety** — Logs usage without exposing PII/content

### 📊 Dashboard
- **Momentum tracking** — Sessions, progress percentage, clarity trends
- **Next focus** — AI-derived recommended next step
- **Recent signals** — Observed learning patterns
- **Data-driven** — All insights derived from user activity

### 💬 Mentor Chat
- **Context-aware** — Remembers your goals and struggles
- **Personalized** — Adapts to your learning style
- **Voice output** — Optional text-to-speech (ElevenLabs)

### 🗺 Learning Roadmaps
- **AI-generated** — Based on your goals
- **Structured** — Stages → Steps hierarchy
- **Interactive** — Mark complete, provide feedback
- **Adaptive** — Regenerates based on your progress

### 👤 Profile
- Edit interests and goals
- View learning pace analysis
- Track progress history

---

## 🔄 User Flow

```mermaid
flowchart TD
    A[Visit Site] --> B{Authenticated?}
    B -->|No| C[Landing Page]
    C --> D[Sign Up / Sign In]
    D --> E{Onboarding Complete?}
    E -->|No| F[Onboarding Wizard]
    F --> G[Dashboard]
    B -->|Yes| E
    E -->|Yes| G
    G --> H[Mentor Chat]
    G --> I[Roadmap]
    G --> J[Profile]
    H -->|Generate| I
```

### Onboarding Questions
1. **Why are you here?** (free text)
2. **What type of guidance do you seek?** (career/learning/both)
3. **Experience level?** (beginner/intermediate/advanced)
4. **Preferred mentoring style?** (supportive/direct/analytical)

---

## 📡 API Reference

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create account |
| `/api/auth/login` | POST | Get JWT token |

### User
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/me` | GET | Current user info |
| `/api/user/memory` | GET | User memory document |
| `/api/user/profile` | PUT | Update interests/goals |
| `/api/user/dashboard` | GET | Dashboard insights |

### Chat
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message to mentor |
| `/api/tts` | POST | Text-to-speech |
| `/api/traces` | GET | **Live system activity logs** |

### Roadmap
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/roadmap/current` | GET | Active roadmap |
| `/api/roadmap/generate` | POST | Create new roadmap |
| `/api/roadmap/feedback` | POST | Submit step feedback |
| `/api/roadmap/regenerate` | POST | Adapt roadmap |

---

## 🎨 Brand Guidelines

### Typography
| Element | Font | Weight |
|---------|------|--------|
| Logo | Playfair Display | 500 |
| Headings | Playfair Display | 400-500 |
| Body | Inter | 400 |

### Colors
| Name | Hex | Usage |
|------|-----|-------|
| Deep Olive | `#5C6B4A` | Primary, Logo |
| Warm Paper | `#FDF8F3` | Background |
| Charcoal | `#3D3D3D` | Text |
| Terracotta | `#D4A574` | Accent |
| Muted Stone | `#8B8178` | Muted text |

See [BRAND_GUIDELINES.md](./BRAND_GUIDELINES.md) for complete guidelines.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Backend Analysis](./docs/BACKEND_ANALYSIS.md) | API, agents, database schema |
| [Frontend Analysis](./docs/FRONTEND_ANALYSIS.md) | Pages, components, state |
| [Brand Guidelines](./BRAND_GUIDELINES.md) | Typography, colors, components |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">
  <strong>Synapse</strong> — Built with intention for intentional learners.
</p>
