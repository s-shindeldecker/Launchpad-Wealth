import { useRef, useState } from 'react';
import { fill, useBrand } from '../brand/BrandProvider.jsx';
import { Button, Layout, Spinner } from '../components/Layout.jsx';
import { api } from '../api.js';
import { depositStepEnabled, evaluateDepositPrompt } from '../ld/index.js';

const MIN_DEPOSIT = 1;

// Screen 6 — THE EXPERIMENT SURFACE.
// `onboarding-deposit-prompt` is evaluated here and only here — never earlier — so only
// devices that actually reach this screen are counted as exposed. The useRef guard just
// keeps the copy stable across re-renders; LaunchDarkly counts one exposure per context
// per experiment however often it evaluates. The headline/amounts/framing come from the
// flag variation, not brand.json — that's what the experiment varies.
export default function Deposit({ nav, session, update }) {
  const { copy, formatMoney } = useBrand();
  const c = copy.deposit;

  // TODO(Sat/Sun): kill switch `onboarding-deposit-step` (boolean). Evaluated before the
  // experiment flag so users who never see the prompt aren't counted as exposed.
  const enabledRef = useRef(null);
  if (enabledRef.current === null) enabledRef.current = depositStepEnabled();

  const promptRef = useRef(null);
  if (enabledRef.current && promptRef.current === null) {
    promptRef.current = evaluateDepositPrompt();
    // TODO(Sat/Sun): relay exposure to server for Databricks (POST /api/exposure).
  }
  const prompt = promptRef.current;

  const [amount, setAmount] = useState(prompt?.amounts?.[1] ?? null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const productName = session.product?.name ?? '';

  if (!enabledRef.current) {
    return (
      <Layout nav={nav} footer={<Button onClick={nav.next}>{copy.common.continue}</Button>}>
        <div className="result">
          <div className="result__icon result__icon--warning">!</div>
          <p className="screen__subtitle">{c.killSwitchMessage}</p>
        </div>
      </Layout>
    );
  }

  const value = custom !== '' ? Number(custom) : amount;
  const valid = Number.isFinite(value) && value >= MIN_DEPOSIT;

  async function confirm() {
    if (!valid) {
      setError(fill(c.errorAmount, { min: formatMoney(MIN_DEPOSIT) }));
      return;
    }
    setBusy(true);
    try {
      const res = await api.deposit(session.userId, {
        amount: value,
        productId: session.product?.id,
        variation: prompt.variation, // from the flag JSON, or 'unknown'; server never evaluates the flag
      });
      update({ deposit: res.amount });
      nav.next();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function skip() {
    update({ deposit: null });
    nav.next();
  }

  if (busy) return <Layout nav={nav}><Spinner label={c.processing} /></Layout>;

  return (
    <Layout
      nav={nav}
      title={prompt.headline}
      subtitle={fill(c.subtitle, { product: productName })}
      footer={
        <>
          <Button onClick={confirm} disabled={!valid}>
            {fill(c.cta, { amount: valid ? formatMoney(value) : '' })}
          </Button>
          <Button variant="ghost" onClick={skip}>{c.skip}</Button>
        </>
      }
    >
      <div className={`amounts amounts--${prompt.framing}`}>
        {prompt.amounts.map((a) => (
          <button key={a}
            className={`chip${custom === '' && amount === a ? ' chip--selected' : ''}`}
            onClick={() => { setAmount(a); setCustom(''); setError(null); }}>
            {formatMoney(a)}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field__label">{c.customAmountLabel}</span>
        <input className="field__input" inputMode="decimal" value={custom}
          onChange={(e) => { setCustom(e.target.value.replace(/[^\d.]/g, '')); setError(null); }} />
      </label>
      {session.bank && <p className="muted small">{session.bank.name} {session.bank.accountMask}</p>}
      {error && <p className="field__error">{error}</p>}
    </Layout>
  );
}
