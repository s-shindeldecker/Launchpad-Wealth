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

Presenter shortcuts: `?kyc=fail` or `?kyc=review` in the URL forces that KYC branch.

## Swap brand (no code change)

```bash
BRAND_FILE=brands/kestrel.json npm run dev
```

…or set `BRAND_FILE` in `.env`. All names, colours, fonts, products, banks and copy come
from the brand file. The deposit headline/amounts on screen 6 come from the
`onboarding-deposit-prompt` flag variation, not the brand.

## Status

Thursday step: all 7 screens, stubbed server, no LaunchDarkly. Integration points are
marked `TODO(Fri AM)`, `TODO(Fri PM)` and `TODO(Sat/Sun)` — start in `client/src/ld/index.js`
and `server/index.js`.
