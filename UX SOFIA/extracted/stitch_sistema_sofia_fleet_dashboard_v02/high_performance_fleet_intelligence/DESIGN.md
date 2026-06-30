---
name: High-Performance Fleet Intelligence
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8f9097'
  outline-variant: '#45474c'
  surface-tint: '#bbc7df'
  primary: '#bbc7df'
  on-primary: '#253144'
  primary-container: '#0a1628'
  on-primary-container: '#758096'
  inverse-primary: '#535f74'
  secondary: '#ffb59f'
  on-secondary: '#5e1700'
  secondary-container: '#bf3801'
  on-secondary-container: '#ffe2da'
  tertiary: '#adc8f5'
  on-tertiary: '#133155'
  tertiary-container: '#001631'
  on-tertiary-container: '#6781aa'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7e3fc'
  primary-fixed-dim: '#bbc7df'
  on-primary-fixed: '#101c2e'
  on-primary-fixed-variant: '#3c475b'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59f'
  on-secondary-fixed: '#3a0a00'
  on-secondary-fixed-variant: '#852400'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#adc8f5'
  on-tertiary-fixed: '#001c3b'
  on-tertiary-fixed-variant: '#2d486d'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  kpi-display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  nav-item:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar-width: 220px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-gap: 12px
---

## Brand & Style
The design system focuses on high-density data visualization and proactive fleet management. The aesthetic is ultra-modern and minimalist, drawing inspiration from high-end developer tools and aerospace interfaces. 

The primary goal is to minimize cognitive load by emphasizing data over decorative elements. It utilizes a deep, dark environment to reduce eye strain for operators monitoring screens for long shifts, using a single vivid accent color to draw immediate attention to critical alerts and calls to action. The style is defined by precision, using sharp typography and subtle depth to create a focused, high-performance workspace.

## Colors
This design system utilizes a layered dark-mode palette. The foundation is built on deep navies to provide a sophisticated, non-black background that maintains high contrast for white text and colorful data visualizations.

- **Primary Background**: Used for the main application canvas.
- **Surface/Cards**: Used for elevated containers to provide subtle separation from the background.
- **Accent (Vivid Orange)**: Reserved strictly for primary actions, critical alerts, and active states.
- **Borders**: Used sparingly to define structure without adding visual noise.
- **Status Colors**: Standardized semantic colors for fleet health (Green: Operational, Amber: Warning, Blue: Maintenance).

## Typography
Inter is the exclusive typeface for the design system, chosen for its exceptional legibility in technical interfaces and various weights.

- **KPI Display**: Used for hero numbers on dashboard cards (e.g., active vehicles, total fuel).
- **Headlines**: Used for page titles and section headers.
- **Labels**: Small, uppercase labels are used for metadata and category titles to create a clear hierarchy.
- **Muted Text**: Use the neutral color (#94a3b8) for secondary body text and labels to ensure primary information stands out.

## Layout & Spacing
The layout uses a **fixed-fluid hybrid model**. A permanent 220px sidebar houses global navigation, while the main content area utilizes a fluid grid that expands to fill the viewport.

- **Grid**: A 12-column grid system is used for dashboard layouts. Large KPI cards typically span 3 columns, while data tables span 12.
- **Padding**: Large internal padding (24px) within cards ensures data feels "breathable" and high-end.
- **Mobile Adaptation**: On mobile, the sidebar collapses into a bottom navigation bar or a hamburger menu. Cards stack vertically with 16px margins to maximize screen real estate.

## Elevation & Depth
This design system avoids traditional heavy shadows in favor of **tonal layering** and **subtle glows**.

- **Level 0 (Background)**: `#0a1628` — The base layer.
- **Level 1 (Cards)**: `#0d2050` — Elevated via color shift and a 1px solid border (`#1e3a5f`).
- **Interactive Depth**: On hover, cards receive a subtle outer glow using the accent color at 10% opacity and the border shifts to a slightly brighter blue.
- **Overlays**: Modals and dropdowns use a background-blur (8px) effect with a darker overlay to maintain focus on the task at hand.

## Shapes
The design system uses a "Soft" roundedness profile (4px - 12px) to maintain a professional, engineered feel. 

- **Cards & Buttons**: 8px (0.5rem) corner radius.
- **Badges**: Fully rounded (pill) to distinguish them from interactive buttons.
- **Inputs**: 6px corner radius for a sharp, precise look.

## Components
- **Buttons**: Primary buttons are solid Vivid Orange with white text. Secondary buttons are outlined with the border color.
- **Status Badges**: Small pill shapes with a 10% background tint of the status color and 100% opacity text for the label.
- **Dashboard Cards**: Must include a 24px internal padding. Title labels should use `label-caps` in the muted text color.
- **Inputs**: Large, 48px height tap targets for mobile friendliness. Borders should highlight in Vivid Orange on focus.
- **Sidebar**: Darker than the background (#07101d) to create a clear anchor. Active states are indicated by a 2px orange vertical line on the left edge and white text.
- **Fleet Indicators**: Mini sparklines within list items to show 24-hour performance trends without needing to open a detail view.