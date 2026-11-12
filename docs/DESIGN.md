---
name: Sylvan Folio
colors:
  surface: '#faf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#faf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f0'
  surface-container: '#efeeea'
  surface-container-high: '#e9e8e4'
  surface-container-highest: '#e3e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#434840'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f2f1ed'
  outline: '#74796f'
  outline-variant: '#c4c8bd'
  surface-tint: '#4d6546'
  primary: '#344b2e'
  on-primary: '#ffffff'
  primary-container: '#4b6344'
  on-primary-container: '#c2deb7'
  inverse-primary: '#b3cea8'
  secondary: '#4d653f'
  on-secondary: '#ffffff'
  secondary-container: '#cfebba'
  on-secondary-container: '#536b44'
  tertiary: '#354a34'
  on-tertiary: '#ffffff'
  tertiary-container: '#4c624a'
  on-tertiary-container: '#c3dcbe'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cfebc3'
  primary-fixed-dim: '#b3cea8'
  on-primary-fixed: '#0b2008'
  on-primary-fixed-variant: '#364d30'
  secondary-fixed: '#cfebba'
  secondary-fixed-dim: '#b4cfa0'
  on-secondary-fixed: '#0c2003'
  on-secondary-fixed-variant: '#364d29'
  tertiary-fixed: '#d0e9cb'
  tertiary-fixed-dim: '#b5cdb0'
  on-tertiary-fixed: '#0c200d'
  on-tertiary-fixed-variant: '#374c36'
  background: '#faf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e3e2df'
  moss: '#4b6344'
  pine: '#1a2e1a'
  sage: '#8ca67a'
  fern: '#2d4a2d'
  parchment: '#faf9f5'
  moonlit-sage: '#c2d1b8'
  pine-black: '#0a0f0a'
  dark-moss: '#1a241a'
typography:
  display:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.7'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 32px
  margin-mobile: 20px
  margin-desktop: 64px
  reading-width: 720px
  stack-sm: 16px
  stack-md: 32px
  stack-lg: 64px
---

## Brand & Style

The design system moves away from digital sterility toward an atmospheric, environmental experience. It is designed to feel like a quiet sanctuary—evoking the tactile qualities of a botanical field guide or a well-worn library nestled in a forest. The target audience values slow consumption, mindfulness, and editorial quality.

The aesthetic is a sophisticated blend of **Minimalism** and **Tactile** design. It prioritizes "environmental" depth over traditional UI elevation, using organic tones and paper-like textures. The emotional response should be one of calm, focus, and warmth, achieved through a "low-blue-light" philosophy that avoids pure whites and harsh blacks. Subtle paper grain overlays and botanical silhouettes provide a curated, human touch that differentiates it from standard corporate frameworks.

## Colors

