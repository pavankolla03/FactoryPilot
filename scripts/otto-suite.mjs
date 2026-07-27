const BASE = 'http://localhost:3000';
const login = async () => (await (await fetch(`${BASE}/api/auth/login`, {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({email:'owner@factorypilot.demo', password:'demo-Pass-123'})})).json()).token;

const CASES = [
  { name:'live stock, exact value', q:'stock level of material MZ-CH-LM09 in plant 1010',
    must:[/100000|100,000/], mustNot:[/simulat/i] },
  { name:'plant 1710 (was invisible)', q:'how many distinct materials are in plant 1710?',
    must:[/\d{3}/], mustNot:[/1030/] },
  { name:'demo plant flagged', q:'what stock is in warehouse 1040?',
    must:[/simulat|demo/i] },
  { name:'PO cannot be plant-scoped', q:'how many open purchase orders in warehouse 1030?',
    mustNot:[/\d+\s+open purchase orders/i] , must:[/cannot|can't|unable|header|not available/i] },
  { name:'suppliers: real IDs, no invented names', q:'which suppliers do we buy from?',
    mustNot:[/Rheinwerk|Nordbolt|Adriatic|Precision Jig/] },
  { name:'movements: no fake 24h window', q:'what moved in plant 1710 in the last 24 hours?',
    mustNot:[/in the last 24 hours,? (there were|we had|\d+)/i] },
  { name:'iFlow listing (no model needed)', q:'list the names of the iflows you are connected to',
    must:[/materialstockread|material stock|purchaseorder|purchase order/i] },
  { name:'physical inventory variances', q:'are there counting differences in physical inventory for plant 1710?',
    must:[/\d/] },
];

const token = await login();
let pass = 0;
for (const c of CASES) {
  let answer = '';
  try {
    const r = await fetch(`${BASE}/api/chat`, {method:'POST',
      headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
      body: JSON.stringify({message:c.q})});
    answer = String((await r.json()).text || '');
  } catch (e) { answer = `ERROR ${e.message}`; }
  const fails = [];
  for (const re of c.must || []) if (!re.test(answer)) fails.push(`missing ${re}`);
  for (const re of c.mustNot || []) { const h = re.exec(answer); if (h) fails.push(`claimed "${h[0]}"`); }
  console.log(fails.length ? `FAIL  ${c.name}\n      ${fails.join('; ')}\n      → ${answer.slice(0,140).replace(/\n/g,' ')}`
                           : `pass  ${c.name}`);
  if (!fails.length) pass++;
}
console.log(`\n${pass}/${CASES.length} passed`);
