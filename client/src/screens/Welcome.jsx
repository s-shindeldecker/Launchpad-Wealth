import { BrandIcon, brandGradient } from '../brand/BrandIcon.jsx';
import { useBrand } from '../brand/BrandProvider.jsx';
import { Button } from '../components/Layout.jsx';

// Screen 1
export default function Welcome({ nav }) {
  const { brand, copy } = useBrand();
  const c = copy.welcome;
  return (
    <div className="screen welcome">
      <div className="welcome__hero">
        <div className="logo">
          <span className="logo__badge" style={{ background: brandGradient(brand.palette) }}>
            <BrandIcon size={22} colorKey="primaryText" />
          </span>
          <span className="logo__text">{brand.logo.text}</span>
        </div>
        <h1 className="welcome__title">{c.title}</h1>
        <p className="welcome__subtitle">{c.subtitle}</p>
      </div>
      <ul className="welcome__bullets">
        {c.bullets.map((b) => (
          <li key={b}><span className="tick">✓</span>{b}</li>
        ))}
      </ul>
      <footer className="screen__footer">
        <Button onClick={nav.next}>{c.cta}</Button>
        <Button variant="ghost" disabled>{c.secondary}</Button>
        <p className="legal">{copy.legal.footer}</p>
      </footer>
    </div>
  );
}
