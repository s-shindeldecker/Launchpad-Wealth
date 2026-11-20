# Launchpad onboarding experiment demo

Phone-framed onboarding flow (`client/`), stub backend (`server/`), and — later — a traffic
simulator (`sim/`). See `CLAUDE.md` for the full spec and build order.

## Run

```bash
npm install
npm run dev
```

- App: http://localhost:5173 (proxies `/api` to the server)
- Server: http://localhost:4100 (override with `SERVER_PORT`)

KYC test identities: type a full legal name containing `fail` (e.g. "Alex Fail") or
`review` (e.g. "Sam Review") on the identity screen. `?kyc=fail|review` in the URL also
works. Details in CLAUDE.md → "Testing the flow".

## Swap brand (no code change)

```bash
BRAND_FILE=brands/kestrel.json npm run dev
```

…or set `BRAND_FILE` in `.env`. All names, colours, fonts, products, banks and copy come
from the brand file. The deposit headline/amounts on screen 6 come from the
`onboarding-deposit-prompt` flag variation, not the brand.

## Status

Friday PM step: LaunchDarkly Node server SDK (`@launchdarkly/node-server-sdk`) in
`server/index.js`, used only for `track()`: `account_created` on KYC pass and
`deposit_confirmed` (metricValue = amount) on deposit, both against the context the client
sent in the request body. The server evaluates no flags. Requests without a context that
includes a device key get a 400 and are not tracked. Requires `LD_SDK_KEY` in `.env`
(without it the server runs and logs conversions as untracked).

Friday AM step: LaunchDarkly JS client SDK (`@launchdarkly/js-client-sdk`) in
`client/src/ld/index.js` — anonymous device context on load, identify to device+user after
signup, `onboarding-deposit-prompt` evaluated once on screen 6.
