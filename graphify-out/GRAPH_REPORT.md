# Graph Report - /Users/pavankolla/FactoryPilot  (2026-07-20)

## Corpus Check
- 126 files · ~82,608 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1135 nodes · 2273 edges · 72 communities (65 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Autonomy Agents (goals, runs, critic, outcomes)
- LLM Provider Layer
- iFlow Simulator (SAP Mock + Live Layer)
- Orchestrator / Package.Json
- Auth, API Keys & Session Layer
- Auth, API Keys & Session Layer 2
- MCP Warehouse-Ops Server
- Package.Json
- iFlow Simulator (SAP Mock + Live Layer) 2
- MCP Inventory Server
- Chat Agent Loop
- Autonomy Agents (goals, runs, critic, outcomes) 2
- Orchestrator / Package.Json 2
- Shared / Package.Json
- Approuter / Package.Json
- Realtime Gateway
- Frontend UI Components
- Shared Types
- MCP Warehouse-Ops Server 2
- Frontend / Package.Json
- Frontend / Package.Json 2
- Alerts & Scheduled Reports
- iFlow Simulator (SAP Mock + Live Layer) 3
- MCP Inventory Server 2
- MCP Warehouse-Ops Server 3
- Readme.Md
- Frontend UI Components 2
- Orchestrator Common Services
- Orchestrator Common Services 2
- Frontend UI Components 3
- MCP Inventory Server 3
- Autonomy Agents (goals, runs, critic, outcomes) 3
- Tsconfig.Base.Json
- Frontend UI Components 4
- Frontend / Tsconfig.Json
- Chat Agent Loop 2
- Chat Agent Loop 3
- Orchestrator / Tsconfig.Json
- Orchestrator Src Ops
- Frontend App Shell
- Frontend UI Components 5
- Orchestrator Common Services 3
- Orchestrator Src Chat
- Frontend UI Components 6
- Frontend UI Components 7
- Shared / Tsconfig.Json
- Frontend / Package.Json 3
- Frontend / Package.Json 4
- Frontend UI Components 8
- MCP Client Service
- Scripts / Agent-Eval.Mjs
- Docs / Roadmap-Phases-E-H.Md
- Scripts / Seed-Demo.Mjs
- Approuter / Resources / Favicon.Svg
- Frontend / Public / Favicon.Svg
- Orchestrator / Src / Main.Ts
- Approuter / Server.Js
- Chat Agent Loop 4
- Frontend / Package.Json 5
- Frontend / Package.Json 6
- Infra / Manifest.Yml
- Readme.Md 2

## God Nodes (most connected - your core abstractions)
1. `AuthUser` - 69 edges
2. `AgentsService` - 57 edges
3. `CurrentUser` - 53 edges
4. `ChatService` - 39 edges
5. `LlmChatMessage` - 28 edges
6. `AuthService` - 27 edges
7. `DbService` - 26 edges
8. `AlertsService` - 24 edges
9. `LlmCompletionResult` - 23 edges
10. `AgentsController` - 22 edges

## Surprising Connections (you probably didn't know these)
- `iflowGet()` --indirect_call--> `key()`  [INFERRED]
  mcp-servers/mcp-inventory/src/iflow-client.ts → orchestrator/src/common/secret-box.ts
- `iflowGet()` --indirect_call--> `key()`  [INFERRED]
  mcp-servers/mcp-warehouse-ops/src/iflow-client.ts → orchestrator/src/common/secret-box.ts
- `Frontend PWA Shell (manifest, service worker, theme #0B1524)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  frontend/index.html → README.md
- `Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  infra/docker-compose.yml → README.md
- `CEO Demo Playbook (three end-to-end walkthroughs)` --references--> `Agentic Chat (15 tools)`  [EXTRACTED]
  docs/ceo-demo-playbook.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (72 total, 7 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.06
Nodes (18): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+10 more)

### Community 1 - "LLM Provider Layer"
Cohesion: 0.11
Nodes (23): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, CustomModelProvider, UserModelConfig, UserRoutedProvider, toOpenAIMessages() (+15 more)

### Community 2 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 3 - "Orchestrator / Package.Json"
Cohesion: 0.04
Nodes (47): @anthropic-ai/sdk, bcryptjs, class-transformer, class-validator, jsonwebtoken, @nestjs/common, @nestjs/config, @nestjs/core (+39 more)

### Community 4 - "Auth, API Keys & Session Layer"
Cohesion: 0.09
Nodes (25): createUserSchema, quotaSchema, scopesSchema, updateUserSchema, goalPatchSchema, goalSchema, createAlertSchema, loginSchema (+17 more)

### Community 5 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.10
Nodes (11): AuthController, Body, Controller, Delete, Get, Param, Post, UseGuards (+3 more)

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

### Community 10 - "Chat Agent Loop"
Cohesion: 0.15
Nodes (4): ChatService, LOCAL_TOOLS, STOCK_MUTATING_TOOLS, Injectable

### Community 11 - "Autonomy Agents (goals, runs, critic, outcomes) 2"
Cohesion: 0.17
Nodes (12): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+4 more)

