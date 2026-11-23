import { createContext, useContext, useEffect, useMemo } from 'react';
import brand from '@brand';

const BrandContext = createContext(null);

// "{amount} into {product}" → filled string
export function fill(template, vars = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

// Gradient stops from palette.gradient; falls back to the older heroFrom/heroTo pair,
// then to primary, so brand files without a gradient still render.
export function brandGradient(palette = {}, angle = 135) {
  const stops = Array.isArray(palette.gradient) && palette.gradient.length
    ? palette.gradient
    : [palette.heroFrom, palette.heroTo].filter(Boolean);
  const colors = stops.length ? stops : [palette.primary ?? '#333'];
  return `linear-gradient(${angle}deg, ${(colors.length === 1 ? [colors[0], colors[0]] : colors).join(', ')})`;
}

// `font` may be a CSS font-family string or { family, googleFontsUrl }.
function fontOf(brand) {
  return typeof brand.font === 'string' ? { family: brand.font } : brand.font ?? {};
}

export function BrandProvider({ children }) {
  const value = useMemo(() => {
    const money = new Intl.NumberFormat(brand.locale || 'en-GB', {
      style: 'currency',
      currency: brand.currency?.code || 'GBP',
      maximumFractionDigits: 0,
    });
    return { brand, copy: brand.copy, formatMoney: (n) => money.format(n) };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(brand.palette || {})) {
      if (typeof v !== 'string') continue; // e.g. palette.gradient (array) → --hero-bg below
      root.style.setProperty(`--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, v);
    }
    // Welcome hero: palette.gradient when present, else heroFrom/heroTo (CSS fallback).
    if (Array.isArray(brand.palette?.gradient) && brand.palette.gradient.length) {
      root.style.setProperty('--hero-bg', brandGradient(brand.palette, 160));
    }
    const font = fontOf(brand);
    if (font.family) root.style.setProperty('--font', font.family);
    document.title = brand.name;

    if (font.googleFontsUrl) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = font.googleFontsUrl;
      document.head.appendChild(link);
      return () => link.remove();
    }
  }, []);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export const useBrand = () => useContext(BrandContext);
