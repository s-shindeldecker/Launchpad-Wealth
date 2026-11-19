import { getContext } from './ld/index.js';

// Every call sends the current LaunchDarkly context in the body so the server can track
// conversions against the exact context the client was exposed under.
async function post(path, body = {}) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, context: getContext() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  signup: (email) => post('/signup', { email }),
  kyc: (userId, details, simulateOutcome) => post('/kyc', { userId, details, simulateOutcome }),
  bankLink: (userId, bankId) => post('/bank-link', { userId, bankId }),
  deposit: (userId, { amount, productId, variation }) =>
    post('/deposit', { userId, amount, productId, variation }),
};
