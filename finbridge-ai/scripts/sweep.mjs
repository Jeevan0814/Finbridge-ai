#!/usr/bin/env node
/**
 * FinBridge AI — hourly tool sweep
 *
 * Jeevan's job from +4:00, mechanised. Spawns the built server over stdio,
 * speaks raw MCP JSON-RPC, and exercises every tool, resource and prompt.
 *
 *   npm run sweep
 *
 * Rule from CONTRIBUTING.md: two errors against one tool in a single sweep and
 * that tool is cut from the video. This script counts them for you and writes
 * a timestamped log to sweeps/ so you have the history when you decide.
 *
 * Exit code 0 = everything green. Non-zero = at least one failure.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'dist', 'index.js');
const TIMEOUT_MS = 20000;

if (!fs.existsSync(ENTRY)) {
  console.error(`✗ ${ENTRY} not found. Run "npm run build" first.`);
  process.exit(2);
}

// ---------------------------------------------------------------- transport

let nextId = 1;
const pending = new Map();
let buffer = '';

const child = spawn(process.execPath, [ENTRY], {
  cwd: ROOT,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'production', MCP_TRANSPORT_TYPE: 'stdio' }
});

const stderrLines = [];
child.stderr.on('data', (d) => stderrLines.push(d.toString()));

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // banner / log noise on stdout
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message || JSON.stringify(msg.error))) : resolve(msg.result);
    }
  }
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timeout after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

// ------------------------------------------------------------------ checks

const results = [];
const errorsByTarget = new Map();

async function check(target, label, fn) {
  try {
    const detail = await fn();
    results.push({ target, label, ok: true, detail: detail || '' });
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (err) {
    errorsByTarget.set(target, (errorsByTarget.get(target) || 0) + 1);
    results.push({ target, label, ok: false, detail: err.message });
    console.log(`  ✗ ${label} — ${err.message}`);
  }
}

/** Every tool output must carry the BaseOutput fields. Non-negotiable. */
function assertBaseOutput(payload) {
  if (typeof payload.risk_note !== 'string' || !payload.risk_note.trim()) {
    throw new Error('missing or empty risk_note');
  }
  if (payload.educational_only !== true) {
    throw new Error('educational_only is not literal true');
  }
}

function parseToolResult(res) {
  if (res.isError) throw new Error(`tool reported isError: ${JSON.stringify(res.content)}`);
  if (res.structuredContent) return res.structuredContent;
  const text = res.content?.find((c) => c.type === 'text')?.text;
  if (!text) throw new Error('no text content in tool result');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`tool result is not JSON: ${text.slice(0, 120)}`);
  }
}

const TOOL_CALLS = [
  {
    name: 'check_scheme_eligibility',
    // Boundary case on purpose: a 10-year-old girl child, the SSY edge.
    args: { age: 10, monthlyIncome: 15000, gender: 'female', occupation: 'student', hasBankAccount: true, isTaxPayer: false },
    verify(out) {
      assertBaseOutput(out);
      if (!Array.isArray(out.eligible) || !Array.isArray(out.ineligible)) {
        throw new Error('eligible/ineligible must both be arrays');
      }
      for (const item of out.ineligible) {
        if (!item.failedCondition) throw new Error(`ineligible ${item.schemeId} has no failedCondition`);
      }
      const total = out.eligible.length + out.ineligible.length;
      return `${out.eligible.length} eligible, ${out.ineligible.length} ineligible (${total} evaluated)`;
    }
  },
  {
    name: 'project_investment_growth',
    args: { monthlyAmount: 5000, years: 10, fundCategory: 'equity' },
    verify(out) {
      assertBaseOutput(out);
      if (typeof out.lowEstimate !== 'number' || typeof out.highEstimate !== 'number') {
        throw new Error('estimates must be numbers');
      }
      if (out.highEstimate < out.lowEstimate) throw new Error('highEstimate < lowEstimate');
      if (!out.assumptions?.length) throw new Error('assumptions array is empty');
      if (!out.navSource) throw new Error('navSource missing');
      return `${out.lowEstimate}–${out.highEstimate} via ${out.navSource}`;
    }
  },
  {
    name: 'calculate_financial_health',
    args: { monthlyIncome: 50000, monthlyExpenses: 30000, savings: 200000, monthlyDebtPayment: 8000, emergencyFundMonths: 6 },
    verify(out) {
      assertBaseOutput(out);
      if (typeof out.score !== 'number') throw new Error('score must be a number');
      for (const k of ['savingsRate', 'emergencyFund', 'debtRatio']) {
        if (typeof out.subScores?.[k] !== 'number') throw new Error(`subScores.${k} missing`);
      }
      if (!out.suggestions?.length) throw new Error('suggestions array is empty');
      return `score ${out.score}`;
    }
  },
  {
    name: 'explain_financial_concept',
    args: { term: 'SIP' },
    verify(out) {
      assertBaseOutput(out);
      if (!out.term || !out.explanation || !out.example) throw new Error('term/explanation/example incomplete');
      return `"${out.term}" explained`;
    }
  }
];

