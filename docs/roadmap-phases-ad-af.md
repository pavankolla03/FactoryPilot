# FactoryPilot Roadmap — Phases AD–AF (go-live / landscape wave)

Phases AA–AC completed the planning-intelligence Insights tab. This wave makes
FactoryPilot connectable to a **real customer landscape from the UI** — no env
editing, no redeploy — and retires mock data as soon as a system is registered.

---

## Phase AD — Connection Center (landscape manager) ← building now

**Why first:** the iFlow endpoint is arriving, and today going live means editing
`SAP_IFLOW_URL` + auth env vars and restarting the orchestrator. A customer
should paste tenant details into a dialog and click Connect.

1. **`connections` table**: one row per registered system — `kind`
   (`iflow` | `s4hana` | `btp`), display name, non-secret `config` JSONB, and
   **AES-256-GCM sealed secrets** (reuses the existing secret box, so a DB dump
   never exposes credentials). Status, last test message and timestamp per row.
2. **Three connectable system types**, each with the fields that system needs:
   - **SAP Integration Suite iFlow** — HTTPS endpoint, method, auth
     (basic / API key / OAuth2 client-credentials).
   - **S/4HANA or Business Accelerator Hub** — base URL + APIKey (or basic),
     so reads can go live **directly against BAH OData v2 even before the iFlow
     exists**.
   - **BTP tenant** — subaccount, region, CF API endpoint, org/space, XSUAA
     token URL + client id/secret; Connect validates by fetching a token.
3. **Test connection** per row (live probe, inline result) + activate/deactivate.
4. **Live wins over mock**: business-object queries resolve
   *active iFlow connection → active S/4HANA connection → env → simulator*, and
   every answer already carries its `dataSource`, so provenance is visible.

**Exit:** paste an iFlow URL (or a BAH API key) in the UI, hit Test, activate —
and Otto answers from real SAP data with no restart.

---

## Phase AE — Enterprise SSO (Entra ID / OIDC)

Beyond the existing XSUAA path: register an OIDC provider (issuer, client id,
secret, claim mapping) per org from the same Connection Center, so a pilot can
sign in with corporate identity. Role/scope mapping from token claims.

**Exit:** a user signs in with Entra ID and lands with the right warehouse scopes.

---

## Phase AF — Observability + eval CI

OpenTelemetry traces across chat → tools → MCP → SAP (one trace per request,
already half-there via the glass-box timeline), plus the eval suite wired to run
on every build with a quality gate — the "engineered like infrastructure" proof.

**Exit:** a request is traceable end-to-end; regressions fail the build.

---

## Sequencing

AD unblocks the real-data pilot (and the arriving iFlow endpoint). AE unblocks
enterprise identity, which is the usual second procurement question. AF hardens
what the first two expose.
