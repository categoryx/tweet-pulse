# Workspace

## Overview

Tweet Pulse — a full-stack Twitter/X News Intelligence Dashboard with two main sections: Keyword Search Analytics and User Account Analysis. Available in two versions: original Node.js/React stack and new PHP server-rendered stack.

## Stack

### PHP Application (Primary — `artifacts/php-app`)
- **Language**: PHP 8.4 (built-in development server)
- **Database**: PostgreSQL via PDO (same shared database)
- **Frontend**: Server-rendered HTML + Tailwind CSS (CDN) + Chart.js (CDN)
- **AI**: OpenAI via Replit AI Integrations (gpt-4o-mini for sentiment + summaries)
- **External API**: Twitter/X API v2 (Bearer Token via cURL)
- **No build step**: Pure PHP, served directly

### Original Node.js/React Stack (artifacts/web + artifacts/api-server)
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts + wouter
- **AI**: OpenAI via Replit AI Integrations (gpt-4o-mini)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── php-app/               # PHP full-stack app (primary)
│   │   ├── public/index.php   # Front controller + router
│   │   ├── src/Database.php   # PDO PostgreSQL connection + schema init
│   │   ├── src/Twitter.php    # Twitter API v2 client (cURL)
│   │   ├── src/OpenAI.php     # OpenAI sentiment + summary (cURL)
│   │   └── templates/         # Server-rendered PHP templates
│   ├── api-server/            # Express API server (original)
│   └── web/                   # React + Vite frontend (original)
├── lib/                       # Shared libraries (Node.js stack)
├── scripts/
├── pnpm-workspace.yaml
└── package.json
```

## Key Features

### Keyword Search Section
- Keyphrase search with Twitter API v2
- AI-powered per-tweet sentiment scoring (positive/negative/neutral)
- Dashboard: stat cards, sentiment pie chart, volume timeline, top sources table
- Top hashtags & mentions bar charts
- AI summary with key themes
- Search history sidebar with delete
- Clickable x.com profile links
- CSV export

### User Account Analysis Section
- Username lookup with profile card (avatar, bio, verified badge, follower stats)
- Sentiment analysis on recent tweets
- Engagement metric cards (avg likes, retweets, replies, engagement rate)
- AI account personality analysis with key themes
- Posting pattern charts (day-of-week, hour-of-day)
- Top tweets by engagement table
- Analysis history sidebar with delete
- CSV export

## Environment Variables

- `TWITTER_BEARER_TOKEN` — Twitter/X API v2 Bearer Token (secret)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-configured by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-configured by Replit AI Integrations
- `DATABASE_URL` — Auto-configured by Replit PostgreSQL

## PHP App Routes

- `GET /` — Keyword Search page (empty state or with search form)
- `POST /search` — Execute search, redirect to result
- `GET /search/:id` — View search result
- `GET /user-analysis` — User Analysis page
- `POST /user-analysis` — Execute analysis, redirect to result
- `GET /user-analysis/:id` — View analysis result
- `DELETE /api/searches/:id` — Delete search record (JSON API)
- `DELETE /api/user-analyses/:id` — Delete analysis record (JSON API)
- `GET /api/healthz` — Health check

## Database Schema

Both PHP and Node.js apps share the same PostgreSQL database with:
- `searches` table — Keyphrase search results with sentiment data, tweets, AI summary (JSONB columns)
- `user_analyses` table — User account analysis with profile data, posting patterns, top tweets, AI summary (JSONB columns)
