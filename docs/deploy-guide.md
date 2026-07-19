# FactoryPilot — Go-Live Guide (Phase E, beta)

Everything code-side is deploy-ready. What remains is creating accounts on the
hosting providers (you must do this yourself — it needs your credentials) and
pasting secrets. Budget: ~45 minutes, $0 on free tiers.

## 1. Databases (5 min)

- **Postgres**: create a free project at neon.tech → copy the connection string.
  Run the schema once: `psql "<connection-string>" -f infra/db/schema.sql`
- **Redis**: create a free database at upstash.com → copy the `rediss://` URL.

## 2. Backend services on Render (15 min)

- Push this repo to GitHub (done) → render.com → *New → Blueprint* → pick the
  repo; Render reads [render.yaml](../render.yaml) and creates 4 services.
- Paste into the orchestrator's env: `DATABASE_URL`, `REDIS_URL`,
  `OPENROUTER_API_KEY`. Put the same generated `MCP_SHARED_SECRET` on both MCP
  services. Optionally `SAP_API_KEY` on the iflow service (live S/4 reads).
- Free-tier note: services sleep after idle; first request takes ~30s to wake.

## 3. Frontend on Netlify (10 min)

- netlify.com → *Add new site → Import from Git* → pick the repo;
  [netlify.toml](../netlify.toml) supplies build settings.
- Set env vars `VITE_API_BASE_URL` and `VITE_WS_URL` to the orchestrator URL.
- Update the orchestrator's CORS/`PUBLIC_BASE_URL` if you add a custom domain.

## 4. Slack app (10 min, optional but the best demo)

- api.slack.com/apps → *Create New App* → enable **Interactivity** and set the
  Request URL to `https://<orchestrator-url>/api/agents/integrations/slack/actions`.
- Add an **Incoming Webhook** to your channel; paste that webhook URL into the
  user's profile (Access Control → webhook). Approval messages then arrive with
  a working **✅ Approve** button (Block Kit is already emitted).

## 5. Seed the demo (2 min)

```bash
node scripts/seed-demo.mjs https://<orchestrator-url>
```

Creates the three demo users, five standing goals (one per agent type), and a
pending approval card. Idempotent — run before every pitch.

## 6. Smoke test

- `/health` on all four services → `{"status":"ok"}`
- Sign in → Autonomy tab → *Run now* on a goal → timeline streams live.
- `GET /api/agents/admin/observability` (admin token) → dependency latencies.

## Security checklist before sharing the URL

- [ ] `AUTH_JWT_SECRET` is a fresh random value (never the dev default)
- [ ] `MCP_SHARED_SECRET` set on all three services
- [ ] Demo passwords changed if the URL is public beyond your team
- [ ] Provider dashboards have 2FA enabled
