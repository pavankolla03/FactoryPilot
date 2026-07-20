# Graph Report - FactoryPilot  (2026-07-20)

## Corpus Check
- 122 files · ~89,586 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2764 nodes · 6888 edges · 184 communities (142 shown, 42 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 1153 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `35b6e2fa`
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
- qi
- xy
- Pv
- zu
- e9
- Ri
- gh
- fp
- vr
- am
- Cs
- KE
- sf
- @nestjs/schedule

## God Nodes (most connected - your core abstractions)
1. `t()` - 185 edges
2. `n()` - 164 edges
3. `r()` - 149 edges
4. `i()` - 115 edges
5. `zg` - 106 edges
6. `u()` - 77 edges
7. `AuthUser` - 70 edges
8. `r()` - 62 edges
9. `AgentsService` - 59 edges
10. `CurrentUser` - 54 edges

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

## Communities (184 total, 42 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.17
Nodes (3): AgentsService, Cron, Injectable

### Community 1 - "LLM Provider Layer"
Cohesion: 0.10
Nodes (23): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, CustomModelProvider, UserModelConfig, UserRoutedProvider, toOpenAIMessages() (+15 more)

### Community 2 - "Chat Agent Loop"
Cohesion: 0.11
Nodes (8): ChatService, LOCAL_TOOLS, STOCK_MUTATING_TOOLS, Injectable, reportModelOutcome(), RealtimeGateway, WebSocketGateway, WebSocketServer

### Community 3 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.07
Nodes (33): createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema, app (+25 more)

### Community 4 - "Auth, API Keys & Session Layer"
Cohesion: 0.11
Nodes (9): AuthService, loadXsuaaCredentials(), Injectable, xssec, key(), openSecret(), sealSecret(), WarehouseScope (+1 more)

### Community 5 - "Orchestrator Common Services"
Cohesion: 0.08
Nodes (27): AgentGoal, RunStep, Suggestion, StockAlertRow, loginSchema, mockSchema, signupSchema, StoredMessage (+19 more)

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
Cohesion: 0.10
Nodes (13): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+5 more)

### Community 11 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.02
Nodes (110): ve(), z8(), _a, ac, ae, ah(), ap, bc (+102 more)

### Community 12 - "Shared / Package.Json"
Cohesion: 0.09
Nodes (21): devDependencies, prettier, typescript, vitest, engines, node, prettier, typescript (+13 more)

### Community 13 - "Orchestrator / Package.Json"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, class-transformer, @nestjs/common, @nestjs/config, @nestjs/websockets, dependencies, @anthropic-ai/sdk, class-transformer (+13 more)

### Community 14 - "Approuter / Package.Json"
Cohesion: 0.10
Nodes (20): dependencies, @sap/approuter, devDependencies, prettier, vitest, engines, node, prettier (+12 more)

### Community 15 - "Frontend UI Components"
Cohesion: 0.14
Nodes (21): AppNotification, StoredSession, UserRole, ApiKey, ApiKeysCard(), AuthPage(), AutopilotBar(), CachePoliciesCard() (+13 more)

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
Cohesion: 0.10
Nodes (10): AlertsController, Controller, Delete, Get, Param, Post, UseGuards, AlertsService (+2 more)

### Community 30 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 31 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 32 - "Chat Agent Loop 2"
Cohesion: 0.06
Nodes (67): Ae(), Aw(), ax(), cA(), Cd(), Cr(), cx(), dm() (+59 more)

### Community 33 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 34 - "Frontend UI Components 4"
Cohesion: 0.28
Nodes (7): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), EmptyState(), StatusChip()

### Community 35 - "Frontend UI Components 5"
Cohesion: 0.19
Nodes (11): App(), loadSession(), MicButton(), Sidebar(), initialsOf(), AdminUser, QuotaLimits, UserCard() (+3 more)

### Community 36 - "Frontend App Shell"
Cohesion: 0.27
Nodes (7): NAV, Tab, dict, I18nContext, I18nProvider(), Lang, TranslationKey

