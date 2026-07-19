#!/usr/bin/env node
/**
 * Agent regression suite: runs canned prompts against a running FactoryPilot
 * stack and verifies the agent invoked the expected tools and succeeded.
 * Usage: node scripts/agent-eval.mjs [baseUrl]   (default http://localhost:3000)
 */
const BASE = process.argv[2] || 'http://localhost:3000';
const EMAIL = 'eval@factorypilot.demo';
const PASSWORD = 'eval-Pass-123!';

// Feedback-flywheel cases (beta): admin-promoted questions from /api/agents/eval-cases
// are appended at runtime so the suite grows with real user feedback.
async function loadPromotedCases(base, token) {
  if (!token) return [];
  try {
    const res = await fetch(`${base}/api/agents/eval-cases`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r) => ({
      q: r.question,
      tools: [],
      expectSubstring: r.expect_substring || undefined,
      promoted: true,
    }));
  } catch {
    return [];
  }
}

const CASES = [
  { q: 'show stock for material MAT-10023456 in warehouse 1010', tools: ['getStockLevel'] },
  { q: 'what stock does warehouse 1020 hold?', tools: ['listWarehouseStock'] },
  { q: 'tell me about material MAT-10023462', tools: ['getMaterialDetails'] },
  { q: 'give me a summary of warehouse 1030', tools: ['getWarehouseSummary'] },
  { q: 'search materials for drive shaft', tools: ['searchMaterials'] },
  { q: 'which materials are running low in warehouse 1030?', tools: ['getLowStock'] },
  { q: 'show open purchase orders for warehouse 1010', tools: ['getPurchaseOrders'] },
  { q: 'what moved in warehouse 1010 in the last 24 hours?', tools: ['getRecentMovements'] },
  { q: 'what should we reorder in warehouse 1030?', tools: ['suggestReorders'] },
  { q: 'give me a shift handover for warehouse 1010', tools: ['getShiftHandover'] },
  { q: 'show the demand trend for warehouse 1010 over the last two weeks', tools: ['getDemandTrend'] },
  { q: 'alert me when MAT-10023461 in warehouse 1020 drops below 40', tools: ['createStockAlert'] },
  { q: 'list my stock alerts', tools: ['listStockAlerts'] },
  { q: 'move product P123 from packing to shipping in warehouse 1010 qty 2', tools: ['moveStock'], expectPending: true },
  { q: 'how much stock of MAT-10023457 is in warehouse 1010?', tools: ['getStockLevel'] },
  { q: 'summary of warehouse 1050 please', tools: ['getWarehouseSummary'] },
  { q: 'any purchase orders in transit for warehouse 1030?', tools: ['getPurchaseOrders'] },
  { q: 'low stock below 100 in warehouse 1040', tools: ['getLowStock'] },
  { q: 'what is material MAT-10023468?', tools: ['getMaterialDetails'] },
  { q: 'list everything stored in warehouse 1050', tools: ['listWarehouseStock'] },
];

async function api(path, options = {}, token) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function login() {
  let res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (res.status !== 201 && res.status !== 200) {
    res = await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, displayName: 'Eval Runner', password: PASSWORD }),
    });
  }
  if (!res.body.token) {
    throw new Error(`could not authenticate eval user: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, role: res.body.user.role };
}

async function main() {
  const { token, role } = await login();
  if (role !== 'admin') {
    console.log('note: eval user is not admin — warehouse-scoped cases may be blocked. Grant scopes or run once on a fresh DB.');
  } else {
    // Raise our own quota so a full run never trips the monthly token budget.
    const me = await api('/api/admin/users', {}, token);
    const self = (me.body || []).find((u) => u.email === EMAIL);
    if (self) {
      await api(
        `/api/admin/users/${self.id}/quota`,
        { method: 'PATCH', body: JSON.stringify({ monthly_token_limit: 2000000 }) },
        token,
      );
    }
  }

  let passed = 0;
  const failures = [];

  const promoted = await loadPromotedCases(BASE, token);
  if (promoted.length > 0) {
    console.log(`+ ${promoted.length} promoted case(s) from feedback flywheel`);
  }
  const ALL_CASES = [...CASES, ...promoted];

  for (const [i, testCase] of ALL_CASES.entries()) {
    const label = `${String(i + 1).padStart(2, '0')} ${testCase.q.slice(0, 60)}`;
    try {
      const res = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: testCase.q }) }, token);
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 120)}`);
      }

      const logs = await api('/api/session-logs', {}, token);
      const latest = logs.body[0] || {};
      const invoked = Array.isArray(latest.tools_invoked_json)
        ? latest.tools_invoked_json
        : JSON.parse(latest.tools_invoked_json || '[]');

      const missing = testCase.tools.filter((tool) => !invoked.includes(tool));
      if (missing.length > 0) {
        throw new Error(`expected tools [${testCase.tools}] but got [${invoked}]`);
      }
      if (testCase.expectPending && !res.body.pendingAction) {
        throw new Error('expected a pending approval but none was returned');
      }
      if (testCase.expectSubstring && !String(res.body.text || '').toLowerCase().includes(testCase.expectSubstring.toLowerCase())) {
        throw new Error(`answer missing expected substring "${testCase.expectSubstring}"`);
      }
      if (latest.status !== 'success') {
        throw new Error(`session log status: ${latest.status}`);
      }

      passed += 1;
      console.log(`PASS  ${label}`);
    } catch (error) {
      failures.push({ label, reason: error.message });
      console.log(`FAIL  ${label}\n      ${error.message}`);
    }
    // gentle pacing for free-tier models and the chat rate limit
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  console.log(`\n${passed}/${ALL_CASES.length} passed`);
  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
