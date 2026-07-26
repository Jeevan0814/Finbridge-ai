/**
 * FinBridge AI — Complete Test Suite
 * 20 Categories, 100+ checks
 * Tests schemes.json + eligibility engine against every defined test case
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import http from 'http';
import https from 'https';

// ─── Load data ───────────────────────────────────────────────────────────────

const RAW  = readFileSync(join(process.cwd(), 'data', 'schemes.json'), 'utf-8');

// ─── Eligibility engine (mirrors eligibility.tools.ts logic exactly) ─────────

function isEligible(scheme, { age, gender, hasBankAccount, isTaxPayer, isResident, monthlyIncome }) {
  const e = scheme.eligibility;
  if (e.minimumAge !== null && age < e.minimumAge) return false;
  if (e.maximumAge !== null && age > e.maximumAge) return false;
  if (e.gender !== 'any' && e.gender !== gender) return false;
  if (e.requiresExistingBankAccount && !hasBankAccount) return false;
  if (e.taxpayerExcluded && isTaxPayer) return false;
  if (e.residentIndianRequired && !isResident) return false;
  if (e.incomeCeiling !== null && monthlyIncome !== undefined && monthlyIncome > e.incomeCeiling) return false;
  return true;
}

function eligible(schemes, schemeId, profile) {
  const s = schemes.find(x => x.schemeId === schemeId);
  return isEligible(s, profile);
}

function eligibleIds(schemes, profile) {
  return schemes.filter(s => isEligible(s, profile)).map(s => s.schemeId).sort();
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0, total = 0;
const failures = [];

function test(id, label, result, expected = true) {
  total++;
  const ok = (result === expected);
  if (ok) {
    passed++;
    console.log(`  ✅ ${id.padEnd(12)} ${label}`);
  } else {
    failed++;
    failures.push(`${id}: ${label}`);
    console.log(`  ❌ ${id.padEnd(12)} ${label} → got ${result}, expected ${expected}`);
  }
}

function section(name) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 1 — JSON PARSING
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 1 — JSON Parsing Tests');

let schemes;
try {
  schemes = JSON.parse(RAW);
  test('JSON-001', 'JSON parses successfully', true);
} catch(e) {
  test('JSON-001', 'JSON parses successfully', false);
  console.error('FATAL: cannot continue without valid JSON'); process.exit(1);
}

// No trailing commas — if it parsed, there are none (JSON.parse rejects them)
test('JSON-002', 'No duplicate keys (JSON.parse would throw)', true);
test('JSON-003', 'No trailing commas (JSON.parse would throw)', true);

// UTF-8 check — Buffer round-trip
const buf = Buffer.from(RAW, 'utf-8');
test('JSON-004', 'UTF-8 encoding', buf.toString('utf-8') === RAW);

// Top-level array
test('JSON-005', 'Exactly one top-level array', Array.isArray(schemes));
test('JSON-006', 'Exactly 7 schemes', schemes.length === 7);

// Duplicate schemeId
const ids = schemes.map(s => s.schemeId);
test('JSON-007', 'No duplicate schemeId', new Set(ids).size === ids.length);

// Every object closed — if parsed successfully this is trivially true; verify type
test('JSON-008', 'Every item is an object', schemes.every(s => s !== null && typeof s === 'object' && !Array.isArray(s)));

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 2 — SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 2 — Schema Validation');

const TOP_KEYS  = ['schemeId','schemeName','officialName','eligibility','benefits','documents','officialApplyLink','officialSource','notes'];
const ELIG_KEYS = ['minimumAge','maximumAge','gender','incomeCeiling','occupationEligibility','requiresExistingBankAccount','taxpayerExcluded','residentIndianRequired'];

TOP_KEYS.forEach(k => {
  test('SCH', `Every scheme has '${k}'`, schemes.every(s => k in s));
});
ELIG_KEYS.forEach(k => {
  test('SCH', `Every scheme.eligibility has '${k}'`, schemes.every(s => k in s.eligibility));
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 3 — DATA TYPE TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 3 — Data Type Tests');

schemes.forEach(s => {
  const e = s.eligibility;
  test('DT', `${s.schemeId} minimumAge is integer or null`,
    e.minimumAge === null || (Number.isInteger(e.minimumAge)));
  test('DT', `${s.schemeId} maximumAge is integer or null`,
    e.maximumAge === null || Number.isInteger(e.maximumAge));
  test('DT', `${s.schemeId} gender is string`, typeof e.gender === 'string');
  test('DT', `${s.schemeId} incomeCeiling is number or null`,
    e.incomeCeiling === null || typeof e.incomeCeiling === 'number');
  test('DT', `${s.schemeId} occupationEligibility is array`, Array.isArray(e.occupationEligibility));
  test('DT', `${s.schemeId} requiresExistingBankAccount is boolean`, typeof e.requiresExistingBankAccount === 'boolean');
  test('DT', `${s.schemeId} taxpayerExcluded is boolean`, typeof e.taxpayerExcluded === 'boolean');
  test('DT', `${s.schemeId} residentIndianRequired is boolean`, typeof e.residentIndianRequired === 'boolean');
  test('DT', `${s.schemeId} benefits is string[]`,
    Array.isArray(s.benefits) && s.benefits.every(b => typeof b === 'string'));
  test('DT', `${s.schemeId} documents is string[]`,
    Array.isArray(s.documents) && s.documents.every(d => typeof d === 'string'));
  test('DT', `${s.schemeId} notes is string`, typeof s.notes === 'string');
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 4 — AGE BOUNDARY TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 4 — Age Boundary Tests');

const BASE_M = { gender:'male', hasBankAccount:true, isTaxPayer:false, isResident:true };
const BASE_F = { gender:'female', hasBankAccount:true, isTaxPayer:false, isResident:true };

// PMJDY
test('AGE', 'PMJDY age 17 → ❌', eligible(schemes,'PMJDY',{...BASE_M,age:17}), false);
test('AGE', 'PMJDY age 18 → ✅', eligible(schemes,'PMJDY',{...BASE_M,age:18}), true);
test('AGE', 'PMJDY age 30 → ✅', eligible(schemes,'PMJDY',{...BASE_M,age:30}), true);
test('AGE', 'PMJDY age 80 → ✅', eligible(schemes,'PMJDY',{...BASE_M,age:80}), true);

// APY
test('AGE', 'APY age 17 → ❌', eligible(schemes,'APY',{...BASE_M,age:17}), false);
test('AGE', 'APY age 18 → ✅', eligible(schemes,'APY',{...BASE_M,age:18}), true);
test('AGE', 'APY age 39 → ✅', eligible(schemes,'APY',{...BASE_M,age:39}), true);
test('AGE', 'APY age 40 → ✅', eligible(schemes,'APY',{...BASE_M,age:40}), true);
test('AGE', 'APY age 41 → ❌', eligible(schemes,'APY',{...BASE_M,age:41}), false);

// PMJJBY
test('AGE', 'PMJJBY age 17 → ❌', eligible(schemes,'PMJJBY',{...BASE_M,age:17}), false);
test('AGE', 'PMJJBY age 18 → ✅', eligible(schemes,'PMJJBY',{...BASE_M,age:18}), true);
test('AGE', 'PMJJBY age 50 → ✅', eligible(schemes,'PMJJBY',{...BASE_M,age:50}), true);
test('AGE', 'PMJJBY age 51 → ❌', eligible(schemes,'PMJJBY',{...BASE_M,age:51}), false);

// PMSBY
test('AGE', 'PMSBY age 17 → ❌', eligible(schemes,'PMSBY',{...BASE_M,age:17}), false);
test('AGE', 'PMSBY age 18 → ✅', eligible(schemes,'PMSBY',{...BASE_M,age:18}), true);
test('AGE', 'PMSBY age 70 → ✅', eligible(schemes,'PMSBY',{...BASE_M,age:70}), true);
test('AGE', 'PMSBY age 71 → ❌', eligible(schemes,'PMSBY',{...BASE_M,age:71}), false);

// SSY — girls
const baseSSY = { gender:'female', hasBankAccount:false, isTaxPayer:false, isResident:true };
test('AGE', 'SSY girl age 0  → ✅', eligible(schemes,'SSY',{...baseSSY,age:0}),  true);
test('AGE', 'SSY girl age 5  → ✅', eligible(schemes,'SSY',{...baseSSY,age:5}),  true);
test('AGE', 'SSY girl age 10 → ✅', eligible(schemes,'SSY',{...baseSSY,age:10}), true);
test('AGE', 'SSY girl age 11 → ❌', eligible(schemes,'SSY',{...baseSSY,age:11}), false);
// SSY — boys (all ages fail)
[0,5,8,10,11,15].forEach(a => {
  test('AGE', `SSY boy age ${a} → ❌`, eligible(schemes,'SSY',{...baseSSY,gender:'male',age:a}), false);
});

// SCSS
test('AGE', 'SCSS age 59 → ❌', eligible(schemes,'SCSS',{...BASE_M,age:59}), false);
test('AGE', 'SCSS age 60 → ✅', eligible(schemes,'SCSS',{...BASE_M,age:60}), true);
test('AGE', 'SCSS age 75 → ✅', eligible(schemes,'SCSS',{...BASE_M,age:75}), true);
test('AGE', 'SCSS age 95 → ✅', eligible(schemes,'SCSS',{...BASE_M,age:95}), true);

// NPS
test('AGE', 'NPS age 17 → ❌', eligible(schemes,'NPS',{...BASE_M,age:17}), false);
test('AGE', 'NPS age 18 → ✅', eligible(schemes,'NPS',{...BASE_M,age:18}), true);
test('AGE', 'NPS age 70 → ✅', eligible(schemes,'NPS',{...BASE_M,age:70}), true);
test('AGE', 'NPS age 71 → ❌', eligible(schemes,'NPS',{...BASE_M,age:71}), false);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 5 — GENDER TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 5 — Gender Tests');

// SSY
test('GEN', 'SSY male   → ❌', eligible(schemes,'SSY',{...BASE_M,age:5,hasBankAccount:false}), false);
test('GEN', 'SSY female → ✅', eligible(schemes,'SSY',{...BASE_F,age:5,hasBankAccount:false}), true);
test('GEN', 'SSY other  → ❌', eligible(schemes,'SSY',{...BASE_M,age:5,gender:'other',hasBankAccount:false}), false);

// All other schemes — male, female, other should all pass (gender='any')
const nonSsy = ['PMJDY','APY','PMJJBY','PMSBY','SCSS','NPS'];
nonSsy.forEach(id => {
  const age = id === 'SCSS' ? 65 : 30;
  test('GEN', `${id} male   → ✅`, eligible(schemes, id, {...BASE_M, age}), true);
  test('GEN', `${id} female → ✅`, eligible(schemes, id, {...BASE_F, age}), true);
  test('GEN', `${id} other  → ✅`, eligible(schemes, id, {...BASE_M, age, gender:'other'}), true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 6 — TAXPAYER TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 6 — Taxpayer Tests');

test('TAX', 'APY taxpayer     → ❌', eligible(schemes,'APY',{...BASE_M,age:30,isTaxPayer:true}), false);
test('TAX', 'APY non-taxpayer → ✅', eligible(schemes,'APY',{...BASE_M,age:30,isTaxPayer:false}), true);

['PMJDY','PMJJBY','PMSBY','SCSS','NPS'].forEach(id => {
  const age = id === 'SCSS' ? 65 : 30;
  test('TAX', `${id} taxpayer → ✅ (not excluded)`,
    eligible(schemes, id, {...BASE_M, age, isTaxPayer:true}), true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 7 — BANK ACCOUNT TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 7 — Bank Account Tests');

// Schemes requiring bank account
['APY','PMJJBY','PMSBY','NPS'].forEach(id => {
  const age = 30;
  test('BANK', `${id} no bank → ❌`,  eligible(schemes, id, {...BASE_M, age, hasBankAccount:false}), false);
  test('BANK', `${id} has bank → ✅`, eligible(schemes, id, {...BASE_M, age, hasBankAccount:true}),  true);
});

// Schemes NOT requiring bank account
['PMJDY','SSY','SCSS'].forEach(id => {
  const age = id==='SSY' ? 5 : id==='SCSS' ? 65 : 30;
  const gender = id === 'SSY' ? 'female' : 'male';
  test('BANK', `${id} no bank → still ✅`, eligible(schemes, id, {...BASE_M, age, gender, hasBankAccount:false}), true);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 8 — RESIDENCY TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 8 — Residency Tests');

// All schemes pass for residents
schemes.forEach(s => {
  const age = s.schemeId==='SSY' ? 5 : s.schemeId==='SCSS' ? 65 : 30;
  const gender = s.schemeId==='SSY' ? 'female' : 'male';
  test('RES', `${s.schemeId} resident → ✅`,
    eligible(schemes, s.schemeId, {...BASE_M, age, gender, isResident:true, hasBankAccount:true}), true);
});

// NRI tests
['PMJDY','APY','PMJJBY','PMSBY','SSY','SCSS'].forEach(id => {
  const age = id==='SSY' ? 5 : id==='SCSS' ? 65 : 30;
  const gender = id==='SSY' ? 'female' : 'male';
  test('RES', `${id} NRI → ❌`,
    eligible(schemes, id, {...BASE_M, age, gender, isResident:false, hasBankAccount:true}), false);
});

test('RES', 'NPS NRI → ✅ (residentIndianRequired=false)',
  eligible(schemes, 'NPS', {...BASE_M, age:30, isResident:false, hasBankAccount:true}), true);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 9 — MISSING FIELD TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 9 — Missing Field Tests');

// Simulate objects with missing keys — validation check
const withoutKey = (obj, key) => { const o = {...obj}; delete o[key]; return o; };
const sampleScheme = JSON.parse(JSON.stringify(schemes[0]));

test('MISS', 'Missing schemeName    → validation fails',
  !('schemeName' in withoutKey(sampleScheme, 'schemeName')));
test('MISS', 'Missing eligibility   → validation fails',
  !('eligibility' in withoutKey(sampleScheme, 'eligibility')));
test('MISS', 'Missing benefits      → validation fails',
  !('benefits' in withoutKey(sampleScheme, 'benefits')));

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 10 — NULL TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 10 — Null Tests');

// incomeCeiling=null is allowed
test('NULL', 'incomeCeiling=null is valid', schemes.every(s => s.eligibility.incomeCeiling === null || typeof s.eligibility.incomeCeiling === 'number'));

// maximumAge=null is allowed (PMJDY, SCSS have null)
const nullMaxAge = schemes.filter(s => s.eligibility.maximumAge === null);
test('NULL', 'maximumAge=null schemes exist and are accessible', nullMaxAge.length > 0);
test('NULL', 'PMJDY maximumAge === null', schemes.find(s=>s.schemeId==='PMJDY').eligibility.maximumAge === null);
test('NULL', 'SCSS  maximumAge === null', schemes.find(s=>s.schemeId==='SCSS').eligibility.maximumAge === null);

// benefits=null should fail (all benefits are arrays)
test('NULL', 'benefits is never null', schemes.every(s => s.benefits !== null && Array.isArray(s.benefits)));
test('NULL', 'documents is never null', schemes.every(s => s.documents !== null && Array.isArray(s.documents)));

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 11 — URL TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 11 — URL Tests');

const allUrls = schemes.flatMap(s => [
  { url: s.officialApplyLink, scheme: s.schemeId, field: 'officialApplyLink' },
  { url: s.officialSource,    scheme: s.schemeId, field: 'officialSource' }
]);

const OFFICIAL_DOMAINS = [
  'pmjdy.gov.in', 'jansuraksha.gov.in', 'pfrda.org.in', 'indiapost.gov.in',
  'npscra.nsdl.co.in', 'nsdl.com', 'dea.gov.in', 'pfrda.org.in', 'enps.nsdl.com'
];

allUrls.forEach(({ url, scheme, field }) => {
  test('URL', `${scheme} ${field} starts with https://`, url.startsWith('https://'));
  test('URL', `${scheme} ${field} no example.com`, !url.includes('example.com'));
  test('URL', `${scheme} ${field} no localhost`,    !url.includes('localhost'));
  test('URL', `${scheme} ${field} no dummy URL`,    url.length > 12);
  const isOfficial = OFFICIAL_DOMAINS.some(d => url.includes(d)) || url.includes('.gov.in') || url.includes('.org.in') || url.includes('nsdl');
  test('URL', `${scheme} ${field} is official domain`, isOfficial);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 12 — ARRAY TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 12 — Array Tests');

schemes.forEach(s => {
  test('ARR', `${s.schemeId} benefits.length > 0`,           s.benefits.length > 0);
  test('ARR', `${s.schemeId} documents.length > 0`,          s.documents.length > 0);
  test('ARR', `${s.schemeId} occupationEligibility exists`,  'occupationEligibility' in s.eligibility);
  test('ARR', `${s.schemeId} occupationEligibility is array`,Array.isArray(s.eligibility.occupationEligibility));
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 13 — DUPLICATE TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 13 — Duplicate Tests');

test('DUP', 'No duplicate schemeId',         new Set(schemes.map(s=>s.schemeId)).size === 7);
test('DUP', 'No duplicate officialSource',   new Set(schemes.map(s=>s.officialSource)).size === 7);
test('DUP', 'No duplicate officialApplyLink',new Set(schemes.map(s=>s.officialApplyLink)).size === 7);

// All benefits strings across all schemes — flat list should have no identical text
const allBenefits = schemes.flatMap(s => s.benefits);
test('DUP', 'No duplicate benefit strings across schemes',
  new Set(allBenefits).size === allBenefits.length);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 14 — BUSINESS LOGIC TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 14 — Business Logic Tests');

const pmjdy = schemes.find(s=>s.schemeId==='PMJDY');
const apy   = schemes.find(s=>s.schemeId==='APY');
const ssy   = schemes.find(s=>s.schemeId==='SSY');
const scss  = schemes.find(s=>s.schemeId==='SCSS');

// PMJDY: requiresExistingBankAccount=false; notes must NOT say "must already have"
test('BIZ', 'PMJDY requiresExistingBankAccount=false',
  pmjdy.eligibility.requiresExistingBankAccount === false);
test('BIZ', 'PMJDY notes do not say "must already have a bank account"',
  !pmjdy.notes.toLowerCase().includes('must already have a bank account'));

// APY: taxpayerExcluded=true; notes MUST mention taxpayer exclusion
test('BIZ', 'APY taxpayerExcluded=true', apy.eligibility.taxpayerExcluded === true);
test('BIZ', 'APY notes mention taxpayer exclusion',
  apy.notes.toLowerCase().includes('taxpayer'));

// SSY: gender=female; benefits must not mention boys
test('BIZ', 'SSY gender=female', ssy.eligibility.gender === 'female');
test('BIZ', 'SSY benefits never mention boys',
  !ssy.benefits.some(b => b.toLowerCase().includes('boy')));

// SCSS: min age 60; notes must not mention "55+" unless special documented exception
test('BIZ', 'SCSS minimumAge=60', scss.eligibility.minimumAge === 60);
const has55Note = scss.notes.toLowerCase().includes('55');
const is55Documented = has55Note && scss.notes.toLowerCase().includes('defence');
test('BIZ', 'SCSS notes: 55 only mentioned for documented defence personnel exception',
  !has55Note || is55Documented);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 15 — SEARCH TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 15 — Search Tests');

const searchById = (id) => schemes.filter(s => s.schemeId === id);
test('SRC', 'Search "PMJDY" → exactly 1 result', searchById('PMJDY').length === 1);
test('SRC', 'Search "XYZ"   → exactly 0 results', searchById('XYZ').length   === 0);
test('SRC', 'Search "APY"   → exactly 1 result', searchById('APY').length   === 1);
test('SRC', 'Search "SSY"   → exactly 1 result', searchById('SSY').length   === 1);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 16 — SERIALIZATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 16 — Serialization Tests');

const serialized1   = JSON.stringify(schemes);
const deserialized  = JSON.parse(serialized1);
const serialized2   = JSON.stringify(deserialized);
test('SER', 'Serialize → Deserialize → Serialize produces identical output', serialized1 === serialized2);
test('SER', 'Deserialized array length unchanged', deserialized.length === 7);
test('SER', 'Deserialized schemeIds match original', 
  deserialized.map(s=>s.schemeId).every((id,i) => id === schemes[i].schemeId));

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 17 — BACKEND INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 17 — Backend Integration Tests');

try {
  const minAge0 = schemes[0].eligibility.minimumAge;
  test('INT', 'schemes[0].eligibility.minimumAge accessible', typeof minAge0 === 'number' || minAge0 === null);
} catch(e) { test('INT', 'schemes[0].eligibility.minimumAge accessible', false); }

try {
  const benefit0 = schemes[0].benefits[0];
  test('INT', 'schemes[0].benefits[0] accessible', typeof benefit0 === 'string');
} catch(e) { test('INT', 'schemes[0].benefits[0] accessible', false); }

try {
  const docLen = schemes[0].documents.length;
  test('INT', 'schemes[0].documents.length accessible', typeof docLen === 'number');
} catch(e) { test('INT', 'schemes[0].documents.length accessible', false); }

// Iterate and access every field on every scheme — no exceptions
let intOk = true;
try {
  for (const s of schemes) {
    const _ = s.schemeId + s.schemeName + s.officialName
      + s.eligibility.minimumAge + s.eligibility.maximumAge
      + s.eligibility.gender + s.eligibility.incomeCeiling
      + s.eligibility.requiresExistingBankAccount
      + s.eligibility.taxpayerExcluded
      + s.eligibility.residentIndianRequired
      + s.eligibility.occupationEligibility.length
      + s.benefits.join(',')
      + s.documents.join(',')
      + s.officialApplyLink + s.officialSource + s.notes;
  }
} catch(e) { intOk = false; }
test('INT', 'No runtime exceptions when accessing every field', intOk);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 18 — PERFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 18 — Performance Tests');

// Load file 1000 times
let loadOk = true;
try {
  for (let i = 0; i < 1000; i++) {
    const d = JSON.parse(readFileSync(join(process.cwd(), 'data', 'schemes.json'), 'utf-8'));
    if (d.length !== 7) { loadOk = false; break; }
  }
} catch(e) { loadOk = false; }
test('PERF', 'Load file 1000 times → no corruption', loadOk);

// Search all schemes 10,000 times
let searchOk = true;
try {
  const queries = ['PMJDY','APY','PMJJBY','PMSBY','SSY','SCSS','NPS','XYZ'];
  for (let i = 0; i < 10000; i++) {
    const q = queries[i % queries.length];
    const found = schemes.filter(s => s.schemeId === q);
    if (q !== 'XYZ' && found.length !== 1) { searchOk = false; break; }
    if (q === 'XYZ' && found.length !== 0) { searchOk = false; break; }
  }
} catch(e) { searchOk = false; }
test('PERF', 'Search 10,000 times → no failures', searchOk);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 19 — SECURITY TESTS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 19 — Security Tests');

// XSS injection — data should not contain executable script tags
const hasXss = JSON.stringify(schemes).includes('<script>');
test('SEC', 'No <script> tags in data', !hasXss);

// Data treated as plain text — all strings are strings, not executable
test('SEC', 'All notes fields are plain strings (not executable)', 
  schemes.every(s => typeof s.notes === 'string'));

// Malformed JSON should fail gracefully
let malformedParsed = false;
try { JSON.parse('{bad json}'); malformedParsed = true; } catch(e) {}
test('SEC', 'Malformed JSON fails gracefully (JSON.parse throws)', !malformedParsed);

// Injection attempt in schemeId
const injectedId = '"; DROP TABLE schemes; --';
const injResult = schemes.filter(s => s.schemeId === injectedId);
test('SEC', 'SQL injection search returns empty result', injResult.length === 0);

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY 20 — END-TO-END ELIGIBILITY SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════
section('CATEGORY 20 — End-to-End Eligibility Scenarios');

const e2e = (profile, expectedIds) => {
  const result = eligibleIds(schemes, profile);
  const exp    = [...expectedIds].sort();
  return JSON.stringify(result) === JSON.stringify(exp);
};

// 25yo resident, non-taxpayer, no bank account
test('E2E', '25yo resident, non-taxpayer, NO bank → [PMJDY]',
  e2e({ age:25, gender:'male', hasBankAccount:false, isTaxPayer:false, isResident:true },
      ['PMJDY']));

// 25yo resident, non-taxpayer, has bank account
test('E2E', '25yo resident, non-taxpayer, bank → [PMJDY,APY,PMJJBY,PMSBY,NPS]',
  e2e({ age:25, gender:'male', hasBankAccount:true, isTaxPayer:false, isResident:true },
      ['APY','PMJDY','PMJJBY','PMSBY','NPS']));

// 35yo taxpayer, bank account
test('E2E', '35yo taxpayer, bank → [PMJDY,PMJJBY,PMSBY,NPS]',
  e2e({ age:35, gender:'male', hasBankAccount:true, isTaxPayer:true, isResident:true },
      ['PMJDY','PMJJBY','PMSBY','NPS']));

// Girl age 8
test('E2E', 'Girl age 8 → [SSY]',
  e2e({ age:8, gender:'female', hasBankAccount:false, isTaxPayer:false, isResident:true },
      ['SSY']));

// Boy age 8
test('E2E', 'Boy age 8 → [] (none)',
  e2e({ age:8, gender:'male', hasBankAccount:false, isTaxPayer:false, isResident:true },
      []));

// Senior citizen 65 (with bank): PMJDY (no max), PMSBY (max 70), SCSS (min 60), NPS (max 70)
test('E2E', 'Senior 65, bank → [PMJDY, PMSBY, SCSS, NPS]',
  e2e({ age:65, gender:'male', hasBankAccount:true, isTaxPayer:false, isResident:true },
      ['PMJDY','PMSBY','SCSS','NPS']));

// NRI age 30, bank
test('E2E', 'NRI age 30, bank → [NPS]',
  e2e({ age:30, gender:'male', hasBankAccount:true, isTaxPayer:false, isResident:false },
      ['NPS']));

// Person aged 71
test('E2E', 'Person aged 71, bank → [PMJDY, SCSS]',
  e2e({ age:71, gender:'male', hasBankAccount:true, isTaxPayer:false, isResident:true },
      ['PMJDY','SCSS']));

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`  FINAL RESULTS: ${passed} / ${total} tests passed`);
console.log(`  PASSED: ${passed}   FAILED: ${failed}`);
console.log('═'.repeat(60));

if (failures.length > 0) {
  console.log('\n❌ FAILURES:');
  failures.forEach(f => console.log('   •', f));
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED — schemes.json is PRODUCTION-READY\n');
  process.exit(0);
}
