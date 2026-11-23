import { Feather, Landmark, PiggyBank, Rocket, Sparkles, Star, TrendingUp, Wallet } from 'lucide-react';
import { useBrand } from './BrandProvider.jsx';

// brand.json `icon` → lucide component. Named imports keep the bundle to these few icons.
// To offer a new icon to brand configs, add it here once; brands then pick it by name.
const ICONS = {
  rocket: Rocket,
  feather: Feather,
  'piggy-bank': PiggyBank,
  sparkles: Sparkles,
  star: Star,
  'trending-up': TrendingUp,
  wallet: Wallet,
  landmark: Landmark,
};
const DEFAULT_ICON = 'rocket';

// The brand's icon as an SVG. Color defaults to the palette's primary; pass a palette key
// (e.g. "primaryText") to pick another palette color.
export function BrandIcon({ size = 24, colorKey = 'primary', strokeWidth = 2, className }) {
  const { brand } = useBrand();
  const Icon = ICONS[brand.icon] ?? ICONS[DEFAULT_ICON];
  return (
    <Icon
      size={size}
      color={brand.palette?.[colorKey] ?? 'currentColor'}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  );
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