This design system uses a palette inspired by the forest floor and canopy. It completely abandons pure white (#FFFFFF) to reduce eye strain and enhance the atmospheric quality.

**Fresh Forest (Light Mode)**
The default mode uses "Warm Parchment" as the brightest point. Surfaces are built using "Sage-tinted" off-whites. The primary action color is "Moss," providing a natural, grounded anchor for the UI.

**Moonlit Forest (Dark Mode)**
The background shifts to "Pine-black," a deep, chromatic green-black. Primary surfaces use "Dark Moss," creating a low-contrast, nocturnal environment. Accents and primary text in dark mode utilize "Moonlit Sage" to mimic the soft glow of moonlight through trees.

> **Scope note:** This dark-mode palette is defined as part of the design system for future use. Product.md does not currently list a light/dark toggle as an in-scope feature — treat this as available design language, not a confirmed v1 requirement, until that's explicitly decided.

Tonal shifts are the primary method of differentiation; surfaces should be derived by tinting the background with a small percentage of Sage or Pine rather than adding gray.

## Typography

The typography system balances editorial elegance with modern legibility.

**Playfair Display** is the primary display face. It should be used for all headlines and storytelling elements. Its high contrast and classical serifs lend an air of authority and timelessness. For large display sizes, tighten the letter spacing slightly to emphasize the ink-on-paper aesthetic.

**Inter** handles all functional UI and long-form body text. It is chosen for its exceptional clarity. To maintain the "unhurried" brand personality, line heights are set generously—never dropping below 1.6x for body copy—to ensure the eye can move easily across the parchment-toned backgrounds.

## Layout & Spacing

The layout philosophy centers on a **Fixed Grid** for content consumption. A central "reading lane" of 720px is used for all narrative content to ensure optimal line lengths.

- **Grid:** A 12-column fluid grid is used for dashboard and gallery views, but individual articles and focused pages must use the centered fixed-width model.
- **Rhythm:** Spacing follows a 4px base, but preference is given to larger "atmospheric" gaps (32px and 64px) to prevent the layout from feeling cluttered.
- **Responsive:** On mobile, margins reduce to 20px. Vertical rhythm should actually increase on mobile to provide more touchable space and a breathable vertical scroll.

## Elevation & Depth

This system rejects the "z-axis shadow" model in favor of **Tonal Layers**. Depth is communicated through color shifts that feel like physical layers of paper or forest canopy.

- **Surface Tiers:** Higher "elevation" is indicated by moving closer to the Sage/Parchment mix. On a parchment background, a surface might be a 5% Sage tint.
- **Borders:** Instead of shadows, use very thin (1px) tonal borders. These borders should be just a few shades darker than the surface they enclose (e.g., a "Fern" border on a "Moss" surface).
- **Atmospheric Depth:** In dark mode, depth is created by varying the "moonlight" saturation. Backgrounds are deep and desaturated; interactive surfaces are slightly lighter and more saturated "Dark Moss."
- **Texture:** A global, low-opacity paper grain texture (.png or SVG filter) should be applied to all primary backgrounds to break the digital flatness.

## Shapes

The shape language is organic and soft, avoiding sharp "technical" corners. The standard radius is 0.5rem (8px), which provides a friendly but structured feel.

For larger environmental containers, such as hero cards or main content blocks, use `rounded-xl` (1.5rem) to reinforce the "soft-edged" indie-game influence. Buttons should feel tactile and approachable, using a 12px (rounded-lg) radius to sit comfortably between a square and a pill shape.

## Components

- **Buttons:** Primary buttons use a solid Moss (#4B6344) fill with Parchment text. They do not use shadows but may use a 1px inner Pine border. Secondary buttons are "Ghost" style with a 1px Sage border and Sage text.
- **Cards:** Cards are defined by their tonal shift and paper texture. They must have a minimum of 32px internal padding to maintain the "editorial" feel.
- **Input Fields:** Backgrounds should be slightly "sunken"—use a Parchment Shadow color with a thin Sage-tinted border. Focus states use a soft 2px ring in Moonlit Sage.
- **Chips & Tags:** Use pill-shaped containers with a very light Sage wash (10% opacity) and deep Moss text. These should feel like small physical labels.
- **Lists:** Abandon dividers where possible, using generous vertical spacing (stack-sm) instead. If dividers are necessary, use a subtle "botanical line"—a horizontal stroke with a tiny leaf or node detail in the center.
- **Botanical Accents:** Use hand-drawn silhouette SVGs (leaves, vines, twigs) for empty states or header decorations. These should be colored in a tone only slightly different from the background to remain "atmospheric" rather than distracting.

### Rich Text Editor

Folio uses a structured rich-text editor that represents blog content as typed content nodes. Supported content includes paragraphs, headings, formatted text, lists, links, images, and code blocks.

Images are represented as content nodes with a source URL, alternative text, and optional caption. **Scope note:** image nodes reference an externally-hosted URL only — the editor does not include file upload or platform-hosted image storage. A student pastes a link to an already-hosted image rather than uploading a file. If platform-hosted image upload is actually intended, that's a bigger scope decision (it needs storage infrastructure that isn't specified anywhere in the current docs) and should be made explicitly rather than assumed from this note.
