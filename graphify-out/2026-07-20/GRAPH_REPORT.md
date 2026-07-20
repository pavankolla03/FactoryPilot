# Graph Report - FactoryPilot  (2026-07-20)

## Corpus Check
- 120 files · ~86,388 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2744 nodes · 6848 edges · 170 communities (129 shown, 41 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 1153 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `237573ee`
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
- W
- FactoryPilot Roadmap — Phases S–V (agentic depth wave)
- OpsController
- wp
- sv
- i6
- Bi
- yB
- y8
- Ds
- v0
- Dd
- w9
- UB
- Fz
- nF
- Li
- y5
- mk
- p3
- d6
- m9
- h7
- $7
- bj
- Bp
- C3
- kj
- cK
- d7
- de
- pB
- wn
- formatHsl
- JA
- kk
- jm
- l3
- L7
- OL
- u0
- bcryptjs

## God Nodes (most connected - your core abstractions)
1. `t()` - 185 edges
2. `n()` - 164 edges
3. `r()` - 149 edges
4. `i()` - 115 edges
5. `zg` - 106 edges
6. `u()` - 77 edges
7. `AuthUser` - 69 edges
8. `r()` - 62 edges
9. `AgentsService` - 59 edges
10. `CurrentUser` - 53 edges

## Surprising Connections (you probably didn't know these)
- `App()` --indirect_call--> `g()`  [INFERRED]
  frontend/src/App.tsx → approuter/resources/assets/charts-C2dOeYOM.js
- `rankByOutcome()` --indirect_call--> `b()`  [INFERRED]
  orchestrator/src/llm/openrouter-provider.ts → approuter/resources/assets/charts-C2dOeYOM.js
- `createApp()` --indirect_call--> `pr()`  [INFERRED]
  integration-mocks/iflow-simulator/src/app.ts → approuter/resources/assets/index-CL7n0V-y.js
- `App()` --indirect_call--> `u()`  [INFERRED]
  frontend/src/App.tsx → approuter/resources/assets/realtime-SYmKJpIj.js
- `iflowGet()` --indirect_call--> `key()`  [INFERRED]
  mcp-servers/mcp-inventory/src/iflow-client.ts → orchestrator/src/common/secret-box.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (170 total, 41 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.15
Nodes (3): AgentsService, Cron, Injectable

### Community 1 - "LLM Provider Layer"
Cohesion: 0.10
Nodes (23): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, CustomModelProvider, UserModelConfig, UserRoutedProvider, toOpenAIMessages() (+15 more)

### Community 2 - "Chat Agent Loop"
Cohesion: 0.07
Nodes (14): ConnectedSocket, ChatService, LOCAL_TOOLS, STOCK_MUTATING_TOOLS, Injectable, WRITE_TOOLS, UsageSnapshot, reportModelOutcome() (+6 more)

### Community 3 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 4 - "Auth, API Keys & Session Layer"
Cohesion: 0.10
Nodes (7): AuthService, loadXsuaaCredentials(), Injectable, key(), openSecret(), sealSecret(), hydrateModelOutcomes()

### Community 5 - "Orchestrator Common Services"
Cohesion: 0.06
Nodes (46): createUserSchema, quotaSchema, scopesSchema, updateUserSchema, goalPatchSchema, goalSchema, AgentGoal, RunStep (+38 more)

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
Cohesion: 0.08
Nodes (31): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+23 more)

### Community 11 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.02
Nodes (96): Yh(), z8(), _a, ac, ae, ah(), ap, bc (+88 more)

### Community 12 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 13 - "Orchestrator / Package.Json"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, @nestjs/common, @nestjs/config, @nestjs/schedule, @nestjs/websockets, dependencies, @anthropic-ai/sdk, @manufacturing-agent/shared (+13 more)

### Community 14 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 15 - "Frontend UI Components"
Cohesion: 0.16
Nodes (16): AppNotification, StoredSession, UserRole, ApiKey, ApiKeysCard(), AuthPage(), AutopilotBar(), CommandCenter() (+8 more)

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
Nodes (22): a4, aj, aU, bc, ej, [f4,d4], gc, H5 (+14 more)

### Community 26 - "Readme.Md"
Cohesion: 0.14
Nodes (15): CEO Demo Playbook (three end-to-end walkthroughs), Frontend PWA Shell (manifest, service worker, theme #0B1524), Docker Compose Stack (postgres, redis, iflow, 2 MCP, orchestrator, frontend, approuter), Agentic Chat (15 tools), Confirmed Writes Flow (pending action, GETDEL one-time consume), Cost Controls (free models, caching, dedupe, quotas), FactoryPilot, Write Governance (confirmation, policies, maker-checker, anomaly detection) (+7 more)

### Community 27 - "Frontend UI Components 3"
Cohesion: 0.11
Nodes (17): AgentStep, AssistantBody(), CHART_LOCATION_COLORS, ChatPage(), ChatTurn, compactArgs(), ConversationSummary, extractChartData() (+9 more)

### Community 28 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 29 - "Alerts & Scheduled Reports"
Cohesion: 0.11
Nodes (10): AlertsController, Body, Controller, Delete, Param, Post, UseGuards, AlertsService (+2 more)

### Community 30 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 31 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 32 - "Chat Agent Loop 2"
Cohesion: 0.05
Nodes (70): Ae(), Aw(), ax(), B1(), cA(), Cd(), Cr(), dm() (+62 more)

### Community 33 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 34 - "Frontend UI Components 4"
Cohesion: 0.32
Nodes (6): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), StatusChip()

### Community 35 - "Frontend UI Components 5"
Cohesion: 0.24
Nodes (8): Sidebar(), EmptyState(), initialsOf(), PageHeader(), SourceChip(), AdminUser, UserCard(), WarehousePolicy

### Community 36 - "Frontend App Shell"
Cohesion: 0.27
Nodes (7): NAV, Tab, dict, I18nContext, I18nProvider(), Lang, TranslationKey

### Community 37 - "Autonomy Agents (goals, runs, critic, outcomes) 3"
Cohesion: 0.36
Nodes (7): ForecastResult, holtForecast(), PARAM_GRID, reorderPoint(), round2(), runHolt(), toDailySeries()

### Community 38 - "Orchestrator Src Chat"
Cohesion: 0.25
Nodes (6): ConversationsController, Controller, Get, Param, Query, UseGuards

### Community 39 - "Frontend UI Components 6"
Cohesion: 0.29
Nodes (6): AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 40 - "Frontend UI Components 7"
Cohesion: 0.19
Nodes (12): App(), loadSession(), ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport (+4 more)

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
Cohesion: 0.60
Nodes (5): api(), CASES, loadPromotedCases(), login(), main()

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
Cohesion: 0.67
Nodes (3): AppModule, Module, bootstrap()

### Community 64 - "Orchestrator / Package.Json 11"
Cohesion: 0.05
Nodes (61): Ci(), Eu(), Gn(), Gt(), sA(), accessor(), An(), ar() (+53 more)

### Community 82 - "RA"
Cohesion: 0.06
Nodes (66): _1(), al(), am(), Ba(), bd(), bl(), bw(), Dh() (+58 more)

### Community 83 - "ha"
Cohesion: 0.04
Nodes (54): Ea(), f3(), fn(), Ih(), Ks(), aa(), ba(), bm() (+46 more)

### Community 84 - "zg"
Cohesion: 0.06
Nodes (63): _4(), a8(), b0(), b4(), C(), C4(), c8(), D4() (+55 more)

### Community 85 - ".push"
Cohesion: 0.06
Nodes (44): kn, og(), $u(), vr(), ad(), af(), cd, concat() (+36 more)

### Community 86 - "Jc"
Cohesion: 0.07
Nodes (37): An(), by(), C1(), cw(), cx(), ei(), G1(), Gf() (+29 more)

### Community 88 - "F"
Cohesion: 0.09
Nodes (5): nh(), ip(), B(), F, p()

### Community 89 - "fx"
Cohesion: 0.10
Nodes (36): Dv, Dx(), kd(), Kt(), Lx(), m8(), Wa(), zv (+28 more)

### Community 90 - "H"
Cohesion: 0.09
Nodes (6): Ae(), Be, H, me(), Re, ye()

### Community 91 - "ex"
Cohesion: 0.08
Nodes (35): A, A1(), ao(), ar(), cm(), CP(), Dy(), E1() (+27 more)

### Community 92 - "r"
Cohesion: 0.08
Nodes (30): _6(), Ai(), Cs(), DF(), dP(), ES(), ez(), fp() (+22 more)

### Community 93 - "realtime-SYmKJpIj.js"
Cohesion: 0.09
Nodes (16): de(), $e(), et, ge(), Je(), k(), le(), M() (+8 more)

### Community 94 - ".query"
Cohesion: 0.15
Nodes (10): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 95 - "n"
Cohesion: 0.08
Nodes (29): _9(), bg(), C9(), dj(), Dk(), e9(), gg(), HL() (+21 more)

### Community 96 - "vl"
Cohesion: 0.10
Nodes (24): Hn(), Hr(), Io(), Jt(), Ld(), lr(), Me(), yO() (+16 more)

### Community 97 - "hf"
Cohesion: 0.07
Nodes (27): eE(), Ti(), ai(), clear(), Cn(), Du(), ef(), _f() (+19 more)

### Community 98 - "Kn"
Cohesion: 0.11
Nodes (27): Al(), ao(), Bo(), Bt(), cs(), Ct(), Dt(), fs() (+19 more)

### Community 99 - "t"
Cohesion: 0.09
Nodes (26): _3(), A9(), aT(), cf(), E7(), f7(), Fl(), h3() (+18 more)

### Community 100 - "ma"
Cohesion: 0.09
Nodes (24): Av(), az(), b8(), bz(), dO(), FS(), fU(), hV() (+16 more)

### Community 102 - "i"
Cohesion: 0.11
Nodes (22): _0(), ag, bb(), bS(), bT(), c0(), cB(), dU() (+14 more)

### Community 103 - "jn"
Cohesion: 0.11
Nodes (23): jn(), Rh(), bf(), ch(), da(), Eh(), gt, jh() (+15 more)

### Community 104 - "ht"
Cohesion: 0.11
Nodes (21): clamp(), Ev(), Fe(), fv, Gs(), h8(), hu(), K8 (+13 more)

### Community 105 - "_v"
Cohesion: 0.11
Nodes (18): aa(), fH(), g7(), gV(), qp(), TS, _v(), vK() (+10 more)

### Community 106 - "Ft"
Cohesion: 0.12
Nodes (19): af(), bo(), Ch(), ew(), Ft(), il(), lh(), Nw() (+11 more)

### Community 107 - ".get"
Cohesion: 0.13
Nodes (18): vd(), ve(), Yf(), At(), $d(), Di(), Fa(), fc() (+10 more)

### Community 108 - "lx"
Cohesion: 0.12
Nodes (15): ei(), Es, ix(), lx(), mi(), Ot(), px(), Rn() (+7 more)

### Community 109 - "Hs"
Cohesion: 0.20
Nodes (18): Bh(), dA(), en(), hd(), Hs(), hw(), In(), ku() (+10 more)

### Community 110 - "d"
Cohesion: 0.18
Nodes (7): MC(), Un, fh(), Ie, d, Fe(), Ve()

### Community 111 - "bl"
Cohesion: 0.15
Nodes (13): cn(), bl(), cr, Jn(), _l(), Ml(), ol(), pr() (+5 more)

### Community 112 - "_o"
Cohesion: 0.21
Nodes (12): a3(), bF(), Ec, i3(), mp(), n3(), _o(), wf() (+4 more)

### Community 113 - ".get"
Cohesion: 0.23
Nodes (10): E2(), ET(), Ng(), PK(), Q2(), rv(), xj(), Xu() (+2 more)

### Community 114 - "ChatController"
Cohesion: 0.23
Nodes (6): ChatController, Body, Controller, Get, Post, UseGuards

### Community 115 - "rgb"
Cohesion: 0.18
Nodes (11): AS(), displayable(), e3(), hz(), JR(), kg(), r3(), rgb() (+3 more)

### Community 116 - "b"
Cohesion: 0.25
Nodes (11): b(), Bu(), C7(), Cg(), Cu(), D(), g(), j7() (+3 more)

### Community 117 - ".has"
Cohesion: 0.18
Nodes (10): CT(), Fg(), iz(), lm(), po(), qB(), sw(), Wg() (+2 more)

### Community 118 - "zx"
Cohesion: 0.18
Nodes (5): fj(), hj(), Ri(), Uj(), zx

### Community 120 - "Qu"
Cohesion: 0.22
Nodes (9): dw(), nz, oh(), Q_(), Qu(), Rc(), wu(), Y_() (+1 more)

### Community 121 - "b7"
Cohesion: 0.22
Nodes (9): A7(), b7(), Je(), O7(), q7(), S7(), w7(), x7() (+1 more)

### Community 122 - "tt"
Cohesion: 0.22
Nodes (9): C5(), e6(), j5(), k5(), Le(), T5(), tt(), z0() (+1 more)

### Community 123 - "Kf"
Cohesion: 0.25
Nodes (8): aP(), iP(), jF(), Kf(), oP(), PP(), S1(), sh()

### Community 124 - "PS"
Cohesion: 0.29
Nodes (8): b3(), g3(), m3(), PS(), v3(), x3(), y3(), zi()

### Community 125 - "rU"
Cohesion: 0.29
Nodes (8): B6(), j6(), k6(), L6(), M6(), R6(), rU(), Zn()

### Community 126 - "cv"
Cohesion: 0.29
Nodes (7): a0(), cv(), Mo(), o0(), rz, VN(), WS()

### Community 127 - "fB"
Cohesion: 0.29
Nodes (7): dB(), ey(), fB(), hB(), NB(), rb(), vB()

### Community 129 - "FactoryPilot Roadmap — Phases S–V (agentic depth wave)"
Cohesion: 0.29
Nodes (6): FactoryPilot Roadmap — Phases S–V (agentic depth wave), Phase S — Glass-Box Chat (trust through transparency) ✅ shipped in beta, Phase T — Warehouse Health Score + "Explain Why" (the ops heartbeat), Phase U — Supplier Intelligence (the procurement moat), Phase V — Slotting Optimizer Agent (the 7th specialist), Sequencing logic (one paragraph)

### Community 130 - "OpsController"
Cohesion: 0.29
Nodes (5): OpsController, Controller, Get, Query, UseGuards

### Community 131 - "wp"
Cohesion: 0.40
Nodes (6): _5(), A5(), E5(), P5(), wp(), wp

### Community 132 - "sv"
Cohesion: 0.33
Nodes (6): Bx(), Lu(), on(), qS(), sj(), sv()

### Community 133 - "i6"
Cohesion: 0.40
Nodes (6): G5(), i6(), n6(), q5(), X5(), un()

### Community 134 - "Bi"
Cohesion: 0.40
Nodes (5): AB(), Bi(), mS(), wL(), xL()

### Community 135 - "yB"
Cohesion: 0.40
Nodes (5): aK(), iK(), np(), xB(), yB()

### Community 136 - "y8"
Cohesion: 0.40
Nodes (5): Bv, Lv, Nv, vu, y8()

### Community 137 - "Ds"
Cohesion: 0.40
Nodes (5): Ds(), sP(), Su(), w1(), x1()

### Community 138 - "v0"
Cohesion: 0.50
Nodes (4): a6(), o6(), u6(), v0()

### Community 139 - "Dd"
Cohesion: 0.50
Nodes (4): Ad(), Dd(), Nd(), id()

### Community 140 - "w9"
Cohesion: 0.50
Nodes (4): b9(), tB(), w9(), x9()

### Community 141 - "UB"
Cohesion: 0.50
Nodes (4): Dg(), Lg(), UB(), WB()

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

### Community 147 - "p3"
Cohesion: 0.67
Nodes (3): d3(), mg(), p3()

### Community 148 - "d6"
Cohesion: 0.67
Nodes (3): d6(), f6(), p6()

### Community 149 - "m9"
Cohesion: 0.67
Nodes (3): g9(), m9(), y9()

### Community 150 - "h7"
Cohesion: 0.67
Nodes (3): h7(), v7(), y7()

## Knowledge Gaps
- **469 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+464 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `ha`, `.query`, `bl`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `pr()` connect `bl` to `iFlow Simulator (SAP Mock + Live Layer)`, `Auth, API Keys & Session Layer 2`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `b()` connect `b` to `Chat Agent Loop 2`, `vl`, `LLM Provider Layer`, `t`, `_`, `i`, `_v`, `Auth, API Keys & Session Layer 2`, `rgb`, `zg`, `.has`, `Jc`, `Orchestrator Common Services 2`, `r`, `n`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Are the 119 inferred relationships involving `t()` (e.g. with `charts-C2dOeYOM.js` and `Ai()`) actually correct?**
  _`t()` has 119 INFERRED edges - model-reasoned connections that need verification._
- **Are the 144 inferred relationships involving `n()` (e.g. with `charts-C2dOeYOM.js` and `_9()`) actually correct?**
  _`n()` has 144 INFERRED edges - model-reasoned connections that need verification._
- **Are the 117 inferred relationships involving `r()` (e.g. with `charts-C2dOeYOM.js` and `Ad()`) actually correct?**
  _`r()` has 117 INFERRED edges - model-reasoned connections that need verification._
- **Are the 98 inferred relationships involving `i()` (e.g. with `charts-C2dOeYOM.js` and `_0()`) actually correct?**
  _`i()` has 98 INFERRED edges - model-reasoned connections that need verification._