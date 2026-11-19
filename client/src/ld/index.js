// LaunchDarkly client SDK integration — the only module that talks to LaunchDarkly.
//
// Context rules (CLAUDE.md):
//  - App load: anonymous `device` context with NO key. The SDK generates the key and
//    persists it in localStorage (stand-in for the mobile SDK's on-device key), so the
//    same browser is the same device across reloads.
//  - After signup: identify() with a multi-context = same device + { kind: 'user', key }.
//    The device key never changes within a session.
//  - RANDOMIZATION UNIT = device. Onboarding starts before a user exists, so a user-keyed
//    experiment would have no unit to bucket on screens 1–2 and would re-bucket at signup.
//  - `onboarding-deposit-prompt` is evaluated ONLY in evaluateDepositPrompt(), called from
//    the Deposit screen (screen 6). Never at init, never via allFlags(). start() fetches
//    flag values but sends no evaluation events — only a variation call is an exposure.

import { basicLogger, createClient } from '@launchdarkly/js-client-sdk';

const CLIENT_SIDE_ID = import.meta.env.LD_CLIENT_SIDE_ID;
const DEPOSIT_PROMPT_FLAG = 'onboarding-deposit-prompt';
const PLATFORM_KEY = 'demo.platform';

// Code default = control variation (served if LD is unreachable or the flag is missing).
export const DEPOSIT_PROMPT_DEFAULT = {
  headline: 'Make your first deposit',
  amounts: [10, 25, 50],
  framing: 'start-small',
};

// JSON values don't carry their variation name, so map the served variation index to the
// names in CLAUDE.md "Flag setup spec". Must match the variation order in the LD UI.
const DEPOSIT_PROMPT_VARIATIONS = ['control', 'earn-first'];

let client = null;
let depositPrompt = null; // per-page-load memo → one evaluation (one exposure) per session

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

function deviceFrom(ctx) {
  if (!ctx) return null;
  if (ctx.kind === 'device') {
    const { kind, ...device } = ctx;
    return device;
  }
  return ctx.kind === 'multi' ? ctx.device : null;
}

export async function initDevice() {
  if (!CLIENT_SIDE_ID) {
    throw new Error('LD_CLIENT_SIDE_ID is not set in .env');
  }
  // No key on purpose: the SDK generates and persists it for anonymous contexts.
  client = createClient(
    CLIENT_SIDE_ID,
    { kind: 'device', anonymous: true, platform: devicePlatform() },
    { logger: basicLogger({ level: import.meta.env.DEV ? 'info' : 'warn' }) },
  );
  const result = await client.start();
  if (result?.status !== 'complete') {
    // App still works on code defaults (control). Usually a wrong client-side ID.
    console.warn('[ld] initialization did not complete:', result);
  }
  if (import.meta.env.DEV) window.__ld = { client, getContext }; // for debugging only
  return client.getContext();
}

export async function identifyUser(userId) {
  const device = deviceFrom(client.getContext()); // same key the SDK generated at load
  const multi = { kind: 'multi', device, user: { key: userId } };
  const result = await client.identify(multi);
  if (result && result.status && result.status !== 'completed') {
    console.warn('[ld] identify did not complete:', result);
  }
  return client.getContext();
}

// Full context, sent in the body of every server call that can produce a conversion.
export function getContext() {
  return client?.getContext() ?? null;
}

// Screen 6 only. One call per page load = one evaluation = one exposure.
export function evaluateDepositPrompt() {
  if (depositPrompt) return depositPrompt;

  const detail = client.jsonVariationDetail(DEPOSIT_PROMPT_FLAG, DEPOSIT_PROMPT_DEFAULT);
  const served = detail.variationIndex ?? null;
  const variationKey = served === null ? 'default' : DEPOSIT_PROMPT_VARIATIONS[served] ?? `index-${served}`;

  if (served === null) {
    // Code default served. Check the flag exists in this environment and has
    // "SDKs using Client-side ID" enabled before debugging code.
    console.warn(`[ld] ${DEPOSIT_PROMPT_FLAG} served code default`, detail.reason);
  } else if (import.meta.env.DEV) {
    console.info(`[ld] ${DEPOSIT_PROMPT_FLAG} → ${variationKey} (variation index ${served})`);
  }

  depositPrompt = { ...DEPOSIT_PROMPT_DEFAULT, ...detail.value, variationKey };
  return depositPrompt;
}

// Kill switch. TODO(Sat/Sun, after Databricks): client.variation('onboarding-deposit-step', true)
// Not wired yet — the flag doesn't exist, and evaluating it now would be noise.
export function depositStepEnabled() {
  return true;
}

// Optional client-side funnel events: kyc_started, bank_linked, product_selected.
// Not outcomes — conversions are tracked server-side (Friday PM).
export function trackFunnel(eventKey, data) {
  client?.track(eventKey, data);
}