### Community 37 - "Autonomy Agents (goals, runs, critic, outcomes) 3"
Cohesion: 0.36
Nodes (7): ForecastResult, holtForecast(), PARAM_GRID, reorderPoint(), round2(), runHolt(), toDailySeries()

### Community 38 - "Orchestrator Src Chat"
Cohesion: 0.10
Nodes (26): cachePolicySchema, createUserSchema, quotaSchema, scopesSchema, updateUserSchema, goalPatchSchema, goalSchema, createAlertSchema (+18 more)

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
Cohesion: 0.16
Nodes (8): AuthController, Body, Controller, Delete, Get, Param, Post, UseGuards

### Community 55 - "Orchestrator / Package.Json 5"
Cohesion: 0.21
Nodes (17): al(), bl(), bw(), gw(), he(), ki(), ky(), _l() (+9 more)

### Community 64 - "Orchestrator / Package.Json 11"
Cohesion: 0.05
Nodes (57): Eu(), Gt(), sA(), $u(), ad(), ar(), Au(), bl() (+49 more)

### Community 82 - "RA"
Cohesion: 0.22
Nodes (19): Ba(), Cu(), Fc(), ge(), gl(), _h(), Hh(), Ii() (+11 more)

### Community 83 - "ha"
Cohesion: 0.05
Nodes (38): Ea(), f3(), fn(), Ih(), Ks(), aa(), ba(), bm() (+30 more)

### Community 84 - "zg"
Cohesion: 0.06
Nodes (65): _4(), a8(), b0(), b4(), C(), C4(), c8(), D4() (+57 more)

### Community 85 - ".push"
Cohesion: 0.06
Nodes (54): kn, vd(), Yf(), af(), At(), cd, Cu(), $d() (+46 more)

### Community 86 - "Jc"
Cohesion: 0.07
Nodes (40): An(), by(), C1(), Dy(), ei(), G1(), Gf(), gp() (+32 more)

### Community 88 - "F"
Cohesion: 0.09
Nodes (4): nh(), ip(), B(), F

### Community 89 - "fx"
Cohesion: 0.08
Nodes (42): Dx(), kd(), Lx(), ax(), bx(), cc(), cx, dc() (+34 more)

### Community 90 - "H"
Cohesion: 0.12
Nodes (5): Ae(), H, me(), qe, ye()

### Community 91 - "ex"
Cohesion: 0.12
Nodes (21): A, b3(), CP(), ef(), Fr(), g3(), Ju(), jw() (+13 more)

### Community 92 - "r"
Cohesion: 0.09
Nodes (25): Ai(), B1(), DF(), dP(), ES(), ez(), gO(), gz() (+17 more)

### Community 93 - "realtime-SYmKJpIj.js"
Cohesion: 0.12
Nodes (15): de(), $e(), Ee(), et, ge(), k(), ke(), M() (+7 more)

### Community 94 - ".query"
Cohesion: 0.18
Nodes (10): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+2 more)

### Community 95 - "n"
Cohesion: 0.12
Nodes (19): bg(), dj(), Dk(), gg(), jd(), K$(), ml(), n() (+11 more)

### Community 96 - "vl"
Cohesion: 0.12
Nodes (17): Jt(), Ld(), Ze(), dd, Gr(), Hl(), ia(), vl() (+9 more)

### Community 97 - "hf"
Cohesion: 0.10
Nodes (24): eE(), Ti(), accessor(), ai(), An(), el(), fo, from() (+16 more)

### Community 98 - "Kn"
Cohesion: 0.11
Nodes (28): Al(), ao(), Bo(), Bt(), concat(), cs(), Ct(), Dt() (+20 more)

### Community 99 - "t"
Cohesion: 0.10
Nodes (24): _3(), _6(), A9(), aT(), cf(), cw(), E7(), f7() (+16 more)

### Community 100 - "ma"
Cohesion: 0.17
Nodes (12): az(), Ds(), fU(), jo(), ma(), sP(), Su(), Uu() (+4 more)

### Community 102 - "i"
Cohesion: 0.12
Nodes (18): _0(), ag, bb(), bS(), bT(), c0(), dU(), h0() (+10 more)

