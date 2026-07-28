/**
 * Builds the FactoryPilot end-to-end KT document.
 *
 * Written for someone who has never seen the product: what problem it solves,
 * what every screen does, a worked example per feature, and an honest account of
 * what is live against the customer's SAP versus what still needs an iFlow.
 */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, TableOfContents, LevelFormat, Footer, PageNumber,
} = require('docx');

// US Letter, in DXA (1440 = 1 inch).
const PAGE = { width: 12240, height: 15840 };
const CONTENT_W = 9360; // 6.5in of usable width

const BLUE = '1F4E79';
const GREY = '595959';
const GREEN = '2E7D32';
const AMBER = 'B26A00';
const RED = 'B3261E';

const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    alignment: opts.align,
    indent: opts.indent,
    children: [new TextRun({ text, size: opts.size ?? 21, color: opts.color, bold: opts.bold, italics: opts.italics })],
  });

/** Paragraph built from [text, {bold|italics|color}] pairs. */
const RichP = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    indent: opts.indent,
    children: runs.map(([t, o = {}]) => new TextRun({ text: t, size: o.size ?? 21, bold: o.bold, italics: o.italics, color: o.color, font: o.mono ? 'Consolas' : undefined })),
  });

const H1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } });
const H2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } });
const H3 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 100 } });

const Bullet = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: 'fp-bullets', level },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 21 })],
  });

const RichBullet = (runs, level = 0) =>
  new Paragraph({
    numbering: { reference: 'fp-bullets', level },
    spacing: { after: 80, line: 276 },
    children: runs.map(([t, o = {}]) => new TextRun({ text: t, size: 21, bold: o.bold, italics: o.italics, color: o.color, font: o.mono ? 'Consolas' : undefined })),
  });

let numSeq = 0;
/** Call before each numbered list so it restarts at 1. */
const NewList = () => { numSeq += 1; };
const Num = (text) =>
  new Paragraph({
    numbering: { reference: `fp-numbers-${numSeq}`, level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 21 })],
  });

/** Monospace block for chat transcripts and payloads. */
const Code = (lines) =>
  lines.map((l, i) =>
    new Paragraph({
      spacing: { after: i === lines.length - 1 ? 140 : 0, line: 240 },
      indent: { left: 360 },
      shading: { type: ShadingType.CLEAR, fill: 'F4F4F2' },
      children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 18 })],
    }),
  );

/** Callout box for "the business problem" / warnings. */
const Callout = (title, body, color = BLUE) =>
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color },
      bottom: { style: BorderStyle.SINGLE, size: 2, color },
      left: { style: BorderStyle.SINGLE, size: 12, color },
      right: { style: BorderStyle.SINGLE, size: 2, color },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: 'FAFAF7' },
            margins: { top: 120, bottom: 120, left: 180, right: 180 },
            children: [
              new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, size: 20, color })] }),
              ...(Array.isArray(body) ? body : [body]).map(
                (t) => new Paragraph({ spacing: { after: 40, line: 264 }, children: [new TextRun({ text: t, size: 20 })] }),
              ),
            ],
          }),
        ],
      }),
    ],
  });

/** Table with a header row. widths must sum to CONTENT_W. */
const Tbl = (headers, rows, widths) =>
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'BFBFBF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: BLUE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 19 })] })],
          }),
        ),
      }),
      ...rows.map((r, ri) =>
        new TableRow({
          children: r.map((c, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F7F7F5' : 'FFFFFF' },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: String(c).split('\n').map((line) =>
                new Paragraph({ spacing: { after: 0, line: 252 }, children: [new TextRun({ text: line, size: 19 })] }),
              ),
            }),
          ),
        }),
      ),
    ],
  });

const Break = () => new Paragraph({ children: [new PageBreak()] });

// ─────────────────────────────────────────────────────────────────────────────
const body = [];

