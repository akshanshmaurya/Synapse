# Contributing to Synapse

First off, thank you for considering contributing to Synapse! It's people like you that make Synapse such a great tool for AI-assisted mentorship and education.

## Introduction

Synapse is an AI mentor system that evaluates understanding, not just conversation. Built using a multi-agent architecture (Memory → Planner → Executor → Evaluator) for adaptive learning guidance. We welcome contributions for bug fixes, new features, documentation updates, and improvements to the multi-agent system.

## Development Setup

The project uses a React + TypeScript frontend, a FastAPI backend, and MongoDB.

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally.
3. **Backend Setup**:
   - Navigate to the `backend/` directory.
   - Set up your `.env` file with MongoDB credentials, Gemini API key, and ElevenLabs API key.
   - Install requirements: `pip install -r requirements.txt`
   - Run the server: `python -m uvicorn app.main:app --reload --port 8000`
4. **Frontend Setup**:
   - Navigate to the root directory.
   - Install dependencies: `npm install`
   - Start the development server: `npm run dev`

## Branch Strategy

We use a simple branching strategy. Create a branch from `main` for your work. Use the following prefixes for your branch names:
- `feature/` for new features (e.g., `feature/new-agent`)
- `fix/` for bug fixes (e.g., `fix/auth-bug`)
- `docs/` for documentation updates (e.g., `docs/update-readme`)
- `refactor/` for code refactoring

## Contribution Steps

1. **Fork repository** and clone it locally.
2. **Create branch** from `main` using our branch strategy.
3. **Make changes** and ensure your code is well-tested.
4. **Submit pull request** against the `main` branch.

## Code Standards

To maintain a high quality and consistent codebase, please adhere to the following standards:

### Python Formatting
- We use `ruff` for linting and formatting. Run `ruff check app/ tests/` and `ruff format app/ tests/` before submitting.
- Follow PEP 8 guidelines.
- Ensure type hints are used where appropriate.

### TypeScript Formatting
- Use ESLint and Prettier.
- Run `npm run lint` before committing your changes.
- Use strict TypeScript types; avoid `any` wherever possible.

### Commit Message Style
Please follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for your commit messages.

Examples:
- `feat(agents): add new evaluation agent`
- `fix(auth): resolve JWT expiration bug`
- `docs: update setup instructions in README`