### Community 103 - "jn"
Cohesion: 0.08
Nodes (29): jn(), Rh(), bf(), ch(), da(), Eh(), gt, _h() (+21 more)

### Community 104 - "ht"
Cohesion: 0.06
Nodes (39): Av(), b8(), clamp(), dO(), Ev(), f0(), fv, Gs() (+31 more)

### Community 105 - "_v"
Cohesion: 0.13
Nodes (10): aa(), g7(), TS, _v(), vK(), wK(), xt(), gn (+2 more)

### Community 106 - "Ft"
Cohesion: 0.18
Nodes (12): af(), Ch(), Ft(), Gh(), lh(), Nw(), of(), Tc() (+4 more)

### Community 107 - ".get"
Cohesion: 0.18
Nodes (3): Be, Re, xe

### Community 108 - "lx"
Cohesion: 0.19
Nodes (5): ConnectedSocket, UsageSnapshot, QuotaService, Cron, Injectable

### Community 109 - "Hs"
Cohesion: 0.20
Nodes (18): Bh(), dA(), en(), hd(), Hs(), hw(), In(), ku() (+10 more)

### Community 110 - "d"
Cohesion: 0.12
Nodes (13): Dv, fH(), m8(), MC(), zv, Ie, nd(), wc() (+5 more)

### Community 111 - "bl"
Cohesion: 0.22
Nodes (10): Ci(), cn(), Gn(), Et(), Jn(), _l(), ol(), pr() (+2 more)

### Community 112 - "_o"
Cohesion: 0.21
Nodes (12): a3(), bF(), Ec, i3(), mp(), n3(), _o(), wf() (+4 more)

### Community 113 - ".get"
Cohesion: 0.08
Nodes (29): B6(), CT(), E2(), ET(), Fg(), iz(), j6(), k6() (+21 more)

### Community 114 - "ChatController"
Cohesion: 0.11
Nodes (17): CurrentUser, ChatController, Body, Controller, Get, Post, UseGuards, Get (+9 more)

### Community 115 - "rgb"
Cohesion: 0.18
Nodes (11): AS(), displayable(), e3(), hz(), JR(), kg(), r3(), rgb() (+3 more)

### Community 116 - "b"
Cohesion: 0.23
Nodes (12): b(), Bu(), C7(), Cg(), D(), g(), j7(), k7() (+4 more)

### Community 117 - ".has"
Cohesion: 0.20
Nodes (11): clear(), Cn(), ef(), _f(), get(), has(), hf(), Pi() (+3 more)

### Community 119 - "qk"
Cohesion: 0.15
Nodes (3): qk, Vf(), Xk()

### Community 120 - "Qu"
Cohesion: 0.25
Nodes (8): dw(), nz, oh(), Q_(), Qu(), Rc(), wu(), Y_()

### Community 121 - "b7"
Cohesion: 0.22
Nodes (9): A7(), b7(), Je(), O7(), q7(), S7(), w7(), x7() (+1 more)

### Community 122 - "tt"
Cohesion: 0.22
Nodes (9): C5(), e6(), j5(), k5(), Le(), T5(), tt(), z0() (+1 more)

### Community 123 - "Kf"
Cohesion: 0.15
Nodes (18): A1(), ao(), ar(), cm(), E1(), Ed(), ex(), hy() (+10 more)

### Community 124 - "PS"
Cohesion: 0.31
Nodes (9): bd(), im(), it(), kr(), rm(), Uw(), Uy(), wd() (+1 more)

### Community 125 - "rU"
Cohesion: 0.31
Nodes (9): Fe(), Hn(), Hr(), Io(), lr(), Me(), Pf, Qn() (+1 more)

### Community 126 - "cv"
Cohesion: 0.29
Nodes (7): a0(), cv(), Mo(), o0(), rz, VN(), WS()

### Community 127 - "fB"
Cohesion: 0.22
Nodes (9): dB(), Eg(), ey(), fB(), hB(), NB(), pB(), rb() (+1 more)

### Community 128 - "W"
Cohesion: 0.31
Nodes (5): _c, kc(), Je(), R(), S()

