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

// palette key → CSS variable: textMuted → --text-muted
const cssVar = (k) => `--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;

// Redesign key → key the stylesheet reads (e.g. textMuted → --muted).
// surfaceAlt and accentText need no alias: they map straight to --surface-alt / --accent-text.
const PALETTE_ALIASES = { textMuted: 'muted' };

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
    const palette = brand.palette || {};
    for (const [k, v] of Object.entries(palette)) {
      if (typeof v !== 'string') continue; // e.g. palette.gradient (array) → --hero-bg below
      root.style.setProperty(cssVar(k), v);
    }
    // Newer key names → the variable the stylesheet reads. The older name wins if both exist.
    for (const [newKey, oldKey] of Object.entries(PALETTE_ALIASES)) {
      if (typeof palette[newKey] === 'string' && palette[oldKey] === undefined) {
        root.style.setProperty(cssVar(oldKey), palette[newKey]);
      }
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
