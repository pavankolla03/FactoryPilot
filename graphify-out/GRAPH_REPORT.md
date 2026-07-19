# Graph Report - /Users/pavankolla/FactoryPilot  (2026-07-20)

## Corpus Check
- 130 files · ~163,560 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1073 nodes · 2066 edges · 85 communities (66 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Autonomy Agents (goals, runs, critic, outcomes)
- iFlow Simulator (SAP Mock + Live Layer)
- LLM Provider Layer
- MCP Warehouse-Ops Server
- Chat Agent Loop
- Package.Json
- iFlow Simulator (SAP Mock + Live Layer) 2
- MCP Inventory Server
- Autonomy Agents (goals, runs, critic, outcomes) 2
- Auth, API Keys & Session Layer
- Frontend UI Components
- Shared / Package.Json
- Orchestrator / Package.Json
- Approuter / Package.Json
- Readme.Md
- Auth, API Keys & Session Layer 2
- Shared Types
- Frontend UI Components 2
- MCP Warehouse-Ops Server 2
- Frontend / Package.Json
- Frontend / Package.Json 2
- Chat Agent Loop 2
- Orchestrator / Package.Json 2
- Admin & Policy APIs
- Alerts & Scheduled Reports
- Frontend UI Components 3
- iFlow Simulator (SAP Mock + Live Layer) 3
- MCP Inventory Server 2
- MCP Warehouse-Ops Server 3
- Frontend UI Components 4
- Auth, API Keys & Session Layer 3
- Admin & Policy APIs 2
- MCP Client Service
- MCP Inventory Server 3
- Tsconfig.Base.Json
- Frontend / Tsconfig.Json
- Orchestrator Common Services
- Chat Agent Loop 3
- Chat Agent Loop 4
- Orchestrator / Tsconfig.Json
- Orchestrator Src Ops
- Auth, API Keys & Session Layer 4
- Orchestrator Common Services 2
- Frontend UI Components 5
- Frontend UI Components 6
- Shared / Tsconfig.Json
- Frontend / Package.Json 3
- Frontend / Package.Json 4
- Frontend UI Components 7
- Orchestrator / Package.Json 3
- Orchestrator / Package.Json 4
- Scripts / Agent-Eval.Mjs
- Scripts / Seed-Demo.Mjs
- Approuter / Resources / Favicon.Svg
- Frontend / Public / Favicon.Svg
- Orchestrator / Src / Main.Ts
- Approuter / Server.Js
- Orchestrator Src Agents
- Chat Agent Loop 5
- Orchestrator / Package.Json 5
- Orchestrator / Package.Json 6
- Frontend / Package.Json 5
- Frontend / Package.Json 6
- Orchestrator / Package.Json 7
- Orchestrator / Package.Json 8
- Orchestrator / Package.Json 9
- Orchestrator / Package.Json 10
- Orchestrator / Package.Json 11
- Orchestrator / Package.Json 12
- Orchestrator / Package.Json 13
- Orchestrator / Package.Json 14
- Orchestrator / Package.Json 15
- Orchestrator / Package.Json 16
- Orchestrator / Package.Json 17
- Readme.Md 2

## God Nodes (most connected - your core abstractions)
1. `AuthUser` - 64 edges
2. `CurrentUser` - 48 edges
3. `AgentsService` - 47 edges
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

## Communities (85 total, 19 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.07
Nodes (14): AdminController, Body, Controller, Delete, Param, Patch, Post, UseGuards (+6 more)

### Community 1 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 2 - "LLM Provider Layer"
Cohesion: 0.14
Nodes (18): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, toOpenAIMessages(), OpenAIProvider, streamOpenAICompletion(), DEFAULT_LIGHT_MODELS (+10 more)

### Community 3 - "MCP Warehouse-Ops Server"
Cohesion: 0.05
Nodes (37): dependencies, express, @modelcontextprotocol/sdk, pino, redis, zod, devDependencies, prettier (+29 more)

### Community 4 - "Chat Agent Loop"
Cohesion: 0.12
Nodes (5): ChatService, LOCAL_TOOLS, STOCK_MUTATING_TOOLS, Injectable, WRITE_TOOLS

### Community 5 - "Package.Json"
Cohesion: 0.06
Nodes (35): concurrently, eslint, eslint-config-prettier, devDependencies, concurrently, eslint, eslint-config-prettier, prettier (+27 more)

### Community 6 - "iFlow Simulator (SAP Mock + Live Layer) 2"
Cohesion: 0.06
Nodes (35): dependencies, express, pino, zod, devDependencies, prettier, supertest, tsx (+27 more)

### Community 7 - "MCP Inventory Server"
Cohesion: 0.06
Nodes (35): dependencies, express, @modelcontextprotocol/sdk, pino, zod, devDependencies, prettier, tsx (+27 more)

### Community 8 - "Autonomy Agents (goals, runs, critic, outcomes) 2"
Cohesion: 0.19
Nodes (10): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+2 more)

