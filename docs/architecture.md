# Synapse Architecture Guide

> **Audience:** Engineers who want to understand how Synapse works under the hood.
> For setup instructions, see [README.md](../README.md).

---

## System Overview

Synapse is a multi-agent AI mentorship platform that maintains a persistent cognitive model of each learner. Every user message passes through a four-agent pipeline before and after response generation, and the system maintains three distinct memory layers operating at different timescales.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│   Chat UI · Dashboard · Concept Map · Analytics · Reports│
└────────────────────────────┬────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────┐
│                  API Layer (FastAPI)                      │
│   POST /api/chat · WS /ws/chat · GET /api/chats/:id/... │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│              Agent Pipeline (Orchestrator)                │
│   Intent → Goal → Memory → Planner → Executor → Evaluator│
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│              Three-Layer Memory (MongoDB)                 │
│   Layer 1: Identity · Layer 2: Concepts · Layer 3: Session│
└─────────────────────────────────────────────────────────┘
```

---

## The Four-Agent Pipeline

Every message flows through six stages. Stages 1–8 are **synchronous** (the user waits). Stages 9–10 run **asynchronously** after the response is sent.

### Stage-by-Stage Breakdown

| Stage | Component | File | Blocking? |
|-------|-----------|------|-----------|
| 1 | Save user message to DB | `main.py` | Yes |
| 2 | Load/create SessionContext | `session_context_service.py` | Yes |
| 3 | Intent Classification | `intent_classifier_service.py` | Yes |
| 4 | Goal Inference (at message 3) | `goal_inference_service.py` | Yes |
| 5 | Memory Agent — assemble context | `memory_agent.py` | Yes |
| 6 | Planner Agent — select strategy | `planner_agent.py` | Yes |
| 7 | Executor Agent — generate response | `executor_agent.py` | Yes |
| 8 | Save response, return to client | `main.py` | Yes |
| 9 | Evaluator Agent — analyze interaction | `evaluator_agent.py` | **No** |
| 10 | Profile signal extraction | `evaluator_agent.py` | **No** |

The orchestrator (`agent_orchestrator.py`) coordinates stages 3–10.

---

## Agent Details

### 1. Memory Agent (`backend/app/agents/memory_agent.py`)

**Role:** Assembles a unified context object from all three memory layers.

The Memory Agent acts as a **facade** for the memory services. It does not contain any learning logic — it simply loads data from each layer and packages it for downstream agents.

**Data flow:**
```
ProfileService.get_profile(user_id)       → Layer 1 (identity)
ConceptMemoryService.get_concepts(user_id) → Layer 2 (concepts)
SessionContextService.get_session(chat_id) → Layer 3 (session)
                     ↓
              Combined MemoryContext dict
```

**Key design decision:** Memory assembly is always synchronous and runs before planning. The planner cannot function without knowing the learner's current state.

---

### 2. Planner Agent (`backend/app/agents/planner_agent.py`)

**Role:** Selects a pedagogical strategy for the response.

Uses a **deterministic-first, LLM-fallback** approach:

1. **Rule-based overrides** (checked first):
   - If momentum is `stuck` → strategy = `simplify_and_scaffold`
   - If concept is in ZPD and mastery < 0.3 → strategy = `guided_discovery`
   - If momentum is `flowing` and mastery > 0.7 → strategy = `challenge`
   - If session is `casual` → strategy = `conversational`

2. **LLM fallback** — only triggered when no deterministic rule fires. Sends the memory context to Gemini with a structured prompt requesting a strategy selection.

**Why deterministic first?** LLM strategy selection is unpredictable. The deterministic rules encode proven pedagogical patterns (Bruner's scaffolding theory, Vygotsky's ZPD) that should never be overridden by model hallucination.

---

### 3. Executor Agent (`backend/app/agents/executor_agent.py`)

**Role:** Generates the mentor's response using Gemini.

Takes the planner's strategy and the memory context and constructs a detailed system prompt that constrains the LLM's behavior. The Executor also handles:

- **Response length constraints** — mentor responses are kept concise
- **Roadmap generation** — when the strategy calls for it
- **Tone adaptation** — based on the user's profile mentoring tone preference

**Key invariant:** The Executor never writes to memory. It is a pure response generator.

---

### 4. Evaluator Agent (`backend/app/agents/evaluator_agent.py`)

**Role:** Analyzes the interaction *after* the response is sent.

Runs asynchronously (the user never waits for evaluation). Performs:

1. **Intent guard** — skips concept evaluation for casual sessions
2. **Concept extraction** — identifies concepts discussed in the message
3. **Clarity scoring** — assesses how well the user understood the material
4. **Mastery updates** — writes to ConceptMemory (Layer 2)
5. **Momentum updates** — writes to SessionContext (Layer 3)
6. **Profile signal extraction** — detects vocabulary level, experience indicators

**Critical invariant — Confusion Fail-Safe:**

```python
# Hardcoded in evaluator_agent.py — cannot be bypassed
CONFUSION_MARKERS = [
    "i don't understand", "confused", "what do you mean",
    "lost", "makes no sense", "huh", "wait what",
    "can you explain again", "i'm stuck", "too fast", "slow down"
]

