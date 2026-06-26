---
name: Velocity Intelligence
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
  on-surface-variant: '#e2bfb0'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#a98a7d'
  outline-variant: '#5a4136'
  surface-tint: '#ffb693'
  primary: '#ffb693'
  on-primary: '#561f00'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#a04100'
  secondary: '#b7c6ed'
  on-secondary: '#21304f'
  secondary-container: '#384667'
  on-secondary-container: '#a6b5db'
  tertiary: '#b6c6f1'
  on-tertiary: '#1f3052'
  tertiary-container: '#8999c1'
  on-tertiary-container: '#203153'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b7c6ed'
  on-secondary-fixed: '#0a1b39'
  on-secondary-fixed-variant: '#384667'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#b6c6f1'
  on-tertiary-fixed: '#071a3c'
  on-tertiary-fixed-variant: '#36466a'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 1440px
---

## Brand & Style
The design system is engineered for high-performance fleet intelligence, targeting logistics directors and operations managers who require precision and speed. The aesthetic is "Technical-Industrial Modernism"—a blend of Corporate Modern reliability with subtle Brutalist structural cues to convey strength and mechanical accuracy. 

The emotional response is one of total control and professional authority. High-contrast interfaces ensure critical data points are immediately legible in high-pressure environments. The system prioritizes functional density, using structured grids and sharp accents to mirror the instrument clusters of high-end machinery.

## Colors
The palette is anchored by a deep **Navy Blue (#0F1F3D)** which serves as the canvas, providing a sophisticated, low-fatigue background for long-duration monitoring. The **Vivid Orange (#FF6B00)** acts as the high-energy signal color, reserved for primary actions, critical alerts, and active focus states. 

Supporting neutrals transition from slate grays to off-whites for maximum readability. Status colors follow industry standards (Success: Emerald, Warning: Amber, Danger: Crimson) but are desaturated slightly to prevent clashing with the primary brand orange.

## Typography
Typography is treated as a functional tool. **Geist** is used for headlines to provide a clean, technical edge. **Inter** handles the bulk of the UI for its exceptional readability in dense layouts. **JetBrains Mono** is utilized for data points, license plates, and timestamps, reinforcing the system's analytical nature.

All labels and captions should use all-caps for "Label-sm" to create clear visual hierarchy against body text. Line heights are kept tight to maximize information density without sacrificing clarity.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for dashboard views and a **fixed 800px column** for form-heavy documents. The spacing rhythm is based on a 4px baseline grid.

### Navigation Structure
Navigation is organized into four distinct functional silos to streamline cognitive load:
- **OPERAÇÃO:** Visão Geral, Equipes, Veículos, Motoristas, KM Diário, Checklist.
- **OCORRÊNCIAS:** Multas, Sinistros.
- **MANUTENÇÃO & DOCUMENTOS:** Revisões, Documentos, Abastecimento.
- **GESTÃO:** Custos, Disponibilidade, Pendências.

### Breakpoints
- **Mobile (< 768px):** Single column, 16px side margins, navigation collapses to a bottom bar or hamburger menu.
- **Tablet (768px - 1024px):** 6-column layout, 20px gutters, persistent sidebar collapses to icons.
- **Desktop (> 1024px):** 12-column layout, 24px margins, fully expanded sidebar.

## Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional shadows. Surfaces are stacked using color luminance:
- **Level 0 (Background):** #0F1F3D.
- **Level 1 (Cards/Sidebar):** #1A2B4D.
- **Level 2 (Modals/Popovers):** #24345A.

Borders are used sparingly to define structure. Use 1px solid strokes in #2D3D5E for UI containers. Interactive elements use a subtle 2px glow of the Primary Orange only when focused or in an active state.

## Shapes
The shape language is "Soft-Industrial." Components use a conservative **0.25rem (4px)** corner radius to maintain a professional, rigid feel while avoiding the harshness of perfect 90-degree angles. Buttons and inputs follow this 4px standard, while smaller utility chips may use 2px for a sharper appearance.

## Components
### Buttons
- **Primary:** Solid #FF6B00 with white or near-black text. Sharp corners (4px).
- **Secondary:** Outlined with #FF6B00, transparent background.
- **Ghost:** Text only, turns #FF6B00 on hover.

### Form Fields
- **Inputs:** Background must be **#0F1F3D**. Borders are #2D3D5E.
- **Focus State:** On focus, the border transitions to **2px solid #FF6B00** with a subtle outer glow.
- **Labels:** Use `label-sm` (JetBrains Mono) placed above the input field.

### Cards & Lists
- Cards use a #1A2B4D background with no shadow and a subtle 1px border.
- List items should have a hover state of #24345A to indicate interactivity.

### Navigation Items
- Active items in the sidebar use a left-aligned 4px vertical bar in Vivid Orange and a high-contrast white text label.