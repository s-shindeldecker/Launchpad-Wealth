import { useState } from 'react';
import { useBrand } from '../brand/BrandProvider.jsx';
import { Button, Field, Layout } from '../components/Layout.jsx';
import { api } from '../api.js';
import { identifyUser } from '../ld/index.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Screen 2 → POST /signup → userId → identify() with device + user multi-context.
export default function Credentials({ nav, update }) {
  const { copy } = useBrand();
  const c = copy.credentials;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const emailErr = touched && !EMAIL_RE.test(email) ? c.errorEmail : null;
  const pwErr = touched && password.length < 8 ? c.errorPassword : null;

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email) || password.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const { userId } = await api.signup(email);
      await identifyUser(userId); // device key unchanged; user context added
      update({ email, userId });
      nav.next();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="contents" onSubmit={submit} noValidate>
      <Layout
        nav={nav}
        onBack={nav.back}
        title={c.title}
        subtitle={c.subtitle}
        footer={<Button type="submit" disabled={busy}>{busy ? copy.common.loading : c.cta}</Button>}
      >
        <Field label={c.emailLabel} type="email" autoComplete="off" placeholder={c.emailPlaceholder}
          value={email} onChange={(e) => setEmail(e.target.value)} error={emailErr} />
        <Field label={c.passwordLabel} type="password" autoComplete="new-password" hint={c.passwordHint}
          value={password} onChange={(e) => setPassword(e.target.value)} error={pwErr} />
        {error && <p className="field__error">{error}</p>}
      </Layout>
    </form>
  );
}
