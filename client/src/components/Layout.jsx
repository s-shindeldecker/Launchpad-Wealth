import { fill, useBrand } from '../brand/BrandProvider.jsx';

export function Layout({ nav, title, subtitle, onBack, footer, children }) {
  const { copy } = useBrand();
  return (
    <div className="screen">
      {(onBack || nav?.stepNumber) && (
        <header className="screen__nav">
          {onBack ? (
            <button className="link-btn" onClick={onBack}>‹ {copy.common.back}</button>
          ) : <span />}
          {nav?.stepNumber && (
            <span className="screen__step">
              {fill(copy.common.stepLabel, { n: nav.stepNumber, total: nav.totalSteps })}
            </span>
          )}
        </header>
      )}
      {nav?.stepNumber && (
        <div className="progress">
          <div className="progress__bar" style={{ width: `${(nav.stepNumber / nav.totalSteps) * 100}%` }} />
        </div>
      )}
      <main className="screen__body">
        {title && <h1 className="screen__title">{title}</h1>}
        {subtitle && <p className="screen__subtitle">{subtitle}</p>}
        {children}
      </main>
      {footer && <footer className="screen__footer">{footer}</footer>}
    </div>
  );
}

export function Button({ variant = 'primary', ...props }) {
  return <button className={`btn btn--${variant}`} {...props} />;
}

export function Field({ label, hint, error, ...inputProps }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className={`field__input${error ? ' field__input--error' : ''}`} {...inputProps} />
      {error ? <span className="field__error">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Spinner({ label }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <p className="muted">{label}</p>}
    </div>
  );
}