# If ANY confusion marker is present, clarity CANNOT increase
if has_confusion_markers:
    clarity_score = min(clarity_score, previous_clarity - 5)
```

This ensures the system cannot hallucinate progress when the learner is explicitly confused.

---

## Three-Layer Memory Architecture

Each layer operates at a different timescale, modeled after Tulving's memory taxonomy.

### Layer 1 — Identity Memory (`user_profiles` collection)

**Service:** `profile_service.py`
**Update frequency:** Rarely (onboarding, major pattern shifts)
**Written by:** ProfileService (onboarding), EvaluatorAgent (profile signals)

Stores stable learner traits:
- Experience level (beginner / intermediate / advanced)
- Learning style preferences
- Career interests
- Vocabulary level
- Strengths and weaknesses

### Layer 2 — Semantic Memory (`concept_memory` collection)

**Service:** `concept_memory_service.py`
**Update frequency:** Per evaluation (learning sessions only)
**Written by:** ConceptMemoryService (via EvaluatorAgent)

Stores per-concept knowledge:
- Mastery level (0.0–1.0)
- Exposure count
- Misconceptions list
- Mastery history (timestamped snapshots)
- Domain classification

**Mastery Formula:**
```
mastery = (0.6 × avg_clarity) + (0.3 × exposure_rate) + (0.1 × recency_weight)

Where:
  avg_clarity    = mean clarity score across sessions discussing this concept
  exposure_rate  = normalized exposure count (capped at 1.0)
  recency_weight = 1.0 if seen in last 7 days, decaying toward 0.1 over 30 days
```

### Layer 3 — Working Memory (`session_contexts` collection)

**Service:** `session_context_service.py`
**Update frequency:** Every message
**Written by:** SessionContextService (via Orchestrator and Evaluator)

Stores ephemeral per-session state:
- Session goal (user-set or inferred)
- Session intent (learning / casual / problem_solving / review / unknown)
- Momentum state (cold_start → warming_up → flowing → stuck → wrapping_up)
- Active concepts list
- Session clarity score
- Confusion points

**Momentum is a deterministic state machine**, not an LLM judgment.

---

## Intent Classification

Not every message carries learning intent. The intent classifier gates the entire evaluation pipeline.

**Three-tier pipeline** (in `intent_classifier_service.py`):

1. **Heuristic tier** — pattern matching for greetings, farewells, single-word messages
2. **Keyword tier** — weighted keyword scoring across intent categories
3. **LLM tier** — Gemini call, only if tiers 1–2 are ambiguous

| Intent | Concept Memory | Clarity | Momentum | Profile Signals |
|--------|---------------|---------|----------|-----------------|
| `learning` | ✅ Updated | ✅ Updated | ✅ Updated | ✅ Updated |
| `problem_solving` | ✅ Updated | ✅ Updated | ✅ Updated | ✅ Updated |
| `review` | ✅ Updated | ✅ Updated | ✅ Updated | ✅ Updated |
| `casual` | ❌ Skipped | ❌ Skipped | ❌ Skipped | ✅ Updated |
| `unknown` (msg ≤ 2) | ❌ Skipped | ❌ Skipped | ❌ Skipped | ✅ Updated |

---

## Goal Inference

**Service:** `goal_inference_service.py`

Fires at **message 3** of learning sessions only. Uses a two-step approach:

1. **Keyword extraction** — identifies domain-specific terms from the conversation
2. **LLM inference** — asks Gemini to infer a learning goal from the first 3 messages

Inferred goals are shown as suggestions in the UI. Once the user confirms, the goal is locked and never overwritten by inference.

---

## Prerequisite Graph & ZPD

**Module:** `backend/app/knowledge/prerequisite_graph.py`

A static directed graph of concept prerequisites. Each concept has:
- Domain (e.g., "python", "dsa", "web")
- Prerequisites list
- Difficulty tier (1–5)

**ZPD (Zone of Proximal Development) logic:**
```python
def is_in_zpd(concept_id, user_mastery_map):
    """A concept is in the ZPD if:
    1. Its own mastery is below 0.7 (not yet proficient)
    2. ALL prerequisites have mastery ≥ 0.5 (foundations are solid)
    """
