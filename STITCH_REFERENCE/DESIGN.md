---
name: Neon Analytics Noir
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c6c9ab'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#909378'
  outline-variant: '#454932'
  surface-tint: '#b8d300'
  primary: '#ffffff'
  on-primary: '#2c3400'
  primary-container: '#d2f000'
  on-primary-container: '#5d6b00'
  inverse-primary: '#576500'
  secondary: '#c6c6c9'
  on-secondary: '#2f3133'
  secondary-container: '#454749'
  on-secondary-container: '#b4b5b7'
  tertiary: '#ffffff'
  on-tertiary: '#2e3135'
  tertiary-container: '#e1e2e7'
  on-tertiary-container: '#626469'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d2f000'
  primary-fixed-dim: '#b8d300'
  on-primary-fixed: '#191e00'
  on-primary-fixed-variant: '#414c00'
  secondary-fixed: '#e2e2e5'
  secondary-fixed-dim: '#c6c6c9'
  on-secondary-fixed: '#1a1c1e'
  on-secondary-fixed-variant: '#454749'
  tertiary-fixed: '#e1e2e7'
  tertiary-fixed-dim: '#c4c6cb'
  on-tertiary-fixed: '#191c20'
  on-tertiary-fixed-variant: '#44474b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 12px
  margin-mobile: 16px
  margin-desktop: 32px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The brand personality is high-stakes, analytical, and precision-engineered. It caters to professional and semi-professional players who view poker through the lens of data and strategy. The UI evokes a "war room" atmosphere—focused, high-tech, and elite.

The design style is **Modern / Sleek High-Tech**. It utilizes deep obsidian backgrounds to create infinite depth, allowing the vibrant lime accents to pop with functional urgency. Key characteristics include:
- **High-Contrast Dark Mode:** Absolute blacks paired with vibrant neon for maximum legibility in low-light environments.
- **Glassmorphism Lite:** Subtle translucency on container surfaces to maintain a sense of layering.
- **Glow & Radiance:** Selective use of outer glows on interactive elements to simulate a physical hardware aesthetic.

## Colors

The palette is optimized for endurance and focus. 

- **Primary (#DFFF00):** A high-visibility "Electric Lime" used for primary actions, success states, and critical data points.
- **Surface Layering:** The background is an absolute black (#0D0D0D). Secondary surfaces use a deep charcoal (#1A1C1E), and tertiary surfaces/interactive states use a slightly lighter grey (#2C2F33).
- **Functional Accents:** Use a muted purple or blue for secondary insights to prevent visual fatigue from the primary lime.
- **Gradients:** Use subtle linear gradients on cards (from #1A1C1E to #111214) to provide subtle volume.

## Typography

This design system uses **Hanken Grotesk** as the primary typeface for its sharp, contemporary geometry and exceptional readability in dark environments. 

**JetBrains Mono** is introduced for labels and data points (ROI, Profit, Count) to emphasize the technical, analytical nature of the platform.

- **Headlines:** Use heavy weights (700+) with tight letter spacing for a commanding presence.
- **Data Points:** Always use monospaced fonts for numerical values to ensure alignment in tables and dashboards.
- **Case:** Use uppercase for labels and section headers to create a "tactical" HUD feel.

## Layout & Spacing

The layout follows a **Fixed Grid** approach for internal content cards to maintain the feel of a dashboard interface, while the outer containers utilize fluid margins.

- **Grid:** A 12-column grid on desktop, transitioning to a 2-column or 1-column layout on mobile.
- **Density:** High information density is encouraged. Use a 4px base unit for all spacing.
- **Groupings:** Related data metrics should be grouped into cards with 12px gutters.
- **Safe Areas:** Ensure a 16px minimum horizontal margin on mobile to prevent content from touching the bezel.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Subtle Outlines** rather than heavy shadows.

- **Level 0 (Background):** #0D0D0D (Pure Black).
- **Level 1 (Cards/Containers):** #1A1C1E with a 1px solid stroke of #2C2F33.
- **Level 2 (Modals/Popovers):** #2C2F33 with a subtle 10% opacity Lime glow (0px 4px 20px) to indicate high priority.
- **Interaction:** Buttons should feel "lit from within." When hovered or active, the primary color should emit a soft glow effect (`box-shadow: 0 0 12px rgba(223, 255, 0, 0.4)`).

## Shapes

The shape language balances professional rigidity with modern approachability.

- **Standard Containers:** Use **0.5rem (8px)** corner radius for cards and input fields.
- **Interactive Elements:** Buttons and chips use **1rem (16px)** or full pill-shapes to distinguish them clearly from layout containers.
- **Icons:** Use thin-stroke, geometric icons that match the corner radius of the typography (e.g., 1.5pt stroke width).

## Components

- **Buttons:** 
  - *Primary:* Solid #DFFF00 background with black text. Pill-shaped.
  - *Secondary:* Dark grey background (#2C2F33) with white text and a 1px border.
- **Data Cards:** 
  - Dark surfaces with centered monospaced metrics. 
  - Include a small icon in the top right or center to represent the metric (e.g., a trophy for "Tournaments").
- **Chips/Filters:** 
  - Use pill-shaped containers. Active state is the primary lime color. Inactive state is a dark outline.
- **Input Fields:** 
  - Subdued dark backgrounds with the bottom border or full stroke turning Lime on focus. 
  - Placeholder text should be low-contrast (#555).
- **Progress Bars:** 
  - Use thin, 4px height bars. The filled portion should use a gradient from Lime to a darker forest green to simulate a glowing "power meter."