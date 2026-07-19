# Graph Report - .  (2026-07-19)

## Corpus Check
- 125 files · ~158,264 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1046 nodes · 1978 edges · 63 communities (56 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.84)
- Token cost: 30,000 input · 5,152 output

## Community Hubs (Navigation)
- Chat Agent Loop & Autonomy Runs
- iFlow Simulator (SAP Mock + Live Layer)
- LLM Provider Layer
- Agents & Admin Controllers
- Orchestrator Dependencies
- MCP Warehouse-Ops Package
- Root Workspace Tooling
- iFlow Simulator Tests
- MCP Inventory Package
- Alerts & Scheduled Reports
- Auth & Session Layer
- Orchestrator Package Manifest
- Auth Guards & Admin Wiring
- Shared Types Package
- Approuter Package
- Agent Goals API Schemas
- Shared Type Definitions
- Product Docs & Deployment Topology
- Frontend UI Components
- MCP iFlow HTTP Clients
- Frontend/Package/Devdependencies
- Frontend/Package/Dependencies
- Orchestrator/Src/Common
- Integration/Mocks/Iflow
- Mcp/Servers/Mcp
- Mcp/Servers/Mcp
- Orchestrator/Src/Quota
- Frontend/Src/Components
- Frontend/Src/Components
- Mcp/Servers/Mcp
- Tsconfig/Base/Compileroptions
- Frontend/Tsconfig/Compileroptions
- Orchestrator/Tsconfig/Compileroptions
- Frontend/Src/Components
- Orchestrator/Src/Realtime
- Frontend/Src/I18N
- Orchestrator/Src/Chat
- Frontend/Src/Components
- Frontend/Src/Components
- Shared/Tsconfig/Compileroptions
- Frontend/Package/Engines
- Frontend/Package/Scripts
- Frontend/Src/Components
- Orchestrator/Src/Auth
- Orchestrator/Src/Mcp
- Scripts/Agent/Eval
- Approuter/Resources/Favicon
- Frontend/Public/Favicon
- Approuter/Server
- Orchestrator/Src/Chat
- Frontend/Package/Devdependencies
- Frontend/Package/Devdependencies
- Readme/Grounding/Flag

