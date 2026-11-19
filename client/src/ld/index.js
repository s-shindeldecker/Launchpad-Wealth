// LaunchDarkly integration seam. THURSDAY: no SDK — these are stubs with the exact shape
// Friday's code will have, so screens don't change when the SDK goes in.
//
// Context rules (CLAUDE.md):
//  - App load: anonymous `device` context. On Friday the JS client SDK generates and
//    persists the key in localStorage (stand-in for the mobile SDK's on-device key).
//  - After signup: identify() with a multi-context = same device + { kind: 'user', key }.
//    The device key never changes within a session.
//  - RANDOMIZATION UNIT = device. Onboarding starts before a user exists, so a user-keyed
//    experiment would have no unit to bucket on screens 1–2 and would re-bucket at signup.
//  - `onboarding-deposit-prompt` is evaluated ONLY in evaluateDepositPrompt(), called once
//    when screen 6 renders. Never at init, never via allFlags().

const PLATFORM_KEY = 'demo.platform';
const STUB_DEVICE_KEY = 'demo.stubDeviceKey';

// Fallback value = control variation (what users get if LD is unreachable).
export const DEPOSIT_PROMPT_DEFAULT = {
  headline: 'Make your first deposit',
  amounts: [10, 25, 50],
  framing: 'start-small',
};

function safeGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k, v) {
  try { localStorage.setItem(k, v); } catch { /* private mode: fine */ }
}

// Platform is randomized once per device and kept, like a real device would be.
function devicePlatform() {
  let p = safeGet(PLATFORM_KEY);
  if (p !== 'ios' && p !== 'android') {
    p = Math.random() < 0.5 ? 'ios' : 'android';
    safeSet(PLATFORM_KEY, p);
  }
  return p;
}

let deviceContext = null;
let currentContext = null;

export async function initDevice() {
  // TODO(Fri AM): replace with the LaunchDarkly JS client SDK.
  //   const client = initialize(import.meta.env.VITE_LD_CLIENT_SIDE_ID / LD_CLIENT_SIDE_ID,
  //     { kind: 'device', anonymous: true, platform });   // no key → SDK generates + persists it
  //   await client.waitForInitialization();
  //   do NOT call client.allFlags() here.
  let key = safeGet(STUB_DEVICE_KEY);
  if (!key) {
    key = `stub-${crypto.randomUUID()}`;
    safeSet(STUB_DEVICE_KEY, key);
  }
  deviceContext = { kind: 'device', key, anonymous: true, platform: devicePlatform() };
  currentContext = deviceContext;
  return currentContext;
}

export async function identifyUser(userId) {
  // TODO(Fri AM): await client.identify({ kind: 'multi', device: <same device>, user: { key: userId } })
  const { kind, ...device } = deviceContext;
  currentContext = { kind: 'multi', device, user: { key: userId } };
  return currentContext;
}

// Full context, sent in the body of every server call that can produce a conversion.
// TODO(Fri AM): return client.getContext()
export function getContext() {
  return currentContext;
}

// Screen 6 only. One call = one evaluation = one exposure.
export function evaluateDepositPrompt() {
  // TODO(Fri AM): return client.variation('onboarding-deposit-prompt', DEPOSIT_PROMPT_DEFAULT);
  return { ...DEPOSIT_PROMPT_DEFAULT, variationKey: 'control' };
}

// Kill switch. TODO(Sat/Sun, after Databricks): client.variation('onboarding-deposit-step', true)
export function depositStepEnabled() {
  return true;
}

// Optional client-side funnel events: kyc_started, bank_linked, product_selected.
export function trackFunnel(eventKey, data) {
  // TODO(Fri AM): client.track(eventKey, data)
  if (import.meta.env.DEV) console.debug('[funnel]', eventKey, data ?? '');
}
