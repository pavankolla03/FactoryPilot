# Graph Report - /Users/pavankolla/FactoryPilot  (2026-07-20)

## Corpus Check
- 139 files · ~171,719 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1132 nodes · 2264 edges · 80 communities (61 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Autonomy Agents (goals, runs, critic, outcomes)
- LLM Provider Layer
- Autonomy Agents (goals, runs, critic, outcomes) 2
- iFlow Simulator (SAP Mock + Live Layer)
- Chat Agent Loop
- Admin & Policy APIs
- MCP Warehouse-Ops Server
- Package.Json
- iFlow Simulator (SAP Mock + Live Layer) 2
- MCP Inventory Server
- Auth, API Keys & Session Layer
- Readme.Md
- Auth, API Keys & Session Layer 2
- Shared / Package.Json
- Orchestrator / Package.Json
- Approuter / Package.Json
- Frontend UI Components
- Shared Types
- MCP Warehouse-Ops Server 2
- Alerts & Scheduled Reports
- Frontend / Package.Json
- Frontend / Package.Json 2
- Orchestrator / Package.Json 2
- Auth, API Keys & Session Layer 3
- iFlow Simulator (SAP Mock + Live Layer) 3
- MCP Inventory Server 2
- MCP Warehouse-Ops Server 3
- Frontend UI Components 2
- Chat Agent Loop 2
- Frontend UI Components 3
- MCP Inventory Server 3
- Tsconfig.Base.Json
- Frontend UI Components 4
- Frontend / Tsconfig.Json
- Auth, API Keys & Session Layer 4
- Orchestrator / Tsconfig.Json
- Chat Agent Loop 3
- Frontend App Shell
- Frontend UI Components 5
- Orchestrator Src Chat
- Frontend UI Components 6
- Frontend UI Components 7
- Shared / Tsconfig.Json
- Frontend / Package.Json 3
- Frontend / Package.Json 4
- Frontend UI Components 8
- Orchestrator / Package.Json 3
- Orchestrator / Package.Json 4
- Scripts / Agent-Eval.Mjs
- Scripts / Seed-Demo.Mjs
- Approuter / Resources / Favicon.Svg
- Frontend / Public / Favicon.Svg
- Approuter / Server.Js
- Chat Agent Loop 4
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
1. `AuthUser` - 69 edges
2. `AgentsService` - 56 edges
3. `CurrentUser` - 53 edges
4. `ChatService` - 38 edges
5. `LlmChatMessage` - 28 edges
6. `AuthService` - 27 edges
7. `DbService` - 26 edges
8. `AlertsService` - 24 edges
9. `LlmCompletionResult` - 23 edges
10. `AgentsController` - 22 edges

## Surprising Connections (you probably didn't know these)
- `Approuter-served Built SPA (production entry)` --semantically_similar_to--> `Frontend PWA Shell (manifest, service worker, theme #0B1524)`  [INFERRED] [semantically similar]
  approuter/resources/index.html → frontend/index.html
- `Render Blueprint (4 backend services, free tier)` --semantically_similar_to--> `Cloud Foundry Deployment (5 apps, XSUAA + Postgres + Redis services)`  [INFERRED] [semantically similar]
  render.yaml → infra/manifest.yml
- `iflowGet()` --indirect_call--> `key()`  [INFERRED]
  mcp-servers/mcp-inventory/src/iflow-client.ts → orchestrator/src/common/secret-box.ts
- `iflowGet()` --indirect_call--> `key()`  [INFERRED]
  mcp-servers/mcp-warehouse-ops/src/iflow-client.ts → orchestrator/src/common/secret-box.ts
- `Frontend PWA Shell (manifest, service worker, theme #0B1524)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  frontend/index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment, approuter_resources_index_built_spa [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (80 total, 19 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.07
Nodes (14): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+6 more)

### Community 1 - "LLM Provider Layer"
Cohesion: 0.10
Nodes (23): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, CustomModelProvider, UserModelConfig, UserRoutedProvider, toOpenAIMessages() (+15 more)

### Community 2 - "Autonomy Agents (goals, runs, critic, outcomes) 2"
Cohesion: 0.07
Nodes (32): ConnectedSocket, AgentGoal, RunStep, Suggestion, ForecastResult, holtForecast(), reorderPoint(), round2() (+24 more)

### Community 3 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 4 - "Chat Agent Loop"
Cohesion: 0.08
Nodes (14): ChatService, LOCAL_TOOLS, STOCK_MUTATING_TOOLS, Injectable, WRITE_TOOLS, validationError(), reportModelOutcome(), OpsController (+6 more)

### Community 5 - "Admin & Policy APIs"
Cohesion: 0.09
Nodes (13): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+5 more)

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

### Community 10 - "Auth, API Keys & Session Layer"
Cohesion: 0.11
Nodes (23): createUserSchema, quotaSchema, scopesSchema, updateUserSchema, goalPatchSchema, goalSchema, createAlertSchema, loginSchema (+15 more)

### Community 11 - "Readme.Md"
Cohesion: 0.09
Nodes (24): Approuter-served Built SPA (production entry), CEO Demo Playbook (three end-to-end walkthroughs), Go-Live Guide (Phase E: Neon, Upstash, Render, Netlify, Slack app), Slack App Interactivity Setup (Block Kit approve button), Forecasting Agent Concept (Holt-Winters demand, no vector DB), Roadmap Phases E-H (go-live, enterprise, SAP intelligence, quality flywheel), Sequencing Logic: distribution -> procurement -> moat -> defense, Frontend PWA Shell (manifest, service worker, theme #0B1524) (+16 more)

### Community 12 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.18
Nodes (8): AuthController, Body, Controller, Delete, Get, Param, Post, UseGuards

### Community 13 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 14 - "Orchestrator / Package.Json"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, bcryptjs, @nestjs/common, @nestjs/config, @nestjs/websockets, dependencies, @anthropic-ai/sdk, bcryptjs (+13 more)

### Community 15 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 16 - "Frontend UI Components"
Cohesion: 0.14
Nodes (13): ApiKey, ApiKeysCard(), AuthPage(), AutopilotBar(), CommandCenter(), Observability, Landing(), SERVICES (+5 more)

### Community 17 - "Shared Types"
Cohesion: 0.11
Nodes (18): ApiError, CacheStatus, ChatRequest, ChatResponse, Conversation, ConversationMessage, ConversationRole, PendingAction (+10 more)

### Community 18 - "MCP Warehouse-Ops Server 2"
Cohesion: 0.22
Nodes (14): getAccessToken(), iflowGet(), iflowPost(), logger, TokenState, app, buildServer(), handleGetRecentMovements() (+6 more)

### Community 19 - "Alerts & Scheduled Reports"
Cohesion: 0.21
Nodes (9): AlertsController, Body, Controller, Delete, Get, Param, Post, UseGuards (+1 more)

### Community 20 - "Frontend / Package.Json"
Cohesion: 0.12
Nodes (17): autoprefixer, devDependencies, autoprefixer, postcss, prettier, tailwindcss, @types/react, @types/react-dom (+9 more)

### Community 21 - "Frontend / Package.Json 2"
Cohesion: 0.12
Nodes (17): axios, dependencies, axios, @manufacturing-agent/shared, react, react-dom, react-markdown, recharts (+9 more)

### Community 22 - "Orchestrator / Package.Json 2"
Cohesion: 0.12
Nodes (17): devDependencies, prettier, tsx, @types/express, @types/jsonwebtoken, @types/node, @types/pg, typescript (+9 more)

### Community 24 - "iFlow Simulator (SAP Mock + Live Layer) 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 25 - "MCP Inventory Server 2"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 26 - "MCP Warehouse-Ops Server 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 27 - "Frontend UI Components 2"
Cohesion: 0.18
Nodes (13): App(), AppNotification, loadSession(), StoredSession, UserRole, AgentGoal, AgentMetrics, AgentRun (+5 more)

### Community 28 - "Chat Agent Loop 2"
Cohesion: 0.20
Nodes (8): Res, CurrentUser, ChatController, Body, Controller, Get, Post, UseGuards

### Community 29 - "Frontend UI Components 3"
Cohesion: 0.19
Nodes (9): AssistantBody(), CHART_LOCATION_COLORS, ChatTurn, ConversationSummary, extractChartData(), extractRecords(), prettyKey(), SUGGESTIONS (+1 more)

### Community 30 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 31 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 32 - "Frontend UI Components 4"
Cohesion: 0.23
Nodes (11): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, ChatPage(), MicButton() (+3 more)

### Community 33 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 34 - "Auth, API Keys & Session Layer 4"
Cohesion: 0.23
Nodes (6): loadXsuaaCredentials(), xssec, key(), openSecret(), sealSecret(), WarehouseScope

### Community 35 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 36 - "Chat Agent Loop 3"
Cohesion: 0.29
Nodes (7): LogsController, toCsv(), Controller, Get, Query, Res, UseGuards

### Community 37 - "Frontend App Shell"
Cohesion: 0.27
Nodes (7): NAV, Tab, dict, I18nContext, I18nProvider(), Lang, TranslationKey

### Community 38 - "Frontend UI Components 5"
Cohesion: 0.27
Nodes (7): Sidebar(), EmptyState(), initialsOf(), PageHeader(), AdminUser, UserCard(), WarehousePolicy

### Community 39 - "Orchestrator Src Chat"
Cohesion: 0.25
Nodes (6): ConversationsController, Controller, Get, Param, Query, UseGuards

### Community 40 - "Frontend UI Components 6"
Cohesion: 0.32
Nodes (6): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), StatusChip()

### Community 41 - "Frontend UI Components 7"
Cohesion: 0.29
Nodes (6): AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 42 - "Shared / Tsconfig.Json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../tsconfig.base.json

### Community 43 - "Frontend / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 44 - "Frontend / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, preview, test

### Community 45 - "Frontend UI Components 8"
Cohesion: 0.33
Nodes (6): BoardPage(), DEFAULT_COLOR, LOCATION_COLORS, LOCATION_ORDER, StockCard, WAREHOUSES

### Community 46 - "Orchestrator / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 47 - "Orchestrator / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, start, test

### Community 48 - "Scripts / Agent-Eval.Mjs"
Cohesion: 0.60
Nodes (5): api(), CASES, loadPromotedCases(), login(), main()

### Community 49 - "Scripts / Seed-Demo.Mjs"
Cohesion: 0.70
Nodes (4): api(), ensureUser(), main(), USERS

### Community 50 - "Approuter / Resources / Favicon.Svg"
Cohesion: 0.50
Nodes (4): Rounded Blue Gradient Tile (#2A78D6 to #1B4E94), FactoryPilot Brand Mark (favicon), White Factory Silhouette with Sawtooth Roof and Chimney, Forward Arrow (pilot/progress motif)

### Community 51 - "Frontend / Public / Favicon.Svg"
Cohesion: 0.67
Nodes (4): Blue Brand Gradient (#2A78D6 to #1B4E94), Factory Silhouette Glyph, FactoryPilot Favicon, Forward Arrow Glyph

## Knowledge Gaps
- **366 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+361 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `Admin & Policy APIs`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Alerts & Scheduled Reports` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Auth, API Keys & Session Layer 4`, `Chat Agent Loop`, `Admin & Policy APIs`, `Chat Agent Loop 3`, `Orchestrator Src Chat`, `Auth, API Keys & Session Layer`, `Auth, API Keys & Session Layer 2`, `Auth, API Keys & Session Layer 3`, `Chat Agent Loop 2`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `DbService` connect `Autonomy Agents (goals, runs, critic, outcomes) 2` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Auth, API Keys & Session Layer 4`, `Admin & Policy APIs`, `Orchestrator Src Chat`, `Auth, API Keys & Session Layer`, `Auth, API Keys & Session Layer 3`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _366 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Autonomy Agents (goals, runs, critic, outcomes)` be split into smaller, more focused modules?**
  _Cohesion score 0.07368421052631578 - nodes in this community are weakly interconnected._
- **Should `LLM Provider Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.10116550116550116 - nodes in this community are weakly interconnected._
- **Should `Autonomy Agents (goals, runs, critic, outcomes) 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07019230769230769 - nodes in this community are weakly interconnected._