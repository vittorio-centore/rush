# Technology Stack

**Analysis Date:** 2026-04-03

## Languages

**Primary:**
- TypeScript 5.x - Next.js frontend and API routes (`src/`)
- Python 3.11+ - ML recommendation service (`ml-service/`)

**Secondary:**
- SQL - Supabase migrations (`supabase/migrations/`)

## Runtime

**Environment:**
- Node.js 20.x (detected from runtime; no `.nvmrc` or `.node-version` pinned)
- Python 3.11+ (specified in `ml-service/pyproject.toml`)

**Package Manager:**
- pnpm (lockfile v9.0) - `pnpm-lock.yaml`
- Lockfile: present
- Workspace config: `pnpm-workspace.yaml` (ignores sharp, unrs-resolver built deps)

## Frameworks

**Core:**
- Next.js 16.2.1 - Full-stack React framework (App Router) - `package.json`
- React 19.2.4 / React DOM 19.2.4 - UI rendering - `package.json`
- FastAPI 0.115+ - ML recommendation microservice - `ml-service/pyproject.toml`

**Testing:**
- Node.js built-in test runner (`node:test`) via `tsx --test` - `package.json` scripts
- pytest 8.3+ - Python ML service tests - `ml-service/pyproject.toml`

**Build/Dev:**
- tsx 4.21+ - TypeScript execution for scripts and tests - `package.json`
- ESLint 9.x with `eslint-config-next` (core-web-vitals + TypeScript) - `eslint.config.mjs`
- Tailwind CSS 4.x via PostCSS plugin - `postcss.config.mjs`, `@tailwindcss/postcss`
- TypeScript 5.x with strict mode, bundler module resolution - `tsconfig.json`

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.2.1 | App Router framework, SSR, API routes |
| `react` | 19.2.4 | UI rendering |
| `react-dom` | 19.2.4 | DOM rendering |
| `@supabase/ssr` | ^0.9.0 | Supabase auth cookie handling (server/client) |
| `@supabase/supabase-js` | ^2.100.1 | Supabase client SDK |
| `resend` | ^6.9.4 | Transactional email delivery |
| `csv-parse` | ^6.2.1 | CSV parsing for data imports |
| `dotenv` | ^17.3.1 | Env var loading for scripts (dev) |
| `tailwindcss` | ^4 | Utility-first CSS framework |
| `lightgbm` | 4.6+ | Gradient boosting ML ranker (Python) |
| `sentence-transformers` | 3.4+ | Text embeddings for recommendations (Python) |
| `pandas` | 2.3+ | Data manipulation in ML pipeline (Python) |
| `redis` | 5.2+ | Recommendation cache layer (Python) |
| `boto3` | 1.35+ | AWS S3 artifact storage (Python) |
| `uvicorn` | 0.34+ | ASGI server for FastAPI (Python) |
| `pydantic` | 2.10+ | Request/response validation in FastAPI (Python) |
| `httpx` | 0.28+ | HTTP client for ML service (Python) |
| `joblib` | 1.4+ | Model serialization/deserialization (Python) |

## Configuration

**Environment:**
- `.env.example` lists all required variables
- Env vars validated at runtime with fail-fast errors (`src/lib/supabase/config.ts`, `ml-service/ml_service/config.py`)
- Public vars prefixed with `NEXT_PUBLIC_`

**TypeScript:**
- `tsconfig.json`: strict mode, ES2017 target, bundler resolution
- Path alias: `@/*` maps to `./src/*`

**Build:**
- `next.config.ts`: minimal config (no custom settings)
- `postcss.config.mjs`: Tailwind CSS v4 via `@tailwindcss/postcss`
- `eslint.config.mjs`: Next.js core-web-vitals + TypeScript rules

**Python ML Service:**
- `ml-service/pyproject.toml`: setuptools build, pytest config
- Settings loaded via `ml_service/config.py` frozen dataclass

## Platform Requirements

**Development:**
- Node.js 20.x
- pnpm
- Python 3.11+ (for ml-service)
- Supabase project (local or hosted)

**Production:**
- Next.js deployment target (Vercel or compatible)
- Supabase hosted instance (PostgreSQL + Auth + RLS)
- FastAPI service (uvicorn) for ML recommendations
- Redis (optional, for recommendation caching)
- AWS S3 (optional, for ML model artifact storage)
- Resend account for transactional email
- Cron trigger for deadline reminders (`/api/cron/deadline-reminders`)

---

*Stack analysis: 2026-04-03*
