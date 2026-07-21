# Graph Report - FactoryPilot  (2026-07-21)

## Corpus Check
- 140 files · ~102,382 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2930 nodes · 7273 edges · 191 communities (153 shown, 38 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 1157 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c88a1de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Autonomy Agents (goals, runs, critic, outcomes)
- LLM Provider Layer
- Chat Agent Loop
- iFlow Simulator (SAP Mock + Live Layer)
- Auth, API Keys & Session Layer
- Orchestrator Common Services
- MCP Warehouse-Ops Server
- Package.Json
- iFlow Simulator (SAP Mock + Live Layer) 2
- MCP Inventory Server
- Autonomy Agents (goals, runs, critic, outcomes) 2
- Auth, API Keys & Session Layer 2
- Shared / Package.Json
- Orchestrator / Package.Json
- Approuter / Package.Json
- Frontend UI Components
- Shared Types
- MCP Warehouse-Ops Server 2
- Frontend / Package.Json
- Frontend / Package.Json 2
- Frontend UI Components 2
- Orchestrator / Package.Json 2
- iFlow Simulator (SAP Mock + Live Layer) 3
- MCP Inventory Server 2
- MCP Warehouse-Ops Server 3
- Orchestrator Common Services 2
- Readme.Md
- Frontend UI Components 3
- MCP Inventory Server 3
- Alerts & Scheduled Reports
- Tsconfig.Base.Json
- Frontend / Tsconfig.Json
- Chat Agent Loop 2
- Orchestrator / Tsconfig.Json
- Frontend UI Components 4
- Frontend UI Components 5
- Frontend App Shell
- Autonomy Agents (goals, runs, critic, outcomes) 3
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
- Docs / Roadmap-Phases-E-H.Md
- Scripts / Seed-Demo.Mjs
- Approuter / Resources / Favicon.Svg
- Frontend / Public / Favicon.Svg
- Orchestrator / Src / Main.Ts
- Approuter / Server.Js
- Chat Agent Loop 3
- Orchestrator / Package.Json 5
- Orchestrator / Package.Json 6
- Frontend / Package.Json 5
- Frontend / Package.Json 6
- Infra / Manifest.Yml
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
- RA
- ha
- zg
- .push
- Jc
- Ce
- F
- fx
- H
- ex
- r
- realtime-SYmKJpIj.js
- .query
- n
- vl
- hf
- Kn
- t
- ma
- _
- i
- jn
- ht
- _v
- Ft
- .get
- lx
- Hs
- d
- bl
- _o
- .get
- ChatController
- rgb
- b
- .has
- zx
- qk
- Qu
- b7
- tt
- Kf
- PS
- rU
- cv
- fB
- mh
- FactoryPilot Roadmap — Phases S–V (agentic depth wave)
- fB
- wp
- sv
- Je
- Bi
- yB
- qi
- Ds
- v0
- Dd
- y8
- UB
- Fz
- nF
- Li
- y5
- mk
- pA
- d6
- zu
- h7
- $7
- bj
- Bp
- C3
- kj
- cK
- d7
- de
- UB
- e9
- formatHsl
- JA
- kk
- jm
- l3
- L7
- OL
- u0
- bcryptjs
- qi
- G5
- Pv
- zu
- gV
- i6
- tU
- fp
- cn
- Iw
- Gn
- wn
- w9
- @nestjs/schedule
- jd
- Je
- KE
- jsonwebtoken
- Ri
- l3
- mS

## God Nodes (most connected - your core abstractions)
1. `t()` - 186 edges
2. `n()` - 164 edges
3. `r()` - 149 edges
4. `i()` - 115 edges
5. `zg` - 106 edges
6. `AuthUser` - 102 edges
7. `u()` - 77 edges
8. `CurrentUser` - 67 edges
9. `r()` - 62 edges
10. `AgentsService` - 59 edges

## Surprising Connections (you probably didn't know these)
- `ObjectEditor()` --indirect_call--> `key()`  [INFERRED]
  frontend/src/components/BusinessObjectsCard.tsx → orchestrator/src/common/secret-box.ts
- `buildGoodsMovements()` --indirect_call--> `t()`  [INFERRED]
  integration-mocks/iflow-simulator/src/odata-fixtures.ts → approuter/resources/assets/charts-C2dOeYOM.js
- `App()` --indirect_call--> `g()`  [INFERRED]
  frontend/src/App.tsx → approuter/resources/assets/charts-C2dOeYOM.js
- `rankByOutcome()` --indirect_call--> `b()`  [INFERRED]
  orchestrator/src/llm/openrouter-provider.ts → approuter/resources/assets/charts-C2dOeYOM.js
- `App()` --indirect_call--> `u()`  [INFERRED]
  frontend/src/App.tsx → approuter/resources/assets/realtime-SYmKJpIj.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (191 total, 38 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.15
Nodes (3): AgentsService, Cron, Injectable

### Community 1 - "LLM Provider Layer"
Cohesion: 0.10
Nodes (23): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, CustomModelProvider, UserModelConfig, UserRoutedProvider, toOpenAIMessages() (+15 more)

### Community 2 - "Chat Agent Loop"
Cohesion: 0.06
Nodes (18): ChatController, Body, Controller, Get, Post, UseGuards, ChatService, LOCAL_TOOLS (+10 more)

### Community 3 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.15
Nodes (6): fixturesDir, IflowState, readFixture(), Material, MovementRecord, PurchaseOrder

### Community 4 - "Auth, API Keys & Session Layer"
Cohesion: 0.06
Nodes (39): eE(), Ti(), accessor(), ai(), An(), constructor(), delete(), ef() (+31 more)

### Community 5 - "Orchestrator Common Services"
Cohesion: 0.05
Nodes (63): cachePolicySchema, createUserSchema, quotaSchema, scopesSchema, updateUserSchema, goalPatchSchema, goalSchema, AgentGoal (+55 more)

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

### Community 10 - "Autonomy Agents (goals, runs, critic, outcomes) 2"
Cohesion: 0.16
Nodes (12): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+4 more)

### Community 11 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.02
Nodes (105): z8(), _a, ac, ae, ah(), ap, bc, bd (+97 more)

### Community 12 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 13 - "Orchestrator / Package.Json"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, class-validator, @nestjs/common, @nestjs/config, @nestjs/websockets, dependencies, @anthropic-ai/sdk, class-validator (+13 more)

### Community 14 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 15 - "Frontend UI Components"
Cohesion: 0.10
Nodes (25): AppNotification, StoredSession, UserRole, ApiKey, ApiKeysCard(), AuthPage(), AutopilotBar(), CachePoliciesCard() (+17 more)

### Community 16 - "Shared Types"
Cohesion: 0.11
Nodes (18): ApiError, CacheStatus, ChatRequest, ChatResponse, Conversation, ConversationMessage, ConversationRole, PendingAction (+10 more)

### Community 17 - "MCP Warehouse-Ops Server 2"
Cohesion: 0.22
Nodes (14): getAccessToken(), iflowGet(), iflowPost(), logger, TokenState, app, buildServer(), handleGetRecentMovements() (+6 more)

### Community 18 - "Frontend / Package.Json"
Cohesion: 0.12
Nodes (17): autoprefixer, devDependencies, autoprefixer, postcss, prettier, tailwindcss, @types/react, @types/react-dom (+9 more)

### Community 19 - "Frontend / Package.Json 2"
Cohesion: 0.12
Nodes (17): axios, dependencies, axios, @manufacturing-agent/shared, react, react-dom, react-markdown, recharts (+9 more)

### Community 20 - "Frontend UI Components 2"
Cohesion: 0.18
Nodes (10): AGENT_LABEL, AgentGoal, AgentMetrics, AgentRun, AutonomyPage(), Pane, ScenarioResult, STATUS_STYLE (+2 more)

### Community 21 - "Orchestrator / Package.Json 2"
Cohesion: 0.12
Nodes (17): devDependencies, prettier, tsx, @types/express, @types/jsonwebtoken, @types/node, @types/pg, typescript (+9 more)

### Community 22 - "iFlow Simulator (SAP Mock + Live Layer) 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 23 - "MCP Inventory Server 2"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 24 - "MCP Warehouse-Ops Server 3"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 25 - "Orchestrator Common Services 2"
Cohesion: 0.02
Nodes (27): a4, aj, aU, bc, Dx(), ej, [f4,d4], fH() (+19 more)

### Community 26 - "Readme.Md"
Cohesion: 0.14
Nodes (15): CEO Demo Playbook (three end-to-end walkthroughs), Frontend PWA Shell (manifest, service worker, theme #0B1524), Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter), Agentic Chat (15 tools), Confirmed Writes Flow (pending action, GETDEL one-time consume), Cost Controls (free models, caching, dedupe, quotas), FactoryPilot, Write Governance (confirmation, policies, maker-checker, anomaly detection) (+7 more)

### Community 27 - "Frontend UI Components 3"
Cohesion: 0.11
Nodes (18): AgentStep, AssistantBody(), CHART_LOCATION_COLORS, ChatPage(), ChatTurn, compactArgs(), ConversationSummary, extractChartData() (+10 more)

### Community 28 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 29 - "Alerts & Scheduled Reports"
Cohesion: 0.09
Nodes (11): AlertsController, Body, Controller, Delete, Get, Param, Post, UseGuards (+3 more)

### Community 30 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 31 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 32 - "Chat Agent Loop 2"
Cohesion: 0.09
Nodes (43): _6(), ax(), Ba(), Cd(), dm(), Eh(), Fc(), fo() (+35 more)

### Community 33 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 34 - "Frontend UI Components 4"
Cohesion: 0.25
Nodes (8): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), EmptyState(), PageHeader(), StatusChip()

### Community 35 - "Frontend UI Components 5"
Cohesion: 0.12
Nodes (18): App(), loadSession(), MicButton(), NAV, Sidebar(), Tab, initialsOf(), AdminUser (+10 more)

### Community 36 - "Frontend App Shell"
Cohesion: 0.21
Nodes (13): Ch(), cw(), cx(), f0(), fx(), Gh(), jl(), lh() (+5 more)

### Community 37 - "Autonomy Agents (goals, runs, critic, outcomes) 3"
Cohesion: 0.12
Nodes (3): me(), O, _

### Community 38 - "Orchestrator Src Chat"
Cohesion: 0.15
Nodes (14): af(), ew(), Ft(), fw(), gd(), Nw(), of(), pA() (+6 more)

### Community 39 - "Frontend UI Components 6"
Cohesion: 0.25
Nodes (7): AnalyticsOverview, AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 40 - "Frontend UI Components 7"
Cohesion: 0.32
Nodes (7): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, StockAlert

### Community 41 - "Shared / Tsconfig.Json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src/**/*.ts, ../tsconfig.base.json

### Community 42 - "Frontend / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 43 - "Frontend / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, preview, test

### Community 44 - "Frontend UI Components 8"
Cohesion: 0.33
Nodes (6): BoardPage(), DEFAULT_COLOR, LOCATION_COLORS, LOCATION_ORDER, StockCard, WAREHOUSES

### Community 45 - "Orchestrator / Package.Json 3"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 46 - "Orchestrator / Package.Json 4"
Cohesion: 0.29
Nodes (7): scripts, build, dev, format, lint, start, test

### Community 47 - "Scripts / Agent-Eval.Mjs"
Cohesion: 0.14
Nodes (4): Be, ne(), Re, se()

### Community 48 - "Docs / Roadmap-Phases-E-H.Md"
Cohesion: 0.40
Nodes (5): Go-Live Guide (Phase E: Neon, Upstash, Render, Netlify, Slack app), Slack App Interactivity Setup (Block Kit approve button), Forecasting Agent Concept (Holt-Winters demand, no vector DB), Roadmap Phases E-H (go-live, enterprise, SAP intelligence, quality flywheel), Sequencing Logic: distribution -> procurement -> moat -> defense

### Community 49 - "Scripts / Seed-Demo.Mjs"
Cohesion: 0.70
Nodes (4): api(), ensureUser(), main(), USERS

### Community 50 - "Approuter / Resources / Favicon.Svg"
Cohesion: 0.50
Nodes (4): Rounded Blue Gradient Tile (#2A78D6 to #1B4E94), FactoryPilot Brand Mark (favicon), White Factory Silhouette with Sawtooth Roof and Chimney, Forward Arrow (pilot/progress motif)

### Community 51 - "Frontend / Public / Favicon.Svg"
Cohesion: 0.67
Nodes (4): Blue Brand Gradient (#2A78D6 to #1B4E94), Factory Silhouette Glyph, FactoryPilot Favicon, Forward Arrow Glyph

### Community 52 - "Orchestrator / Src / Main.Ts"
Cohesion: 0.08
Nodes (15): AuthController, Body, Controller, Delete, Get, Param, Post, UseGuards (+7 more)

### Community 55 - "Orchestrator / Package.Json 5"
Cohesion: 0.09
Nodes (37): _1(), al(), bd(), bl(), bw(), Dh(), Fy(), Gi() (+29 more)

### Community 56 - "Orchestrator / Package.Json 6"
Cohesion: 0.12
Nodes (18): _4(), C(), C4(), D4(), d8(), e8(), j4(), k4() (+10 more)

### Community 60 - "Orchestrator / Package.Json 7"
Cohesion: 0.13
Nodes (14): ForecastResult, holtForecast(), PARAM_GRID, reorderPoint(), round2(), runHolt(), toDailySeries(), HealthController (+6 more)

### Community 63 - "Orchestrator / Package.Json 10"
Cohesion: 0.14
Nodes (11): SlottingController, Controller, Get, Param, UseGuards, PRIME, Rec, RESERVE (+3 more)

### Community 64 - "Orchestrator / Package.Json 11"
Cohesion: 0.07
Nodes (44): Gt(), ar(), Au(), Bn(), clear(), Cn(), co(), Di() (+36 more)

### Community 82 - "RA"
Cohesion: 0.17
Nodes (15): buildDeliveries(), buildGoodsMovements(), buildPurchaseOrderItems(), buildSalesOrders(), CARRIERS, CUSTOMERS, dayOffset(), matchesFilter() (+7 more)

### Community 83 - "ha"
Cohesion: 0.05
Nodes (51): Ea(), f3(), fn(), Ih(), Ks(), aa(), ba(), bm() (+43 more)

### Community 84 - "zg"
Cohesion: 0.14
Nodes (22): b0(), b4(), c8(), g0(), g4(), i4, j0(), JB() (+14 more)

### Community 85 - ".push"
Cohesion: 0.06
Nodes (49): kn, $u(), vr(), ad(), af(), At(), cd, concat() (+41 more)

### Community 86 - "Jc"
Cohesion: 0.06
Nodes (51): An(), b(), Bu(), by(), C1(), C7(), Cg(), Cu() (+43 more)

### Community 88 - "F"
Cohesion: 0.09
Nodes (7): i6(), n6(), nh(), ip(), un(), B(), F

### Community 89 - "fx"
Cohesion: 0.06
Nodes (60): Fa(), Ls(), pl(), Un, wf(), xv(), z7(), ax() (+52 more)

### Community 90 - "H"
Cohesion: 0.16
Nodes (4): Ae(), H, qe, ye()

### Community 91 - "ex"
Cohesion: 0.19
Nodes (13): ok(), pr(), createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema (+5 more)

### Community 92 - "r"
Cohesion: 0.08
Nodes (28): Ai(), Cs(), dP(), ez(), fp(), gO(), gR(), gz() (+20 more)

### Community 93 - "realtime-SYmKJpIj.js"
Cohesion: 0.09
Nodes (25): Ze(), dd, de(), $e(), Ee(), et, Fe(), G() (+17 more)

### Community 94 - ".query"
Cohesion: 0.10
Nodes (16): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+8 more)

### Community 95 - "n"
Cohesion: 0.07
Nodes (35): _9(), aK(), am(), bg(), C9(), dj(), Dk(), e9() (+27 more)

### Community 96 - "vl"
Cohesion: 0.50
Nodes (5): fm(), sm(), tx(), uA(), Us()

### Community 97 - "hf"
Cohesion: 0.15
Nodes (13): ei(), Es, ix(), lx(), mi(), Ot(), Rn(), throwIfRequested() (+5 more)

### Community 98 - "Kn"
Cohesion: 0.12
Nodes (25): Al(), ao(), Bo(), Bt(), cs(), Ct(), Dt(), fs() (+17 more)

### Community 99 - "t"
Cohesion: 0.07
Nodes (35): _3(), A9(), aT(), cf(), DF(), E7(), Eu(), f7() (+27 more)

### Community 100 - "ma"
Cohesion: 0.25
Nodes (4): WriteLedger, ApiErrorShape, PurchaseRequisition, StockRecord

### Community 101 - "_"
Cohesion: 0.19
Nodes (6): SuppliersController, Controller, Get, UseGuards, SuppliersService, Injectable

### Community 102 - "i"
Cohesion: 0.09
Nodes (25): _0(), ag, bb(), bS(), bT(), c0(), cB(), dU() (+17 more)

### Community 103 - "jn"
Cohesion: 0.19
Nodes (14): jn(), Rh(), bf(), ch(), da(), Eh(), kf(), lh() (+6 more)

### Community 104 - "ht"
Cohesion: 0.08
Nodes (27): clamp(), dO(), Dv, Ev(), Fe(), fv, Gs(), h8() (+19 more)

### Community 105 - "_v"
Cohesion: 0.11
Nodes (13): aa(), g7(), gV(), qp(), TS, _v(), vK(), wK() (+5 more)

### Community 106 - "Ft"
Cohesion: 0.32
Nodes (8): A1(), ao(), ar(), cm(), E1(), Ed(), ex(), um()

### Community 107 - ".get"
Cohesion: 0.20
Nodes (9): Aw(), Cr(), Ko(), Ow(), qA(), ux(), _w(), Ya() (+1 more)

### Community 108 - "lx"
Cohesion: 0.15
Nodes (3): qk, Vf(), Xk()

### Community 109 - "Hs"
Cohesion: 0.20
Nodes (18): Bh(), dA(), en(), hd(), Hs(), hw(), In(), ku() (+10 more)

### Community 110 - "d"
Cohesion: 0.40
Nodes (5): bo(), il(), or(), qy(), xy()

### Community 111 - "bl"
Cohesion: 0.17
Nodes (13): Av(), az(), bz(), FS(), hV(), lO(), ma(), Pv() (+5 more)

### Community 112 - "_o"
Cohesion: 0.24
Nodes (12): dn(), EP(), GA(), Pi(), Qw(), rr(), sx(), wh() (+4 more)

### Community 113 - ".get"
Cohesion: 0.15
Nodes (15): E2(), ET(), Fg(), Kt(), Ng(), PK(), Q2(), rv() (+7 more)

### Community 114 - "ChatController"
Cohesion: 0.27
Nodes (14): acquire(), breaker, fetchLiveMaterial(), fetchLiveOData(), fetchLivePurchaseOrders(), fetchLiveStock(), logger, odataDate() (+6 more)

### Community 115 - "rgb"
Cohesion: 0.18
Nodes (11): AS(), displayable(), e3(), hz(), JR(), kg(), r3(), rgb() (+3 more)

### Community 116 - "b"
Cohesion: 0.67
Nodes (3): AppModule, Module, bootstrap()

### Community 117 - ".has"
Cohesion: 0.21
Nodes (12): Ae(), D(), em(), Fr(), hx(), iu(), jw(), pm() (+4 more)

### Community 118 - "zx"
Cohesion: 0.18
Nodes (5): fj(), hj(), Ri(), Uj(), zx

### Community 119 - "qk"
Cohesion: 0.22
Nodes (10): a3(), bF(), Ec, i3(), mp(), n3(), _o(), Xf() (+2 more)

### Community 120 - "Qu"
Cohesion: 0.22
Nodes (9): dw(), nz, oh(), Q_(), Qu(), Rc(), wu(), Y_() (+1 more)

### Community 121 - "b7"
Cohesion: 0.33
Nodes (6): A7(), b7(), O7(), S7(), w7(), x7()

### Community 122 - "tt"
Cohesion: 0.22
Nodes (9): C5(), e6(), j5(), k5(), Le(), T5(), tt(), z0() (+1 more)

### Community 123 - "Kf"
Cohesion: 0.29
Nodes (8): b3(), g3(), m3(), PS(), v3(), x3(), y3(), zi()

### Community 124 - "PS"
Cohesion: 0.33
Nodes (5): After this wave, FactoryPilot Roadmap — Phases U–W (Business Object coverage), Phase U — Business Object Registry + generic query path, Phase V — The five business objects + contextualization rules, Phase W — Live SAP via Business Accelerator Hub OData

### Community 126 - "cv"
Cohesion: 0.29
Nodes (7): a0(), cv(), Mo(), o0(), rz, VN(), WS()

### Community 128 - "mh"
Cohesion: 0.22
Nodes (10): A, CP(), gy(), jP(), Ju(), kP(), mh(), ou() (+2 more)

### Community 129 - "FactoryPilot Roadmap — Phases S–V (agentic depth wave)"
Cohesion: 0.29
Nodes (6): FactoryPilot Roadmap — Phases S–V (agentic depth wave), Phase S — Glass-Box Chat (trust through transparency) ✅ shipped in beta, Phase T — Warehouse Health Score + "Explain Why" (the ops heartbeat), Phase U — Supplier Intelligence (the procurement moat), Phase V — Slotting Optimizer Agent (the 7th specialist), Sequencing logic (one paragraph)

### Community 130 - "fB"
Cohesion: 0.29
Nodes (7): dB(), ey(), fB(), hB(), NB(), rb(), vB()

### Community 131 - "wp"
Cohesion: 0.40
Nodes (6): _5(), A5(), E5(), P5(), wp(), wp

### Community 132 - "sv"
Cohesion: 0.33
Nodes (6): Bx(), Lu(), on(), qS(), sj(), sv()

### Community 133 - "Je"
Cohesion: 0.19
Nodes (5): ConnectedSocket, UsageSnapshot, QuotaService, Cron, Injectable

### Community 134 - "Bi"
Cohesion: 0.18
Nodes (12): Dy(), ef(), iz(), lw(), Oa(), qB(), so(), TP() (+4 more)

### Community 135 - "yB"
Cohesion: 0.22
Nodes (9): CT(), lm(), po(), sw(), ve(), x2(), Zc(), Fa() (+1 more)

### Community 136 - "qi"
Cohesion: 0.25
Nodes (8): aP(), iP(), jF(), Kf(), oP(), PP(), S1(), sh()

### Community 137 - "Ds"
Cohesion: 0.08
Nodes (24): BusinessObjectSummary, ContextConfig, contextualize(), countBy(), Row, BusinessObjectsController, Body, Controller (+16 more)

### Community 138 - "v0"
Cohesion: 0.50
Nodes (4): a6(), o6(), u6(), v0()

### Community 139 - "Dd"
Cohesion: 0.50
Nodes (4): Ad(), Dd(), Nd(), id()

### Community 140 - "y8"
Cohesion: 0.40
Nodes (5): Bv, Lv, Nv, vu, y8()

### Community 141 - "UB"
Cohesion: 0.40
Nodes (5): d3(), ES(), k3(), mg(), p3()

### Community 142 - "Fz"
Cohesion: 0.50
Nodes (4): Dz(), Fz(), Lz(), Uz()

### Community 143 - "nF"
Cohesion: 0.50
Nodes (4): IF(), J8(), nF(), rF()

### Community 144 - "Li"
Cohesion: 0.50
Nodes (4): J_(), Li(), oj, pj()

### Community 145 - "y5"
Cohesion: 0.50
Nodes (4): m5(), r0(), v5(), y5()

### Community 146 - "mk"
Cohesion: 0.67
Nodes (3): bK(), gK(), mk()

### Community 147 - "pA"
Cohesion: 0.29
Nodes (8): B6(), j6(), k6(), L6(), M6(), R6(), rU(), Zn()

### Community 148 - "d6"
Cohesion: 0.67
Nodes (3): d6(), f6(), p6()

### Community 149 - "zu"
Cohesion: 0.39
Nodes (8): Hn(), Hr(), Io(), lr(), Me(), yO(), qu, St()

### Community 150 - "h7"
Cohesion: 0.67
Nodes (3): h7(), v7(), y7()

### Community 159 - "UB"
Cohesion: 0.50
Nodes (4): Dg(), Lg(), UB(), WB()

### Community 160 - "e9"
Cohesion: 0.40
Nodes (6): a8(), f8(), Hi, mF(), nO(), s8()

### Community 165 - "l3"
Cohesion: 0.33
Nodes (5): Deliberate deviations from the spec (kept, with rationale), Spec Gap Analysis — PO Technical Design vs FactoryPilot, Status after the Phase T spec-alignment wave, Still open (the "missing" item, next phase), Verdict

### Community 169 - "bcryptjs"
Cohesion: 0.29
Nodes (4): AuthMode, ODataQuery, ODataResult, SapIflowClient

### Community 171 - "G5"
Cohesion: 0.67
Nodes (3): G5(), q5(), X5()

### Community 172 - "Pv"
Cohesion: 0.67
Nodes (3): g9(), m9(), y9()

### Community 173 - "zu"
Cohesion: 0.25
Nodes (7): 1. Endpoint, 2. Request (what FactoryPilot sends), 3. iFlow steps (suggested), 4. Response (what FactoryPilot accepts), 5. Errors, 6. Going live — checklist, FactoryPilot ↔ SAP Integration Suite iFlow — Integration Contract

### Community 174 - "gV"
Cohesion: 0.33
Nodes (5): BAND_RING, BAND_TEXT, Factor, Health, WarehouseHealthCard()

### Community 175 - "i6"
Cohesion: 0.60
Nodes (5): api(), CASES, loadPromotedCases(), login(), main()

### Community 176 - "tU"
Cohesion: 0.40
Nodes (5): b8(), jv(), Mv(), Uv(), wv

### Community 178 - "cn"
Cohesion: 0.14
Nodes (14): cn(), bl(), cr, getUri(), Jn(), _l(), Ml(), ol() (+6 more)

### Community 179 - "Iw"
Cohesion: 0.23
Nodes (12): B1(), cA(), Iw(), mw(), nn(), ot(), rl(), Rw() (+4 more)

### Community 181 - "wn"
Cohesion: 0.40
Nodes (5): F4(), H4(), Mr, n4, u4

### Community 182 - "w9"
Cohesion: 0.50
Nodes (4): b9(), tB(), w9(), x9()

### Community 184 - "jd"
Cohesion: 0.40
Nodes (4): BusinessObject, BusinessObjectsCard(), EMPTY, ObjectEditor()

### Community 185 - "Je"
Cohesion: 0.50
Nodes (4): E(), EB(), IB(), sK()

### Community 186 - "KE"
Cohesion: 0.50
Nodes (4): i8(), Ir, u8(), z4()

### Community 188 - "Ri"
Cohesion: 1.00
Nodes (3): Eo(), gB(), mB()

### Community 197 - "mS"
Cohesion: 0.40
Nodes (5): AB(), Bi(), mS(), wL(), xL()

## Knowledge Gaps
- **525 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+520 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `b()` connect `Jc` to `LLM Provider Layer`, `t`, `Auth, API Keys & Session Layer`, `Autonomy Agents (goals, runs, critic, outcomes) 3`, `i`, `yB`, `_v`, `Auth, API Keys & Session Layer 2`, `_o`, `rgb`, `zg`, `Orchestrator / Package.Json 6`, `Orchestrator Common Services 2`, `r`, `realtime-SYmKJpIj.js`, `n`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `rankByOutcome()` connect `LLM Provider Layer` to `Jc`?**
  _High betweenness centrality (0.258) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Ds` to `Autonomy Agents (goals, runs, critic, outcomes)`, `Chat Agent Loop`, `Orchestrator Common Services`, `_`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Orchestrator / Src / Main.Ts`, `Orchestrator / Package.Json 7`, `Alerts & Scheduled Reports`, `.query`, `Orchestrator / Package.Json 10`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 120 inferred relationships involving `t()` (e.g. with `charts-C2dOeYOM.js` and `Ai()`) actually correct?**
  _`t()` has 120 INFERRED edges - model-reasoned connections that need verification._
- **Are the 144 inferred relationships involving `n()` (e.g. with `charts-C2dOeYOM.js` and `_9()`) actually correct?**
  _`n()` has 144 INFERRED edges - model-reasoned connections that need verification._
- **Are the 117 inferred relationships involving `r()` (e.g. with `charts-C2dOeYOM.js` and `Ad()`) actually correct?**
  _`r()` has 117 INFERRED edges - model-reasoned connections that need verification._
- **Are the 98 inferred relationships involving `i()` (e.g. with `charts-C2dOeYOM.js` and `_0()`) actually correct?**
  _`i()` has 98 INFERRED edges - model-reasoned connections that need verification._