const RESOURCES = ['finbridge://schemes', 'finbridge://glossary'];
const PROMPTS = ['beginner_investor_advisor', 'scheme_navigator'];

// -------------------------------------------------------------------- main

async function main() {
  const started = new Date();
  console.log(`\nFinBridge sweep — ${started.toISOString()}\n`);

  await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'finbridge-sweep', version: '1.0.0' }
  });
  notify('notifications/initialized', {});

  console.log('Discovery');
  const [tools, resources, prompts] = [
    await request('tools/list', {}).catch(() => ({ tools: [] })),
    await request('resources/list', {}).catch(() => ({ resources: [] })),
    await request('prompts/list', {}).catch(() => ({ prompts: [] }))
  ];
  const toolNames = (tools.tools || []).map((t) => t.name);
  const resourceUris = (resources.resources || []).map((r) => r.uri);
  const promptNames = (prompts.prompts || []).map((p) => p.name);

  await check('discovery', '4 tools discoverable', async () => {
    const missing = TOOL_CALLS.map((t) => t.name).filter((n) => !toolNames.includes(n));
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
    return toolNames.join(', ');
  });
  await check('discovery', '2 resources discoverable', async () => {
    const missing = RESOURCES.filter((u) => !resourceUris.includes(u));
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
    return resourceUris.join(', ');
  });
  await check('discovery', '2 prompts discoverable', async () => {
    const missing = PROMPTS.filter((n) => !promptNames.includes(n));
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
    return promptNames.join(', ');
  });

  console.log('\nTools');
  for (const t of TOOL_CALLS) {
    await check(t.name, t.name, async () => t.verify(parseToolResult(await request('tools/call', { name: t.name, arguments: t.args }))));
  }

  console.log('\nResources');
  for (const uri of RESOURCES) {
    await check(uri, uri, async () => {
      const res = await request('resources/read', { uri });
      const text = res.contents?.[0]?.text;
      if (!text) throw new Error('no text content');
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('payload is not a non-empty array');
      return `${parsed.length} entries`;
    });
  }

  console.log('\nPrompts');
  for (const name of PROMPTS) {
    await check(name, name, async () => {
      const res = await request('prompts/get', { name, arguments: {} });
      if (!res.messages?.length) throw new Error('no messages returned');
      return `${res.messages.length} messages`;
    });
  }

  // ------------------------------------------------------------- reporting
  const failed = results.filter((r) => !r.ok);
  const cut = [...errorsByTarget.entries()].filter(([, n]) => n >= 2);

  console.log('\n' + '─'.repeat(58));
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (cut.length) {
    console.log('\n⚠ TWO OR MORE ERRORS — cut from the video per CONTRIBUTING.md:');
    for (const [target, n] of cut) console.log(`   ${target} (${n} errors)`);
  }
  if (failed.length && stderrLines.length) {
    console.log('\nServer stderr (last 20 lines):');
    console.log(stderrLines.join('').split('\n').slice(-20).join('\n'));
  }

  const dir = path.join(ROOT, 'sweeps');
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, `sweep-${started.toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(logFile, JSON.stringify({ startedAt: started.toISOString(), passed: results.length - failed.length, total: results.length, cut: cut.map(([t, n]) => ({ target: t, errors: n })), results }, null, 2));
  console.log(`\nLog: ${path.relative(ROOT, logFile)}`);

  child.kill();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n✗ Sweep aborted: ${err.message}`);
  if (stderrLines.length) console.error(stderrLines.join('').split('\n').slice(-20).join('\n'));
  child.kill();
  process.exit(2);
});