## God Nodes (most connected - your core abstractions)
1. `AuthUser` - 56 edges
2. `AgentsService` - 41 edges
3. `CurrentUser` - 40 edges
4. `ChatService` - 37 edges
5. `DbService` - 26 edges
6. `AlertsService` - 24 edges
7. `LlmChatMessage` - 23 edges
8. `AuthService` - 22 edges
9. `RealtimeGateway` - 20 edges
10. `IflowState` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Approuter-served Built SPA (production entry)` --semantically_similar_to--> `Frontend PWA Shell (manifest, service worker, theme #0B1524)`  [INFERRED] [semantically similar]
  approuter/resources/index.html → frontend/index.html
- `Frontend PWA Shell (manifest, service worker, theme #0B1524)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  frontend/index.html → README.md
- `Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter)` --conceptually_related_to--> `FactoryPilot`  [INFERRED]
  infra/docker-compose.yml → README.md
- `XSUAA Auth Mode (approuter OAuth2, @sap/xssec)` --conceptually_related_to--> `Approuter-served Built SPA (production entry)`  [INFERRED]
  README.md → approuter/resources/index.html
- `CEO Demo Playbook (three end-to-end walkthroughs)` --references--> `Agentic Chat (15 tools)`  [EXTRACTED]
  docs/ceo-demo-playbook.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment, approuter_resources_index_built_spa [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (63 total, 7 thin omitted)

### Community 0 - "Chat Agent Loop & Autonomy Runs"
Cohesion: 0.05
Nodes (36): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+28 more)

### Community 1 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 2 - "LLM Provider Layer"
Cohesion: 0.11
Nodes (22): StoredMessage, user, AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, toOpenAIMessages(), OpenAIProvider (+14 more)

### Community 3 - "Agents & Admin Controllers"
Cohesion: 0.10
Nodes (13): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+5 more)

### Community 4 - "Orchestrator Dependencies"
Cohesion: 0.04
Nodes (47): @anthropic-ai/sdk, bcryptjs, class-transformer, class-validator, jsonwebtoken, @nestjs/common, @nestjs/config, @nestjs/core (+39 more)

### Community 5 - "MCP Warehouse-Ops Package"
Cohesion: 0.05
Nodes (37): dependencies, express, @modelcontextprotocol/sdk, pino, redis, zod, devDependencies, prettier (+29 more)

### Community 6 - "Root Workspace Tooling"
Cohesion: 0.06
Nodes (35): concurrently, eslint, eslint-config-prettier, devDependencies, concurrently, eslint, eslint-config-prettier, prettier (+27 more)

### Community 7 - "iFlow Simulator Tests"
Cohesion: 0.06
Nodes (35): dependencies, express, pino, zod, devDependencies, prettier, supertest, tsx (+27 more)

### Community 8 - "MCP Inventory Package"
Cohesion: 0.06
Nodes (35): dependencies, express, @modelcontextprotocol/sdk, pino, zod, devDependencies, prettier, tsx (+27 more)

### Community 9 - "Alerts & Scheduled Reports"
Cohesion: 0.10
Nodes (11): AlertsController, Body, Controller, Delete, Get, Param, Post, UseGuards (+3 more)

### Community 10 - "Auth & Session Layer"
Cohesion: 0.10
Nodes (11): AuthController, Body, Controller, Delete, Get, Param, Post, UseGuards (+3 more)

### Community 11 - "Orchestrator Package Manifest"
Cohesion: 0.06
Nodes (30): devDependencies, prettier, tsx, @types/express, @types/jsonwebtoken, @types/node, @types/pg, typescript (+22 more)

### Community 12 - "Auth Guards & Admin Wiring"
Cohesion: 0.14
Nodes (15): createUserSchema, quotaSchema, scopesSchema, updateUserSchema, createAlertSchema, loginSchema, mockSchema, signupSchema (+7 more)

### Community 13 - "Shared Types Package"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 14 - "Approuter Package"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 15 - "Agent Goals API Schemas"
Cohesion: 0.19
Nodes (14): goalPatchSchema, goalSchema, AgentGoal, RunStep, Suggestion, StockAlertRow, STOCK_MUTATING_TOOLS, WRITE_TOOLS (+6 more)

### Community 16 - "Shared Type Definitions"
Cohesion: 0.11
Nodes (18): ApiError, CacheStatus, ChatRequest, ChatResponse, Conversation, ConversationMessage, ConversationRole, PendingAction (+10 more)

### Community 17 - "Product Docs & Deployment Topology"
Cohesion: 0.12
Nodes (18): Approuter-served Built SPA (production entry), CEO Demo Playbook (three end-to-end walkthroughs), Frontend PWA Shell (manifest, service worker, theme #0B1524), Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter), Cloud Foundry Deployment (5 apps, XSUAA + Postgres + Redis services), Agentic Chat (15 tools), Confirmed Writes Flow (pending action, GETDEL one-time consume), Cost Controls (free models, caching, dedupe, quotas) (+10 more)

### Community 18 - "Frontend UI Components"
Cohesion: 0.19
Nodes (13): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), AuthPage(), Landing(), SERVICES (+5 more)

### Community 19 - "MCP iFlow HTTP Clients"
Cohesion: 0.22
Nodes (14): getAccessToken(), iflowGet(), iflowPost(), logger, TokenState, app, buildServer(), handleGetRecentMovements() (+6 more)

### Community 20 - "Frontend/Package/Devdependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, devDependencies, autoprefixer, postcss, prettier, tailwindcss, @types/react, @types/react-dom (+9 more)

### Community 21 - "Frontend/Package/Dependencies"
Cohesion: 0.12
Nodes (17): axios, dependencies, axios, @manufacturing-agent/shared, react, react-dom, react-markdown, recharts (+9 more)

### Community 22 - "Orchestrator/Src/Common"
Cohesion: 0.15
Nodes (9): AppModule, Module, AuthModule, Module, chatSchema, confirmSchema, RedisService, Injectable (+1 more)

### Community 23 - "Integration/Mocks/Iflow"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 24 - "Mcp/Servers/Mcp"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 25 - "Mcp/Servers/Mcp"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 26 - "Orchestrator/Src/Quota"
Cohesion: 0.18
Nodes (5): DbService, Injectable, UsageSnapshot, QuotaService, Injectable

### Community 27 - "Frontend/Src/Components"
Cohesion: 0.19
Nodes (12): App(), AppNotification, loadSession(), StoredSession, UserRole, AgentGoal, AgentRun, AutonomyPage() (+4 more)

### Community 28 - "Frontend/Src/Components"
Cohesion: 0.19
Nodes (9): AssistantBody(), CHART_LOCATION_COLORS, ChatTurn, ConversationSummary, extractChartData(), extractRecords(), prettyKey(), SUGGESTIONS (+1 more)

### Community 29 - "Mcp/Servers/Mcp"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 30 - "Tsconfig/Base/Compileroptions"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 31 - "Frontend/Tsconfig/Compileroptions"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 32 - "Orchestrator/Tsconfig/Compileroptions"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 33 - "Frontend/Src/Components"
Cohesion: 0.25
Nodes (9): ChatPage(), MicButton(), Sidebar(), initialsOf(), AdminUser, UserCard(), UsersPage(), WarehousePolicy (+1 more)

### Community 34 - "Orchestrator/Src/Realtime"
Cohesion: 0.20
Nodes (4): ConnectedSocket, RealtimeGateway, WebSocketGateway, WebSocketServer

### Community 35 - "Frontend/Src/I18N"
Cohesion: 0.27
Nodes (7): NAV, Tab, dict, I18nContext, I18nProvider(), Lang, TranslationKey

### Community 36 - "Orchestrator/Src/Chat"
Cohesion: 0.25
Nodes (6): ConversationsController, Controller, Get, Param, Query, UseGuards

### Community 37 - "Frontend/Src/Components"
Cohesion: 0.29
Nodes (6): AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 38 - "Frontend/Src/Components"
Cohesion: 0.32
Nodes (7): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, StockAlert

### Community 39 - "Shared/Tsconfig/Compileroptions"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../tsconfig.base.json

### Community 40 - "Frontend/Package/Engines"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 41 - "Frontend/Package/Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, preview, test

### Community 42 - "Frontend/Src/Components"
Cohesion: 0.33
Nodes (6): BoardPage(), DEFAULT_COLOR, LOCATION_COLORS, LOCATION_ORDER, StockCard, WAREHOUSES

### Community 45 - "Scripts/Agent/Eval"
Cohesion: 0.80
Nodes (4): api(), CASES, login(), main()

### Community 46 - "Approuter/Resources/Favicon"
Cohesion: 0.50
Nodes (4): Rounded Blue Gradient Tile (#2A78D6 to #1B4E94), FactoryPilot Brand Mark (favicon), White Factory Silhouette with Sawtooth Roof and Chimney, Forward Arrow (pilot/progress motif)

### Community 47 - "Frontend/Public/Favicon"
Cohesion: 0.67
Nodes (4): Blue Brand Gradient (#2A78D6 to #1B4E94), Factory Silhouette Glyph, FactoryPilot Favicon, Forward Arrow Glyph

## Knowledge Gaps
- **357 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+352 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `Agents & Admin Controllers`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Chat Agent Loop & Autonomy Runs` to `LLM Provider Layer`, `Orchestrator/Src/Chat`, `Alerts & Scheduled Reports`, `Auth & Session Layer`, `Orchestrator/Src/Auth`, `Auth Guards & Admin Wiring`, `Agent Goals API Schemas`, `Orchestrator/Src/Common`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `DbService` connect `Orchestrator/Src/Quota` to `Chat Agent Loop & Autonomy Runs`, `Orchestrator/Src/Realtime`, `LLM Provider Layer`, `Orchestrator/Src/Chat`, `Agents & Admin Controllers`, `Auth & Session Layer`, `Orchestrator/Src/Auth`, `Auth Guards & Admin Wiring`, `Agent Goals API Schemas`, `Orchestrator/Src/Common`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _357 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chat Agent Loop & Autonomy Runs` be split into smaller, more focused modules?**
  _Cohesion score 0.05133161512027491 - nodes in this community are weakly interconnected._
- **Should `iFlow Simulator (SAP Mock + Live Layer)` be split into smaller, more focused modules?**
  _Cohesion score 0.06994535519125683 - nodes in this community are weakly interconnected._
- **Should `LLM Provider Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._