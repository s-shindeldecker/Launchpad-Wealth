// Hidden presenter shortcut: Shift+N = "new device".
//
// Clears only the localStorage keys this app and the LaunchDarkly SDK write, then reloads to
// Welcome. On load the SDK finds no stored device key, generates a fresh one and identifies
// with it, so the next walk-through is a brand-new, never-exposed device.
//   - `demo.*`         this app: demo.platform (device platform), demo.inspectorOpen
//   - `LaunchDarkly_*` the JS client SDK: generated context keys, cached flags, context index
// Anything else on the origin is left alone.

const APP_PREFIX = 'demo.';
const LD_PREFIX = 'LaunchDarkly_';
const TOAST_MS = 900;

function ownedKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(APP_PREFIX) || k.startsWith(LD_PREFIX))) keys.push(k);
    }
  } catch {
    /* storage unavailable: nothing to clear */
  }
  return keys;
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
}

let resetting = false;
export function newDevice() {
  if (resetting) return;
  resetting = true;
  for (const k of ownedKeys()) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  toast('New device');
  setTimeout(() => window.location.reload(), TOAST_MS);
}

// Don't fire while someone is typing a capital N into a form field.
function isTyping(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
}

export function installNewDeviceShortcut() {
  const onKey = (ev) => {
    if (ev.shiftKey && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.code === 'KeyN' && !isTyping(ev.target)) {
      ev.preventDefault();
      newDevice();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
