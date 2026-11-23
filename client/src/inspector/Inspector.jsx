import { useEffect, useState } from 'react';
import { useBrand } from '../brand/BrandProvider.jsx';
import { getContext } from '../ld/index.js';

// Presenter-only side panel: what the SERVER did with this device's requests, read from the
// inspector sidecar (inspector/, SSE). Not part of the customer's app; hidden on narrow
// viewports. If the sidecar is down it says "Inspector offline" and nothing else changes.
const URL = import.meta.env.VITE_INSPECTOR_URL || 'http://localhost:4200';
const MAX = 200;
let seq = 0; // stable React keys for incoming events

const short = (k) => (k && k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : k ?? '');

function myDeviceKey() {
  const ctx = getContext();
  if (!ctx) return null;
  return ctx.kind === 'device' ? ctx.key : ctx.kind === 'multi' ? ctx.device?.key ?? null : null;
}

function describe(e, formatMoney) {
  const device = e.deviceKey ? `device ${short(e.deviceKey)}` : 'no device';
  switch (e.kind) {
    case 'deposit_confirmed':
      return `Server recorded deposit ${formatMoney(e.amount ?? 0)} — ${device}` +
        (e.variation ? `, variation ${e.variation}` : '');
    case 'account_created':
      return `Server recorded account created — ${device}`;
    case 'not_attributed': {
      const reason = /— (.+)$/.exec(e.message)?.[1] ?? 'no usable context';
      const what = /deposit_confirmed/.test(e.message)
        ? `Deposit${e.amount ? ` of ${formatMoney(e.amount)}` : ''} went through`
        : 'Account was created';
      return `${what} but was not attributed: ${reason}.`;
    }
    default: {
      const m = /^\[([\w-]+)\] device=\S+ user=\S+ ?(.*)$/.exec(e.message);
      if (!m) return e.message;
      const [, route, extra] = m;
      const outcome = /outcome: '(\w+)'/.exec(extra)?.[1];
      if (route === 'signup') return `Server: signup — ${device}`;
      if (route === 'kyc') return `Server: identity check ${outcome ?? ''} — ${device}`;
      if (route === 'bank-link') return `Server: bank linked — ${device}`;
      if (route === 'deposit') return `Server: deposit request — ${device}`;
      return e.message;
    }
  }
}

export default function Inspector() {
  const { formatMoney } = useBrand();
  const [status, setStatus] = useState('connecting'); // connecting | online | offline
  const [events, setEvents] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [mine, setMine] = useState(myDeviceKey);

  useEffect(() => {
    let es;
    try {
      es = new EventSource(`${URL}/events`);
    } catch {
      setStatus('offline');
      return undefined;
    }
    // The sidecar resends its backlog on every (re)connect, so start fresh each time.
    es.onopen = () => {
      setStatus('online');
      setEvents([]);
    };
    es.onerror = () => setStatus('offline'); // EventSource keeps retrying on its own
    es.onmessage = (msg) => {
      let e;
      try {
        e = JSON.parse(msg.data);
      } catch {
        return;
      }
      setMine(myDeviceKey()); // device context is ready by the time events matter
      e.id = ++seq;
      setEvents((list) => [e, ...list].slice(0, MAX));
    };
    return () => es.close();
  }, []);

  // The device key exists once the LD client has started; pick it up if we rendered first.
  useEffect(() => {
    if (mine) return undefined;
    const t = setInterval(() => {
      const k = myDeviceKey();
      if (k) setMine(k);
    }, 500);
    return () => clearInterval(t);
  }, [mine]);

  // Default: this browser's device only. Context-less "not attributed" lines have no device
  // key; sim devices always send a context, so those are shown here too.
  const visible = showAll
    ? events
    : events.filter((e) => (e.deviceKey ? e.deviceKey === mine : e.kind === 'not_attributed'));

  return (
    <aside className="inspector" aria-label="Inspector">
      <header className="inspector__head">
        <span className="inspector__title">Inspector</span>
        <span className={`inspector__dot inspector__dot--${status}`} />
      </header>
      {status === 'offline' ? (
        <p className="inspector__offline">Inspector offline</p>
      ) : (
        <>
          <div className="inspector__meta">
            <span>This device: {mine ? short(mine) : '…'}</span>
            <label className="inspector__toggle">
              <input type="checkbox" checked={showAll} onChange={(ev) => setShowAll(ev.target.checked)} />
              Show all traffic
            </label>
          </div>
          <ol className="inspector__list">
            {visible.length === 0 && (
              <li className="inspector__empty">
                {showAll ? 'No server events yet.' : 'No server events for this device yet.'}
              </li>
            )}
            {visible.map((e) => (
              <li
                key={e.id}
                className={[
                  'inspector__line',
                  `inspector__line--${e.kind}`,
                  showAll && e.simulated ? 'inspector__line--sim' : '',
                ].join(' ')}
                title={e.message}
              >
                {e.ts && (
                  <time className="inspector__ts">
                    {new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false })}
                  </time>
                )}
                <span>{describe(e, formatMoney)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}
