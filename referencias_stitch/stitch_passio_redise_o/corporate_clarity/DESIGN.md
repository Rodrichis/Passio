---
name: Corporate Clarity
colors:
  surface: '#f6faff'
  surface-dim: '#b9dffc'
  surface-bright: '#f6faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ebf5ff'
  surface-container: '#e0f0ff'
  surface-container-high: '#d4ebff'
  surface-container-highest: '#c8e6ff'
  on-surface: '#001e2f'
  on-surface-variant: '#3e484d'
  inverse-surface: '#07344b'
  inverse-on-surface: '#e5f2ff'
  outline: '#6e797d'
  outline-variant: '#bdc8cd'
  surface-tint: '#00677d'
  primary: '#00677d'
  on-primary: '#ffffff'
  primary-container: '#219ebc'
  on-primary-container: '#002f3a'
  inverse-primary: '#69d4f4'
  secondary: '#7d5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffb702'
  on-secondary-container: '#6b4b00'
  tertiary: '#934b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#df7500'
  on-tertiary-container: '#452000'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b2ebff'
  primary-fixed-dim: '#69d4f4'
  on-primary-fixed: '#001f27'
  on-primary-fixed-variant: '#004e5f'
  secondary-fixed: '#ffdea9'
  secondary-fixed-dim: '#ffba27'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4100'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb781'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703800'
  background: '#f6faff'
  on-background: '#001e2f'
  surface-variant: '#c8e6ff'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  data-tabular:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  headline-md-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 32px
  margin-mobile: 16px
  card-padding: 24px
  stack-gap: 16px
---

## Brand & Style

The design system is engineered for a professional, SaaS-oriented environment that prioritizes efficiency and trust. The visual language moves away from the "flat and improvised" feel of early-stage MVPs toward a refined **Corporate Modern** aesthetic. 

The personality is authoritative yet accessible, using a balanced mix of cool technical tones and vibrant functional accents. By combining significant whitespace, a structured 12-column grid, and subtle depth through soft elevation, the UI evokes a sense of reliability and architectural order. The target experience is one where data is easily scannable and actions are clearly prioritized.

## Colors

The palette is built on a foundation of professional high-contrast neutrals and functional blues.

- **Primary (#219ebc):** Used for main actions, active states, and primary brand indicators.
- **Secondary (#ffb703):** Reserved for secondary call-to-actions and highlighting key metrics.
- **Tertiary/Orange (#fb8500):** Used sparingly for urgent actions or distinct functional zones like "Canjear premio."
- **Text & Neutral (#023047):** A deep, midnight blue used for all primary text and navigation backgrounds to ensure maximum legibility and a premium feel.
- **Backgrounds:** The canvas uses a soft grey (#f5f5f5) to provide contrast for the pure white (#ffffff) cards, which creates a clean, tiered hierarchy.

## Typography

The typography system uses **Hanken Grotesk** to achieve a sharp, contemporary look that bridges the gap between technical precision and approachability.

- **Hierarchical Weighting:** Titles always use **Bold (700)** in the deep neutral (#023047) to anchor the page.
- **Interactive Elements:** Labels for inputs and navigation items use **Medium (500)** for better definition against white surfaces.
- **Data Display:** Regular weights (400) are used for body copy and list data to maintain readability in data-heavy views.
- **Scale:** Sizes are optimized for a professional dashboard, keeping secondary information compact (14px) while ensuring primary headers (24px-32px) provide immediate orientation.

## Layout & Spacing

The layout is built on a **12-column fluid grid** for desktop, allowing for flexible card widths (e.g., 3-column stats cards, 12-column data tables). 

- **Sidebar:** A fixed width sidebar (260px) in deep neutral (#023047) houses the primary navigation.
- **Gutter & Rhythm:** A consistent 24px gutter ensures that even when cards are densely packed, the interface feels breathable.
- **Rhythm:** Vertical spacing follows an 8px base unit. Component-to-component spacing is typically 24px or 32px to separate logical sections.
- **Mobile Reflow:** On mobile devices, the 12-column grid collapses to a single column with 16px side margins. Cards expand to full width to maximize touch targets.

## Elevation & Depth

This design system uses **Ambient Shadows** to create a clear physical metaphor for depth without the visual noise of heavy borders.

- **Level 1 (Cards):** A very soft, diffused shadow (0px 4px 12px rgba(0, 0, 0, 0.05)) is applied to white cards to lift them off the #f5f5f5 background.
- **Level 2 (Hover/Active):** When a card or interactive element is hovered, the elevation increases slightly (0px 8px 20px rgba(0, 0, 0, 0.08)) to provide tactile feedback.
- **Tonal Layering:** Navigation sidebars and headers are treated as the lowest layer (flat or inset), while primary content "floats" above on the light grey canvas.

## Shapes

The shape language is defined by **Rounded (8px to 12px)** corners, striking a balance between the friendliness of fully rounded "pill" shapes and the rigidity of sharp corners.

- **Base Components:** Buttons and Input fields use an 8px radius.
- **Containers:** Large cards and dashboard widgets use a 12px radius to frame content comfortably.
- **Consistency:** Use the same radius for internal elements (like icons backgrounds) as the parent container to maintain concentric visual harmony.

## Components

### Buttons
- **Primary:** Solid #219ebc with white text. 12px top/bottom padding for a generous, professional feel.
- **Secondary:** Solid #ffb703 with #023047 text for high-visibility secondary actions.
- **States:** Hover states should darken the background color by 10%. Focused states use a 2px offset ring in #8ecae6.

### Cards
- **Structure:** Pure white (#ffffff) background, 12px border radius, and Level 1 elevation.
- **Content:** Standardized 24px internal padding. Use #8ecae6 for small decorative icons within cards to maintain brand cohesion.

### Input Fields
- **Styling:** 1px border in a soft grey (#e0e0e0) that transitions to #219ebc on focus. 
- **Typography:** Placeholder text in #023047 at 40% opacity.

### Lists & Tables
- **Rows:** Eliminate heavy borders; use subtle 1px dividers in #eeeeee.
- **Hover:** Apply a very light blue tint (#f8fbfe) to rows on hover to improve tracking across wide screens.

### Navigation Sidebar
- **Background:** #023047.
- **Active State:** A solid #ffb703 left-accent bar (4px) and white text for the active link. Icons should be refined, thin-stroke SVG variants.