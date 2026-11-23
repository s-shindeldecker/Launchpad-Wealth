import { BrandIcon } from '../brand/BrandIcon.jsx';
import { fill, useBrand } from '../brand/BrandProvider.jsx';
import { Button, Layout } from '../components/Layout.jsx';

// Screen 7
export default function Done({ nav, session }) {
  const { copy, formatMoney } = useBrand();
  const c = copy.done;
  const product = session.product?.name ?? '';
  const body = session.deposit
    ? fill(c.depositedBody, { amount: formatMoney(session.deposit), product })
    : fill(c.noDepositBody, { product });

  return (
    <Layout footer={<Button onClick={nav.restart}>{c.cta}</Button>}>
      <div className="result result--celebrate">
        <div className="result__icon result__icon--brand">
          <BrandIcon size={38} colorKey="primary" />
        </div>
        <h1 className="screen__title">{c.title}</h1>
        <p className="screen__subtitle">{body}</p>
      </div>
    </Layout>
  );
}
