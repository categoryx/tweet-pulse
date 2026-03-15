# Workspace

## Overview

Twitter/X News Listener Dashboard — a full-stack app that searches Twitter by keyphrase and produces a rich analytics dashboard with sentiment analysis, top sources, and AI-generated summaries.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **AI**: OpenAI via Replit AI Integrations (sentiment analysis + summaries)
- **External API**: Twitter/X API v2 (Bearer Token)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── web/                # React + Vite frontend (Tweet Pulse dashboard)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # OpenAI AI integration
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Features

- **Keyphrase Search**: Enter a topic and search Twitter's recent tweets
- **Sentiment Analysis**: AI-powered per-tweet sentiment scoring (positive/negative/neutral)
- **Dashboard Analytics**: Stat cards, sentiment pie chart, volume timeline, top sources table
- **Top Hashtags & Mentions**: Bar charts showing trending tags
- **AI Summary**: GPT-generated narrative summary with key themes
- **Search History**: Sidebar to revisit previous searches stored in PostgreSQL
- **Tweet Feed**: Individual tweets with sentiment badges and engagement stats

## Environment Variables

- `TWITTER_BEARER_TOKEN` — Twitter/X API v2 Bearer Token (secret)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-configured by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-configured by Replit AI Integrations
- `DATABASE_URL` — Auto-configured by Replit PostgreSQL

## API Endpoints

- `POST /api/twitter/search` — Search Twitter, analyze sentiment, return full analytics
- `GET /api/twitter/searches` — List previous search history
- `GET /api/twitter/searches/:id` — Get a previous search result

## Database Schema

- `searches` table — Stores keyphrase, sentiment data, top sources, hashtags, mentions, tweets, AI summary, all as JSONB columns for flexibility

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/web` (`@workspace/web`)

React + Vite frontend with dark theme dashboard. Uses Recharts for charts, shadcn/ui for components, wouter for routing.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`. Twitter search and AI analysis in `src/lib/`.

### `lib/db` (`@workspace/db`)

Database layer with `searches` table for persisting search results.

### `lib/integrations-openai-ai-server`

OpenAI SDK client for sentiment analysis and summary generation.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run: `pnpm --filter @workspace/api-spec run codegen`