### Community 9 - "Auth, API Keys & Session Layer"
Cohesion: 0.14
Nodes (7): AuthController, Body, Controller, Post, AuthService, loadXsuaaCredentials(), Injectable

### Community 10 - "Frontend UI Components"
Cohesion: 0.15
Nodes (16): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), ApiKey, ApiKeysCard(), AuthPage() (+8 more)

### Community 11 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 12 - "Orchestrator / Package.Json"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, bcryptjs, @nestjs/common, @nestjs/config, @nestjs/websockets, dependencies, @anthropic-ai/sdk, bcryptjs (+13 more)

### Community 13 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 14 - "Readme.Md"
Cohesion: 0.10
Nodes (21): Approuter-served Built SPA (production entry), CEO Demo Playbook (three end-to-end walkthroughs), Go-Live Guide (Phase E: Neon, Upstash, Render, Netlify, Slack app), Slack App Interactivity Setup (Block Kit approve button), Frontend PWA Shell (manifest, service worker, theme #0B1524), Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter), Cloud Foundry Deployment (5 apps, XSUAA + Postgres + Redis services), Agentic Chat (15 tools) (+13 more)

### Community 15 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.19
Nodes (10): createAlertSchema, AuthGuard, Injectable, AuthModule, Module, ConversationsController, Controller, UseGuards (+2 more)

### Community 16 - "Shared Types"
Cohesion: 0.11
Nodes (18): ApiError, CacheStatus, ChatRequest, ChatResponse, Conversation, ConversationMessage, ConversationRole, PendingAction (+10 more)

### Community 17 - "Frontend UI Components 2"
Cohesion: 0.18
Nodes (13): NAV, Sidebar(), Tab, initialsOf(), UserCard(), UsersPage(), WarehousePolicy, dict (+5 more)

### Community 18 - "MCP Warehouse-Ops Server 2"
Cohesion: 0.22
Nodes (14): getAccessToken(), iflowGet(), iflowPost(), logger, TokenState, app, buildServer(), handleGetRecentMovements() (+6 more)

### Community 19 - "Frontend / Package.Json"
Cohesion: 0.12
Nodes (17): autoprefixer, devDependencies, autoprefixer, postcss, prettier, tailwindcss, @types/react, @types/react-dom (+9 more)

### Community 20 - "Frontend / Package.Json 2"
Cohesion: 0.12
Nodes (17): axios, dependencies, axios, @manufacturing-agent/shared, react, react-dom, react-markdown, recharts (+9 more)

### Community 21 - "Chat Agent Loop 2"
Cohesion: 0.18
Nodes (9): ConnectedSocket, StoredMessage, user, UsageSnapshot, QuotaService, Injectable, RealtimeGateway, WebSocketGateway (+1 more)

### Community 22 - "Orchestrator / Package.Json 2"
Cohesion: 0.12
Nodes (17): devDependencies, prettier, tsx, @types/express, @types/jsonwebtoken, @types/node, @types/pg, typescript (+9 more)

### Community 23 - "Admin & Policy APIs"
Cohesion: 0.15
Nodes (7): Get, Res, Get, Get, Param, Query, AuthUser

### Community 24 - "Alerts & Scheduled Reports"
Cohesion: 0.17
Nodes (7): AlertsController, Body, Controller, Delete, Param, Post, UseGuards

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

### Community 30 - "Auth, API Keys & Session Layer 3"
Cohesion: 0.26
Nodes (10): goalPatchSchema, goalSchema, loginSchema, mockSchema, signupSchema, xssec, actionExpired(), quotaExceeded() (+2 more)

### Community 31 - "Admin & Policy APIs 2"
Cohesion: 0.19
Nodes (8): createUserSchema, quotaSchema, scopesSchema, updateUserSchema, AdminGuard, Injectable, RequestWithUser, WarehouseScope

### Community 32 - "MCP Client Service"
Cohesion: 0.20
Nodes (7): AgentGoal, RunStep, Suggestion, StockAlertRow, McpService, ToolDescriptor, Injectable

### Community 33 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 34 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 35 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 36 - "Orchestrator Common Services"
Cohesion: 0.20
Nodes (6): AlertsService, Injectable, DbService, Injectable, LlmProviderFactory, Injectable

### Community 37 - "Chat Agent Loop 3"
Cohesion: 0.23
Nodes (6): ChatController, Body, Controller, Get, Post, UseGuards

### Community 38 - "Chat Agent Loop 4"
Cohesion: 0.26
Nodes (7): LogsController, toCsv(), Controller, Get, Query, Res, UseGuards

### Community 39 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 40 - "Orchestrator Src Ops"
Cohesion: 0.22
Nodes (7): OpsController, Body, Controller, Get, Post, Query, UseGuards

### Community 41 - "Auth, API Keys & Session Layer 4"
Cohesion: 0.22
Nodes (4): Delete, Get, Param, UseGuards

### Community 42 - "Orchestrator Common Services 2"
Cohesion: 0.25
Nodes (4): chatSchema, confirmSchema, RedisService, Injectable

### Community 43 - "Frontend UI Components 5"
Cohesion: 0.29
Nodes (6): AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 44 - "Frontend UI Components 6"
Cohesion: 0.32
Nodes (7): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, StockAlert

### Community 45 - "Shared / Tsconfig.Json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../tsconfig.base.json

### Community 46 - "Frontend / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 47 - "Frontend / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, preview, test

### Community 48 - "Frontend UI Components 7"
Cohesion: 0.33
Nodes (6): BoardPage(), DEFAULT_COLOR, LOCATION_COLORS, LOCATION_ORDER, StockCard, WAREHOUSES

### Community 49 - "Orchestrator / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 50 - "Orchestrator / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, start, test

### Community 51 - "Scripts / Agent-Eval.Mjs"
Cohesion: 0.60
Nodes (5): api(), CASES, loadPromotedCases(), login(), main()

### Community 52 - "Scripts / Seed-Demo.Mjs"
Cohesion: 0.70
Nodes (4): api(), ensureUser(), main(), USERS

### Community 53 - "Approuter / Resources / Favicon.Svg"
Cohesion: 0.50
Nodes (4): Rounded Blue Gradient Tile (#2A78D6 to #1B4E94), FactoryPilot Brand Mark (favicon), White Factory Silhouette with Sawtooth Roof and Chimney, Forward Arrow (pilot/progress motif)

### Community 54 - "Frontend / Public / Favicon.Svg"
Cohesion: 0.67
Nodes (4): Blue Brand Gradient (#2A78D6 to #1B4E94), Factory Silhouette Glyph, FactoryPilot Favicon, Forward Arrow Glyph

### Community 55 - "Orchestrator / Src / Main.Ts"
Cohesion: 0.67
Nodes (3): AppModule, Module, bootstrap()

## Knowledge Gaps
- **361 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+356 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `Autonomy Agents (goals, runs, critic, outcomes)`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Admin & Policy APIs` to `MCP Client Service`, `Autonomy Agents (goals, runs, critic, outcomes)`, `Chat Agent Loop`, `Chat Agent Loop 3`, `Chat Agent Loop 4`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Auth, API Keys & Session Layer 4`, `Auth, API Keys & Session Layer`, `Orchestrator Common Services 2`, `Orchestrator Src Ops`, `Auth, API Keys & Session Layer 2`, `Chat Agent Loop 2`, `Alerts & Scheduled Reports`, `Auth, API Keys & Session Layer 3`, `Admin & Policy APIs 2`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `DbService` connect `Orchestrator Common Services` to `Autonomy Agents (goals, runs, critic, outcomes)`, `MCP Client Service`, `Chat Agent Loop 4`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Auth, API Keys & Session Layer`, `Auth, API Keys & Session Layer 2`, `Chat Agent Loop 2`, `Auth, API Keys & Session Layer 3`, `Admin & Policy APIs 2`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _361 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Autonomy Agents (goals, runs, critic, outcomes)` be split into smaller, more focused modules?**
  _Cohesion score 0.07135135135135136 - nodes in this community are weakly interconnected._
- **Should `iFlow Simulator (SAP Mock + Live Layer)` be split into smaller, more focused modules?**
  _Cohesion score 0.06994535519125683 - nodes in this community are weakly interconnected._
- **Should `LLM Provider Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.13860544217687074 - nodes in this community are weakly interconnected._