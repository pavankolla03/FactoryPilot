# Deploying FactoryPilot to AWS

## First: the architecture you were given does not fit this app

The generic advice (Lambda + API Gateway) is right for a stateless REST API. It
is wrong for FactoryPilot, and adopting it would cost weeks. Three blockers:

| FactoryPilot needs | Lambda / API Gateway |
|---|---|
| Persistent Socket.IO connection (Otto streams answers token by token over `/ws`) | API Gateway's WebSocket API is a different model — connect/disconnect/message routes. Socket.IO's server protocol does not run on it. |
| 8 in-process `@Cron` jobs (autopilot, alert checks, quota resets) | No in-process scheduler. Each becomes a separate EventBridge rule + Lambda. |
| 4 long-running Node services (orchestrator + 2 MCP servers + iFlow simulator) | 4 separate functions, cold starts on a NestJS DI container each time. |

**Containers are the right call** — which is Option B in the advice you were
given. The only question is how much AWS machinery to wrap around them.

## Recommended: one EC2 instance, Docker Compose, Caddy

Measured footprint after the frontend fix below: **~370 MB at rest**. That fits a
`t3.micro` with room to spare.

```
Route 53  ──►  Elastic IP  ──►  EC2 (Docker Compose)
                                 ├── Caddy         :80/:443  automatic HTTPS
                                 ├── frontend      nginx, static bundle
                                 ├── orchestrator  NestJS + Socket.IO
                                 ├── mcp-inventory / mcp-warehouse-ops
                                 ├── postgres      (internal network only)
                                 └── redis         (internal network only)
```

Caddy terminates TLS and proxies `/api` and `/ws` to the orchestrator, so the
browser talks to a single origin and CORS never arises. Postgres and Redis are
not published to the host at all.

### Why not the full managed stack yet

| | Single EC2 | Fargate + RDS + ElastiCache + ALB |
|---|---|---|
| Approx. monthly | **~$0.50 (yr 1) / ~$15 after** | **~$90–130** |
| Managed backups / failover | no | yes |
| Scales past one box | no | yes |
| Time to first deploy | ~20 min | ~1–2 days |

At demo and pilot scale the managed stack buys resilience you are not yet using.
The migration path is in "When to upgrade" below — and because everything is
already containerised, it is a task-definition exercise, not a rewrite.

### Cost breakdown (approximate, ap-south-1)

| Item | Year 1 (Free Tier) | After |
|---|---|---|
| `t3.micro` 750 h/mo | $0 | ~$8.30 |
| EBS gp3 30 GB | $0 | ~$2.75 |
| Public IPv4 address | $0 (750 h) | ~$3.65 |
| Route 53 hosted zone | $0.50 | $0.50 |
| Data transfer out (first 100 GB) | $0 | $0 |
| **Total** | **~$0.50/mo** | **~$15/mo** |

Two notes. AWS has charged for **all** public IPv4 addresses since Feb 2024,
including attached ones — that surprises people. And a NAT Gateway would add
~$32/mo on its own, which is why this template puts the instance in a public
subnet and uses security groups rather than private subnets.

Prices move; check the AWS Pricing Calculator for your region before committing.

## Changes made to the codebase

Two, both committed:

**1. Production frontend image** — `frontend/Dockerfile.prod` + `frontend/nginx.conf`

The existing `frontend/Dockerfile` builds the bundle and then runs
`npm run dev` — the Vite dev server, which re-transforms source per request and
holds a file watcher. Measured:

| | Dev server | nginx static |
|---|---|---|
| Image | 424 MB | **77 MB** |
| Resident memory | 173 MB | **8.4 MB** |

Vite inlines `VITE_*` at build time, so those are build ARGs in the new image,
not runtime env. Left empty, the app talks to its own origin — which is what we
want behind Caddy.

**2. `infra/docker-compose.prod.yml`** now builds `Dockerfile.prod` and the
frontend memory ceiling drops 224 MB → 64 MB.

Nothing else changed. The app is already portable: `AUTH_MODE` supports
local/XSUAA, the LLM layer is provider-agnostic, and SAP connections are runtime
config rather than build config.

## Deploy

### 1. Create an EC2 key pair

EC2 → Key Pairs → Create. Download the `.pem`. You cannot download it twice.

### 2. Launch the stack

CloudFormation → Create stack → Upload `deploy/aws/factorypilot.yaml`.

| Parameter | Value |
|---|---|
| `DomainName` | `app.intelliops4.ai` |
| `LlmProvider` | `openrouter` (or `openai`) |
| `LlmApiKey` | your key |
| `InstanceType` | `t3.micro` (Free Tier) |
| `SshKeyName` | the key pair from step 1 |
| `SshAllowedCidr` | **your IP + `/32`**, not `0.0.0.0/0` |
| `HostedZoneId` | fill in after step 3, or leave blank |

