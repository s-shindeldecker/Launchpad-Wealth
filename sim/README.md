# sim/ — traffic simulator

Synthetic devices walk the real server API (signup → kyc → bank-link → deposit) with the
same request shapes and contexts as the client. Devices that reach the deposit screen
evaluate `onboarding-deposit-prompt` once, with their own LaunchDarkly server SDK instance
(separate from `server/`, which never evaluates flags). Every context is tagged
`simulated: true`. Behaviour model (drop-off, KYC rates, per-arm deposit rate and amounts)
is at the top of `index.js`.

Needs the server running (`npm run dev`) and `LD_SDK_KEY` in `.env`.

```bash
npm run sim                        # loop forever, 3 devices/min (SIM_RATE=5 or --rate 5)
npm run sim -- --once --count 20   # one burst of 20 devices, then exit
```

Ctrl-C stops new devices, lets in-flight ones finish (max 15s), flushes events and exits.
Each device has a fresh random key, so stopping and restarting never re-exposes a device.
Options: `--server http://host:port` (or `SIM_SERVER_URL`), `LD_LOG_LEVEL=info`.
