// Stand-in for the customer's backend. Owns signup, KYC, bank link, deposit confirmation.
//
// KYC, bank link and deposit logic are still stubs (fixed / simulated responses).
//
// Attribution rule (CLAUDE.md): every call that can produce a conversion carries the
// client's full LaunchDarkly context in the request body as `context`. The server calls
// ldClient.track(...) against THAT context, passed through unchanged — never against a
// context it builds itself from userId. That is the attribution fix this demo exists to
// show: the conversion lands on the same device the client was exposed under.
//
// The server NEVER evaluates `onboarding-deposit-prompt` (or any flag): there is no
// variation() call in this file, so the server SDK sends no evaluation events. If the
// server needs the variation, the client sends it in the body (`variation`).

import express from 'express';
import { randomUUID } from 'node:crypto';
import * as ld from '@launchdarkly/node-server-sdk';

const PORT = Number(process.env.SERVER_PORT || 4100);
const KYC_DELAY_MS = Number(process.env.KYC_DELAY_MS ?? 1500);
const KYC_OUTCOMES = new Set(['pass', 'fail', 'review']);

// LaunchDarkly Node server SDK — used ONLY for track(). Without LD_SDK_KEY the server
// still runs (conversions are logged as untracked) so the flow works offline.
let ldClient = null;
if (process.env.LD_SDK_KEY) {
  ldClient = ld.init(process.env.LD_SDK_KEY, {
    logger: ld.basicLogger({ level: process.env.LD_LOG_LEVEL || 'warn' }),
  });
  ldClient
    .waitForInitialization({ timeout: 10 })
    .then(() => console.log('[ld] server SDK initialized'))
    .catch((err) => console.warn('[ld] server SDK did not initialize:', err.message));
} else {
  console.warn('[ld] LD_SDK_KEY not set — conversions will NOT be tracked');
}

// Track a conversion against the context the CLIENT sent, unchanged.
function trackConversion(eventKey, ctx, data, metricValue) {
  const { device, user } = keysOf(ctx);
  if (!ldClient) {
    console.warn(`[ld] NOT tracked ${eventKey} device=${device} (no LD_SDK_KEY)`);
    return;
  }
  ldClient.track(eventKey, ctx, data, metricValue);
  console.log(
    `[ld] track ${eventKey} device=${device} user=${user ?? '-'}` +
      (metricValue !== undefined ? ` metricValue=${metricValue}` : ''),
  );
}

// Flush queued events before exit so a restart doesn't drop the last conversions.
async function shutdown() {
  if (ldClient) {
    await ldClient.flush().catch(() => {});
    ldClient.close();
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const app = express();
app.use(express.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function keysOf(ctx) {
  if (ctx?.kind === 'multi') return { device: ctx.device?.key, user: ctx.user?.key };
  if (ctx?.kind === 'device') return { device: ctx.key };
  if (ctx?.kind === 'user') return { user: ctx.key };
  return {};
}

// The context must come from the client and must contain the device (the experiment's
// randomization unit). If it's missing or has no device key the request is rejected:
// there is deliberately NO fallback to a context built from userId — that is exactly the
// broken attribution this demo is about. Nothing is tracked for a rejected request.
function requireContext(req, res) {
  const ctx = req.body?.context;
  const reason =
    !ctx || typeof ctx !== 'object' ? 'no context in request body'
    : !ctx.kind ? 'context has no kind'
    : !keysOf(ctx).device ? 'context has no device key'
    : null;
  if (reason) {
    console.warn(`[${req.path.slice(1)}] rejected, NOT tracked: ${reason}`);
    res.status(400).json({ error: `invalid LaunchDarkly context: ${reason}` });
    return null;
  }
  return ctx;
}

function logCall(route, ctx, extra = {}) {
  const { device, user } = keysOf(ctx);
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
    // Conversion `account_created` — on the CLIENT's context, as received.
    trackConversion('account_created', ctx);
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

  // Conversion `deposit_confirmed`, metricValue = amount — on the CLIENT's context, as
  // received. One event feeds both LD metrics (conversion: did they deposit; numeric: amount).
  trackConversion('deposit_confirmed', ctx, { productId, variation }, amount);
  // TODO(Sat/Sun): if DATABRICKS_ENABLED, append conversion row to `onboarding_events`.

  res.json({ confirmed: true, depositId: `dep_${randomUUID()}`, amount });
});

// TODO(Sat/Sun): POST /exposure — client relays its screen-6 exposure here so the server
// can write it to Databricks. Writes a row only; never evaluates the flag.

app.use('/api', api);

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
