# Graph Report - /Users/pavankolla/FactoryPilot  (2026-07-20)

## Corpus Check
- 130 files · ~163,607 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1077 nodes · 2071 edges · 61 communities (56 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Autonomy Agents (goals, runs, critic, outcomes)
- iFlow Simulator (SAP Mock + Live Layer)
- Chat Agent Loop
- LLM Provider Layer
- Orchestrator / Package.Json
- Auth, API Keys & Session Layer
- MCP Warehouse-Ops Server
- Package.Json
- iFlow Simulator (SAP Mock + Live Layer) 2
- MCP Inventory Server
- Alerts & Scheduled Reports
- Orchestrator Common Services
- Autonomy Agents (goals, runs, critic, outcomes) 2
- Orchestrator / Package.Json 2
- Realtime Gateway
- Readme.Md
- Admin & Policy APIs
- Frontend UI Components
- Shared / Package.Json
- Approuter / Package.Json
- Shared Types
- Frontend UI Components 2
- MCP Warehouse-Ops Server 2
- Frontend / Package.Json
- Frontend / Package.Json 2
- Frontend UI Components 3
- iFlow Simulator (SAP Mock + Live Layer) 3
- MCP Inventory Server 2
- MCP Warehouse-Ops Server 3
- Frontend UI Components 4
- MCP Inventory Server 3
- Tsconfig.Base.Json
- Frontend / Tsconfig.Json
- Chat Agent Loop 2
- Orchestrator / Tsconfig.Json
- Frontend UI Components 5
- Frontend UI Components 6
- Shared / Tsconfig.Json
- Frontend / Package.Json 3
- Frontend / Package.Json 4
- Frontend UI Components 7
- Scripts / Agent-Eval.Mjs
- Scripts / Seed-Demo.Mjs
- Approuter / Resources / Favicon.Svg
- Frontend / Public / Favicon.Svg
- Orchestrator / Src / Main.Ts
- Approuter / Server.Js
- Chat Agent Loop 3
- Frontend / Package.Json 5
- Frontend / Package.Json 6
- Readme.Md 2

## God Nodes (most connected - your core abstractions)
1. `AuthUser` - 64 edges
2. `AgentsService` - 48 edges
3. `CurrentUser` - 48 edges
4. `ChatService` - 37 edges
5. `DbService` - 26 edges
6. `AlertsService` - 24 edges
7. `LlmChatMessage` - 23 edges
8. `AuthService` - 22 edges
9. `AgentsController` - 21 edges
10. `RealtimeGateway` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Approuter-served Built SPA (production entry)` --semantically_similar_to--> `Frontend PWA Shell (manifest, service worker, theme #0B1524)`  [INFERRED] [semantically similar]
  approuter/resources/index.html → frontend/index.html
- `Render Blueprint (4 backend services, free tier)` --semantically_similar_to--> `Cloud Foundry Deployment (5 apps, XSUAA + Postgres + Redis services)`  [INFERRED] [semantically similar]
  render.yaml → infra/manifest.yml
- `Frontend PWA Shell (manifest, service worker, theme #0B1524)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  frontend/index.html → README.md
- `Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  infra/docker-compose.yml → README.md
- `XSUAA Auth Mode (approuter OAuth2, @sap/xssec)` --conceptually_related_to--> `Approuter-served Built SPA (production entry)`  [INFERRED]
  README.md → approuter/resources/index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment, approuter_resources_index_built_spa [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (61 total, 5 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.07
Nodes (15): AdminController, Body, Controller, Delete, Param, Patch, Post, UseGuards (+7 more)

### Community 1 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 2 - "Chat Agent Loop"
Cohesion: 0.07
Nodes (19): ChatController, Body, Controller, Get, Post, UseGuards, ChatService, LOCAL_TOOLS (+11 more)

### Community 3 - "LLM Provider Layer"
Cohesion: 0.14
Nodes (18): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, toOpenAIMessages(), OpenAIProvider, streamOpenAICompletion(), DEFAULT_LIGHT_MODELS (+10 more)

### Community 4 - "Orchestrator / Package.Json"
Cohesion: 0.04
Nodes (47): @anthropic-ai/sdk, bcryptjs, class-transformer, class-validator, jsonwebtoken, @nestjs/common, @nestjs/config, @nestjs/core (+39 more)

### Community 5 - "Auth, API Keys & Session Layer"
Cohesion: 0.08
Nodes (18): AuthController, loginSchema, mockSchema, signupSchema, Body, Controller, Delete, Get (+10 more)

### Community 6 - "MCP Warehouse-Ops Server"
Cohesion: 0.05
Nodes (37): dependencies, express, @modelcontextprotocol/sdk, pino, redis, zod, devDependencies, prettier (+29 more)

### Community 7 - "Package.Json"
Cohesion: 0.06
Nodes (35): concurrently, eslint, eslint-config-prettier, devDependencies, concurrently, eslint, eslint-config-prettier, prettier (+27 more)

### Community 8 - "iFlow Simulator (SAP Mock + Live Layer) 2"
Cohesion: 0.06
Nodes (35): dependencies, express, pino, zod, devDependencies, prettier, supertest, tsx (+27 more)

### Community 9 - "MCP Inventory Server"
Cohesion: 0.06
Nodes (35): dependencies, express, @modelcontextprotocol/sdk, pino, zod, devDependencies, prettier, tsx (+27 more)

### Community 10 - "Alerts & Scheduled Reports"
Cohesion: 0.11
Nodes (18): Get, Res, AlertsController, Body, Controller, Delete, Get, Param (+10 more)

### Community 11 - "Orchestrator Common Services"
Cohesion: 0.15
Nodes (18): goalPatchSchema, goalSchema, AgentGoal, RunStep, Suggestion, StockAlertRow, StoredMessage, user (+10 more)

### Community 12 - "Autonomy Agents (goals, runs, critic, outcomes) 2"
Cohesion: 0.14
Nodes (11): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+3 more)

### Community 13 - "Orchestrator / Package.Json 2"
Cohesion: 0.06
Nodes (30): devDependencies, prettier, tsx, @types/express, @types/jsonwebtoken, @types/node, @types/pg, typescript (+22 more)

### Community 14 - "Realtime Gateway"
Cohesion: 0.09
Nodes (10): ConnectedSocket, RedisService, Injectable, LlmProviderFactory, Injectable, McpService, Injectable, RealtimeGateway (+2 more)

### Community 15 - "Readme.Md"
Cohesion: 0.09
Nodes (24): Approuter-served Built SPA (production entry), CEO Demo Playbook (three end-to-end walkthroughs), Go-Live Guide (Phase E: Neon, Upstash, Render, Netlify, Slack app), Slack App Interactivity Setup (Block Kit approve button), Forecasting Agent Concept (Holt-Winters demand, no vector DB), Roadmap Phases E-H (go-live, enterprise, SAP intelligence, quality flywheel), Sequencing Logic: distribution -> procurement -> moat -> defense, Frontend PWA Shell (manifest, service worker, theme #0B1524) (+16 more)

### Community 16 - "Admin & Policy APIs"
Cohesion: 0.15
Nodes (14): createUserSchema, quotaSchema, scopesSchema, updateUserSchema, createAlertSchema, AuthGuard, Injectable, AdminGuard (+6 more)

### Community 17 - "Frontend UI Components"
Cohesion: 0.15
Nodes (16): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), ApiKey, ApiKeysCard(), AuthPage() (+8 more)

### Community 18 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 19 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 20 - "Shared Types"
Cohesion: 0.11
Nodes (18): ApiError, CacheStatus, ChatRequest, ChatResponse, Conversation, ConversationMessage, ConversationRole, PendingAction (+10 more)

### Community 21 - "Frontend UI Components 2"
Cohesion: 0.18
Nodes (13): NAV, Sidebar(), Tab, initialsOf(), UserCard(), UsersPage(), WarehousePolicy, dict (+5 more)

### Community 22 - "MCP Warehouse-Ops Server 2"
Cohesion: 0.22
Nodes (14): getAccessToken(), iflowGet(), iflowPost(), logger, TokenState, app, buildServer(), handleGetRecentMovements() (+6 more)

### Community 23 - "Frontend / Package.Json"
Cohesion: 0.12
Nodes (17): autoprefixer, devDependencies, autoprefixer, postcss, prettier, tailwindcss, @types/react, @types/react-dom (+9 more)

### Community 24 - "Frontend / Package.Json 2"
Cohesion: 0.12
Nodes (17): axios, dependencies, axios, @manufacturing-agent/shared, react, react-dom, react-markdown, recharts (+9 more)

### Community 25 - "Frontend UI Components 3"
Cohesion: 0.17
Nodes (14): App(), AppNotification, loadSession(), StoredSession, UserRole, AgentGoal, AgentMetrics, AgentRun (+6 more)

### Community 26 - "iFlow Simulator (SAP Mock + Live Layer) 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 27 - "MCP Inventory Server 2"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 28 - "MCP Warehouse-Ops Server 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 29 - "Frontend UI Components 4"
Cohesion: 0.16
Nodes (11): AssistantBody(), CHART_LOCATION_COLORS, ChatPage(), ChatTurn, ConversationSummary, extractChartData(), extractRecords(), MicButton() (+3 more)

### Community 30 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 31 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 32 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 33 - "Chat Agent Loop 2"
Cohesion: 0.26
Nodes (7): LogsController, toCsv(), Controller, Get, Query, Res, UseGuards

### Community 34 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 35 - "Frontend UI Components 5"
Cohesion: 0.29
Nodes (6): AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 36 - "Frontend UI Components 6"
Cohesion: 0.32
Nodes (7): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, StockAlert

### Community 37 - "Shared / Tsconfig.Json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../tsconfig.base.json

### Community 38 - "Frontend / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 39 - "Frontend / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, preview, test

### Community 40 - "Frontend UI Components 7"
Cohesion: 0.33
Nodes (6): BoardPage(), DEFAULT_COLOR, LOCATION_COLORS, LOCATION_ORDER, StockCard, WAREHOUSES

### Community 41 - "Scripts / Agent-Eval.Mjs"
Cohesion: 0.60
Nodes (5): api(), CASES, loadPromotedCases(), login(), main()

### Community 42 - "Scripts / Seed-Demo.Mjs"
Cohesion: 0.70
Nodes (4): api(), ensureUser(), main(), USERS

### Community 43 - "Approuter / Resources / Favicon.Svg"
Cohesion: 0.50
Nodes (4): Rounded Blue Gradient Tile (#2A78D6 to #1B4E94), FactoryPilot Brand Mark (favicon), White Factory Silhouette with Sawtooth Roof and Chimney, Forward Arrow (pilot/progress motif)

### Community 44 - "Frontend / Public / Favicon.Svg"
Cohesion: 0.67
Nodes (4): Blue Brand Gradient (#2A78D6 to #1B4E94), Factory Silhouette Glyph, FactoryPilot Favicon, Forward Arrow Glyph

### Community 45 - "Orchestrator / Src / Main.Ts"
Cohesion: 0.67
Nodes (3): AppModule, Module, bootstrap()

## Knowledge Gaps
- **362 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+357 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `Autonomy Agents (goals, runs, critic, outcomes)`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Alerts & Scheduled Reports` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Chat Agent Loop 2`, `Chat Agent Loop`, `Auth, API Keys & Session Layer`, `Orchestrator Common Services`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Admin & Policy APIs`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `DbService` connect `Orchestrator Common Services` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Chat Agent Loop 2`, `Auth, API Keys & Session Layer`, `Alerts & Scheduled Reports`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Realtime Gateway`, `Admin & Policy APIs`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _362 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Autonomy Agents (goals, runs, critic, outcomes)` be split into smaller, more focused modules?**
  _Cohesion score 0.0721120984278879 - nodes in this community are weakly interconnected._
- **Should `iFlow Simulator (SAP Mock + Live Layer)` be split into smaller, more focused modules?**
  _Cohesion score 0.06994535519125683 - nodes in this community are weakly interconnected._
- **Should `Chat Agent Loop` be split into smaller, more focused modules?**
  _Cohesion score 0.0672316384180791 - nodes in this community are weakly interconnected._