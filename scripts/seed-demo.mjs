#!/usr/bin/env node
/**
 * Demo seeding (Phase E, beta): puts a deployment into the standard
 * photogenic demo state — three users, one goal per agent type, and one
 * pending approval. Idempotent: safe to run before every demo.
 *
 *   node scripts/seed-demo.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const PASSWORD = 'demo-Pass-123';

const USERS = [
  { email: 'owner@factorypilot.demo', displayName: 'Pavan Kolla' },
  { email: 'operator@factorypilot.demo', displayName: 'Op One' },
  { email: 'viewer@factorypilot.demo', displayName: 'View Only' },
];

async function api(path, opts = {}, token) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

async function ensureUser({ email, displayName }) {
  const login = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: PASSWORD }) });
  if (login.status === 200 || login.status === 201) {
    return login.body.token;
  }
  const signup = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, displayName, password: PASSWORD }),
  });
  if (signup.body?.token) {
    return signup.body.token;
  }
  throw new Error(`cannot ensure user ${email}: ${JSON.stringify(signup.body)}`);
}

async function main() {
  console.log(`Seeding demo state at ${BASE}`);
  const owner = await ensureUser(USERS[0]);
  await ensureUser(USERS[1]);
  await ensureUser(USERS[2]);
  console.log('✓ demo users ready (password: demo-Pass-123)');

  const goals = (await api('/api/agents/goals', {}, owner)).body || [];
  const wanted = [
    { agent: 'replenishment', warehouseId: '1030', threshold: 50, autonomy: 'propose' },
    { agent: 'replenishment', warehouseId: '1040', threshold: 80, autonomy: 'act', dailyBudgetQty: 200 },
    { agent: 'cycle_count', warehouseId: '1050' },
    { agent: 'rebalance', warehouseId: '1010', threshold: 40, autonomy: 'propose' },
    { agent: 'po_followup', warehouseId: '1010' },
  ];
  for (const goal of wanted) {
    const exists = goals.some((g) => g.agent === goal.agent && g.warehouse_id === goal.warehouseId);
    if (!exists) {
      await api('/api/agents/goals', { method: 'POST', body: JSON.stringify(goal) }, owner);
      console.log(`✓ goal: ${goal.agent} on WH ${goal.warehouseId}`);
    }
  }

  // One pending approval so the Approvals tab has a card the moment the demo starts.
  const move = await api(
    '/api/ops/move-request',
    {
      method: 'POST',
      body: JSON.stringify({ warehouseId: '1010', productId: 'P125', fromLocation: 'receiving', toLocation: 'bulk', qty: 25 }),
    },
    owner,
  );
  console.log(move.body?.executed ? '✓ demo move auto-executed by policy' : '✓ pending approval staged (Approvals tab)');
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