### Community 12 - "Orchestrator / Package.Json 2"
Cohesion: 0.06
Nodes (30): devDependencies, prettier, tsx, @types/express, @types/jsonwebtoken, @types/node, @types/pg, typescript (+22 more)

### Community 13 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 14 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 15 - "Realtime Gateway"
Cohesion: 0.14
Nodes (7): ConnectedSocket, UsageSnapshot, QuotaService, Injectable, RealtimeGateway, WebSocketGateway, WebSocketServer

### Community 16 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): ApiKey, ApiKeysCard(), AuthPage(), AutopilotBar(), CommandCenter(), Observability, Landing(), SERVICES (+5 more)

### Community 17 - "Shared Types"
Cohesion: 0.11
Nodes (18): ApiError, CacheStatus, ChatRequest, ChatResponse, Conversation, ConversationMessage, ConversationRole, PendingAction (+10 more)

### Community 18 - "MCP Warehouse-Ops Server 2"
Cohesion: 0.22
Nodes (14): getAccessToken(), iflowGet(), iflowPost(), logger, TokenState, app, buildServer(), handleGetRecentMovements() (+6 more)

### Community 19 - "Frontend / Package.Json"
Cohesion: 0.12
Nodes (17): axios, dependencies, axios, @manufacturing-agent/shared, react, react-dom, react-markdown, recharts (+9 more)

### Community 20 - "Frontend / Package.Json 2"
Cohesion: 0.12
Nodes (17): devDependencies, postcss, prettier, tailwindcss, @types/react, @types/react-dom, typescript, @vitejs/plugin-react (+9 more)

### Community 21 - "Alerts & Scheduled Reports"
Cohesion: 0.21
Nodes (8): Res, AlertsController, Body, Controller, Get, Post, UseGuards, AuthUser

