# inspector/

A read-only sidecar for the demo. It tails `server.log` at the repo root and streams the
server's conversion lines to the client's **Inspector** panel over Server-Sent Events.

```bash
npm run inspector          # http://localhost:4200/events (INSPECTOR_PORT to change)
```

The server only writes `server.log` when its output is piped through `tee`. No server
code change is needed. From the repo root:

```bash
npm run start:server 2>&1 | tee -a server.log
```

Events: `{ ts, kind, deviceKey, userKey, variation, amount, message, simulated }`, where
`kind` is `account_created`, `deposit_confirmed`, `not_attributed` or `other`. See
`parse.js` for the line formats and how `variation` and `simulated` are inferred.

If the sidecar isn't running, the panel shows "Inspector offline" and the app works as normal.