Create. ~3 minutes to provision, then ~15 minutes for the first image build on a
`t3.micro`. Copy `PublicIp` from the Outputs tab.

The three application secrets (`AUTH_JWT_SECRET`, `POSTGRES_PASSWORD`,
`MCP_SHARED_SECRET`) are generated **on the instance** — they never pass through
the template, the console, or CloudFormation events.

### 3. Point the domain at it (GoDaddy → Route 53)

You have two options. The second is simpler and free.

**Option A — delegate the whole domain to Route 53** (needed for ACM certs,
alias records, and health checks later):

1. Route 53 → Hosted zones → Create hosted zone → `intelliops4.ai`
2. Copy the four `NS` values
3. GoDaddy → Domain → Nameservers → **Change** → Custom → paste all four
4. Propagation takes 1–48 h. Re-run CloudFormation with `HostedZoneId` set, or
   add the A record by hand.

**Option B — keep GoDaddy DNS** (no Route 53, saves $0.50/mo and the wait):

GoDaddy → DNS → Add record:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `app` | *(the Elastic IP)* | 600 |

That gives `app.intelliops4.ai`. Nothing else is needed.

You asked for Route 53 specifically — worth knowing it buys you nothing yet if
you only need one A record. It starts earning its place when you add CloudFront,
an ALB, or failover routing.

### 4. Wait for the certificate

Caddy requests a Let's Encrypt certificate on first request **after DNS
resolves**. Confirm resolution first:

```bash
dig +short app.intelliops4.ai     # must return your Elastic IP
```

Then watch it:

```bash
ssh -i your-key.pem ubuntu@<ELASTIC_IP>
sudo tail -f /var/log/factorypilot-bootstrap.log     # build progress
cd /opt/factorypilot/infra && docker compose -f docker-compose.prod.yml logs -f caddy
```

Open **https://app.intelliops4.ai**.

## Before a client sees it

- [ ] **Rotate the OpenAI and BTP keys** — both were pasted into a chat transcript
- [ ] **Change the demo login** — `owner@factorypilot.demo` / `demo-Pass-123` is in
      the repo and this host is now public
- [ ] Confirm `DEMO_PLANTS=never` in `/opt/factorypilot/infra/.env`
- [ ] Re-add SAP connections through the UI — credentials are sealed per install
- [ ] Restrict `SshAllowedCidr` to your own IP

## Operating it

```bash
# Deploy an update
cd /opt/factorypilot && git pull && cd infra
docker compose -f docker-compose.prod.yml up -d --build

# Apply a schema change (idempotent)
docker exec -i manufacturing-postgres psql -U postgres -d manufacturing_agent < db/schema.sql

# Back up before a demo
docker exec manufacturing-postgres pg_dump -U postgres manufacturing_agent | gzip > ~/fp-$(date +%F).sql.gz

# Confirm a rebuild actually shipped — a failed build leaves the old image serving
docker exec orchestrator sh -c 'grep -c "<string from your change>" dist/<path>.js'
```

## When to upgrade, and to what

Move one piece at a time, in this order:

1. **Postgres → RDS** (~$13/mo) when losing the database would matter. Automated
   backups and point-in-time recovery. Change one connection string.
2. **Redis → ElastiCache** (~$12/mo) only if you outgrow one node. Redis here is
   a cache and a last-known-good SAP snapshot — losing it is recoverable.
3. **Frontend → S3 + CloudFront** when users are geographically spread. Requires
   building with `VITE_API_BASE_URL` set to the API domain and adding that origin
   to `CORS_ALLOWED_ORIGINS` — the one change that breaks the single-origin
   simplicity, so do it deliberately.
4. **EC2 → ECS Fargate + ALB** (~$55/mo more) when you need zero-downtime deploys
   or more than one instance. The images are unchanged; this is task definitions
   and a target group.

For the SAP-native enterprise track (CAP/BTP), none of this is wasted — the same
containers run on Kyma, and `AUTH_MODE=xsuaa` plus the existing approuter are
already in the repo.

## When something is wrong

**Site does not load.** Check the stack finished: `sudo tail -50
/var/log/factorypilot-bootstrap.log`. Then `docker compose -f
docker-compose.prod.yml ps`.

**No certificate.** DNS is not resolving to this IP yet, or port 80 is blocked.
Let's Encrypt validates over port 80 even for an HTTPS certificate.

**Chat connects but never streams.** The WebSocket is not getting through —
check the `/ws*` block in `infra/Caddyfile`.

**Build killed partway.** Out of memory. Confirm swap: `free -h` should show 4 GB.
If it recurs, move up to `t3.small` or build images locally and push to ECR.
