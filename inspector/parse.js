// Parses server/index.js console output into inspector events. Formats (server source):
//
//   logCall():        [<route>] device=<key|-> user=<key|-> { ...extra }
//                     (Node prints `extra` on ONE line when short, else as a multi-line
//                     block ending in a line that is just "}")
//   trackConversion:  [ld] track <event> device=<key> user=<key|-> [metricValue=<n>]
//                     [ld] NOT attributed: <event> not tracked — <reason>
//                     [ld] NOT tracked <event> device=<key> (no LD_SDK_KEY)
//
// The server prints no timestamps and doesn't log the context's `simulated` attribute, so:
//   - ts is when the inspector read the line (null for lines already in the file at startup)
//   - simulated = the device signed up with a sim+…@example.com email (sim/index.js)
//   - variation on deposit_confirmed comes from that device's preceding [deposit] line
//
// Output: { ts, kind, deviceKey, userKey, variation, amount, message, simulated }
// kind: account_created | deposit_confirmed | not_attributed | other

const ROUTE_RE = /^\[([a-z][\w-]*)\] device=(\S+) user=(\S+)(?: (.*))?$/;
const TRACK_RE = /^\[ld\] track (\w+) device=(\S+) user=(\S+)(?: metricValue=(\S+))?$/;
const NOT_ATTR_RE = /^\[ld\] NOT attributed: (\w+) not tracked — (.+)$/;

const dash = (v) => (v === '-' || v === undefined ? null : v);
// Read one field from Node's inspect output, e.g. "{ amount: 25, variation: 'control' }".
function field(text, name) {
  const m = new RegExp(`\\b${name}: (?:'([^']*)'|([\\w.-]+))`).exec(text ?? '');
  const v = m ? (m[1] ?? m[2]) : null;
  return v === 'undefined' || v === 'null' ? null : v;
}

export function createParser({ onEvent, now = () => new Date().toISOString() }) {
  const simDevices = new Set();
  const lastVariation = new Map(); // deviceKey → variation from its [deposit] line
  let pending = null; // multi-line logCall block being collected
  let anonAmount = null; // amount from the last context-less [deposit] line
  let live = false;

  function emit(e) {
    const simulated = e.deviceKey ? simDevices.has(e.deviceKey) : false;
    onEvent({
      ts: live ? now() : null,
      kind: e.kind,
      deviceKey: e.deviceKey ?? null,
      userKey: e.userKey ?? null,
      variation: e.variation ?? null,
      amount: e.amount ?? null,
      message: e.message,
      simulated,
    });
  }

  function routeLine(text) {
    const m = ROUTE_RE.exec(text);
    const [, route, device, user, extra] = m;
    const deviceKey = dash(device);
    if (route === 'signup' && /email: 'sim\+/.test(extra ?? '') && deviceKey) simDevices.add(deviceKey);
    let variation = null;
    let amount = null;
    if (route === 'deposit') {
      variation = field(extra, 'variation');
      amount = Number(field(extra, 'amount')) || null;
      if (deviceKey && variation) lastVariation.set(deviceKey, variation);
      if (!deviceKey) anonAmount = amount;
    }
    emit({ kind: 'other', deviceKey, userKey: dash(user), variation, amount, message: text });
  }

  function line(raw) {
    const text = raw.replace(/\r$/, '');
    if (pending) {
      pending.push(text.trim());
      if (text === '}') {
        const joined = pending.join(' ').replace(/,\s+}/, ' }').replace(/{\s+/, '{ ');
        pending = null;
        routeLine(joined);
      }
      return;
    }
    if (!text.trim()) return;

    if (ROUTE_RE.test(text)) {
      if (text.endsWith('{')) pending = [text];
      else routeLine(text);
      return;
    }
    const m = TRACK_RE.exec(text);
    if (m && (m[1] === 'account_created' || m[1] === 'deposit_confirmed')) {
      const [, event, device, user, metricValue] = m;
      const deviceKey = dash(device);
      emit({
        kind: event,
        deviceKey,
        userKey: dash(user),
        variation: event === 'deposit_confirmed' ? lastVariation.get(deviceKey) ?? null : null,
        amount: metricValue !== undefined ? Number(metricValue) : null,
        message: text,
      });
      return;
    }
    if (NOT_ATTR_RE.test(text)) {
      // No usable context → the server has no device key to log. The event name and reason
      // stay in `message` ("… deposit_confirmed not tracked — no context in request body").
      const amount = /deposit_confirmed/.test(text) ? anonAmount : null;
      anonAmount = null;
      emit({ kind: 'not_attributed', amount, message: text });
      return;
    }
    emit({ kind: 'other', message: text });
  }

  return {
    line,
    goLive() {
      live = true;
    },
  };
}
