---
name: Vantix Obsidian
colors:
  surface: '#060a14'
  surface-dim: '#060a14'
  surface-bright: '#0f172a'
  surface-container-lowest: '#030610'
  surface-container-low: '#060a14'
  surface-container: '#0a1020'
  surface-container-high: '#0f172a'
  surface-container-highest: '#1e293b'
  on-surface: '#f1f5f9'
  on-surface-variant: '#94a3b8'
  inverse-surface: '#f1f5f9'
  inverse-on-surface: '#0f172a'
  outline: '#334155'
  outline-variant: '#1e293b'
  surface-tint: '#22d3ee'
  primary: '#22d3ee'
  on-primary: '#083344'
  primary-container: '#0e7490'
  on-primary-container: '#cffafe'
  inverse-primary: '#0891b2'
  secondary: '#64748b'
  on-secondary: '#f1f5f9'
  secondary-container: '#1e293b'
  on-secondary-container: '#cbd5e1'
  tertiary: '#f472b6'
  on-tertiary: '#ffffff'
  tertiary-container: '#831843'
  on-tertiary-container: '#fce7f3'
  error: '#ef4444'
  on-error: '#ffffff'
  error-container: '#7f1d1d'
  on-error-container: '#fef2f2'
  primary-fixed: '#22d3ee'
  primary-fixed-dim: '#06b6d4'
  on-primary-fixed: '#083344'
  on-primary-fixed-variant: '#0e7490'
  background: '#060a14'
  on-background: '#f1f5f9'
  surface-variant: '#1e293b'
typography:
  metric-lg:
    fontFamily: Geist Mono
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: -0.04em
  h1:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  card-title:
    fontFamily: Geist Mono
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
  body-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: -0.01em
  label-sm:
    fontFamily: Geist Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 6px
  DEFAULT: 10px
  md: 14px
  lg: 20px
  xl: 32px
  full: 9999px
spacing:
  base: 4px
  gutter: 20px
  margin: 32px
  card-padding: 24px
  stack-md: 18px
---\n
## Brand & Style
Vantix Obsidian is a high-fidelity, "Stealth Ops" design system optimized for deep-focus security analysis. The aesthetic is clinical, precise, and engineered — like a well-calibrated satellite operations console.

The primary characteristic is **Controlled Contrast** — the background is deep navy-charcoal (#060a14), making **Arctic Cyan** (#22d3ee) telemetry data pop with electric clarity. Glassmorphism is applied with restraint: moderate blur (16px), ultra-thin borders (rgba 0.06 opacity), and subtle tinted shadows that suggest depth without overwhelming data readability.

## Visual Language
- **Deep Foundation:** Using #060a14 as the base surface — avoiding pure black.
- **Luminous Borders:** 1px borders at 6% white opacity for structure; cyan accents at 25% for active states.
- **Monospaced Data:** Geist Mono is the telemetry font for metrics, timestamps, and technical identifiers.
- **Display Typography:** Outfit serves as the display/body font — track-tight, weight-driven hierarchy.
- **Refined Roundedness:** 10px default radius for cards and containers; 6px for compact controls.
- **Spring Physics:** All interactive transitions use cubic-bezier(0.16, 1, 0.3, 1) for weighty, premium feel.
