// Stand-in for the customer's backend. Owns signup, KYC, bank link, deposit confirmation.
//
// THURSDAY SCOPE: stubbed fixed responses, no LaunchDarkly.
//
// Attribution rule (CLAUDE.md): every call that can produce a conversion carries the
// client's full LaunchDarkly context in the request body as `context`. On Friday the
// server will call ldClient.track(...) against THAT context — never against a context it
// builds itself from userId. That is the attribution fix this demo exists to show.
//
// The server NEVER evaluates `onboarding-deposit-prompt`. If it needs the variation,
// the client sends it in the body (`variation`).

import express from 'express';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.SERVER_PORT || 4100);
const KYC_DELAY_MS = Number(process.env.KYC_DELAY_MS ?? 1500);
const KYC_OUTCOMES = new Set(['pass', 'fail', 'review']);

// TODO(Fri PM): initialise the LaunchDarkly Node server SDK here.
//   import * as ld from '@launchdarkly/node-server-sdk';
//   const ldClient = ld.init(process.env.LD_SDK_KEY);
//   await ldClient.waitForInitialization({ timeout: 10 });

const app = express();
app.use(express.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireContext(req, res) {
  const ctx = req.body?.context;
  if (!ctx || typeof ctx !== 'object' || !ctx.kind) {
    res.status(400).json({ error: 'missing LaunchDarkly context in request body' });
    return null;
  }
  return ctx;
}

function logCall(route, ctx, extra = {}) {
  const device = ctx.kind === 'multi' ? ctx.device?.key : ctx.key;
  const user = ctx.kind === 'multi' ? ctx.user?.key : undefined;
  console.log(`[${route}] device=${device} user=${user ?? '-'}`, extra);
}

const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true }));

// Screen 2 → returns userId. Client then identify()s with device + user multi-context.
api.post('/signup', (req, res) => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const userId = `usr_${randomUUID()}`;
  logCall('signup', ctx, { email });
  res.json({ userId });
});

// Sandbox test identities, the way real KYC providers do it: a deterministic outcome
// from what's typed in the form, so a presenter can trigger branches from the UI.
// Full legal name containing the word "fail" → fail, "review" → manual review.
// (e.g. "Alex Fail", "Sam Review"). Case-insensitive. See CLAUDE.md "Testing the flow".
function outcomeFromDetails(details = {}) {
  const name = String(details.name ?? '').toLowerCase();
  if (/\bfail\b/.test(name)) return 'fail';
  if (/\breview\b/.test(name)) return 'review';
  return null;
}

// Screen 3 → simulated async KYC. Outcome precedence:
//   1. `simulateOutcome` in the body (simulator, or ?kyc=fail|review in the client URL)
//   2. test-identity name in `details` (typed on the KYC screen)
//   3. pass
api.post('/kyc', async (req, res) => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const requested = req.body.simulateOutcome;
  const outcome = KYC_OUTCOMES.has(requested)
    ? requested
    : outcomeFromDetails(req.body.details) ?? 'pass';
  await sleep(KYC_DELAY_MS);
  logCall('kyc', ctx, { outcome });

  if (outcome === 'pass') {
    // TODO(Fri PM): conversion `account_created` — track on the CLIENT's context.
    //   ldClient.track('account_created', ctx);
  }
  res.json({ status: outcome });
});

// Screen 4 → simulated Open Banking consent.
api.post('/bank-link', (req, res) => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const { bankId } = req.body;
  logCall('bank-link', ctx, { bankId });
  res.json({ linked: true, bankId, accountMask: '••••4821' });
});

// Screen 6 → deposit confirmation. `variation` comes from the client; the server does
// not evaluate the experiment flag.
api.post('/deposit', (req, res) => {
  const ctx = requireContext(req, res);
  if (!ctx) return;
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const { productId, variation } = req.body;
  logCall('deposit', ctx, { amount, productId, variation });

  // TODO(Fri PM): conversion `deposit_confirmed` with metricValue = amount, on the CLIENT's context.
  //   ldClient.track('deposit_confirmed', ctx, { productId, variation }, amount);
  // TODO(Sat/Sun): if DATABRICKS_ENABLED, append conversion row to `onboarding_events`.

  res.json({ confirmed: true, depositId: `dep_${randomUUID()}`, amount });
});

// TODO(Sat/Sun): POST /exposure — client relays its screen-6 exposure here so the server
// can write it to Databricks. Writes a row only; never evaluates the flag.

app.use('/api', api);

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
