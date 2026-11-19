import { useState } from 'react';
import { useBrand } from '../brand/BrandProvider.jsx';
import { Button, Field, Layout, Spinner } from '../components/Layout.jsx';
import { api } from '../api.js';
import { trackFunnel } from '../ld/index.js';

// Presenter override for the other KYC branches: add ?kyc=fail or ?kyc=review to the URL.
const forcedOutcome = new URLSearchParams(window.location.search).get('kyc') || undefined;

// Screen 3 → POST /kyc (simulated async): pass | fail | review.
// account_created is tracked SERVER-side on pass, against the context sent here.
export default function Kyc({ nav, session, update }) {
  const { copy } = useBrand();
  const c = copy.kyc;
  const [form, setForm] = useState({ name: '', dob: '', postcode: '' });
  const [state, setState] = useState('form'); // form | pending | pass | fail | review
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ready = form.name.trim() && form.dob && form.postcode.trim();

  async function submit(e) {
    e.preventDefault();
    if (!ready) return;
    setState('pending');
    trackFunnel('kyc_started');
    try {
      const { status } = await api.kyc(session.userId, form, forcedOutcome);
      update({ kycStatus: status });
      setState(status);
    } catch {
      setState('fail');
    }
  }

  if (state === 'pending') {
    return <Layout nav={nav}><Spinner label={c.pending} /></Layout>;
  }

  if (state !== 'form') {
    const result = {
      pass: { icon: '✓', tone: 'success', title: c.passTitle, body: c.passBody },
      fail: { icon: '!', tone: 'danger', title: c.failTitle, body: c.failBody },
      review: { icon: '…', tone: 'warning', title: c.reviewTitle, body: c.reviewBody },
    }[state];
    return (
      <Layout
        nav={nav}
        footer={state === 'pass'
          ? <Button onClick={nav.next}>{copy.common.continue}</Button>
          : <Button variant="secondary" onClick={nav.restart}>{copy.common.startOver}</Button>}
      >
        <div className="result">
          <div className={`result__icon result__icon--${result.tone}`}>{result.icon}</div>
          <h1 className="screen__title">{result.title}</h1>
          <p className="screen__subtitle">{result.body}</p>
        </div>
      </Layout>
    );
  }

  return (
    <form className="contents" onSubmit={submit}>
      <Layout nav={nav} title={c.title} subtitle={c.subtitle}
        footer={<Button type="submit" disabled={!ready}>{c.cta}</Button>}>
        <Field label={c.nameLabel} value={form.name} onChange={set('name')} autoComplete="off" />
        <Field label={c.dobLabel} type="date" value={form.dob} onChange={set('dob')} />
        <Field label={c.postcodeLabel} value={form.postcode} onChange={set('postcode')} autoComplete="off" />
      </Layout>
    </form>
  );
}