```

ZPD concepts are surfaced as "next step" recommendations in the dashboard.

---

## Supporting Services

### Learning Pattern Service (`learning_pattern_service.py`)
Synthesizes cross-session patterns: learning velocity, struggle detection, domain imbalances. All deterministic — no LLM calls.

### Learning Cycle Service (`learning_cycle_service.py`)
Orchestrates periodic background analysis. Throttled to once per 5 minutes to prevent overload.

### Report Service (`report_service.py`)
Aggregates data from all memory layers into a structured learning outcome report. Pure aggregation — no LLM calls.

### Dashboard Service (`dashboard_service.py`)
Computes dashboard analytics: momentum hero, effort metrics, recent signals, daily nurture prompts.

---

## Frontend Architecture

### Key Pages

| Page | File | Purpose |
|------|------|---------|
| Chat | `MentorPage.tsx` | Main mentor interaction + AI Insights panel |
| Dashboard | `DashboardPage.tsx` | Learning analytics overview |
| Concept Map | `ConceptMapPage.tsx` | D3-powered concept visualization |
| Roadmap | `RoadmapPage.tsx` | AI-generated learning paths |
| Analytics | `AnalyticsPage.tsx` | Detailed progress charts |
| Report | `ReportPage.tsx` | Learning outcome report (exportable) |

### Key Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useSessionContext` | `hooks/useSessionContext.ts` | Session context state management |
| `useMentorSocket` | `hooks/use-mentor-socket.ts` | WebSocket connection for streaming |

### API Client

All API calls are centralized in `src/services/api.ts`. Each function:
- Uses `fetch` with `credentials: 'include'` for cookie-based auth
- Returns typed data or `null` on failure
- Never throws for non-critical failures (chat must always work)

---

## Database Collections

| Collection | Layer | Purpose |
|-----------|-------|---------|
| `users` | Auth | User accounts |
| `sessions` | Auth | Login sessions |
| `chats` | Core | Chat session metadata |
| `messages` | Core | Chat messages |
| `roadmaps` | Core | Learning roadmaps |
| `roadmap_feedback` | Core | Step-level feedback |
| `agent_logs` | Debug | Agent pipeline traces |
| `user_memory` | Legacy | Pre-Phase 4.7 memory |
| `interactions` | Legacy | Interaction history |
| `user_profiles` | Layer 1 | Identity memory |
| `concept_memory` | Layer 2 | Semantic memory |
| `session_contexts` | Layer 3 | Working memory |

All collections use async indexes created on application startup.

---

## Research Foundation

| Framework | Implementation |
|-----------|----------------|
| Tulving's Memory Taxonomy (1985) | Three-layer memory architecture |
| Baddeley's Working Memory (2000) | SessionContext as limited-capacity buffer |
| Vygotsky's ZPD (1978) | Prerequisite graph + readiness scoring |
| Bruner's Scaffolding (1976) | Planner's deterministic strategy selection |
| Corbett & Anderson's BKT (1994) | Mastery formula (clarity + exposure + recency) |
| Csikszentmihalyi's Flow (1990) | Momentum state machine |
| Ebbinghaus's Spacing Effect (1885) | Mastery recency weighting |

---

## Test Coverage Summary

169 automated tests across 18 test files. Coverage: 52% (3,563 statements).
See [`backend/TESTING.md`](../backend/TESTING.md) for the complete test suite documentation.

| Module | Test File | Tests | Coverage |
|--------|-----------|-------|----------|
| Agent Pipeline (full chain) | `test_agents_pipeline.py` | 15 | — |
| Orchestrator V2 | `test_orchestrator_v2.py` | 8 | 73% |
| Evaluator Logic | `test_evaluator_logic.py` | 7 | 43% |
| Evaluator ↔ Memory | `test_evaluator_memory.py` | 10 | 43% |
| Memory Agent V2 | `test_memory_agent_v2.py` | 7 | 45% |
| Session Context Service | `test_session_context_service.py` | 18 | 92% |
| Concept Memory Service | `test_concept_memory_service.py` | 18 | 66% |
| Profile Service | `test_profile_service.py` | 7 | 92% |
| Intent + Goal Services | `test_intent_goal_services.py` | 8 | 80% |
| Analytics | `test_analytics.py` | 8 | 74% |
| Auth (register/login) | `test_auth.py` | 10 | 36% |
| JWT Handler | `test_jwt.py` | 15 | 97% |
| Password Hashing | `test_password.py` | 7 | 100% |
| API Endpoints | `test_api_endpoints.py` | 10 | 35% |
| Chat History Routes | `test_chat_history_routes.py` | 2 | 42% |
| WebSocket | `test_websocket.py` | 6 | 72% |
| Rate Limiter | `test_rate_limiter.py` | 5 | 97% |
| Error Handling | `test_errors.py` | 8 | — |

**Total:** 169 tests · 52% coverage · 18 test files
**CI:** GitHub Actions runs full suite on every push to `main` and `dev`

---

## Key Design Principles

1. **Deterministic over probabilistic** — Rules fire before LLM, not after
2. **Separation of concerns** — Agents don't write to each other's memory layers
3. **Casual isolation** — Casual messages never corrupt learning metrics
4. **Async evaluation** — Users never wait for post-response analysis
5. **Fail-safe invariants** — Confusion markers are hardcoded, not prompt-engineered