### Community 129 - "FactoryPilot Roadmap — Phases S–V (agentic depth wave)"
Cohesion: 0.29
Nodes (6): FactoryPilot Roadmap — Phases S–V (agentic depth wave), Phase S — Glass-Box Chat (trust through transparency) ✅ shipped in beta, Phase T — Warehouse Health Score + "Explain Why" (the ops heartbeat), Phase U — Supplier Intelligence (the procurement moat), Phase V — Slotting Optimizer Agent (the 7th specialist), Sequencing logic (one paragraph)

### Community 130 - "OpsController"
Cohesion: 0.22
Nodes (7): OpsController, Body, Controller, Get, Post, Query, UseGuards

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
Cohesion: 0.25
Nodes (8): _1(), Fy(), kh(), qf(), vw(), yW(), mo(), si

### Community 138 - "v0"
Cohesion: 0.50
Nodes (4): a6(), o6(), u6(), v0()

### Community 139 - "Dd"
Cohesion: 0.50
Nodes (4): Ad(), Dd(), Nd(), id()

### Community 140 - "w9"
Cohesion: 0.12
Nodes (15): aP(), b9(), gR(), gV(), nU(), oP(), PP(), qp() (+7 more)

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

### Community 159 - "pB"
Cohesion: 0.33
Nodes (6): Dh(), Gi(), jP(), kP(), mh(), tm()

### Community 165 - "l3"
Cohesion: 0.33
Nodes (5): Deliberate deviations from the spec (kept, with rationale), Spec Gap Analysis — PO Technical Design vs FactoryPilot, Status after the Phase T spec-alignment wave, Still open (the "missing" item, next phase), Verdict

### Community 170 - "qi"
Cohesion: 0.40
Nodes (5): _9(), C9(), j9(), qi(), T9()

### Community 171 - "xy"
Cohesion: 0.40
Nodes (5): bo(), il(), or(), qy(), xy()

### Community 172 - "Pv"
Cohesion: 0.40
Nodes (5): bz(), FS(), hV(), Pv(), vV()

### Community 173 - "zu"
Cohesion: 0.50
Nodes (4): cB(), lB(), sB(), zu()

### Community 174 - "e9"
Cohesion: 0.50
Nodes (4): e9(), kb(), qV(), yV()

### Community 175 - "Ri"
Cohesion: 0.50
Nodes (4): fj(), hj(), Ri(), Uj()

### Community 176 - "gh"
Cohesion: 0.50
Nodes (4): hm(), Xh(), Yh(), gh()

### Community 177 - "fp"
Cohesion: 0.67
Nodes (3): fp(), kz(), mz()

### Community 178 - "vr"
Cohesion: 0.67
Nodes (3): og(), vr(), Nu()

## Knowledge Gaps
- **478 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+473 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `b()` connect `b` to `Chat Agent Loop 2`, `vl`, `LLM Provider Layer`, `t`, `_`, `i`, `_v`, `Auth, API Keys & Session Layer 2`, `.get`, `rgb`, `zg`, `Jc`, `Orchestrator Common Services 2`, `r`, `n`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `rankByOutcome()` connect `LLM Provider Layer` to `b`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `createApp()` connect `iFlow Simulator (SAP Mock + Live Layer)` to `ha`, `.query`, `bl`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Are the 119 inferred relationships involving `t()` (e.g. with `charts-C2dOeYOM.js` and `Ai()`) actually correct?**
  _`t()` has 119 INFERRED edges - model-reasoned connections that need verification._
- **Are the 144 inferred relationships involving `n()` (e.g. with `charts-C2dOeYOM.js` and `_9()`) actually correct?**
  _`n()` has 144 INFERRED edges - model-reasoned connections that need verification._
- **Are the 117 inferred relationships involving `r()` (e.g. with `charts-C2dOeYOM.js` and `Ad()`) actually correct?**
  _`r()` has 117 INFERRED edges - model-reasoned connections that need verification._
- **Are the 98 inferred relationships involving `i()` (e.g. with `charts-C2dOeYOM.js` and `_0()`) actually correct?**
  _`i()` has 98 INFERRED edges - model-reasoned connections that need verification._