import { useState } from 'react';
import { useBrand } from '../brand/BrandProvider.jsx';
import { Button, Layout } from '../components/Layout.jsx';
import { trackFunnel } from '../ld/index.js';

// Screen 5 — products come from brand.json. (Cut-list fallback: hardcode easy-access.)
export default function ChooseProduct({ nav, session, update }) {
  const { brand, copy } = useBrand();
  const c = copy.chooseProduct;
  const [selected, setSelected] = useState(session.product?.id ?? brand.products[0].id);

  function next() {
    const product = brand.products.find((p) => p.id === selected);
    update({ product });
    trackFunnel('product_selected', { productId: product.id });
    nav.next();
  }

  return (
    <Layout nav={nav} title={c.title} subtitle={c.subtitle}
      footer={<Button onClick={next}>{c.cta}</Button>}>
      <div className="list">
        {brand.products.map((p) => (
          <button key={p.id}
            className={`product${selected === p.id ? ' product--selected' : ''}`}
            onClick={() => setSelected(p.id)}>
            <div className="product__row">
              <span className="product__name">{p.name}</span>
              <span className="product__rate">{p.rate}</span>
            </div>
            <span className="product__blurb">{p.blurb}</span>
          </button>
        ))}
      </div>
    </Layout>
  );
}
