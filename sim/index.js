// Traffic simulator — synthetic devices walking the real onboarding API.
//
// Each device behaves like the client app:
//   - device context { kind: 'device', key, anonymous: true, platform } (+ simulated: true)
//   - after signup, the multi-context the client identify()s with: same device + user
//   - every server call carries that context in the body, same request shapes as
//     client/src/api.js, so conversions go through the server's real track() path
//   - the client's funnel events (kyc_started, bank_linked, product_selected) are tracked
//     via this process's SDK at the same points, on the same multi-context
//   - only devices that reach the deposit screen evaluate `onboarding-deposit-prompt`,
//     once, with the multi-context (randomization unit = device; onboarding starts before
//     a user exists). The variation name comes from the JSON value's `variation` field.
//
// This process has its OWN LaunchDarkly server SDK instance (stand-in for the mobile SDK
// evaluating on-device). server/ never evaluates the flag.
//
// Safe to stop and restart: every device gets a fresh random key and is walked exactly
// once, so a restart never re-evaluates (re-exposes) an existing device. A device that is
// mid-walk when the sim stops simply drops off, like a real user closing the app.
//
// Usage:  npm run sim                      # loop, 3 devices/min (SIM_RATE or --rate N)
//         npm run sim -- --once --count 20 # one burst, then exit

import * as ld from '@launchdarkly/node-server-sdk';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- config ----------
const args = parseArgs(process.argv.slice(2));
const ONCE = Boolean(args.once);
const COUNT = Number(args.count ?? 20);
const RATE = Number(args.rate ?? process.env.SIM_RATE ?? 3); // devices per minute (loop)
const SERVER = String(
  args.server ?? process.env.SIM_SERVER_URL ?? `http://localhost:${process.env.SERVER_PORT || 4100}`,
);
const FLAG = 'onboarding-deposit-prompt';
// Code default = control copy with no `variation` field, exactly like the client.
const FLAG_DEFAULT = { headline: 'Make your first deposit', amounts: [10, 25, 50], framing: 'start-small' };

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(
  fs.readFileSync(path.resolve(repoRoot, process.env.BRAND_FILE || 'brand.json'), 'utf8'),
);
const PRODUCT_IDS = brand.products.map((p) => p.id);
const PRODUCT_WEIGHTS = [40, 25, 15, 15, 5]; // easy access is the common first product
const BANK_IDS = brand.banks.map((b) => b.id);

// ---------- behaviour model ----------
// Share of devices that continue past each step.
const STEP = {
  welcome: 0.85, // Welcome → create account (signup)
  kycSubmit: 0.9, // KYC screen → submits identity details
  bankLink: 0.85, // KYC pass → links a bank
  product: 0.95, // bank linked → chooses product → deposit screen renders (exposure)
};
const KYC = { fail: 0.08, review: 0.04 }; // else pass; only pass → account_created

// Per-arm deposit behaviour on screen 6. `amounts` mirror the flag's suggested amounts.
const ARMS = {
  control: {
    depositRate: 0.4,
    chipShare: 0.8,
    chips: [[10, 25], [25, 45], [50, 30]], // [amount, weight]
    customMedian: 40,
    whaleRate: 0.005,
  },
  'earn-first': {
    depositRate: 0.46, // modest lift
    chipShare: 0.6,
    chips: [[100, 55], [500, 30], [1000, 15]], // larger lift in amount
    customMedian: 80, // some people go smaller when the suggestions feel big
    whaleRate: 0.01,
  },
};
const WHALE_MIN = 5000;
const WHALE_MAX = 20000;

