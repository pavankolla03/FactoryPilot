# Graph Report - FactoryPilot  (2026-07-22)

## Corpus Check
- 147 files · ~106,908 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2989 nodes · 7423 edges · 190 communities (149 shown, 41 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 1157 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59349a04`
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
- formatHsl
- JA
- kk
- jm
- l3
- L7
- OL
- u0
- bcryptjs
- G5
- Pv
- zu
- gV
- i6
- Iw
- wn
- w9
- @nestjs/schedule
- jsonwebtoken
- l3
- class-validator
- PS
- sv
- FactoryPilot Roadmap — Phases AA–AC (planning-intelligence wave)
- qi
- mS
- pA
- Ri
- AppModule
- bcryptjs

## God Nodes (most connected - your core abstractions)
1. `t()` - 186 edges
2. `n()` - 164 edges
3. `r()` - 149 edges
4. `i()` - 115 edges
5. `AuthUser` - 110 edges
6. `zg` - 106 edges
7. `u()` - 77 edges
8. `CurrentUser` - 71 edges
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
- `createApp()` --indirect_call--> `pr()`  [INFERRED]
  integration-mocks/iflow-simulator/src/app.ts → approuter/resources/assets/index-CL7n0V-y.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trust and Governance Layer** — readme_governance, readme_confirmed_writes, readme_warehouse_scopes, readme_grounding_flag [INFERRED 0.85]
- **Deployment Topology (local compose vs Cloud Foundry)** — infra_docker_compose_stack, infra_manifest_cf_deployment [INFERRED 0.85]
- **FactoryPilot Brand Mark Composition** — frontend_public_favicon_factory_silhouette, frontend_public_favicon_forward_arrow, frontend_public_favicon_blue_gradient [EXTRACTED 1.00]

## Communities (190 total, 41 thin omitted)

### Community 0 - "Autonomy Agents (goals, runs, critic, outcomes)"
Cohesion: 0.15
Nodes (4): AgentsService, Cron, Injectable, key()

### Community 1 - "LLM Provider Layer"
Cohesion: 0.10
Nodes (24): AnthropicProvider, normalizeAnthropicSchema(), toAnthropicMessages(), AzureOpenAIProvider, CustomModelProvider, UserModelConfig, UserRoutedProvider, toOpenAIMessages() (+16 more)

### Community 2 - "Chat Agent Loop"
Cohesion: 0.08
Nodes (12): ChatService, LOCAL_TOOLS, STOCK_MUTATING_TOOLS, Injectable, hydrateModelOutcomes(), OpsController, Body, Controller (+4 more)

### Community 3 - "iFlow Simulator (SAP Mock + Live Layer)"
Cohesion: 0.05
Nodes (51): ok(), createApp(), dataSource(), errorResponse(), logger, moveBodySchema, movementQuerySchema, stockQuerySchema (+43 more)

### Community 4 - "Auth, API Keys & Session Layer"
Cohesion: 0.08
Nodes (35): eE(), Ti(), accessor(), ai(), An(), concat(), constructor(), el() (+27 more)

### Community 5 - "Orchestrator Common Services"
Cohesion: 0.10
Nodes (27): cachePolicySchema, createUserSchema, quotaSchema, scopesSchema, updateUserSchema, goalPatchSchema, goalSchema, createAlertSchema (+19 more)

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
Cohesion: 0.13
Nodes (11): Headers, AgentsController, Body, Controller, Get, Param, Patch, Post (+3 more)

### Community 11 - "Auth, API Keys & Session Layer 2"
Cohesion: 0.02
Nodes (107): z8(), _a, ac, ae, ah(), Al(), ap, bc (+99 more)

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
Cohesion: 0.09
Nodes (20): ApiKey, ApiKeysCard(), AutopilotBar(), BusinessObject, BusinessObjectsCard(), EMPTY, ObjectEditor(), CachePoliciesCard() (+12 more)

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
Cohesion: 0.12
Nodes (17): App(), AppNotification, loadSession(), StoredSession, UserRole, AGENT_LABEL, AgentGoal, AgentMetrics (+9 more)

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
Nodes (18): AgentStep, AssistantBody(), CHART_LOCATION_COLORS, ChatPage(), ChatTurn, compactArgs(), ConversationSummary, extractChartData() (+10 more)

### Community 28 - "MCP Inventory Server 3"
Cohesion: 0.27
Nodes (11): getAccessToken(), iflowGet(), logger, TokenState, app, buildServer(), handleGetMaterialDetails(), handleGetStockLevel() (+3 more)

### Community 29 - "Alerts & Scheduled Reports"
Cohesion: 0.11
Nodes (10): AlertsController, Controller, Delete, Get, Param, Post, UseGuards, AlertsService (+2 more)

### Community 30 - "Tsconfig.Base.Json"
Cohesion: 0.15
Nodes (12): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, resolveJsonModule (+4 more)

### Community 31 - "Frontend / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, baseUrl, jsx, module, moduleResolution, target, extends, include (+3 more)

### Community 32 - "Chat Agent Loop 2"
Cohesion: 0.25
Nodes (14): ax(), Cd(), dm(), Eh(), HA(), ix(), KA(), kl() (+6 more)

### Community 33 - "Orchestrator / Tsconfig.Json"
Cohesion: 0.17
Nodes (11): compilerOptions, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir, extends (+3 more)

### Community 34 - "Frontend UI Components 4"
Cohesion: 0.16
Nodes (12): ActivityPage(), AuditDetail(), DetailMessage, formatToolResult(), toolList(), AuthPage(), Landing(), SERVICES (+4 more)

### Community 35 - "Frontend UI Components 5"
Cohesion: 0.15
Nodes (16): MicButton(), NAV, Sidebar(), Tab, initialsOf(), AdminUser, QuotaLimits, UserCard() (+8 more)

### Community 36 - "Frontend App Shell"
Cohesion: 0.12
Nodes (17): clear(), Cn(), Du(), ef(), _f(), get(), has(), hu (+9 more)

### Community 38 - "Orchestrator Src Chat"
Cohesion: 0.19
Nodes (7): HealthController, Controller, Get, Param, UseGuards, HealthService, Injectable

### Community 39 - "Frontend UI Components 6"
Cohesion: 0.25
Nodes (7): AnalyticsOverview, AnalyticsPage(), TokenRow, Tone, TONE_BAR, TONE_TEXT, toneFor()

### Community 40 - "Frontend UI Components 7"
Cohesion: 0.26
Nodes (7): LogsController, toCsv(), Controller, Get, Query, Res, UseGuards

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
Cohesion: 0.09
Nodes (7): Ae(), Be, H, me(), qe, Re, ye()

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
Cohesion: 0.06
Nodes (60): _1(), A1(), am(), ao(), ar(), Ba(), bd(), bl() (+52 more)

### Community 56 - "Orchestrator / Package.Json 6"
Cohesion: 0.07
Nodes (60): _4(), a8(), b0(), b4(), C(), C4(), c8(), D4() (+52 more)

### Community 60 - "Orchestrator / Package.Json 7"
Cohesion: 0.10
Nodes (18): ForecastResult, holtForecast(), PARAM_GRID, reorderPoint(), round2(), runHolt(), toDailySeries(), ScenarioController (+10 more)

### Community 63 - "Orchestrator / Package.Json 10"
Cohesion: 0.07
Nodes (40): AgentGoal, RunStep, Suggestion, StockAlertRow, AuthModule, Module, StoredMessage, user (+32 more)

### Community 64 - "Orchestrator / Package.Json 11"
Cohesion: 0.07
Nodes (36): Eu(), Gt(), sA(), ar(), Au(), Bn(), co(), Dl() (+28 more)

### Community 82 - "RA"
Cohesion: 0.21
Nodes (11): An(), by(), I1(), id(), M1(), N1(), ph(), V1() (+3 more)

### Community 83 - "ha"
Cohesion: 0.05
Nodes (37): fn(), Ih(), Ks(), Un, Yh(), aa(), ba(), bm() (+29 more)

### Community 84 - "zg"
Cohesion: 0.23
Nodes (12): b(), Bu(), C7(), Cg(), Cu(), g(), j7(), k7() (+4 more)

### Community 85 - ".push"
Cohesion: 0.04
Nodes (71): Ea(), f3(), kn, og(), $u(), vd(), ve(), vr() (+63 more)

### Community 86 - "Jc"
Cohesion: 0.21
Nodes (16): ei(), G1(), Gf(), ho(), iA(), Iy(), Jc(), Ly() (+8 more)

### Community 88 - "F"
Cohesion: 0.09
Nodes (4): nh(), ip(), B(), F

### Community 89 - "fx"
Cohesion: 0.07
Nodes (50): Ci(), cn(), Dx(), Gn(), kd(), Lx(), ax(), bx() (+42 more)

### Community 90 - "H"
Cohesion: 0.14
Nodes (8): ConnectedSocket, ChatController, Body, Controller, Get, Post, UseGuards, UsageSnapshot

### Community 91 - "ex"
Cohesion: 0.18
Nodes (11): C1(), Dy(), gy(), j1(), k1(), lw(), Oa(), ou() (+3 more)

### Community 92 - "r"
Cohesion: 0.10
Nodes (22): _6(), Cs(), DF(), dP(), ES(), gz(), iV(), k3() (+14 more)

### Community 93 - "realtime-SYmKJpIj.js"
Cohesion: 0.07
Nodes (29): Jt(), Ze(), dd, Gr(), vl(), Wr(), Yr(), de() (+21 more)

### Community 94 - ".query"
Cohesion: 0.12
Nodes (11): AdminController, Body, Controller, Delete, Get, Param, Patch, Post (+3 more)

### Community 95 - "n"
Cohesion: 0.07
Nodes (32): Ai(), al(), bg(), dj(), Dk(), e9(), gg(), HL() (+24 more)

### Community 96 - "vl"
Cohesion: 0.10
Nodes (22): af(), bo(), displayable(), Ft(), fU(), hz(), il(), jo() (+14 more)

### Community 97 - "hf"
Cohesion: 0.22
Nodes (9): ei(), Es, ix(), lx(), Rn(), throwIfRequested(), vs(), Yt() (+1 more)

### Community 98 - "Kn"
Cohesion: 0.13
Nodes (23): ao(), Bo(), Bt(), cs(), Ct(), Dt(), fs(), ho() (+15 more)

### Community 99 - "t"
Cohesion: 0.10
Nodes (23): _3(), A9(), aT(), cw(), cx(), E7(), f7(), Fl() (+15 more)

### Community 100 - "ma"
Cohesion: 0.50
Nodes (8): bw(), ki(), _l(), md(), nm(), vt(), yd(), zt()

### Community 101 - "_"
Cohesion: 0.19
Nodes (6): SuppliersController, Controller, Get, UseGuards, SuppliersService, Injectable

### Community 102 - "i"
Cohesion: 0.09
Nodes (29): _0(), ag, bb(), bS(), bT(), c0(), cB(), dB() (+21 more)

### Community 103 - "jn"
Cohesion: 0.10
Nodes (25): jn(), Rh(), bf(), ch(), da(), Eh(), gt, jh() (+17 more)

### Community 104 - "ht"
Cohesion: 0.08
Nodes (31): b8(), clamp(), Ev(), f0(), Fe(), fv, h8(), hu() (+23 more)

### Community 105 - "_v"
Cohesion: 0.32
Nodes (7): ApprovalCard(), ApprovalsPage(), DOW, prettyKey(), prettyTool(), ScheduledReport, StockAlert

### Community 106 - "Ft"
Cohesion: 0.33
Nodes (7): fx(), iu(), ot(), qA(), ux(), xa(), Ya()

### Community 107 - ".get"
Cohesion: 0.22
Nodes (8): Aw(), Cr(), FF(), Ko(), Ow(), _w(), wn(), $t

### Community 109 - "Hs"
Cohesion: 0.18
Nodes (20): Bh(), cf(), dA(), en(), hd(), Hs(), hw(), In() (+12 more)

### Community 110 - "d"
Cohesion: 0.33
Nodes (6): ef(), Fr(), jw(), qo(), vi(), Ge

### Community 111 - "bl"
Cohesion: 0.13
Nodes (16): Av(), az(), bz(), dO(), FS(), hV(), kv(), l0() (+8 more)

### Community 112 - "_o"
Cohesion: 0.27
Nodes (11): dn(), EP(), GA(), Pi(), Qw(), rr(), sx(), wh() (+3 more)

### Community 113 - ".get"
Cohesion: 0.09
Nodes (26): B6(), CT(), E2(), ET(), Fg(), j6(), k6(), Kt() (+18 more)

### Community 115 - "rgb"
Cohesion: 0.29
Nodes (7): AS(), e3(), JR(), r3(), t3(), vg(), zR()

### Community 116 - "b"
Cohesion: 0.29
Nodes (8): aK(), Eo(), gB(), iK(), mB(), np(), xB(), yB()

### Community 117 - ".has"
Cohesion: 0.11
Nodes (13): aa(), g7(), gV(), qp(), TS, _v(), vK(), wK() (+5 more)

### Community 119 - "qk"
Cohesion: 0.21
Nodes (12): a3(), bF(), Ec, i3(), mp(), n3(), _o(), wf() (+4 more)

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
Cohesion: 0.19
Nodes (14): Ae(), D(), em(), Fc(), fm(), hx(), Ni(), pm() (+6 more)

### Community 124 - "PS"
Cohesion: 0.33
Nodes (5): After this wave, FactoryPilot Roadmap — Phases U–W (Business Object coverage), Phase U — Business Object Registry + generic query path, Phase V — The five business objects + contextualization rules, Phase W — Live SAP via Business Accelerator Hub OData

### Community 125 - "rU"
Cohesion: 0.27
Nodes (10): B1(), cA(), Iw(), mw(), nn(), rl(), Rw(), TA() (+2 more)

### Community 126 - "cv"
Cohesion: 0.29
Nodes (7): a0(), cv(), Mo(), o0(), rz, VN(), WS()

### Community 128 - "mh"
Cohesion: 0.18
Nodes (11): aP(), Ch(), Gh(), iP(), jF(), Kf(), oP(), PP() (+3 more)

### Community 129 - "FactoryPilot Roadmap — Phases S–V (agentic depth wave)"
Cohesion: 0.29
Nodes (6): FactoryPilot Roadmap — Phases S–V (agentic depth wave), Phase S — Glass-Box Chat (trust through transparency) ✅ shipped in beta, Phase T — Warehouse Health Score + "Explain Why" (the ops heartbeat), Phase U — Supplier Intelligence (the procurement moat), Phase V — Slotting Optimizer Agent (the 7th specialist), Sequencing logic (one paragraph)

### Community 130 - "fB"
Cohesion: 0.33
Nodes (5): RadarData, Risk, SEV_CHIP, SEV_TEXT, StockoutRadarCard()

### Community 131 - "wp"
Cohesion: 0.40
Nodes (6): _5(), A5(), E5(), P5(), wp(), wp

### Community 132 - "sv"
Cohesion: 0.11
Nodes (16): Dv, fH(), m8(), MC(), zv, _c, dc(), Ie (+8 more)

### Community 133 - "Je"
Cohesion: 0.50
Nodes (3): StockoutController, Controller, UseGuards

### Community 134 - "Bi"
Cohesion: 0.24
Nodes (11): A, CP(), jP(), Ju(), kP(), mh(), so(), Sy() (+3 more)

### Community 135 - "yB"
Cohesion: 0.14
Nodes (13): ez(), fp(), gR(), iz(), kz(), Ls(), mz(), nU() (+5 more)

### Community 137 - "Ds"
Cohesion: 0.08
Nodes (22): Body, BusinessObjectSummary, ContextConfig, contextualize(), countBy(), Row, BusinessObjectsController, Body (+14 more)

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
Cohesion: 0.67
Nodes (3): d3(), mg(), p3()

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

### Community 165 - "l3"
Cohesion: 0.33
Nodes (5): Deliberate deviations from the spec (kept, with rationale), Spec Gap Analysis — PO Technical Design vs FactoryPilot, Status after the Phase T spec-alignment wave, Still open (the "missing" item, next phase), Verdict

### Community 169 - "bcryptjs"
Cohesion: 0.29
Nodes (4): AuthMode, ODataQuery, ODataResult, SapIflowClient

### Community 171 - "G5"
Cohesion: 0.40
Nodes (6): G5(), i6(), n6(), q5(), X5(), un()

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

### Community 179 - "Iw"
Cohesion: 0.25
Nodes (6): ConversationsController, Controller, Get, Param, Query, UseGuards

### Community 181 - "wn"
Cohesion: 0.29
Nodes (4): Material, Result, ScenarioStudioCard(), WAREHOUSES

### Community 182 - "w9"
Cohesion: 0.50
Nodes (4): b9(), tB(), w9(), x9()

### Community 189 - "l3"
Cohesion: 0.14
Nodes (11): SlottingController, Controller, Get, Param, UseGuards, PRIME, Rec, RESERVE (+3 more)

### Community 192 - "PS"
Cohesion: 0.29
Nodes (8): b3(), g3(), m3(), PS(), v3(), x3(), y3(), zi()

### Community 193 - "sv"
Cohesion: 0.33
Nodes (6): Bx(), Lu(), on(), qS(), sj(), sv()

### Community 195 - "FactoryPilot Roadmap — Phases AA–AC (planning-intelligence wave)"
Cohesion: 0.33
Nodes (5): FactoryPilot Roadmap — Phases AA–AC (planning-intelligence wave), Phase AA — What-if Scenario Studio (the CEO-meeting feature) ← building now, Phase AB — Predictive Stockout Radar (proactive alerting), Phase AC — ESG / Sustainability report, Sequencing

### Community 196 - "qi"
Cohesion: 0.40
Nodes (5): _9(), C9(), j9(), qi(), T9()

### Community 197 - "mS"
Cohesion: 0.25
Nodes (8): AB(), Bi(), Gs(), mS(), wL(), xL(), gp(), rd()

### Community 199 - "pA"
Cohesion: 0.18
Nodes (11): Ds(), ew(), Fa(), fw(), gd(), pA(), pl(), tw() (+3 more)

### Community 201 - "Ri"
Cohesion: 0.50
Nodes (4): fj(), hj(), Ri(), Uj()

### Community 205 - "AppModule"
Cohesion: 0.67
Nodes (3): AppModule, Module, bootstrap()

## Knowledge Gaps
- **543 isolated node(s):** `name`, `version`, `private`, `node`, `dev` (+538 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `b()` connect `zg` to `vl`, `LLM Provider Layer`, `t`, `Autonomy Agents (goals, runs, critic, outcomes) 3`, `i`, `Auth, API Keys & Session Layer 2`, `_o`, `.get`, `.has`, `Jc`, `Orchestrator / Package.Json 6`, `Orchestrator Common Services 2`, `r`, `realtime-SYmKJpIj.js`, `n`?**
  _High betweenness centrality (0.265) - this node is a cross-community bridge._
- **Why does `rankByOutcome()` connect `LLM Provider Layer` to `zg`?**
  _High betweenness centrality (0.261) - this node is a cross-community bridge._
- **Why does `AuthUser` connect `Ds` to `Chat Agent Loop`, `Orchestrator Common Services`, `Orchestrator Src Chat`, `_`, `Frontend UI Components 7`, `Autonomy Agents (goals, runs, critic, outcomes) 2`, `Iw`, `Orchestrator / Src / Main.Ts`, `l3`, `H`, `Orchestrator / Package.Json 7`, `Alerts & Scheduled Reports`, `.query`, `Orchestrator / Package.Json 10`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 120 inferred relationships involving `t()` (e.g. with `charts-C2dOeYOM.js` and `Ai()`) actually correct?**
  _`t()` has 120 INFERRED edges - model-reasoned connections that need verification._
- **Are the 144 inferred relationships involving `n()` (e.g. with `charts-C2dOeYOM.js` and `_9()`) actually correct?**
  _`n()` has 144 INFERRED edges - model-reasoned connections that need verification._
- **Are the 117 inferred relationships involving `r()` (e.g. with `charts-C2dOeYOM.js` and `Ad()`) actually correct?**
  _`r()` has 117 INFERRED edges - model-reasoned connections that need verification._
- **Are the 98 inferred relationships involving `i()` (e.g. with `charts-C2dOeYOM.js` and `_0()`) actually correct?**
  _`i()` has 98 INFERRED edges - model-reasoned connections that need verification._