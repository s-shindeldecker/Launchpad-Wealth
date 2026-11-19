import { useState } from 'react';
import { useBrand } from '../brand/BrandProvider.jsx';
import { Button, Layout, Spinner } from '../components/Layout.jsx';
import { api } from '../api.js';
import { trackFunnel } from '../ld/index.js';

// Screen 4 → simulated Open Banking: pick bank → consent sheet → POST /bank-link.
export default function BankLink({ nav, session, update }) {
  const { brand, copy } = useBrand();
  const c = copy.bankLink;
  const [bank, setBank] = useState(null);
  const [state, setState] = useState('pick'); // pick | consent | linking

  async function allow() {
    setState('linking');
    try {
      const res = await api.bankLink(session.userId, bank.id);
      update({ bank: { ...bank, accountMask: res.accountMask } });
      trackFunnel('bank_linked', { bankId: bank.id });
      nav.next();
    } catch {
      setState('consent');
    }
  }

  if (state === 'linking') return <Layout nav={nav}><Spinner label={c.linking} /></Layout>;

  return (
    <Layout nav={nav} title={c.title} subtitle={c.subtitle}>
      <div className="list">
        {brand.banks.map((b) => (
          <button key={b.id} className="list__item"
            onClick={() => { setBank(b); setState('consent'); }}>
            <span className="bank-avatar">{b.name[0]}</span>
            <span className="list__label">{b.name}</span>
            <span className="list__chev">›</span>
          </button>
        ))}
      </div>

      {state === 'consent' && bank && (
        <div className="sheet-backdrop" onClick={() => setState('pick')}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__handle" />
            <div className="sheet__banks">
              <span className="bank-avatar bank-avatar--lg">{bank.name[0]}</span>
              <span className="sheet__arrow">⇄</span>
              <span className="bank-avatar bank-avatar--lg bank-avatar--brand">{brand.logo.glyph}</span>
            </div>
            <h2 className="sheet__title">{c.consentTitle}</h2>
            <p className="muted">{c.consentBody}</p>
            <Button onClick={allow}>{c.consentAllow}</Button>
            <Button variant="ghost" onClick={() => setState('pick')}>{c.consentCancel}</Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
