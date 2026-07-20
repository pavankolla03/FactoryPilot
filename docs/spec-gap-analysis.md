# Spec Gap Analysis — PO Technical Design vs FactoryPilot

Source documents: *Technical_Design_Document.docx* ("AI-Assisted S/4HANA Business
Insights Platform") and *Documentation.docx* (functional spec), plus SAP's
"Building MCP Servers with SAP Integration Suite" guidance (community blog,
2025). Mapped against the codebase on 2026-07-20.

## Verdict

FactoryPilot implements the spec's runtime pipeline (NL question → intent →
OData-backed tools → rate limit → LLM contextualization → cache → audit log →
dashboard) and goes far beyond it (autonomy agents, governance, approvals,
forecasting, BYOM). The spec's differentiating pillar it lacked was
**configurability** — admin-maintained business objects, rate-limit windows and
cache policies instead of code/env constants.

## Status after the Phase T spec-alignment wave

| Spec requirement | Before | Now |
|---|---|---|
| Day/week/month rate-limit windows per user | monthly only | ✅ daily + weekly + monthly, tightest window wins |
| Overage policy (BLOCK / WARN_AND_ALLOW) | hard block | ✅ per-user `block` / `warn` (warn notifies once/day) |
| Rate-limit rejection message with reset time | month only | ✅ names the window and its reset date |
| Cache TTL per business object / tool | one env TTL | ✅ `cache_policies` table + admin card (TTL, on/off) |
| Cache key strategy (PER_USER / GLOBAL) | global | ✅ per-tool `global` / `per_user` |
| Cache invalidation on events | already present | ✅ write-invalidation kept (spec listed it optional) |
| CommunicationLog fields: model, latency split (OData vs LLM), payload size, error detail, channel | missing | ✅ session_logs: `model, channel, tool_ms, llm_ms, payload_bytes, error_detail, tools_detail` |
| Dashboard: throughput by business object | missing | ✅ requests-by-tool chart |
| Dashboard: cache hit ratio | partial | ✅ ratio tile + cache-hit latency tile |
| Dashboard: rate-limit rejections | missing | ✅ rejections tile (last N days) |
| Dashboard: response time OData vs LLM vs cache | missing | ✅ LLM vs tool time tile + cache-hit latency |
| Dashboard: top questions | missing | ✅ top-questions list (+ channel mix) |
| CSV export with enriched fields | partial | ✅ export includes the new columns |

## Still open (the "missing" item, next phase)

**Business Object Configuration Registry** — the spec's objective #1: register
Sales / Delivery / Shipping / Goods Movement / Purchasing with OData service
path, entity set, default filters, `$select`, keywords, active flag, and a
test-connection action; served by a generic metadata-driven query path so a
functional consultant can add an object with zero code change. Planned as the
next phase; it also delivers the three business objects (Sales, Delivery,
Shipping) not covered today, against the Business Accelerator Hub sandbox via
the existing iFlow layer.

## Deliberate deviations from the spec (kept, with rationale)

- **Intent resolution** uses real LLM tool-calling instead of keyword tables —
  strictly stronger; the keyword fallback path still exists for LLM outages.
  (The TDD itself lists LLM-based classification as the alternative.)
- **Rate-limit placement**: the spec debates OData-then-rate-limit; we check
  quota *before* any spend and additionally rate-limit requests/minute, which
  answers the spec's open point 2 more conservatively.
- **Per-role limits** are approximated by per-user limits + org defaults; true
  role entries can ride on the same columns if a pilot needs them.
- **CAP/Fiori + HANA stack** is replaced by NestJS + Postgres + React on the
  same BTP-deployable topology (approuter + XSUAA + CF manifest). Contracts,
  not frameworks, are what the spec's flows require.