### Community 22 - "iFlow Simulator (SAP Mock + Live Layer) 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 23 - "MCP Inventory Server 2"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 24 - "MCP Warehouse-Ops Server 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 25 - "Readme.Md"
Cohesion: 0.14
Nodes (15): CEO Demo Playbook (three end-to-end walkthroughs), Frontend PWA Shell (manifest, service worker, theme #0B1524), Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter), Agentic Chat (15 tools), Confirmed Writes Flow (pending action, GETDEL one-time consume), Cost Controls (free models, caching, dedupe, quotas), FactoryPilot, Write Governance (confirmation, policies, maker-checker, anomaly detection) (+7 more)

### Community 26 - "Frontend UI Components 2"
Cohesion: 0.18
Nodes (13): App(), AppNotification, loadSession(), StoredSession, UserRole, AgentGoal, AgentMetrics, AgentRun (+5 more)

### Community 27 - "Orchestrator Common Services"
Cohesion: 0.16
Nodes (6): StoredMessage, user, RedisService, Injectable, LlmProviderFactory, Injectable

### Community 28 - "Orchestrator Common Services 2"
Cohesion: 0.30
Nodes (9): StockAlertRow, WRITE_TOOLS, actionExpired(), quotaExceeded(), scopeDenied(), throwApiError(), validationError(), reportModelOutcome() (+1 more)

### Community 29 - "Frontend UI Components 3"
Cohesion: 0.19
Nodes (9): AssistantBody(), CHART_LOCATION_COLORS, ChatTurn, ConversationSummary, extractChartData(), extractRecords(), prettyKey(), SUGGESTIONS (+1 more)

### Community 30 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 31 - "Autonomy Agents (goals, runs, critic, outcomes) 3"
Cohesion: 0.26
Nodes (10): AgentGoal, RunStep, Suggestion, ForecastResult, holtForecast(), PARAM_GRID, reorderPoint(), round2() (+2 more)

### Community 32 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 33 - "Frontend UI Components 4"
Cohesion: 0.23
Nodes (11): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, ChatPage(), MicButton() (+3 more)

### Community 34 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 35 - "Chat Agent Loop 2"
Cohesion: 0.23
Nodes (6): ChatController, Body, Controller, Get, Post, UseGuards

### Community 36 - "Chat Agent Loop 3"
Cohesion: 0.26
Nodes (7): LogsController, toCsv(), Controller, Get, Query, Res, UseGuards

### Community 37 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 38 - "Orchestrator Src Ops"
Cohesion: 0.22
Nodes (7): OpsController, Body, Controller, Get, Post, Query, UseGuards

### Community 39 - "Frontend App Shell"
Cohesion: 0.27
Nodes (7): NAV, Tab, dict, I18nContext, I18nProvider(), Lang, TranslationKey

### Community 40 - "Frontend UI Components 5"
Cohesion: 0.27
Nodes (7): Sidebar(), EmptyState(), initialsOf(), PageHeader(), AdminUser, UserCard(), WarehousePolicy

### Community 41 - "Orchestrator Common Services 3"
Cohesion: 0.28
Nodes (4): key(), openSecret(), sealSecret(), hydrateModelOutcomes()

### Community 42 - "Orchestrator Src Chat"
Cohesion: 0.25
Nodes (6): ConversationsController, Controller, Get, Param, Query, UseGuards

### Community 43 - "Frontend UI Components 6"
Cohesion: 0.32
Nodes (6): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), StatusChip()

### Community 44 - "Frontend UI Components 7"
Cohesion: 0.29
Nodes (6): AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 45 - "Shared / Tsconfig.Json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../tsconfig.base.json

### Community 46 - "Frontend / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 47 - "Frontend / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, preview, test

### Community 48 - "Frontend UI Components 8"
Cohesion: 0.33
Nodes (6): BoardPage(), DEFAULT_COLOR, LOCATION_COLORS, LOCATION_ORDER, StockCard, WAREHOUSES

### Community 50 - "Scripts / Agent-Eval.Mjs"
Cohesion: 0.60
Nodes (5): api(), CASES, loadPromotedCases(), login(), main()

### Community 51 - "Docs / Roadmap-Phases-E-H.Md"
Cohesion: 0.40
Nodes (5): Go-Live Guide (Phase E: Neon, Upstash, Render, Netlify, Slack app), Slack App Interactivity Setup (Block Kit approve button), Forecasting Agent Concept (Holt-Winters demand, no vector DB), Roadmap Phases E-H (go-live, enterprise, SAP intelligence, quality flywheel), Sequencing Logic: distribution -> procurement -> moat -> defense

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
- **370 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+365 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthUser` connect `Alerts & Scheduled Reports` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Chat Agent Loop 2`, `Auth, API Keys & Session Layer`, `Auth, API Keys & Session Layer 2`, `Chat Agent Loop 3`, `Orchestrator Src Ops`, `Chat Agent Loop`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Orchestrator Src Chat`, `Orchestrator Common Services`, `Orchestrator Common Services 2`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `Autonomy Agents (goals, runs, critic, outcomes)`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `DbService` connect `Auth, API Keys & Session Layer` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Chat Agent Loop 3`, `Orchestrator Src Chat`, `Realtime Gateway`, `MCP Client Service`, `Orchestrator Common Services`, `Orchestrator Common Services 2`, `Autonomy Agents (goals, runs, critic, outcomes) 3`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _370 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Autonomy Agents (goals, runs, critic, outcomes)` be split into smaller, more focused modules?**
  _Cohesion score 0.05767543859649123 - nodes in this community are weakly interconnected._
- **Should `LLM Provider Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.1056547619047619 - nodes in this community are weakly interconnected._
- **Should `iFlow Simulator (SAP Mock + Live Layer)` be split into smaller, more focused modules?**
  _Cohesion score 0.06994535519125683 - nodes in this community are weakly interconnected._