// ── Cover ───────────────────────────────────────────────────────────────────
body.push(
  new Paragraph({ spacing: { before: 2200, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'FactoryPilot', bold: true, size: 72, color: BLUE })] }),
  new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'An AI agent for SAP warehousing and manufacturing', size: 28, color: GREY })] }),
  new Paragraph({ spacing: { before: 480, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'End-to-end product guide and knowledge transfer', size: 24, bold: true })] }),
  new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Written for a reader who has never seen the product', size: 20, italics: true, color: GREY })] }),
  new Paragraph({ spacing: { before: 1400, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Every feature · what it does · why it exists · a worked example', size: 20, color: GREY })] }),
  Break(),
);

// ── TOC ─────────────────────────────────────────────────────────────────────
body.push(
  H1('Contents'),
  ...[
    ['1.  The problem FactoryPilot solves', 'Who it is for, and what the status quo costs'],
    ['2.  How it works, in plain terms', 'The pieces, a request end to end, why answers can be trusted'],
    ['3.  Otto — the chat assistant', 'Every question type, with worked examples'],
    ['4.  Operations Board', 'Visual stock by location, drag to propose a move'],
    ['5.  Insights', 'Health, stockout, suppliers, slotting, scenario, ESG'],
    ['6.  Autonomy — agents that work on their own', 'Six specialists, three autonomy levels, the safety limits'],
    ['7.  Connections and the Business Object registry', 'Connecting SAP, and adding data without code'],
    ['8.  Governance, security and cost', 'Permissions, audit, cost control, model choice'],
    ['9.  The honesty principle', 'The hardest part, and how it is enforced'],
    ['10. What is live today, and what is not', 'Connected feeds, known limits, what unlocks what'],
    ['11. A fifteen-minute demo script', 'Ordered so each step builds on the last'],
    ['12. Glossary', 'Every term explained in plain language'],
  ].map(([t, d]) => new Paragraph({
    spacing: { after: 100, line: 264 },
    children: [
      new TextRun({ text: t, bold: true, size: 21 }),
      new TextRun({ text: '  —  ' + d, size: 20, color: GREY }),
    ],
  })),
  Break(),
);

// ── 1. The problem ──────────────────────────────────────────────────────────
body.push(
  H1('1. The problem FactoryPilot solves'),

  H2('1.1 Start with the person, not the software'),
  P('Picture a warehouse supervisor at the start of a shift. She needs to know four things: what is running low, what is arriving, what moved yesterday, and what needs counting. All four answers exist in SAP. Getting them out takes her about forty minutes.'),
  P('That is not because SAP lacks the data. It is because the data lives behind transaction codes and Fiori apps that each answer one narrow question, in a layout designed around the database rather than around her morning. MMBE for stock. ME2N for purchase orders. MB51 for movements. Each needs the right plant, the right storage location, the right selection screen. Each returns a grid she then has to read, filter and mentally join to the others.'),
  P('So she does what most supervisors do. She asks someone. Or she keeps a spreadsheet. Or she goes without the answer and finds out at 3pm that a line stopped.'),

  Callout('The business problem in one sentence', [
    'The information needed to run a warehouse already exists in SAP, but the cost of retrieving it — in clicks, in training, in waiting for someone who knows the transaction code — is high enough that people work without it.',
  ]),

  H2('1.2 What that costs'),
  P('The cost shows up in four places, and they compound:'),
  Bullet('Time. A supervisor spends 30 to 60 minutes a day assembling a picture that the system could produce instantly. Multiply by every supervisor, every shift.'),
  Bullet('Delay. A stockout is usually visible in the data days before it bites. Nobody looked, because looking is expensive.'),
  Bullet('Dependency. The two or three people who know SAP well become a bottleneck. When they are on leave, decisions wait.'),
  Bullet('Errors. Manual re-keying between a spreadsheet and SAP introduces mistakes that are then hard to trace.'),

  H2('1.3 What FactoryPilot does about it'),
  P('FactoryPilot puts a conversation in front of SAP. You type a question in plain language and get an answer grounded in your live SAP data, in seconds, with the evidence attached.'),
  P('It also acts. It can draft a stock movement or a purchase requisition — but never executes one without a human approving it first, and every action is logged with who asked, who approved, and what SAP returned.'),

  Callout('The design principle everything follows', [
    'When the data cannot answer the question, FactoryPilot says so. It never fills a gap with a plausible number.',
    'This sounds obvious. It is the single hardest thing to get right in a product like this, and section 9 explains why it took several attempts.',
  ], GREEN),

  H2('1.4 Who uses it'),
  Tbl(
    ['Role', 'What they use it for'],
    [
      ['Warehouse supervisor', 'Morning picture: what is low, what moved, what needs counting. Drafts replenishments.'],
      ['Inventory / materials planner', 'Stock levels across plants, reorder decisions, supplier follow-up.'],
      ['Buyer', 'Purchase order status, supplier reliability, chasing late deliveries.'],
      ['Plant manager', 'Warehouse health at a glance, where the risk is, what changed.'],
      ['SAP functional consultant', 'Registers new SAP data sources without writing code (section 6.2).'],
      ['IT / security', 'Controls who can see and change what; audits every action (section 7).'],
    ],
    [2600, 6760],
  ),
  Break(),
);

// ── 2. How it works ─────────────────────────────────────────────────────────
body.push(
  H1('2. How it works, in plain terms'),

  H2('2.1 The one-paragraph version'),
  P('You ask a question in the chat. FactoryPilot works out which SAP data would answer it, calls SAP through an integration layer, receives the real records, and writes you an answer. If the question needs an action, it prepares the action and asks you to approve it before anything is written back.'),

  H2('2.2 The pieces, and what each is for'),
  Tbl(
    ['Piece', 'Plain-language role'],
    [
      ['Browser (the app)', 'What you see and type into. Chat, board, insights, approvals.'],
      ['Orchestrator', 'The brain. Decides which data is needed, enforces permissions, calls the tools, assembles the answer, writes the audit log.'],
      ['Tools (MCP servers)', 'A catalogue of specific capabilities — "get stock level", "list movements", "draft a requisition". Each is one well-defined job.'],
      ['SAP Integration Suite (iFlow)', 'The bridge to SAP. A small integration flow that exposes one SAP OData service at a URL FactoryPilot can call.'],
      ['SAP S/4HANA', 'The system of record. FactoryPilot never bypasses it and never holds a second copy of the truth.'],
      ['Language model', 'Turns your sentence into the right tool call, and the returned records into readable prose. It never invents data — see 2.4.'],
    ],
    [2600, 6760],
  ),

  H2('2.3 A request, start to finish'),
  P('Take the question: "which materials are running low in plant 1710?"'),
  (NewList(), Num('You type it into the chat and press enter.')),
  Num('The orchestrator checks you are allowed to see plant 1710. If not, it stops here and logs the refusal.'),
  Num('It recognises this as a stock question about one plant, and selects the "get low stock" tool.'),
  Num('That tool calls your SAP iFlow, which calls the SAP OData service and returns the real material records.'),
  Num('The records come back and are turned into a readable answer with a table.'),
  Num('You see the answer, a "Live from SAP" badge, and an expandable panel showing the exact endpoint called and a sample of the raw response.'),
  Num('The whole exchange is written to the audit log: who asked, which tools ran, how long it took, how many tokens it cost.'),

  H2('2.4 Why the answers can be trusted'),
  P('A reasonable first reaction to "AI over my ERP" is: what stops it making things up? Three things, in order of importance.'),
  RichP([['Grounding. ', { bold: true }], ['The model is never asked what the stock level is. It is given the actual SAP records and asked to present them. Every number in an answer traces to a record that came back from SAP.']]),
  RichP([['Withholding. ', { bold: true }], ['When the data cannot support the question, FactoryPilot removes the data rather than adding a caveat. Asked for purchase orders "for plant 1030" when the connected feed has no plant field, it returns no rows at all and explains why. Section 9 covers what happens when you only add a caveat — the model ignores it.']]),
  RichP([['Determinism where possible. ', { bold: true }], ['Simple lookups do not involve the model at all. "Stock in plant 1710" is answered by fetching the records and rendering a table directly — about 40 milliseconds, no model, and a rendered table cannot hallucinate.']]),

  Callout('What a demo audience always asks', [
    'Q: "Can it invent a number?"',
    'A: For lookups, no — those answers never touch a language model. For analytical questions the model does write the prose, but every figure comes from a tool result, the evidence panel shows the raw SAP response, and there is an automated test suite that specifically checks it refuses to answer what the data cannot support.',
  ]),
  Break(),
);

// ── 3. Otto ─────────────────────────────────────────────────────────────────
body.push(
  H1('3. Otto — the chat assistant'),
  P('Otto is the main way people use FactoryPilot. This section walks through everything it can do, with a worked example for each.'),

  H2('3.1 Asking about stock'),
  P('The most common use. Otto understands several phrasings of the same question.'),
  ...Code([
    'You:  stock in plant 1710',
    '',
    'Otto: Plant 1710 holds 349 stock positions, 268,429,158 units',
    '      across 326 materials.',
    '',
    '      | Material       | Location | Qty        |',
    '      |----------------|----------|------------|',
    '      | MZ-SF-AU-BM01  | 171B     | 1,000,000  |',
    '      | MZ-FG-S02      | 171A     | 200,000    |',
    '      | ...                                     |',
    '',
    '      Showing the 20 largest of 349.',
    '      Live from SAP (sap-iflow (live)).',
  ]),
  RichP([['Business value: ', { bold: true }], ['replaces MMBE plus a manual sum. Answered in about 40 milliseconds with no AI cost.']]),

  H3('Variations that work'),
  Bullet('"stock level of material MZ-CH-LM09 in plant 1010" — one material, exact quantity and storage location.'),
  Bullet('"which materials are running low in plant 1710?" — everything below the reorder threshold, lowest first.'),
  Bullet('"give me a summary of plant 1710" — totals and a breakdown by storage location.'),
  Bullet('"search materials containing TG" — find a material when you only know part of the code.'),

  H2('3.2 Asking about movements'),
  ...Code([
    'You:  goods movements in plant 1710',
    '',
    'Otto: 10 goods movement(s) in plant 1710.',
    '',
    '      | Document     | Material      | Loc  | Qty       | Type | Direction |',
    '      |--------------|---------------|------|-----------|------|-----------|',
    '      | 4900000121/1 | TG11          | 171A | 10,000 PC | 561  | receipt   |',
    '      | 4900000122/1 | MZ-RM-R11-01  | 171C | 100 PC    | 561  | receipt   |',
    '',
    '      This SAP entity does not expose a posting timestamp, so the',
    '      requested time window was NOT applied.',
  ]),
  RichP([['Note the last line. ', { bold: true }], ['This is the honesty principle in action. The SAP feed currently connected returns movement lines without a posting date, so "in the last 24 hours" cannot be answered. Otto says so rather than presenting the rows as if they were recent.']]),

  H2('3.3 Asking about purchase orders and suppliers'),
  ...Code([
    'You:  which suppliers do we buy from',
    '',
    'Otto: 11 supplier(s) appear on purchase orders.',
    '',
    '      | Supplier   | Purchase orders |',
    '      |------------|-----------------|',
    '      | 17300001   | 28              |',
    '      | 17300002   | 6               |',
    '      | USSU-VSF01 | 4               |',
    '',
    '      Supplier names, lead times and on-time rates are NOT available',
    '      — no business-partner feed is connected.',
  ]),
  P('And an example of a question the connected data genuinely cannot answer:'),
  ...Code([
    'You:  open purchase orders for warehouse 1030',
    '',
    'Otto: I can\'t list purchase orders for plant 1030. The connected SAP',
    '      iFlow serves purchase order headers only — they carry no plant,',
    '      material or quantity, so there is no way to tell which orders',
    '      belong to this plant.',
    '',
    '      Connecting an A_PurchaseOrderItem iFlow would enable it.',
  ]),
  RichP([['Why this matters for a demo. ', { bold: true }], ['Earlier versions answered this question with a confident table of 50 purchase orders titled "Warehouse 1030 has 30 open purchase orders". Every number was real; the attribution to plant 1030 was invented. A buyer would have acted on it. This refusal is the product working correctly.']]),

  H2('3.4 Asking about physical inventory'),
  ...Code([
    'You:  are there counting differences in physical inventory for plant 1710?',
    '',
    'Otto: Yes — several posted variances.',
    '',
    '      | Material | Counted | Book Qty | Difference | Date       |',
    '      |----------|---------|----------|------------|------------|',
    '      | TG11     | 8,436   | 8,437.99 | -1.999     | 2017-06-27 |',
    '      | TG10     | 8       | 10       | -2         | 2020-05-13 |',
    '      | WM-PHY01 | 5       | 0        | +5         | 2024-08-13 |',
  ]),
  RichP([['Business value: ', { bold: true }], ['inventory accuracy problems surface as a question rather than a month-end report.']]),

  H2('3.5 Asking Otto to do something'),
  P('Otto can act, but never unilaterally. Every write follows the same four steps.'),
  ...Code([
    'You:  move 500 units of TG11 from 171A to 171B in plant 1710',
    '',
    'Otto: I have prepared this movement:',
    '        Material   TG11',
    '        From       171A',
    '        To         171B',
    '        Quantity   500',
    '      This needs your approval before it touches SAP.',
    '      [ Approve ]  [ Cancel ]',
  ]),
  (NewList(), Num('Otto prepares the action and shows exactly what will happen.')),
  Num('Nothing is sent to SAP yet. The request waits in the Approvals screen.'),
  Num('A human approves. If maker-checker is on for that warehouse, it must be a different human than the one who asked.'),
  Num('The result is reported honestly — either "Posted to SAP, document 4900001234", or "Recorded in FactoryPilot. SAP has not been updated: no write iFlow is connected."'),

  Callout('Governance in one line', [
    'FactoryPilot cannot change your SAP data without a named human approving the specific change, and the approval is recorded permanently.',
  ], GREEN),

  H2('3.6 Setting up alerts and reports'),
  Bullet('"alert me when TG11 in plant 1710 drops below 100" — creates a standing watch, checked every minute; you get a notification when it trips.'),
  Bullet('"send me the shift handover every Monday at 7" — a scheduled report.'),
  Bullet('"remember my warehouse is 1710" — stores a preference so you can stop repeating it.'),

  H2('3.7 Asking Otto about itself'),
  ...Code([
    'You:  list the names of the iflows you are connected to',
    '',
    'Otto: You have 4 connection(s) registered:',
    '      - BTP trial iFlow — material stock (connected)',
    '          serves A_MatlStkInAcctMod',
    '      - BTP trial iFlow — material documents (movements) (connected)',
    '          serves A_MaterialDocumentItem',
    '      - BTP trial iFlow — purchase orders (connected)',
    '      - BTP trial iFlow — physical inventory (connected)',
  ]),

  H2('3.8 The activity trail'),
  P('Every answer can be expanded to show exactly how it was produced. Click the "1 tool call" line under any response and you see:'),
  Bullet('Which tool ran, and whether it hit live SAP or the simulator'),
  Bullet('The exact endpoint URL called'),
  Bullet('The SAP entity set involved'),
  Bullet('How many rows came back, and a sample of the raw response'),
  Bullet('How long it took and how large the payload was'),
  ...Code([
    'Query business object   Orchestrator   live SAP   1.0 KB   8.46s',
    '  > 15 row(s) from SAP',
    '    Endpoint    https://…/http/materialstockread',
    '    Entity set  A_MatlStkInAcctMod',
    '    Response sample',
    '    [ { "Material": "MZ-CH-LM09", "Plant": "1010",',
    '        "StorageLocation": "101A",',
    '        "MatlWrhsStkQtyInMatlBaseUnit": "100000" } ]',
  ]),
  RichP([['Why this exists. ', { bold: true }], ['"Where did that number come from?" is the first question any auditor, and most sceptical users, will ask. The answer is one click away rather than a support ticket.']]),
  Break(),
);

// ── 4. Board ────────────────────────────────────────────────────────────────
body.push(
  H1('4. Operations Board'),
  P('A visual, kanban-style view of live stock, one column per storage location.'),

  H2('4.1 What you see'),
  Bullet('One column for each storage location that actually holds stock in that plant (171A, 171B, 171C…).'),
  Bullet('Each column header shows the total quantity in that location.'),
  Bullet('Each card is a material with its current quantity.'),
  Bullet('A badge at the top states whether the data is live from SAP or simulated.'),

  H2('4.2 What you can do'),
  P('Drag a card from one column to another. That does not move anything yet — it proposes a stock transfer, which then goes through the same approval flow as a chat-initiated move.'),
  RichP([['Business value: ', { bold: true }], ['a supervisor can rebalance stock across storage locations by dragging, instead of running MIGO with movement type 311 and remembering the field layout.']]),

  Callout('A real bug worth mentioning in a KT session', [
    'The board originally showed five fixed columns — receiving, inspection, bulk, packing, shipping — because those were the demo warehouse\'s locations. Against a real SAP plant those five were always empty and the real locations wrapped onto a second row.',
    'The columns are now derived from the data. It is a small fix, but it is the kind of thing that makes a demo feel wrong for reasons the audience cannot articulate.',
  ], AMBER),
  Break(),
);

// ── 5. Insights ─────────────────────────────────────────────────────────────
body.push(
  H1('5. Insights'),
  P('Six advisory cards. These do not act; they tell you where to look. Each one is honest about whether it could actually run against your data — several currently cannot, and say so.'),

  H2('5.1 Warehouse Health Score'),
  P('One number from 0 to 100 per plant, from four weighted factors.'),
  Tbl(
    ['Factor', 'Weight', 'What it measures'],
    [
      ['Days of cover', '40%', 'Materials with less than three days of demand left'],
      ['Low stock', '20%', 'How much of the plant is below threshold or at zero'],
      ['PO aging', '20%', 'Overdue open purchase orders'],
      ['Movement anomalies', '20%', 'Movements far larger than the recent norm'],
    ],
    [2800, 1200, 5360],
  ),
  P('Against the currently connected SAP feeds, three of those four factors have no data behind them. The card says so explicitly:'),
  ...Code([
    'Plant 1710 — score 50 (critical)',
    'based on 1 of 4 factors — Days of cover, PO aging and Movement',
    'anomalies could not be measured',
    '',
    '  x Days of cover       not measurable — no consumption history',
    '    Low stock           106 below 50, 56 at zero',
    '  x PO aging            not measurable — POs carry no plant or date',
    '  x Movement anomalies  not measurable — movements carry no posting date',
  ]),
  Callout('This was the most serious defect found in the whole product', [
    'Before this was fixed, the same plant scored 76 — "watch" — because the three unmeasurable factors quietly defaulted to scores of 90 and 100, with detail text reading "all materials above 3 days of demand" and "no open purchase orders". Neither was true; both were the absence of data rendered as good news.',
    'Eighty per cent of the score was reassurance manufactured from nothing, and it diluted the one real signal. The score now averages only the factors it could actually measure, and names the ones it could not.',
  ], RED),

  H2('5.2 Stockout Radar'),
  P('Projects which materials will run out and when, and whether an inbound order covers them in time.'),
  P('Requires consumption history. The connected SAP movement feed has no posting dates, so days-of-cover cannot be calculated for live plants. The card reports this rather than showing an empty list:'),
  ...Code([
    'Not assessed (11): 1010, 1110, 1710, 3010, AUC1, DE20, DE30, DEC1,',
    'US20, US30, USC1 — no consumption history: the connected SAP',
    'material-document feed carries no posting date, so days-of-cover',
    'cannot be calculated for this plant',
  ]),

  H2('5.3 Supplier Intelligence'),
  P('A reliability scorecard per supplier — on-time rate, lead time, open exposure, overdue orders — ranked worst first.'),
  P('Currently lists all 11 real SAP supplier IDs with their purchase order counts, and reports the reliability score as "not scored", because the connected purchase order feed has no delivery dates to compare against.'),
  RichP([['Design note: ', { bold: true }], ['unscored suppliers sort last, not first. Unknown is not the same as bad.']]),

  H2('5.4 Slotting Optimiser'),
  P('Recommends moving fast-moving materials to more accessible pick faces, to shorten picker walking routes.'),
  P('Needs pick frequency over time, which needs dated movements. For a live plant it explains that rather than claiming the slotting is already optimal.'),

  H2('5.5 Scenario Studio'),
  P('A what-if tool. "If demand rises 20% and my supplier is 5 days late, what runs out?" Read-only — it never writes anything.'),
  ...Code([
    'Demand +20%   Horizon 30 days   Supplier delay +5 days',
    '',
    '  Stockouts        —      (not modelled)',
    '  New vs baseline  —      (not modelled)',
    '  At risk          86',
    '  Units short      —      (not modelled)',
    '',
    '  Not simulated: no consumption history exists for plant 1710, so',
    '  daily demand is zero for every material and nothing was actually',
    '  simulated. The zero figures mean "not modelled", NOT "safe".',
  ]),
  RichP([['Before this was fixed ', { bold: true }], ['those tiles showed a green "0 stockouts, 0 shortfall" — visually identical to a stress test that ran and passed.']]),

  H2('5.6 ESG / carbon footprint'),
  P('Estimates the carbon footprint of warehouse activity — handling energy per movement, and transport emissions by supplier country and mode.'),
  Callout('Be precise about this one in front of a customer', [
    'The movement quantities are real SAP data. The emission factors are illustrative constants held in FactoryPilot, not SAP sustainability data. The figure is a modelled estimate, and both the screen and the underlying data label it as such.',
    'A real deployment would plug in the customer\'s own factors. Presenting this as a measured carbon number would be wrong.',
  ], AMBER),
  Break(),
);

// ── 6. Autonomy + registry ──────────────────────────────────────────────────
body.push(
  H1('6. Autonomy — agents that work on their own'),
  P('Insights advise. Agents act, on a schedule, within limits you set.'),

  H2('6.1 The six specialists'),
  Tbl(
    ['Agent', 'What it does'],
    [
      ['Replenishment', 'Finds materials below threshold and drafts purchase requisitions to top them up.'],
      ['Rebalance', 'Moves stock between storage locations within a plant.'],
      ['Network rebalance', 'Moves stock between plants — covers a shortage in one from a surplus in another.'],
      ['Forecast', 'Projects demand and calculates reorder points from consumption history.'],
      ['PO follow-up', 'Chases overdue purchase orders.'],
      ['Cycle count', 'Proposes a weekly counting checklist, prioritised by value and movement.'],
    ],
    [2600, 6760],
  ),

  H2('6.2 The three autonomy levels'),
  Tbl(
    ['Level', 'Behaviour', 'When to use it'],
    [
      ['Observe', 'Looks and reports. Changes nothing.', 'Week one. Build trust.'],
      ['Propose', 'Prepares actions and queues them for approval.', 'The normal steady state.'],
      ['Act', 'Executes within budget, window and review limits.', 'Once a specific agent has proved itself.'],
    ],
    [1500, 4600, 3260],
  ),

  H2('6.3 What an agent run looks like'),
  ...Code([
    'Run started (trigger: manual, autonomy: propose)',
    '',
    'OBSERVE  30 position(s) below 50 in WH 1710:',
    '         MZ-FG-E102=35, FG0502=32, MZ-FG-E163=30, TG20=25, …',
    '',
    'PLAN     30 reorder(s) — MZ-FG-E102: order 65, FG0502: order 68, …',
    '         [30 quantities are a top-up to 100 (2x threshold), NOT',
    '          demand-based — no consumption history for this plant]',
    '',
    'CRITIC   Critic could not run (rate limit) — auto-execution withheld,',
    '         routing to human approval.',
    '',
    'APPROVAL Awaiting human approval of 30 draft(s).',
  ]),
  P('Read that critic line carefully — it is the most important safety property in the product.'),

  Callout('A genuine safety hole, found and closed', [
    'A second AI reviews every plan before it executes. When that reviewer failed — which on a rate-limited account happens most days — the code recorded it as "no concerns raised" and an agent set to Act would write to SAP with no review at all.',
    'A review that could not run is now treated as a review that did not pass: execution is withheld and the plan goes to a human. There is a dedicated unit test whose entire purpose is to stop that regressing.',
  ], RED),

  H2('6.4 The other limits on an agent'),
  Bullet('Blast radius — a per-run quantity budget. Exceed it and the run escalates to a human.'),
  Bullet('Change window — outside the permitted hours, auto-execution is disabled.'),
  Bullet('Duplicate guard — will not re-draft a requisition it already drafted in the last three days.'),
  Bullet('Inbound awareness — will not reorder what an existing purchase order already covers.'),

  H1('7. Connections and the Business Object registry'),

  H2('7.1 Connecting to SAP'),
  P('Under Connections you register your SAP systems: an iFlow endpoint for reads, one for writes, a direct S/4HANA connection, or a BTP tenant. Credentials are encrypted at rest and never returned to the browser — the screen shows only a masked hint such as "clientSecret: ce3••••o=".'),
  P('A Test button proves the connection end to end and reports what came back:'),
  ...Code([
    'BTP trial iFlow — material stock            connected',
    '  Reachable via iFlow (oauth2 auth)',
    '  — A_MatlStkInAcctMod returned 1 row(s)',
  ]),

  H2('7.2 The Business Object registry — adding SAP data without code'),
  P('This is the feature that makes FactoryPilot extensible by a functional consultant rather than a developer.'),
  P('To teach FactoryPilot a new kind of SAP data, you fill in a form: the OData service path, the entity set, which fields to select, a default filter, and the keywords a user might say. It becomes queryable immediately — no deployment, no code.'),
  Tbl(
    ['Field', 'Example', 'What it does'],
    [
      ['Object code', 'PHYSICAL_INVENTORY', 'Internal name'],
      ['Service path', '/sap/opu/odata/sap/API_PHYSICAL_INVENTORY_DOC_SRV', 'The SAP OData service'],
      ['Entity set', 'A_PhysInventoryDocItem', 'The specific collection'],
      ['Default filter', "Plant eq '{warehouseId}'", 'Scope to the plant being asked about'],
      ['Keywords', 'stock count, cycle count, variance', 'How users refer to it in chat'],
    ],
    [2000, 4400, 2960],
  ),

  H3('Two safety features worth demonstrating'),
  RichP([['Preview ', { bold: true }], ['fetches a few real rows and lists the field names SAP actually returned. A fixed-endpoint iFlow often serves a different entity set than the registry claims — this is how two such mismatches were caught.']]),
  RichP([['Validate all ', { bold: true }], ['checks every configured field against a live preview and reports which objects are backed by live SAP versus the simulator. Its first run found three real misconfigurations, including a filter on a field the endpoint does not return, which had been silently matching nothing.']]),
  Break(),
);

// ── 8. Governance ───────────────────────────────────────────────────────────
body.push(
  H1('8. Governance, security and cost'),

  H2('8.1 Who can see and do what'),
  Bullet('Warehouse scopes — a user is granted read or write access per warehouse. Someone scoped to 1010 cannot see 1710, and asking is logged as a refusal.'),
  Bullet('Roles — administrators manage users, connections and policies; viewers use the product.'),
  Bullet('Maker-checker — for sensitive warehouses, the person who requests an action cannot be the person who approves it.'),
  Bullet('Auto-approve thresholds — small routine movements can be pre-authorised up to a quantity limit; anything larger needs a human.'),
  Bullet('Multi-tenancy — organisations are isolated from each other.'),

  H2('8.2 The audit trail'),
  P('Every interaction is recorded: who asked, the exact question, which tools ran, whether the answer came from cache or live SAP, how long it took, how many tokens it cost, and whether it succeeded, failed, or was blocked by scope or quota.'),
  RichP([['Business value: ', { bold: true }], ['"who changed this stock figure and why" is answerable in seconds, which is normally the hardest question in an ERP estate.']]),

  H2('8.3 Cost control'),
  P('AI models cost money per question. Four mechanisms keep that predictable:'),
  Tbl(
    ['Mechanism', 'Effect'],
    [
      ['Deterministic answers', 'Common lookups never call a model — zero cost, about 40ms.'],
      ['Row budget', 'The model reads at most 30 rows plus accurate totals, instead of 350 rows (~10,000 tokens).'],
      ['Caching and dedupe', 'A repeated question inside the cache window replays the previous answer for free.'],
      ['Quotas', 'Per-user daily, weekly and monthly token limits, with block or warn behaviour.'],
    ],
    [2800, 6560],
  ),
  P('The Usage & Cost screen shows estimated spend per day and month, priced per model. Unknown models are reported as unpriced rather than counted as free, so spend is never under-reported.'),

  H2('8.4 Bring your own model'),
  P('FactoryPilot is not tied to one AI provider. It supports OpenAI, Anthropic, Azure OpenAI, OpenRouter, and any self-hosted OpenAI-compatible endpoint — including a model running entirely inside your own network, which matters if the data must not leave your estate.'),

  H2('8.5 When the AI is unavailable'),
  P('Model providers rate-limit and go down. FactoryPilot degrades in a specific, deliberate way:'),
  Bullet('Lookups keep working — they never needed a model.'),
  Bullet('Questions about connections and capabilities keep working.'),
  Bullet('For anything that genuinely needs the model, it explains the actual cause and what to do about it, rather than a generic error.'),
  ...Code([
    'Your OpenRouter free-tier daily request limit is used up. Every free',
    'model shares that one account-wide cap, so switching models will not',
    'help until it resets. Add credits, or connect your own model.',
    '',
    'I can still answer these directly from SAP without the model:',
    '  - "stock in plant 1010"',
    '  - "which materials are running low in plant 1010?"',
    '  - "goods movements in plant 1010"',
  ]),
  P('The automated end-to-end test suite passes 8 out of 8 with no model available at all.'),
  Break(),
);

// ── 9. Honesty ──────────────────────────────────────────────────────────────
body.push(
  H1('9. The honesty principle — the hardest part'),
  P('If you take one thing from this document into a customer conversation, take this section. It is the difference between a demo and a product someone will trust with their inventory.'),

  H2('9.1 The failure it prevents'),
  P('An AI over enterprise data has one catastrophic failure mode: a confident, well-formatted, entirely wrong answer. Not a crash — those get noticed. A plausible number that someone acts on.'),

  H2('9.2 What was actually tried'),
  P('Asked for "open purchase orders for warehouse 1030" against a feed whose purchase orders carry no plant field, the system produced:'),
  ...Code([
    'Warehouse 1030 has 30 open purchase orders (50 total in system).',
    '  | 4500000001 | 17300001 |',
    '  | 4500000002 | 17300001 |  … and 28 more rows',
  ]),
  P('Every purchase order number was real. The attribution to warehouse 1030 was invented, and so was "open". Three fixes were attempted:'),
  Tbl(
    ['Attempt', 'Result'],
    [
      ['Add a prose caveat to the data', 'Ignored. The model tabulated the rows anyway.'],
      ['Add a warehouseFilterApplied: false flag', 'Ignored.'],
      ['Remove the rows entirely', 'Worked.'],
    ],
    [4200, 5160],
  ),
  Callout('The rule that came out of it', [
    'When the payload cannot support the question, withhold the data — do not annotate it.',
    'Nothing to tabulate means nothing to misattribute. This rule is now applied across the product and is enforced by automated tests.',
  ], GREEN),

  H2('9.3 The same defect, in four places'),
  P('Once the pattern was recognised, the same shape appeared repeatedly — absence of data rendered as a good outcome:'),
  Tbl(
    ['Where', 'What it displayed', 'What was true'],
    [
      ['Health score', '"All materials above 3 days of demand"', 'No demand data at all'],
      ['Stockout radar', '9 risks, all plants looking fine', 'All 11 live plants were never assessed'],
      ['Slotting', '"Fast movers already on forward pick faces"', 'No pick history; nothing ran'],
      ['Scenario Studio', 'Green "0 stockouts, 0 shortfall"', 'Zero demand; nothing simulated'],
    ],
    [2000, 3900, 3460],
  ),
  P('All four now state what they could not measure and why, and name the SAP feed that would fix it.'),

  H2('9.4 How it is kept honest'),
  P('An automated suite runs eight end-to-end questions against the live system and asserts refusal, not just retrieval:'),
  Bullet('A plant-scoped purchase order question must not report a count of open orders.'),
  Bullet('A supplier question must not produce invented supplier names.'),
  Bullet('A movements question must not present rows as last-24-hours activity.'),
  Bullet('A question about an unknown plant must say it is not in the landscape.'),
  P('These were verified in both directions — they pass today, and they fire when replayed against the fabricated answers captured before the fixes. An assertion that cannot fail is not a test.'),
  Break(),
);

// ── 10. Current state ───────────────────────────────────────────────────────
body.push(
  H1('10. What is live today, and what is not'),
  P('Be straightforward about this in any presentation. The gaps are integration work, not product defects, and each has a named fix.'),

  H2('10.1 Connected SAP feeds'),
  Tbl(
    ['SAP entity', 'Feeds', 'Status'],
    [
      ['A_MatlStkInAcctMod', 'Stock, low stock, summaries, materials', 'Live'],
      ['A_MaterialDocumentItem', 'Goods movements', 'Live'],
      ['A_PurchaseOrder', 'Purchase orders, suppliers (header only)', 'Live'],
      ['A_PhysInventoryDocItem', 'Count documents and variances', 'Live'],
      ['A_OutboundDelivery', 'Deliveries, shipping', 'Not connected'],
      ['A_SalesOrder', 'Sales orders', 'Not connected'],
    ],
    [3000, 4400, 1960],
  ),
  P('Nine of the seventeen data tools are served from live SAP: stock level, warehouse stock, low stock, warehouse summary, goods movements, purchase orders, materials search, material details and suppliers.'),

  H2('10.2 The known limits, stated plainly'),
  Bullet('Purchase order headers carry no plant, material or quantity — so purchase orders cannot be listed per plant.'),
  Bullet('Movement lines carry no posting date — so no time window can be applied and no consumption history can be built.'),
  Bullet('No product master is connected — material descriptions are empty; you see codes.'),
  Bullet('No business-partner feed is connected — supplier names are empty; you see supplier IDs.'),
  Bullet('No write iFlow is connected — approved actions are recorded in FactoryPilot and labelled as not yet posted to SAP.'),

  H2('10.3 What unlocks what'),
  Tbl(
    ['Provide this', 'And this becomes real'],
    [
      ['PostingDate on movements\n(or A_MaterialDocumentHeader)',
       'Stockout radar, slotting, Scenario Studio, demand forecasting, two of the four health factors, and "what moved in the last 24 hours"'],
      ['A_PurchaseOrderItem',
       'Plant-scoped purchase orders, inbound quantities and ETAs, supplier reliability scoring'],
      ['A write iFlow (POST)',
       'Approved movements and requisitions actually post to SAP'],
      ['A_Product',
       'Material descriptions instead of codes'],
      ['A_Supplier (business partner)',
       'Supplier names instead of IDs'],
    ],
    [3400, 5960],
  ),
  RichP([['If only one is done, do the first. ', { bold: true }], ['A single date field revives five features and half the health score.']]),
  Break(),
);

// ── 11. Demo script + glossary ──────────────────────────────────────────────
body.push(
  H1('11. A fifteen-minute demo script'),
  P('Ordered so each step builds on the last, and so the honesty behaviour lands as a strength rather than a limitation.'),
  Tbl(
    ['Min', 'Do this', 'Say this'],
    [
      ['0–2', 'Open Otto. Type "hi".',
       '"Plain language, no transaction codes. Note it answered instantly — simple things do not use AI at all."'],
      ['2–5', '"stock in plant 1710"',
       '"349 positions from live SAP in about 40 milliseconds. This replaces MMBE plus a manual sum."'],
      ['5–7', 'Expand the tool-call line.',
       '"Here is the exact iFlow called and the raw SAP response. Every number traces back."'],
      ['7–9', '"open purchase orders for warehouse 1030"',
       '"It refuses — and explains why, and what would fix it. That refusal is the most valuable thing in this demo."'],
      ['9–11', 'Insights → Health.',
       '"One number per plant, and it tells you which factors it could not measure rather than scoring them as good."'],
      ['11–13', 'Ask for a stock move.',
       '"It prepares, it does not execute. Approval is required and recorded."'],
      ['13–15', 'Connections → Business objects.',
       '"A functional consultant adds a new SAP object with a form. No code, no deployment."'],
    ],
    [900, 3200, 5260],
  ),

  H1('12. Glossary'),
  Tbl(
    ['Term', 'Plain meaning'],
    [
      ['iFlow', 'A small integration flow in SAP Integration Suite that exposes one SAP service at a URL FactoryPilot can call.'],
      ['OData', 'The web API standard SAP uses to expose business data.'],
      ['Entity set', 'One collection within an OData service — for example A_MatlStkInAcctMod is material stock.'],
      ['Plant', 'SAP\'s term for a site or warehouse. FactoryPilot calls it a warehouse; they are the same thing.'],
      ['Storage location', 'A subdivision within a plant — an aisle, zone or area.'],
      ['MCP', 'Model Context Protocol. The standard for giving an AI assistant a catalogue of tools.'],
      ['Tool', 'One specific capability the assistant can invoke, such as "get low stock".'],
      ['Token', 'The unit AI models are billed in. Roughly three quarters of a word.'],
      ['Grounding', 'Giving the model real data to answer from, rather than relying on what it memorised.'],
      ['Maker-checker', 'A control requiring that the requester and the approver be different people.'],
      ['Provenance', 'The record of where a piece of data came from — live SAP, cache, or simulator.'],
      ['BYOM', 'Bring Your Own Model — point the product at your own AI provider or a self-hosted model.'],
    ],
    [2000, 7360],
  ),

  new Paragraph({ spacing: { before: 400 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: BLUE } }, children: [] }),
  P('FactoryPilot — end-to-end product guide. Generated from the running system; every example in this document was captured from live output against the connected SAP tenant.',
    { italics: true, color: GREY, size: 18 }),
);

// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'FactoryPilot',
  title: 'FactoryPilot — End-to-End Product Guide and KT',
  description: 'Complete functional walkthrough, use cases and business value',
  numbering: {
    config: [
      {
        reference: 'fp-bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 240 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 900, hanging: 240 } } } },
        ],
      },
      ...Array.from({ length: numSeq + 1 }, (_, i) => ({
        reference: `fp-numbers-${i}`,
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 240 } } } },
        ],
      })),
    ],
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 360, after: 160 } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 280, after: 120 } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, color: '2E5F८A'.replace('८','8'), font: 'Calibri' },
        paragraph: { spacing: { before: 220, after: 100 } } },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'FactoryPilot — Product Guide & KT    ', size: 16, color: GREY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
              ],
            }),
          ],
        }),
      },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = '/Users/pavankolla/FactoryPilot/docs/kt/FactoryPilot-Product-Guide-and-KT.docx';
  fs.writeFileSync(out, buf);
  console.log('written:', out, (buf.length / 1024).toFixed(0) + ' KB');
});
