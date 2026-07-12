/**
 * FRANCHIR Tracker V3 brand tokens — shared across shell, dashboard, and patient fiche.
 * Reference: docs/Design responsive UI_UX_Tracker_V3/src/app/App.tsx
 */
export const BRAND = {
  navy: '#1E2B70',
  navyDark: '#171F52',
  navyLight: '#2D3E8F',
  coral: '#E8534A',
  coralDark: '#D03D34',
  coralLight: '#F26B63',
  cream: '#F2EDE4',
  creamDark: '#F4EFDF',
  creamMid: '#E8E0D4',
  white: '#FFFFFF',
  slate: '#6B7CAA',
  slateLight: '#A8B4D8',
  dark: '#1A1F3A',
  ink: '#2E3450',
  green: '#18A050',
  orange: '#D97706',
  red: '#D03030',
  /** KPI accent — revue médicale */
  revue: '#4D5EC0',
  /** KPI accent — commercial / à confirmer */
  commercial: '#1A9CC0',
} as const

/** Alias used in the V3 prototype (App.tsx `B` object) */
export const B = BRAND

export type BrandColor = (typeof BRAND)[keyof typeof BRAND]

/** Typography families used in the V3 prototype */
export const brandTypography = {
  display: 'var(--font-nunito), var(--font-geist-sans), system-ui, sans-serif',
  body: "var(--font-geist-sans), 'Inter', system-ui, sans-serif",
  mono: "var(--font-geist-mono), 'DM Mono', ui-monospace, monospace",
} as const

/** CSS custom property names — wired in app/globals.css @theme */
export const brandCssVars = {
  navy: '--franchir-navy',
  navyDark: '--franchir-navy-dark',
  coral: '--franchir-coral',
  coralDark: '--franchir-coral-dark',
  cream: '--franchir-cream',
  creamDark: '--franchir-cream-dark',
  creamMid: '--franchir-cream-mid',
  slate: '--franchir-slate',
  ink: '--franchir-ink',
} as const