// ---------- random helpers ----------
const chance = (p) => Math.random() < p;
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
}
function normal() {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(300 + Math.random() * 1200); // time spent on a screen

function depositAmount(arm) {
  if (chance(arm.whaleRate)) {
    const v = Math.exp(Math.log(WHALE_MIN) + Math.random() * Math.log(WHALE_MAX / WHALE_MIN));
    return Math.round(v / 100) * 100;
  }
  if (chance(arm.chipShare)) return weighted(arm.chips);
  const custom = arm.customMedian * Math.exp(0.8 * normal()); // lognormal
  return Math.max(5, Math.round(custom / 5) * 5);
}

// ---------- API (same shapes as client/src/api.js) ----------
async function post(route, body, context) {
  const res = await fetch(`${SERVER}/api${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, context }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${route} → HTTP ${res.status} ${data.error ?? ''}`.trim());
  return data;
}

const FIRST = ['Alex', 'Sam', 'Jordan', 'Priya', 'Tom', 'Aisha', 'Chris', 'Mei', 'Owen', 'Zara'];
const LAST = ['Taylor', 'Patel', 'Jones', 'Okafor', 'Smith', 'Nguyen', 'Brown', 'Khan', 'Evans'];
function identity() {
  const year = 1960 + Math.floor(Math.random() * 45);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  return {
    name: `${pick(FIRST)} ${pick(LAST)}`, // never contains the "fail"/"review" test words
    dob: `${year}-${month}-15`,
    postcode: pick(['SW1A 1AA', 'M1 1AE', 'B33 8TH', 'LS1 4DY', 'EH1 1YZ']),
  };
}

// ---------- one device ----------
async function runDevice(ldClient) {
  const platform = chance(0.5) ? 'ios' : 'android';
  // The client's load-time context, plus the simulated tag.
  const device = { kind: 'device', key: randomUUID(), anonymous: true, platform, simulated: true };
  const r = { key: device.key, platform, reached: 'welcome', variation: '-', outcome: '' };
  let step = 'signup';
  try {
    await think();
    if (!chance(STEP.welcome)) return { ...r, outcome: 'dropped at welcome' };

    // Screen 2: signup carries the anonymous device context (no user yet).
    const { userId } = await post('/signup', { email: `sim+${device.key.slice(0, 8)}@example.com` }, device);
    r.reached = 'kyc';
    // Exactly what the client identify()s with: same device (minus `kind`) + user.
    const { kind: _kind, ...deviceAttrs } = device;
    const context = { kind: 'multi', device: deviceAttrs, user: { key: userId, simulated: true } };

    await think();
    if (!chance(STEP.kycSubmit)) return { ...r, outcome: 'dropped at kyc form' };
    step = 'kyc';
    ldClient.track('kyc_started', context); // client: on KYC submit, before POST /kyc
    const roll = Math.random();
    const kycOutcome = roll < KYC.fail ? 'fail' : roll < KYC.fail + KYC.review ? 'review' : 'pass';
    const { status } = await post('/kyc', { userId, details: identity(), simulateOutcome: kycOutcome }, context);
    if (status !== 'pass') return { ...r, outcome: `kyc ${status}` };
    r.reached = 'bank-link';

    await think();
    if (!chance(STEP.bankLink)) return { ...r, outcome: 'dropped at bank link' };
    step = 'bank-link';
    const bankId = pick(BANK_IDS);
    await post('/bank-link', { userId, bankId }, context);
    ldClient.track('bank_linked', context, { bankId }); // client: after link succeeds
    r.reached = 'product';

    await think();
    if (!chance(STEP.product)) return { ...r, outcome: 'dropped at product' };
    const productId = weighted(PRODUCT_IDS.map((id, i) => [id, PRODUCT_WEIGHTS[i] ?? 1]));
    ldClient.track('product_selected', context, { productId }); // client: on Continue
    r.reached = 'deposit';

    // Screen 6 renders → the ONE evaluation (exposure) for this device.
    step = 'evaluate';
    const value = await ldClient.variation(FLAG, context, FLAG_DEFAULT);
    const variation = typeof value?.variation === 'string' ? value.variation : 'unknown';
    r.variation = variation;
    const arm = ARMS[variation] ?? ARMS.control; // 'unknown' behaves like control

    await think();
    if (!chance(arm.depositRate)) return { ...r, outcome: 'skipped deposit' };
    step = 'deposit';
    const amount = depositAmount(arm);
    await post('/deposit', { userId, amount, productId, variation }, context);
    return { ...r, outcome: `deposited £${amount.toLocaleString('en-GB')}` };
  } catch (err) {
    return { ...r, outcome: `error at ${step}: ${err.message}` };
  }
}

function logDevice(r) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(
    `[sim ${ts}] device=${r.key} ${r.platform.padEnd(7)} reached=${r.reached.padEnd(9)} ` +
      `variation=${r.variation.padEnd(10)} ${r.outcome}`,
  );
}

// ---------- main ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

async function main() {
  if (!process.env.LD_SDK_KEY) {
    console.error('[sim] LD_SDK_KEY is not set in .env');
    process.exit(1);
  }
  const health = await fetch(`${SERVER}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`[sim] server not reachable at ${SERVER} — start it with npm run dev`);
    process.exit(1);
  }

  const ldClient = ld.init(process.env.LD_SDK_KEY, {
    logger: ld.basicLogger({ level: process.env.LD_LOG_LEVEL || 'warn' }),
  });
  try {
    await ldClient.waitForInitialization({ timeout: 10 });
  } catch (err) {
    console.error('[sim] LaunchDarkly SDK did not initialize:', err.message);
    process.exit(1);
  }

  const inFlight = new Set();
  const tally = {};
  const launch = () => {
    const p = runDevice(ldClient).then((r) => {
      logDevice(r);
      const k = r.outcome.startsWith('deposited') ? 'deposited' : r.outcome;
      tally[k] = (tally[k] ?? 0) + 1;
      inFlight.delete(p);
    });
    inFlight.add(p);
  };

  let stopping = false;
  async function finish(code = 0) {
    stopping = true;
    await Promise.race([Promise.all(inFlight), sleep(15000)]); // let in-flight devices end
    await ldClient.flush().catch((err) => console.warn('[sim] flush failed:', err.message));
    ldClient.close();
    console.log('[sim] summary', tally);
    process.exit(code);
  }
  process.on('SIGINT', () => (stopping ? process.exit(130) : finish(0)));
  process.on('SIGTERM', () => finish(0));

  if (ONCE) {
    console.log(`[sim] burst of ${COUNT} devices → ${SERVER}`);
    for (let i = 0; i < COUNT && !stopping; i++) {
      launch();
      await sleep(250);
    }
    await finish(0);
    return;
  }

  const meanGapMs = 60000 / RATE;
  console.log(`[sim] loop: ${RATE} devices/min → ${SERVER} (Ctrl-C to stop)`);
  while (!stopping) {
    launch();
    await sleep(meanGapMs * (0.5 + Math.random())); // jittered arrivals, same average rate
  }
}

main();
