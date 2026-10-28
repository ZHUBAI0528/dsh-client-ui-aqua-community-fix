/**
 * Aqua theme layer: one toggleable visual skin over the whole Web surface.
 * Everything this layer owns is an effect — token overrides ride the theme
 * service's override stack, the CSS hooks ride a `data-dsh-aqua` attribute on
 * <html> (the stylesheet only applies under it), the ambient scene and page
 * fades are mounted/removed with the layer — so switching the flag off (or
 * unloading the plugin) restores the stock UI exactly: no residue, no reload.
 *
 * The enable flag persists in localStorage: a client-only visual preference
 * (like the selected-session key), written and read by this plugin alone.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ensureAmbientScene, removeAmbientScene, ensurePageFades, removePageFades } from './critters.ts'
import { startEdgeMetrics, type EdgeMetricsHandle } from './edge-metrics.ts'
import { attachFluidShader, SITE_FLUID_PARAMS, type FluidParams, type FluidShaderHandle } from './fluid-shader.ts'
import { fluidToneColors, HUE_BASE } from './fluid-tones.ts'
import { deleteVideoBlob, deleteVideoHandle, loadVideoBlob, loadVideoHandle } from './wallpaper-store.ts'
import { attachFluidInteractions } from './fluid-interactions.ts'
import { startSeamStamper } from './seam-stamper.ts'
import { startSubmenuHold } from './submenu-hold.ts'
import { mountWhale, type WhaleHandle } from './whale.ts'
import { mountMesh, type MeshHandle } from './mesh.ts'
import { startSpotlight, SPOTLIGHT_ATTRIBUTE } from './spotlight.ts'
import { FONT_SIZE_SPECS, findPalette, hintColorValue, paletteTokens, type FontRole } from './typography.ts'

/** html attribute selecting the Aqua layer: CSS hooks and ambient effects. */
export const AQUA_ATTRIBUTE = 'data-dsh-aqua'

/**
 * The layer instance that currently owns the DOM gate attributes.
 *
 * A cold boot can compose this plugin more than once (the host re-composes its
 * fiber while the splash is still up). Each instance mounts, and the *older*
 * instance's cleanup may run after the newer one already mounted — and that
 * cleanup used to strip `data-dsh-aqua` / `data-dsh-float` wholesale. The
 * whole stylesheet is gated on those attributes, so the surviving layer kept
 * its settings (the panel still worked) while every rule it owns went inert:
 * the page roots painted their stock opaque fill (an all-white conversation
 * area) and the 会话区不透明度 knob did nothing. Only the owner may release
 * the DOM.
 */
let domOwner: AquaLayer | undefined

/** How many times a failed fluid-canvas attach is retried before giving up. */
const FLUID_RETRY_LIMIT = 8

/** localStorage key carrying the layer enable flag. */
export const AQUA_ENABLED_KEY = 'dsh.ui-aqua.enabled'

/** Default state when nothing is stored yet: on. */
export const DEFAULT_ENABLED = true

/** The layer's identity in the theme override stack (inspection-visible). */
const OVERRIDE_SOURCE = '@zhubai0528/dsh-client-ui-aqua-community-fix'

/** Layout regions whose weights are configurable independently. */
/* The stats dock lives INSIDE the composer bar, so a separate stats region only
   duplicated the composer controls; the right details panel is host-owned and is
   left completely untouched (its width is draggable there). */
const REGIONS = ['sidebar', 'header', 'chat', 'composer'] as const
/** One configurable layout region. */
type RegionKey = typeof REGIONS[number]

/**
 * DOM roots the explanatory-text pass walks, in the same order the CSS uses.
 * Shared by the full scan and the incremental one so both agree on what
 * "belongs to which region".
 */
const HINT_REGIONS: ReadonlyArray<readonly [string, string]> = [
  ['sidebar', '[class*="sidebarCol"]'],
  ['header', '[data-dsh-center] header, [class*="centerCol"] header'],
  ['chat', '[data-conversation-scroll]'],
  ['composer', '[data-composer-card], [data-dsh-inputbar]'],
]

/**
 * Shipped per-region explanatory values. They are deliberately NOT the global
 * defaults: a region's small copy ships at 92% strength, the global knob at 80%.
 * `resetRegion` used the global pair and therefore "reset" a region to a value
 * it never shipped with.
 */
const REGION_HINT_DEFAULTS = { weight: 400, opacity: 92 } as const

/** Override-stack source for the explanatory-text colour (layered above the palette). */
const HINT_COLOR_SOURCE = '@zhubai0528/dsh-client-ui-aqua-community-fix/hint'

/** Override-stack source for the selected text-colour palette (its own layer). */
const PALETTE_SOURCE = '@zhubai0528/dsh-client-ui-aqua-community-fix/typography'

const FONT_STACK = "'Space Grotesk Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', "
  + "'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** Scheme-invariant override value (applied to both palettes). */
const both = (value: string): { light: string; dark: string } => ({ light: value, dark: value })

/**
 * Alias-token override layer: the deep-sea palette. Every value is a
 * `{ light, dark }` pair so the layer stays legible when the user switches
 * the Appearance preference — dark is deep-sea navy, light is cool white-blue.
 */
export const AQUA_TOKEN_OVERRIDES: ThemeTokenOverrides = {
  // Typography: Space Grotesk for Latin/digits, CJK keeps the system stack.
  '--dsw-font-family': both(FONT_STACK),

  // Backgrounds.
  '--dsw-alias-bg-base': { light: '#F4F8FD', dark: '#0C121B' },
  '--dsw-alias-bg-layer-1': { light: '#FFFFFF', dark: '#111A27' },
  '--dsw-alias-bg-layer-2': { light: '#ECF2FA', dark: '#162130' },
  '--dsw-alias-bg-layer-3': { light: '#E2EBF7', dark: '#1C2A3D' },
  '--dsw-alias-bg-overlay': { light: '#DCE7F4', dark: '#22334A' },
  '--dsw-alias-bg-module-platform': { light: '#FFFFFF', dark: '#111A27' },
  '--dsw-alias-bg-multi-select': { light: '#FFFFFF', dark: '#162130' },
  '--dsw-alias-bg-skeleton': { light: 'rgba(19, 45, 83, 0.08)', dark: 'rgba(148, 180, 220, 0.12)' },
  '--dsw-alias-bg-mask-1': { light: 'rgba(19, 37, 62, 0.3)', dark: 'rgba(4, 8, 14, 0.55)' },
  '--dsw-alias-bg-mask-2': { light: 'rgba(19, 37, 62, 0.12)', dark: 'rgba(4, 8, 14, 0.25)' },
  '--dsw-alias-bg-mask-3': { light: 'rgba(19, 37, 62, 0.3)', dark: 'rgba(4, 8, 14, 0.5)' },
  '--dsw-alias-bg-mask-drop': { light: 'rgba(244, 248, 253, 0.72)', dark: 'rgba(12, 18, 27, 0.7)' },

  // Hairlines and strokes.
  '--dsw-alias-border-l1': { light: 'rgba(19, 45, 83, 0.08)', dark: 'rgba(148, 180, 220, 0.08)' },
  '--dsw-alias-border-l2': { light: 'rgba(19, 45, 83, 0.14)', dark: 'rgba(148, 180, 220, 0.15)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(19, 45, 83, 0.1)', dark: 'rgba(148, 180, 220, 0.1)' },
  '--dsw-alias-border-l3': { light: 'rgba(19, 45, 83, 0.22)', dark: 'rgba(148, 180, 220, 0.24)' },
  '--dsw-alias-border-l4': { light: 'rgba(19, 45, 83, 0.32)', dark: 'rgba(148, 180, 220, 0.34)' },
  '--dsw-alias-border-inverted': { light: 'rgba(19, 45, 83, 0.06)', dark: 'rgba(148, 180, 220, 0.12)' },
  '--dsw-alias-border-inverted2': { light: 'rgba(19, 45, 83, 0.08)', dark: 'rgba(148, 180, 220, 0.08)' },

  // Text ink.
  '--dsw-alias-label-primary': { light: '#13243E', dark: '#EAF2FC' },
  '--dsw-alias-label-secondary': { light: '#40597A', dark: '#AFC3DC' },
  '--dsw-alias-label-tertiary': { light: '#5D7696', dark: '#8399B5' },
  '--dsw-alias-label-caption': { light: '#7E93AC', dark: '#6B829F' },
  '--dsw-alias-label-dimmed': { light: '#C9D4E2', dark: '#4E5F76' },
  '--dsw-alias-label-primary-bluish': { light: '#2E5EB8', dark: '#BFD6F6' },
  '--dsw-alias-label-primary-dimmed': { light: '#1E3556', dark: '#D7E3F4' },
  '--dsw-alias-label-primary-inverted': { light: '#FFFFFF', dark: '#162130' },
  '--dsw-alias-label-primary-foreground': { light: '#FFFFFF', dark: '#FFFFFF' },

  // Brand (wordmark ink stays scheme ink; accents go business blue).
  '--dsw-alias-brand-primary': { light: '#13243E', dark: '#EAF2FC' },
  '--dsw-alias-brand-text': { light: '#13243E', dark: '#EAF2FC' },
  '--dsw-alias-brand-primary-invert': { light: '#FFFFFF', dark: '#0C121B' },
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: '#3F76D8', dark: '#6E9BE8' },

  // States.
  '--dsw-alias-state-business-primary': { light: '#3F76D8', dark: '#6E9BE8' },
  '--dsw-alias-state-business-tertiary': { light: '#DCE9FB', dark: '#1D2C44' },
  '--dsw-alias-state-success-tertiary': { light: '#DDF3E4', dark: '#12271C' },
  '--dsw-alias-state-warn-tertiary': { light: '#FCEED6', dark: '#2A2416' },

  // Buttons: the primary action becomes business blue with white ink.
  '--dsw-alias-button-primary-fill': { light: '#3F76D8', dark: '#4A7FD9' },
  '--dsw-alias-button-primary-hover': { light: '#5C8DE0', dark: '#5E8FE6' },
  '--dsw-alias-button-primary-dimmed': { light: '#DCE9FB', dark: '#162130' },
  '--dsw-alias-button-info-fill': { light: '#3F76D8', dark: '#6E9BE8' },
  '--dsw-alias-button-info-hover': { light: '#5C8DE0', dark: '#7FA8EF' },
  '--dsw-alias-button-elevated-fill': { light: '#FFFFFF', dark: '#162130' },
  '--dsw-alias-button-floating-fill': { light: '#FFFFFF', dark: '#162130' },
  '--dsw-alias-button-floating-hover': { light: '#F0F5FB', dark: '#1C2A3D' },
  '--dsw-alias-button-contrast-fill': { light: '#26364D', dark: '#EAF2FC' },
  '--dsw-alias-button-ghost-active-fill': { light: '#DCE7F4', dark: '#1C2A3D' },
  '--dsw-alias-button-ghost-active-hover': { light: '#E9F0F8', dark: '#162130' },
  '--dsw-alias-button-ghost-active-border': { light: '#8FA3BC', dark: '#6B829F' },

  // Interaction fills.
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(63, 118, 216, 0.08)', dark: 'rgba(126, 164, 223, 0.1)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(63, 118, 216, 0.14)', dark: 'rgba(126, 164, 223, 0.2)' },
  '--dsw-alias-interactive-bg-active': { light: 'rgba(63, 118, 216, 0.2)', dark: 'rgba(126, 164, 223, 0.26)' },
  '--dsw-alias-interactive-bg-hover-danger': { light: 'rgba(236, 19, 19, 0.05)', dark: 'rgba(242, 90, 90, 0.14)' },
  '--dsw-alias-interactive-bg-hover-solid': { light: '#F0F5FB', dark: '#1C2A3D' },

  // Markdown / code surfaces.
  '--dsw-alias-markdown-code-block': { light: '#F0F5FB', dark: '#0D141F' },
  '--dsw-alias-markdown-code-block-banner': { light: '#F5F8FD', dark: '#121B29' },
  '--dsw-alias-markdown-inline-code': { light: '#E4EDF8', dark: '#172334' },
  '--dsw-alias-markdown-citation': { light: '#EAF1F9', dark: '#1A2534' },
  '--dsw-alias-markdown-tag': { light: '#E4EDF8', dark: '#162130' },
  '--dsw-alias-markdown-placeholder': { light: '#EAF1F9', dark: '#131D2B' },
  '--dsw-alias-markdown-code-segment-selected': { light: '#FFFFFF', dark: '#1C2A3D' },
  '--dsw-alias-markdown-code-segment-unselected': { light: '#F0F5FB', dark: '#0F1723' },

  // Scrollbars.
  '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(63, 118, 216, 0.28)', dark: 'rgba(126, 164, 223, 0.28)' },
  '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(63, 118, 216, 0.4)', dark: 'rgba(126, 164, 223, 0.36)' },
  '--dsw-alias-scrollbar-hover-l1': { light: 'rgba(63, 118, 216, 0.5)', dark: 'rgba(126, 164, 223, 0.44)' },
  '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(63, 118, 216, 0.6)', dark: 'rgba(126, 164, 223, 0.52)' },

  // Specific surfaces. The sidebar root fill goes transparent — the glass
  // panel styling lives on the column itself, so no double tint.
  '--dsw-specific-sidebar-fill': { light: 'transparent', dark: 'transparent' },
  '--dsw-specific-sidebar-nav-item-active': { light: '#DEE9F8', dark: '#1B283A' },
  '--dsw-specific-sidebar-nav-item-hover': { light: '#E9F0F8', dark: '#15202F' },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: '#3F76D8', dark: '#6E9BE8' },
  '--dsw-specific-input-major': { light: '#FFFFFF', dark: '#101927' },
  '--dsw-specific-login-input': { light: '#F0F5FB', dark: '#0D141F' },
  '--dsw-specific-menu': { light: '#EAF1F9', dark: '#162130' },
  '--dsw-specific-selector': { light: '#EAF1F9', dark: '#1C2A3D' },
  '--dsw-specific-bubble': { light: '#F0F5FC', dark: '#121C2A' },
  '--dsw-specific-bubble-highlight': { light: '#DCE9FB', dark: '#1A283A' },
  '--dsw-specific-tip': { light: '#EAF1F9', dark: '#131D2B' },
  '--dsw-alias-toast-bg': { light: '#1B3256', dark: '#1C2A3D' },
  '--dsw-alias-tooltip-bg': { light: '#13243E', dark: '#162130' },

  // Elevation shadows (blue-tinted depth).
  '--dsw-shadow-lv1': { light: '0 2px 4px rgba(19, 45, 83, 0.06)', dark: '0 2px 4px rgba(2, 6, 14, 0.5)' },
  '--dsw-shadow-lv1-blur': { light: '0 4px 12px rgba(19, 45, 83, 0.05)', dark: '0 4px 12px rgba(2, 6, 14, 0.4)' },
  '--dsw-shadow-lv2': {
    light: '0 4px 12px rgba(19, 45, 83, 0.05), 0 2px 8px rgba(19, 45, 83, 0.06)',
    dark: '0 4px 12px rgba(2, 6, 14, 0.4), 0 2px 8px rgba(2, 6, 14, 0.35)',
  },
  '--dsw-shadow-lv3': {
    light: '0 0 1px rgba(19, 45, 83, 0.08), 0 12px 32px rgba(19, 45, 83, 0.12)',
    dark: '0 0 1px rgba(2, 6, 14, 0.6), 0 12px 32px rgba(2, 6, 14, 0.55)',
  },
}


/** Read the persisted enable flag (absent storage means on). */
function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(AQUA_ENABLED_KEY)
    return raw === null ? DEFAULT_ENABLED : raw === 'true'
  } catch {
    return DEFAULT_ENABLED
  }
}

/** Persist the enable flag (storage failures keep the in-memory state). */
function writeEnabled(value: boolean): void {
  try {
    localStorage.setItem(AQUA_ENABLED_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Tunable layer knobs, persisted independently of the enable flag. */
export interface AquaSettings {
  /** Glass backdrop blur radius, px. */
  blur: number
  /** Glass fill opacity, 0-100 (50 = the shipped look; drives the frost multiplier). */
  frost: number
  /** Fluid hue, degrees (0-360, continuous). */
  fluidHue: number
  /** Fluid depth, 0-100 (0 = deep saturated, 100 = pale light, continuous). */
  fluidDepth: number
  /** Background brightness, 0-100 (0 = pure black, 50 = transparent, 100 = pure white). */
  /** Background brightness for the LIGHT appearance (50 = off, 100 = pure white). */
  bgBrightnessLight: number
  /** Background brightness for the DARK appearance (0 = pure black, 50 = off). */
  bgBrightnessDark: number
  /** Backdrop source: the living fluid board or a custom wallpaper. */
  background: 'fluid' | 'wallpaper'
  /** Wallpaper image data URL (empty until one is picked). */
  wallpaper: string
  /** Particle whale in the chat area center (the harness hero fish). */
  whale: boolean
  /** Ambient marine life (fish / bubbles / plankton). */
  critters: boolean
  /** Interactive mesh (the site's dot-grid with pointer repel). */
  mesh: boolean
  /** Cursor spotlight glow that follows the pointer over the glass panes. */
  spotlight: boolean
  /** Keep a hover-opened submenu open when the same row is clicked. */
  submenuHold: boolean
  /** Submenu/popup surface opacity, 0-100 (0 = clear glass, 100 = solid). */
  menuOpacity: number
  /** Chat surface veil, 0-100 (0 = the backdrop shows untouched, 100 = an opaque chat slab). */
  chatAlpha: number
  /** Wallpaper blur radius, px. */
  wallpaperBlur: number
  /** Wallpaper frost veil, 0-100. */
  wallpaperFrost: number
  /** Video wallpaper blur radius, px (0 = crisp, 40 = heavy acrylic). */
  videoBlur: number
  /** Video wallpaper brightness, 0-100 (100 = fully lit, 0 = deepest dim). */
  videoBrightness: number
  /* ---------- Typography settings ---------- */
  /* Font families and sizes are MIRRORS of the host theme service (设置 → 外观).
     The panel writes through theme.setFontFamily / theme.setFontSize and re-reads
     the result, so the two surfaces can never disagree and 设置 里改的立刻在这显示. */
  /** Conversation font stack. Empty = the host's own stack. */
  fontText: string
  /** Code-block font stack. Empty = the host's own stack. */
  fontCode: string
  /** Conversation font size, px (host range 10-22). */
  fontSizeText: number
  /** Code-block font size, px (host range 10-16). */
  fontSizeCode: number
  /** Sidebar terminal font size, px (host range 10-20). */
  fontSizeTerminal: number
  /** Line-height multiplier layered over the host rhythm (1.0 = tightest). */
  lineHeight: number
  /** Body font weight (300-800). */
  weightBody: number
  /** Heading font weight (400-800). */
  weightHeading: number
  /** Text-colour palette id (see typography.ts). */
  palette: string
  /** Appearance preference — the SAME value as 设置 → 外观 (light / dark / system). */
  preference: 'light' | 'dark' | 'system'
  /* Per-region weights. 0 means "follow the global body/heading weight". */
  /** Body weight inside the left glass sidebar. */
  weightBodySidebar: number
  /** Heading weight inside the left glass sidebar. */
  weightHeadingSidebar: number
  /** Body weight inside the top glass header. */
  weightBodyHeader: number
  /** Heading weight inside the top glass header. */
  weightHeadingHeader: number
  /** Body weight inside the conversation column. */
  weightBodyChat: number
  /** Heading weight inside the conversation column. */
  weightHeadingChat: number
  /** Body weight inside the bottom composer. */
  weightBodyComposer: number
  /** Heading weight inside the bottom composer. */
  weightHeadingComposer: number
  /* Explanatory / small copy: its own weight, strength and family. */
  /** Weight for explanatory text (300-800). */
  hintWeight: number
  /** Strength of explanatory text, 40-100 (100 = as strong as body text). */
  hintOpacity: number
  /** Font stack for explanatory text; empty = follow the body font. */
  hintFont: string
  /** Explanatory-text colour preset id; empty = follow the colour scheme. */
  hintColor: string
  /* Conversation-area blur split: the transcript and sibling routes (settings /
     feature pages) are separate surfaces with different densities. */
  /** Blur radius for the conversation detail column, px. */
  blurChat: number
  /** Blur radius for menu pages / feature pages, px. */
  blurPages: number
  /* Per-region explanatory text: weight / strength / colour, four regions. */
  hintWeightSidebar: number
  hintOpacitySidebar: number
  hintColorSidebar: string
  hintWeightHeader: number
  hintOpacityHeader: number
  hintColorHeader: string
  hintWeightChat: number
  hintOpacityChat: number
  hintColorChat: string
  hintWeightComposer: number
  hintOpacityComposer: number
  hintColorComposer: string
  /* Conversation-only colour scheme (empty = follow the global font colour). */
  paletteChat: string
}

/** Shipped defaults — what a first-time install sees (the tuned look). */
const SETTINGS_DEFAULTS: AquaSettings = {
  blur: 20,
  frost: 7,
  bgBrightnessLight: 50,
  bgBrightnessDark: 50,
  background: 'fluid',
  wallpaper: '',
  whale: true,
  critters: true,
  mesh: true,
  spotlight: true,
  submenuHold: true,
  menuOpacity: 96,
  chatAlpha: 25,
  fluidHue: 320,
  fluidDepth: 25,
  wallpaperBlur: 0,
  wallpaperFrost: 0,
  videoBlur: 6,
  videoBrightness: 45,
  /* Typography defaults: the four mirrored fields are re-read from the host on
     mount; only the three knobs the host does not own are persisted here. */
  fontText: '',
  fontCode: '',
  fontSizeText: FONT_SIZE_SPECS.text.default,
  fontSizeCode: FONT_SIZE_SPECS.code.default,
  fontSizeTerminal: FONT_SIZE_SPECS.terminal.default,
  lineHeight: 1.5,
  weightBody: 400,
  weightHeading: 600,
  palette: 'ink',
  /* Mirrored from the host theme service on every mount, never persisted here:
     setting it in 设置 or in this panel writes the same host field. */
  preference: 'system',
  /* Region weights: 0 = follow the global knob, so a global change still lands. */
  weightBodySidebar: 0,
  weightHeadingSidebar: 0,
  weightBodyHeader: 0,
  weightHeadingHeader: 0,
  weightBodyChat: 0,
  weightHeadingChat: 0,
  weightBodyComposer: 0,
  weightHeadingComposer: 0,
  hintWeight: 400,
  hintOpacity: 80,
  hintFont: '',
  hintColor: '',
  blurChat: 14,
  blurPages: 14,
  hintWeightSidebar: 400,
  hintOpacitySidebar: 92,
  hintColorSidebar: '',
  hintWeightHeader: 400,
  hintOpacityHeader: 92,
  hintColorHeader: '',
  hintWeightChat: 400,
  hintOpacityChat: 92,
  hintColorChat: '',
  hintWeightComposer: 400,
  hintOpacityComposer: 92,
  hintColorComposer: '',
  paletteChat: '',
}

/** Numeric knob keys and their localStorage names. */
const NUMERIC_KEYS = {
  blur: 'dsh.ui-aqua.blur',
  frost: 'dsh.ui-aqua.frost',
  fluidHue: 'dsh.ui-aqua.fluidHue',
  fluidDepth: 'dsh.ui-aqua.fluidDepth',
  bgBrightnessLight: 'dsh.ui-aqua.bgBrightnessLight',
  bgBrightnessDark: 'dsh.ui-aqua.bgBrightnessDark',
  chatAlpha: 'dsh.ui-aqua.chatAlpha',
  menuOpacity: 'dsh.ui-aqua.menuOpacity',
  wallpaperBlur: 'dsh.ui-aqua.wallpaperBlur',
  wallpaperFrost: 'dsh.ui-aqua.wallpaperFrost',
  videoBlur: 'dsh.ui-aqua.videoBlur',
  videoBrightness: 'dsh.ui-aqua.videoBrightness',
  /* Typography numeric keys (host sizes are NOT stored here — they live in 设置) */
  lineHeight: 'dsh.ui-aqua.lineHeight',
  weightBody: 'dsh.ui-aqua.weightBody',
  weightHeading: 'dsh.ui-aqua.weightHeading',
  weightBodySidebar: 'dsh.ui-aqua.wBodySidebar',
  weightHeadingSidebar: 'dsh.ui-aqua.wHeadingSidebar',
  weightBodyHeader: 'dsh.ui-aqua.wBodyHeader',
  weightHeadingHeader: 'dsh.ui-aqua.wHeadingHeader',
  weightBodyChat: 'dsh.ui-aqua.wBodyChat',
  weightHeadingChat: 'dsh.ui-aqua.wHeadingChat',
  weightBodyComposer: 'dsh.ui-aqua.wBodyComposer',
  weightHeadingComposer: 'dsh.ui-aqua.wHeadingComposer',
  hintWeight: 'dsh.ui-aqua.hintWeight',
  hintOpacity: 'dsh.ui-aqua.hintOpacity',
  blurChat: 'dsh.ui-aqua.blurChat',
  blurPages: 'dsh.ui-aqua.blurPages',
  hintWeightSidebar: 'dsh.ui-aqua.hintWSidebar',
  hintOpacitySidebar: 'dsh.ui-aqua.hintOSidebar',
  hintWeightHeader: 'dsh.ui-aqua.hintWHeader',
  hintOpacityHeader: 'dsh.ui-aqua.hintOHeader',
  hintWeightChat: 'dsh.ui-aqua.hintWChat',
  hintOpacityChat: 'dsh.ui-aqua.hintOChat',
  hintWeightComposer: 'dsh.ui-aqua.hintWComposer',
  hintOpacityComposer: 'dsh.ui-aqua.hintOComposer',
} as const
type NumericKey = keyof typeof NUMERIC_KEYS

/** String knob keys (font family, colors). */
const STRING_KEYS = {
  palette: 'dsh.ui-aqua.palette',
  hintFont: 'dsh.ui-aqua.hintFont',
  /* Font families are owned HERE, not mirrored from the host: the host write
     lands on --dsh-font-family-{role} which nothing consumes, and reading it
     back returned '' — that is what snapped the picker to the default. */
  fontText: 'dsh.ui-aqua.fontText',
  fontCode: 'dsh.ui-aqua.fontCode',
  hintColor: 'dsh.ui-aqua.hintColor',
  hintColorSidebar: 'dsh.ui-aqua.hintCSidebar',
  hintColorHeader: 'dsh.ui-aqua.hintCHeader',
  hintColorChat: 'dsh.ui-aqua.hintCChat',
  hintColorComposer: 'dsh.ui-aqua.hintCComposer',
  paletteChat: 'dsh.ui-aqua.paletteChat',
} as const
type StringKey = keyof typeof STRING_KEYS

const BACKGROUND_KEY = 'dsh.ui-aqua.background'
const WALLPAPER_KEY = 'dsh.ui-aqua.wallpaper'
const WHALE_KEY = 'dsh.ui-aqua.whale'
const CRITTERS_KEY = 'dsh.ui-aqua.critters'
const MESH_KEY = 'dsh.ui-aqua.mesh'
const SPOTLIGHT_KEY = 'dsh.ui-aqua.spotlight'
const SUBMENU_HOLD_KEY = 'dsh.ui-aqua.submenuHold'

/** Region → the two settings fields that carry its body / heading weight. */
const REGION_WEIGHT_FIELDS = {
  sidebar: { body: 'weightBodySidebar', heading: 'weightHeadingSidebar' },
  header: { body: 'weightBodyHeader', heading: 'weightHeadingHeader' },
  chat: { body: 'weightBodyChat', heading: 'weightHeadingChat' },
  composer: { body: 'weightBodyComposer', heading: 'weightHeadingComposer' },
} as const satisfies Record<RegionKey, { body: NumericKey, heading: NumericKey }>

/** Region → the three explanatory-text fields it owns. */
const REGION_HINT_FIELDS = {
  sidebar: { weight: 'hintWeightSidebar', opacity: 'hintOpacitySidebar', color: 'hintColorSidebar' },
  header: { weight: 'hintWeightHeader', opacity: 'hintOpacityHeader', color: 'hintColorHeader' },
  chat: { weight: 'hintWeightChat', opacity: 'hintOpacityChat', color: 'hintColorChat' },
  composer: { weight: 'hintWeightComposer', opacity: 'hintOpacityComposer', color: 'hintColorComposer' },
} as const satisfies Record<RegionKey, { weight: NumericKey, opacity: NumericKey, color: StringKey }>

/** Clamp a numeric knob into its sane range. */
function clampSetting(key: NumericKey, value: number): number {
  const max = key === 'blur' || key === 'wallpaperBlur' || key === 'videoBlur' ? 40
    : key === 'bgBrightnessDark' ? 50
    : key === 'frost' || key === 'wallpaperFrost' || key === 'bgBrightnessLight' || key === 'videoBrightness' || key === 'chatAlpha' || key === 'menuOpacity' ? 100
    : key === 'lineHeight' ? 2.5
    : key === 'blurChat' || key === 'blurPages' ? 40
    : key === 'hintOpacity' || key.startsWith('hintOpacity') ? 100
    : key === 'weightBody' || key === 'weightHeading' || key === 'hintWeight' ? 800
    : key.startsWith('weightBody') || key.startsWith('weightHeading') || key.startsWith('hintWeight') ? 800
      : 360
  const min = key === 'bgBrightnessLight' ? 50
    : key === 'lineHeight' ? 1
    : key === 'hintOpacity' || key.startsWith('hintOpacity') ? 40
    : key === 'weightBody' || key === 'weightHeading' || key === 'hintWeight' ? 300
    : key.startsWith('weightBody') || key.startsWith('weightHeading') ? 0
    : key.startsWith('hintWeight') ? 300
      : 0
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : SETTINGS_DEFAULTS[key]
}

/** Read one numeric knob from localStorage (absent/parse failure means the default). */
function readSetting(key: NumericKey): number {
  try {
    const raw = localStorage.getItem(NUMERIC_KEYS[key])
    return raw === null ? SETTINGS_DEFAULTS[key] : clampSetting(key, Number(raw))
  } catch {
    return SETTINGS_DEFAULTS[key]
  }
}

/** Persist one numeric knob (storage failures keep the in-memory state). */
function writeSetting(key: NumericKey, value: number): void {
  try {
    localStorage.setItem(NUMERIC_KEYS[key], String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the backdrop source ('fluid' or 'wallpaper'). */
function readBackground(): 'fluid' | 'wallpaper' {
  try {
    return localStorage.getItem(BACKGROUND_KEY) === 'wallpaper' ? 'wallpaper' : 'fluid'
  } catch {
    return 'fluid'
  }
}

/** Persist the backdrop source. */
function writeBackground(value: 'fluid' | 'wallpaper'): void {
  try {
    localStorage.setItem(BACKGROUND_KEY, value)
  } catch {
    /* in-memory state still applies */
  }
}

/** Read the wallpaper data URL (absent/oversized means empty). */
function readWallpaper(): string {
  try {
    return localStorage.getItem(WALLPAPER_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Persist the wallpaper data URL (quota failures keep it in memory only). */
function writeWallpaper(value: string): void {
  try {
    localStorage.setItem(WALLPAPER_KEY, value)
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read one string knob from localStorage (absent means default). */
function readStringSetting(key: StringKey): string {
  try {
    return localStorage.getItem(STRING_KEYS[key]) ?? SETTINGS_DEFAULTS[key]
  } catch {
    return SETTINGS_DEFAULTS[key]
  }
}

/** Persist one string knob. */
function writeStringSetting(key: StringKey, value: string): void {
  try {
    localStorage.setItem(STRING_KEYS[key], value)
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the particle-whale flag (absent means on). */
function readWhale(): boolean {
  try {
    const raw = localStorage.getItem(WHALE_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the particle-whale flag. */
function writeWhale(value: boolean): void {
  try {
    localStorage.setItem(WHALE_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the critters flag (absent means on). */
function readCritters(): boolean {
  try {
    const raw = localStorage.getItem(CRITTERS_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the critters flag. */
function writeCritters(value: boolean): void {
  try {
    localStorage.setItem(CRITTERS_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the interactive-mesh flag (absent means on). */
function readMesh(): boolean {
  try {
    const raw = localStorage.getItem(MESH_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the interactive-mesh flag. */
function writeMesh(value: boolean): void {
  try {
    localStorage.setItem(MESH_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the cursor-spotlight flag (absent means on). */
function readSpotlight(): boolean {
  try {
    const raw = localStorage.getItem(SPOTLIGHT_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the cursor-spotlight flag. */
function writeSpotlight(value: boolean): void {
  try {
    localStorage.setItem(SPOTLIGHT_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the submenu click-hold flag (absent means on). */
function readSubmenuHold(): boolean {
  try {
    const raw = localStorage.getItem(SUBMENU_HOLD_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the submenu click-hold flag. */
function writeSubmenuHold(value: boolean): void {
  try {
    localStorage.setItem(SUBMENU_HOLD_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Current scheme from the presenter-owned body attribute. */
function activeScheme(): 'light' | 'dark' {
  return document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
}

/**
 * Owns the Aqua layer lifecycle: reads the durable enable flag, and applies /
 * retracts every layer on change. Cross-tab flips arrive through the storage
 * event; every subscription and mounted effect are released when the plugin
 * fiber is disposed.
 */
export class AquaLayer {
  private enabled = false
  private settings: AquaSettings = { ...SETTINGS_DEFAULTS }
  /** Resolved palette scheme: dark = the brightness knob darkens, light = it brightens. */
  private dark = false
  private tokenDisposer: (() => void) | undefined
  /** Disposer of the text-colour palette override layer. */
  private paletteDisposer: (() => void) | undefined
  /** Palette id the current override layer was built from (guards churn). */
  private appliedPalette: string | undefined
  /** Disposer of the explanatory-text colour layer. */
  private hintColorDisposer: (() => void) | undefined
  /** Hint colour id the current layer was built from (re-entrancy guard). */
  private appliedHintColor: string | undefined
  /** Watches the DOM so newly rendered explanatory nodes get their weight mark. */
  private hintObserver: MutationObserver | undefined
  /** Throttle for the marking pass. */
  private hintStampTimer: number | undefined
  /** Nodes added since the last marking pass (the only real work per frame). */
  private hintPending = new Set<HTMLElement>()
  /** Per-region explanatory colour, re-probed only when the theme re-applies. */
  private hintTargets = new Map<string, { root: HTMLElement, color: string }>()
  /** Queued rAF pass for {@link scheduleApply}. */
  private applyFrame: number | undefined
  private mainFluid: FluidShaderHandle | undefined
  private interactionDisposer: (() => void) | undefined
  private themeListener: (() => void) | undefined
  private seamDisposer: (() => void) | undefined
  private submenuHoldDisposer: (() => void) | undefined
  private attributeGuard: MutationObserver | undefined
  private schemeObserver: MutationObserver | undefined
  private fluidRetryTimer: number | undefined
  private fluidRetries = 0
  private lateApplyTimers: number[] = []
  private spotlightDisposer: (() => void) | undefined
  private edgeMetrics: EdgeMetricsHandle | undefined
  private whaleHandle: WhaleHandle | undefined
  private meshHandle: MeshHandle | undefined
  /** Object URL of the current large-video wallpaper (revoked on replace). */
  private videoObjectUrl: string | undefined
  /** IndexedDB id backing the current object URL (guards against reloads). */
  private videoBlobId: string | undefined
  private readonly ctx: Context

  /**
   * @param ctx - owning client context.
   */
  constructor(ctx: Context) {
    this.ctx = ctx
    ctx.effect(() => {
      const onStorage = (event: StorageEvent): void => {
        if (event.key === AQUA_ENABLED_KEY) {
          this.enabled = readEnabled()
          this.sync()
        }
        const key = event.key
        if (key !== null && (key in NUMERIC_KEYS || key in STRING_KEYS || key === BACKGROUND_KEY || key === WALLPAPER_KEY || key === WHALE_KEY || key === CRITTERS_KEY || key === MESH_KEY || key === SPOTLIGHT_KEY)) {
          this.reloadSettings()
          if (this.enabled) { this.scheduleApply(); this.applyTokens(); this.applyFluidPalettes(); this.syncWhale() }
        }
      }
      window.addEventListener('storage', onStorage)
      // Follow the Appearance switch: the brightness knob's half-range and
      // the overlay direction flip with the resolved scheme (`system` follows
      // the OS). Runs even while disabled so the settings row stays correct.
      this.themeListener = this.ctx.on('theme/change', () => {
        this.dark = this.resolveScheme()
        // 设置 → 外观 may have moved; keep the panel's cubes in sync.
        this.settings.preference = this.readThemePreference()
        // 设置 → 外观 can move the sizes as well; without this the panel kept
        // showing the boot snapshot and the next drag overwrote the host value.
        this.refreshThemeTypography()
        this.whaleHandle?.setDark(this.dark)
        if (this.enabled) {
          this.scheduleApply()
          this.applyFluidPalettes()
        }
      })
      return () => {
        window.removeEventListener('storage', onStorage)
        this.themeListener?.()
        this.themeListener = undefined
        this.dispose()
        this.unmount()
      }
    }, 'ui-aqua: layer lifecycle')
    this.enabled = readEnabled()
    this.reloadSettings()
    this.dark = this.resolveScheme()
    this.sync()
    // Interaction shim: independent of the visual flip — turning the glass
    // theme off must not change how submenus answer a click.
    this.syncSubmenuHold()
  }

  /** Current enable state (the settings row mirrors this). */
  getEnabled(): boolean {
    return this.enabled
  }

  /** Current knob values (the settings row mirrors these). */
  getSettings(): AquaSettings {
    return { ...this.settings }
  }

  /** Whether the resolved palette is dark (the brightness knob darkens). */
  getDark(): boolean {
    return this.dark
  }

  /**
   * Whether the resolved palette is dark.
   *
   * The stylesheet splits every scheme-sensitive surface on
   * `body[data-ds-dark-theme]`, so that attribute — not the theme service — is
   * the authority here. Asking the service first used to be fine on a warm
   * page, but a cold boot can mount this layer before the service has resolved
   * the stored preference: it then answered "dark" while the document was
   * light, and applySettings wrote `--dsh-aqua-chat-white: 0` for a light
   * page. The light veil therefore resolved to transparent, exposing the
   * opaque page fill (an all-white conversation area) and making the
   * 会话区不透明度 knob inert — while dark mode, which reads the other
   * variable, kept working. The service is still consulted, but only as a
   * fallback when the document carries no signal at all.
   */
  private resolveScheme(): boolean {
    if (typeof document !== 'undefined' && document.body.hasAttribute('data-ds-dark-theme')) return true
    if (typeof document !== 'undefined' && document.body.isConnected) return false
    try {
      return this.ctx.theme.getTheme().active.colorScheme === 'dark'
    } catch {
      return activeScheme() === 'dark'
    }
  }

  /** Re-read every knob from localStorage into memory. */
  private reloadSettings(): void {
    try {
      // One-shot cleanup: knobs from reverted iterations never shipped.
      localStorage.removeItem('dsh.ui-aqua.tilt')
      localStorage.removeItem('dsh.ui-aqua.lens')
      localStorage.removeItem('dsh.ui-aqua.fluidTone')
      // The hover-press tilt shipped and was withdrawn: any stored flag is
      // obsolete (the effect re-rasterizes glass panes and blurs text).
      localStorage.removeItem('dsh.ui-aqua.press')
      localStorage.removeItem('dsh.ui-aqua.entrance')
      // The first typography pass wrote its own variables and colours; the
      // host theme service owns those values now, so the leftovers are dead.
      localStorage.removeItem('dsh.ui-aqua.fontFamily')
      localStorage.removeItem('dsh.ui-aqua.fontSizeBase')
      localStorage.removeItem('dsh.ui-aqua.fontWeightBody')
      localStorage.removeItem('dsh.ui-aqua.fontWeightHeading')
      localStorage.removeItem('dsh.ui-aqua.fontSmoothing')
      localStorage.removeItem('dsh.ui-aqua.fontColorPrimary')
      localStorage.removeItem('dsh.ui-aqua.fontColorSecondary')
      // The single brightness knob was split per appearance: move the old value
      // into the half it must have come from (the knob never offered the other
      // half), then drop the legacy key so this migration runs once.
      const legacyBrightness = localStorage.getItem('dsh.ui-aqua.bgBrightness')
      if (legacyBrightness !== null) {
        const legacy = Number(legacyBrightness)
        if (Number.isFinite(legacy)) {
          if (legacy > 50 && localStorage.getItem(NUMERIC_KEYS.bgBrightnessLight) === null) {
            localStorage.setItem(NUMERIC_KEYS.bgBrightnessLight, String(Math.min(100, legacy)))
          }
          if (legacy < 50 && localStorage.getItem(NUMERIC_KEYS.bgBrightnessDark) === null) {
            localStorage.setItem(NUMERIC_KEYS.bgBrightnessDark, String(Math.max(0, legacy)))
          }
        }
        localStorage.removeItem('dsh.ui-aqua.bgBrightness')
      }
    } catch {
      /* ignore */
    }
    this.settings = {
      blur: readSetting('blur'),
      frost: readSetting('frost'),
      fluidHue: readSetting('fluidHue'),
      fluidDepth: readSetting('fluidDepth'),
      bgBrightnessLight: readSetting('bgBrightnessLight'),
      bgBrightnessDark: readSetting('bgBrightnessDark'),
      chatAlpha: readSetting('chatAlpha'),
      background: readBackground(),
      wallpaper: readWallpaper(),
      whale: readWhale(),
      critters: readCritters(),
      mesh: readMesh(),
      spotlight: readSpotlight(),
      submenuHold: readSubmenuHold(),
      menuOpacity: readSetting('menuOpacity'),
      wallpaperBlur: readSetting('wallpaperBlur'),
      wallpaperFrost: readSetting('wallpaperFrost'),
      videoBlur: readSetting('videoBlur'),
      videoBrightness: readSetting('videoBrightness'),
      ...this.readThemeTypography(),
      fontText: readStringSetting('fontText'),
      fontCode: readStringSetting('fontCode'),
      hintColor: readStringSetting('hintColor'),
      blurChat: readSetting('blurChat'),
      blurPages: readSetting('blurPages'),
      hintWeightSidebar: readSetting('hintWeightSidebar'),
      hintOpacitySidebar: readSetting('hintOpacitySidebar'),
      hintColorSidebar: readStringSetting('hintColorSidebar'),
      hintWeightHeader: readSetting('hintWeightHeader'),
      hintOpacityHeader: readSetting('hintOpacityHeader'),
      hintColorHeader: readStringSetting('hintColorHeader'),
      hintWeightChat: readSetting('hintWeightChat'),
      hintOpacityChat: readSetting('hintOpacityChat'),
      hintColorChat: readStringSetting('hintColorChat'),
      hintWeightComposer: readSetting('hintWeightComposer'),
      hintOpacityComposer: readSetting('hintOpacityComposer'),
      hintColorComposer: readStringSetting('hintColorComposer'),
      paletteChat: readStringSetting('paletteChat'),
      lineHeight: readSetting('lineHeight'),
      weightBody: readSetting('weightBody'),
      weightHeading: readSetting('weightHeading'),
      weightBodySidebar: readSetting('weightBodySidebar'),
      weightHeadingSidebar: readSetting('weightHeadingSidebar'),
      weightBodyHeader: readSetting('weightBodyHeader'),
      weightHeadingHeader: readSetting('weightHeadingHeader'),
      weightBodyChat: readSetting('weightBodyChat'),
      weightHeadingChat: readSetting('weightHeadingChat'),
      weightBodyComposer: readSetting('weightBodyComposer'),
      weightHeadingComposer: readSetting('weightHeadingComposer'),
      hintWeight: readSetting('hintWeight'),
      hintOpacity: readSetting('hintOpacity'),
      hintFont: readStringSetting('hintFont'),
      palette: readStringSetting('palette'),
      preference: this.readThemePreference(),
    }
  }

  /** Flip the layer: persist, then apply or retract every owned effect. */
  setEnabled(value: boolean): void {
    if (value === this.enabled) return
    this.enabled = value
    writeEnabled(value)
    this.sync()
  }

  /** Set the glass blur radius (px). */
  setBlur(value: number): void {
    const next = clampSetting('blur', value)
    if (next === this.settings.blur) return
    this.settings.blur = next
    writeSetting('blur', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the glass frost amount (0-100). */
  setFrost(value: number): void {
    const next = clampSetting('frost', value)
    if (next === this.settings.frost) return
    this.settings.frost = next
    writeSetting('frost', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the fluid hue (degrees, continuous). */
  setFluidHue(value: number): void {
    const next = clampSetting('fluidHue', value)
    if (next === this.settings.fluidHue) return
    this.settings.fluidHue = next
    writeSetting('fluidHue', next)
    if (this.enabled) {
      this.scheduleApply()
      this.applyFluidPalettes()
    }
  }

  /** Set the fluid depth (0-100, continuous: deep ↔ pale). */
  setFluidDepth(value: number): void {
    const next = clampSetting('fluidDepth', value)
    if (next === this.settings.fluidDepth) return
    this.settings.fluidDepth = next
    writeSetting('fluidDepth', next)
    if (this.enabled) this.applyFluidPalettes()
  }

  /** Set the background brightness (0-100: 0 = pure black, 50 = transparent, 100 = pure white). */
  setBgBrightness(value: number): void {
    // Each appearance keeps its OWN value: the knob only spans the half that
    // makes sense for the resolved scheme, so one shared field silently threw
    // the other half away every time 外观 flipped.
    const key = this.dark ? 'bgBrightnessDark' : 'bgBrightnessLight'
    const next = clampSetting(key, value)
    if (next === this.settings[key]) return
    this.settings[key] = next
    writeSetting(key, next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the backdrop source (fluid board or custom wallpaper). */
  setBackground(value: 'fluid' | 'wallpaper'): void {
    if (value === this.settings.background) return
    this.settings.background = value
    writeBackground(value)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the wallpaper image (a data URL; empty clears it) or a large video
   *  (`idb:<id>` marker whose blob lives in IndexedDB). */
  setWallpaper(value: string): void {
    const previous = this.settings.wallpaper
    this.settings.wallpaper = value
    writeWallpaper(value)
    if (previous.startsWith('idb:') && value !== previous) {
      void deleteVideoBlob(previous.slice(4))
    }
    // A remembered file handle is a standing read grant on a file outside the
    // app. Drop it together with the wallpaper it was picked for — otherwise
    // deleting the wallpaper leaves the grant behind, invisible to the user.
    if (previous.startsWith('fsa:') && value !== previous) {
      void deleteVideoHandle()
    }
    if (!value.startsWith('idb:') && this.videoObjectUrl !== undefined) {
      URL.revokeObjectURL(this.videoObjectUrl)
      this.videoObjectUrl = undefined
      this.videoBlobId = undefined
    }
    if (this.enabled) this.scheduleApply()
  }

  /** Set the particle-whale flag (chat-area center decoration). */
  setWhale(value: boolean): void {
    if (value === this.settings.whale) return
    this.settings.whale = value
    writeWhale(value)
    if (this.enabled) this.syncWhale()
  }

  /** Set the ambient marine-life flag (fish / bubbles / plankton). */
  setCritters(value: boolean): void {
    if (value === this.settings.critters) return
    this.settings.critters = value
    writeCritters(value)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the interactive-mesh flag (dot-grid decoration). */
  setMesh(value: boolean): void {
    if (value === this.settings.mesh) return
    this.settings.mesh = value
    writeMesh(value)
    if (this.enabled) this.syncMesh()
  }

  /** Set the cursor-spotlight flag (pointer-tracking glass glow). */
  setSpotlight(value: boolean): void {
    if (value === this.settings.spotlight) return
    this.settings.spotlight = value
    writeSpotlight(value)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the submenu surface opacity (0-100). */
  setMenuOpacity(value: number): void {
    const next = clampSetting('menuOpacity', value)
    if (next === this.settings.menuOpacity) return
    this.settings.menuOpacity = next
    writeSetting('menuOpacity', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the submenu click-hold flag (hover-opened submenus survive a click). */
  setSubmenuHold(value: boolean): void {
    if (value === this.settings.submenuHold) return
    this.settings.submenuHold = value
    writeSubmenuHold(value)
    this.syncSubmenuHold()
    if (this.enabled) this.scheduleApply()
  }

  /** Set the chat surface veil (0-100: 0 = backdrop untouched, 100 = opaque chat slab). */
  setChatAlpha(value: number): void {
    const next = clampSetting('chatAlpha', value)
    if (next === this.settings.chatAlpha) return
    this.settings.chatAlpha = next
    writeSetting('chatAlpha', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the wallpaper blur radius (px). */
  setWallpaperBlur(value: number): void {
    const next = clampSetting('wallpaperBlur', value)
    if (next === this.settings.wallpaperBlur) return
    this.settings.wallpaperBlur = next
    writeSetting('wallpaperBlur', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the wallpaper frost veil (0-100). */
  setWallpaperFrost(value: number): void {
    const next = clampSetting('wallpaperFrost', value)
    if (next === this.settings.wallpaperFrost) return
    this.settings.wallpaperFrost = next
    writeSetting('wallpaperFrost', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the video wallpaper blur radius (px). */
  setVideoBlur(value: number): void {
    const next = clampSetting('videoBlur', value)
    if (next === this.settings.videoBlur) return
    this.settings.videoBlur = next
    writeSetting('videoBlur', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the video wallpaper brightness (0-100, 100 = fully lit). */
  setVideoBrightness(value: number): void {
    const next = clampSetting('videoBrightness', value)
    if (next === this.settings.videoBrightness) return
    this.settings.videoBrightness = next
    writeSetting('videoBrightness', next)
    if (this.enabled) this.scheduleApply()
  }

  /* ---------- Typography ---------- */

  /**
   * Read the host's current font sizes and families — the single source of
   * truth for everything the panel shows in the font group.
   * @returns the mirrored typography fields.
   */
  private readThemeTypography(): Pick<AquaSettings, 'fontSizeText' | 'fontSizeCode' | 'fontSizeTerminal'> {
    const defaults = {
      fontSizeText: FONT_SIZE_SPECS.text.default,
      fontSizeCode: FONT_SIZE_SPECS.code.default,
      fontSizeTerminal: FONT_SIZE_SPECS.terminal.default,
    }
    try {
      const theme = this.ctx.theme.getTheme()
      return {
        fontSizeText: theme.fontSizes?.text ?? FONT_SIZE_SPECS.text.default,
        fontSizeCode: theme.fontSizes?.code ?? FONT_SIZE_SPECS.code.default,
        fontSizeTerminal: theme.fontSizes?.terminal ?? FONT_SIZE_SPECS.terminal.default,
      }
    } catch {
      return defaults
    }
  }

  /** Re-read the host typography after 设置 changed it (or after our own write). */
  refreshThemeTypography(): void {
    let sizes: { text?: number, code?: number, terminal?: number } | undefined
    try {
      sizes = this.ctx.theme.getTheme()?.fontSizes
    } catch {
      sizes = undefined
    }
    // A role the host does not report keeps the value in force. Falling back to
    // the shipped default here reset the user's size on every apply.
    const next = {
      fontSizeText: sizes?.text ?? this.settings.fontSizeText,
      fontSizeCode: sizes?.code ?? this.settings.fontSizeCode,
      fontSizeTerminal: sizes?.terminal ?? this.settings.fontSizeTerminal,
    }
    const same = next.fontSizeText === this.settings.fontSizeText
      && next.fontSizeCode === this.settings.fontSizeCode
      && next.fontSizeTerminal === this.settings.fontSizeTerminal
    if (same) return
    this.settings = { ...this.settings, ...next }
    if (this.enabled) this.scheduleApply()
  }

  /**
   * Read the host's appearance preference (the value 设置 → 外观 shows).
   * @returns light, dark, or system when the host reports something unusable.
   */
  private readThemePreference(): 'light' | 'dark' | 'system' {
    try {
      const preference = this.ctx.theme.getTheme()?.preference
      return preference === 'light' || preference === 'dark' ? preference : 'system'
    } catch {
      return 'system'
    }
  }

  /**
   * Switch the appearance through the host theme service — byte-for-byte the
   * same effect as changing it in 设置 → 外观 (one field, one publish).
   * @param id - light, dark, or system.
   */
  setThemePreference(id: 'light' | 'dark' | 'system'): void {
    try {
      this.ctx.theme.setTheme(id)
    } catch {
      /* host refused the id — the panel keeps whatever the host reports */
    }
    this.settings.preference = this.readThemePreference()
    this.dark = this.resolveScheme()
    if (this.enabled) this.scheduleApply()
  }

  /**
   * Write one role's font stack through the host theme service.
   * @param role - font role.
   * @param stack - CSS font-family stack; empty restores the host stack.
   */
  private writeFontRole(role: FontRole, stack: string): void {
    const key = role === 'text' ? 'fontText' : role === 'code' ? 'fontCode' : undefined
    if (key !== undefined) {
      this.settings[key] = stack
      writeStringSetting(key, stack)
    }
    // Best-effort host sync (设置 still shows the value); the host's own read-back
    // is NOT used, because its write target is a variable nothing consumes.
    try {
      this.ctx.theme.setFontFamily(role, stack)
    } catch {
      /* host refused the stack — our own copy still applies */
    }
    if (this.enabled) this.scheduleApply()
  }

  /** Pick the conversation font (a theme-service write, identical to 设置). */
  setFontText(stack: string): void {
    this.writeFontRole('text', stack)
  }

  /** Pick the conversation-only colour scheme (empty = follow the global one). */
  setPaletteChat(id: string): void {
    if (id === this.settings.paletteChat) return
    this.settings.paletteChat = id
    writeStringSetting('paletteChat', id)
    if (this.enabled) this.scheduleApply()
  }

  /** Pick the code-block font. */
  setFontCode(stack: string): void {
    this.writeFontRole('code', stack)
  }

  /**
   * Set one role's font size through the host theme service (range enforced there).
   * @param role - font role.
   * @param px - requested size; clamped to the role's host range and rounded.
   */
  setFontSizeRole(role: FontRole, px: number): void {
    const spec = FONT_SIZE_SPECS[role]
    const next = Math.round(Math.min(spec.max, Math.max(spec.min, px)))
    const field = role === 'text' ? 'fontSizeText' : role === 'code' ? 'fontSizeCode' : 'fontSizeTerminal'
    // A slider drag fires once per pixel; the host write plus read-back is not
    // free, and an unchanged value is a guaranteed no-op.
    if (next === this.settings[field]) return
    try {
      this.ctx.theme.setFontSize(role, next)
    } catch (error) {
      // The host refused (role unknown / range rejected). The read-back below
      // leaves the knob on the value actually in force — the only honest answer
      // — but the refusal itself must not vanish silently.
      console.warn('[aqua] the host refused a font-size write', role, next, error)
    }
    this.refreshThemeTypography()
  }

  /**
   * Set one region's weight. 0 means "follow the global body/heading knob", so
   * moving the global slider still lands on regions the user never overrode.
   * @param region - layout region key.
   * @param kind - body text or heading text.
   * @param value - 0 (follow) or 300-800.
   */
  setRegionWeight(region: RegionKey, kind: 'body' | 'heading', value: number): void {
    const field = REGION_WEIGHT_FIELDS[region][kind]
    const next = clampSetting(field, value)
    if (next === this.settings[field]) return
    this.settings[field] = next
    writeSetting(field, next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the conversation-detail blur radius (px). */
  setBlurChat(value: number): void {
    const next = clampSetting('blurChat', value)
    if (next === this.settings.blurChat) return
    this.settings.blurChat = next
    writeSetting('blurChat', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the menu-page / feature-page blur radius (px). */
  setBlurPages(value: number): void {
    const next = clampSetting('blurPages', value)
    if (next === this.settings.blurPages) return
    this.settings.blurPages = next
    writeSetting('blurPages', next)
    if (this.enabled) this.scheduleApply()
  }

  /**
   * Set one region's explanatory-text weight or strength.
   * @param region - layout region key.
   * @param kind - weight or opacity.
   * @param value - 300-800 for weight, 40-100 for opacity.
   */
  setRegionHintNumber(region: RegionKey, kind: 'weight' | 'opacity', value: number): void {
    const field = REGION_HINT_FIELDS[region][kind]
    const next = clampSetting(field, value)
    if (next === this.settings[field]) return
    this.settings[field] = next
    writeSetting(field, next)
    if (this.enabled) this.scheduleApply()
  }

  /**
   * Set one region's explanatory-text colour preset.
   * @param region - layout region key.
   * @param id - preset id (empty = follow the global explanatory colour).
   */
  setRegionHintColor(region: RegionKey, id: string): void {
    const field = REGION_HINT_FIELDS[region].color
    if (id === this.settings[field]) return
    this.settings[field] = id
    writeStringSetting(field, id)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the explanatory-text weight (300-800). */
  setHintWeight(value: number): void {
    const next = clampSetting('hintWeight', value)
    if (next === this.settings.hintWeight) return
    this.settings.hintWeight = next
    writeSetting('hintWeight', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the explanatory-text strength (40-100: 100 = as strong as body text). */
  setHintOpacity(value: number): void {
    const next = clampSetting('hintOpacity', value)
    if (next === this.settings.hintOpacity) return
    this.settings.hintOpacity = next
    writeSetting('hintOpacity', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the explanatory-text font stack (empty = follow the body font). */
  setHintFont(stack: string): void {
    if (stack === this.settings.hintFont) return
    this.settings.hintFont = stack
    writeStringSetting('hintFont', stack)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the explanatory-text colour preset (empty = follow the scheme). */
  setHintColor(id: string): void {
    if (id === this.settings.hintColor) return
    this.settings.hintColor = id
    writeStringSetting('hintColor', id)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the line-height multiplier (1.0-2.5, 1.5 = the host rhythm). */
  setLineHeight(value: number): void {
    const next = clampSetting('lineHeight', value)
    if (next === this.settings.lineHeight) return
    this.settings.lineHeight = next
    writeSetting('lineHeight', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the body font weight (300-800). */
  setWeightBody(value: number): void {
    const next = clampSetting('weightBody', value)
    if (next === this.settings.weightBody) return
    this.settings.weightBody = next
    writeSetting('weightBody', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Set the heading font weight (400-800). */
  setWeightHeading(value: number): void {
    const next = clampSetting('weightHeading', value)
    if (next === this.settings.weightHeading) return
    this.settings.weightHeading = next
    writeSetting('weightHeading', next)
    if (this.enabled) this.scheduleApply()
  }

  /** Pick a text-colour palette (each palette carries its own light/dark pair). */
  setPalette(id: string): void {
    if (id === this.settings.palette) return
    this.settings.palette = id
    writeStringSetting('palette', id)
    if (this.enabled) this.scheduleApply()
  }

  /* ---------- Typography resets (back to the host defaults) ---------- */

  /** Restore the conversation font to the host stack. */
  resetFontText(): void {
    this.writeFontRole('text', '')
  }

  /** Restore the code font to the host stack. */
  resetFontCode(): void {
    this.writeFontRole('code', '')
  }

  /**
   * Restore one role's size to the host default.
   * @param role - font role.
   */
  resetFontSizeRole(role: FontRole): void {
    this.setFontSizeRole(role, FONT_SIZE_SPECS[role].default)
  }

  /** Restore every region to "follow the global weight". */
  resetRegionWeights(): void {
    for (const region of REGIONS) {
      for (const kind of ['body', 'heading'] as const) this.setRegionWeight(region, kind, 0)
    }
  }

  /**
   * Restore ONE region to defaults: weights back to "follow global" and the
   * explanatory trio back to the shipped values. The per-region reset button
   * used to reset every region at once, which read as "nothing happened".
   * @param region - layout region key.
   */
  resetRegion(region: RegionKey): void {
    this.setRegionWeight(region, 'body', 0)
    this.setRegionWeight(region, 'heading', 0)
    this.setRegionHintNumber(region, 'weight', REGION_HINT_DEFAULTS.weight)
    this.setRegionHintNumber(region, 'opacity', REGION_HINT_DEFAULTS.opacity)
    this.setRegionHintColor(region, '')
  }

  /** Restore every region's explanatory-text knobs. */
  resetRegionHints(): void {
    for (const region of REGIONS) {
      this.setRegionHintNumber(region, 'weight', REGION_HINT_DEFAULTS.weight)
      this.setRegionHintNumber(region, 'opacity', REGION_HINT_DEFAULTS.opacity)
      this.setRegionHintColor(region, '')
    }
  }

  /** Restore the explanatory-text knobs to their shipped values. */
  resetHint(): void {
    this.setHintWeight(SETTINGS_DEFAULTS.hintWeight)
    this.setHintOpacity(SETTINGS_DEFAULTS.hintOpacity)
    this.setHintFont(SETTINGS_DEFAULTS.hintFont)
    this.setHintColor(SETTINGS_DEFAULTS.hintColor)
  }

  /** Restore the line-height multiplier. */
  resetLineHeight(): void {
    this.setLineHeight(SETTINGS_DEFAULTS.lineHeight)
  }

  /** Restore both font weights. */
  resetWeights(): void {
    this.setWeightBody(SETTINGS_DEFAULTS.weightBody)
    this.setWeightHeading(SETTINGS_DEFAULTS.weightHeading)
  }

  /** Drop the colour override and follow the theme tokens again. */
  resetPalette(): void {
    this.setPalette('theme')
  }

  /**
   * Push the selected palette onto the theme override stack. Every palette
   * carries a light AND a dark value, so flipping 外观 re-resolves it with no
   * listener of our own. Following the theme drops the layer entirely.
   */
  private applyPaletteTokens(): void {
    // RE-ENTRANCY: theme.overrideTokens() publishes SYNCHRONOUSLY (the service
    // does `emit('theme/change')` inside publish()), and our own theme/change
    // listener calls applySettings() again from inside that emit. The palette id
    // is therefore recorded BEFORE the call so the nested run bails out here —
    // keying the guard on paletteDisposer instead deadlocks the boot: that field
    // is only assigned after overrideTokens() returns, i.e. never during emit.
    if (this.appliedPalette === this.settings.palette) return
    const tokens = paletteTokens(findPalette(this.settings.palette))
    this.appliedPalette = this.settings.palette
    this.paletteDisposer?.()
    this.paletteDisposer = undefined
    if (Object.keys(tokens).length === 0) return
    this.paletteDisposer = this.ctx.theme.overrideTokens(PALETTE_SOURCE, tokens)
  }

  /**
   * Push the explanatory-text colour onto the theme override stack.
   *
   * The class-based CSS route did nothing in the real UI — the small copy does
   * not carry any of the class names we guessed and its colour comes from the
   * `label-tertiary` / `label-caption` tokens. Overriding those two tokens is
   * the only route that actually reaches every explanatory surface (hints,
   * timestamps, tool summaries, panel notes).
   */
  private applyHintColorTokens(): void {
    // Re-entrancy: overrideTokens publishes synchronously; record the id first.
    if (this.appliedHintColor === this.settings.hintColor) return
    this.appliedHintColor = this.settings.hintColor
    const light = hintColorValue(this.settings.hintColor, false)
    const dark = hintColorValue(this.settings.hintColor, true)
    this.hintColorDisposer?.()
    this.hintColorDisposer = undefined
    if (light === '' || dark === '') return
    this.hintColorDisposer = this.ctx.theme.overrideTokens(HINT_COLOR_SOURCE, {
      '--dsw-alias-label-tertiary': { light, dark },
      '--dsw-alias-label-caption': { light, dark },
    })
  }

  /**
   * Mark explanatory-text nodes with `data-dsh-aqua-hint="<region>"`.
   *
   * Colour and strength reach these nodes through the label tokens, so they
   * cover whatever the host paints with them. Font-weight has no token, so the
   * only way to reach the SAME set is to find the nodes that render in the
   * explanatory colour and tag them; CSS then applies the weight by attribute.
   *
   * The previous version re-ran `querySelectorAll("*")` over every region on
   * every mutation and called `getComputedStyle()` on each element — on a long
   * transcript that is thousands of forced style resolutions every 400 ms. Now
   * the first pass scans once, the observer only queues the nodes it added, and
   * region colours are probed once per apply instead of once per pass.
   */
  private stampHintNodes(): void {
    if (this.hintStampTimer !== undefined) return
    this.hintStampTimer = window.setTimeout(() => {
      this.hintStampTimer = undefined
      this.flushHintNodes()
    }, 300)
  }

  /** Tag one leaf when it renders in the explanatory colour. */
  private markHintLeaf(el: HTMLElement, region: string, target: string): void {
    if (el.hasAttribute('data-dsh-aqua-hint')) return
    if (el.childElementCount > 0) return
    if (getComputedStyle(el).color === target) el.setAttribute('data-dsh-aqua-hint', region)
  }

  /** Resolve (and cache) the explanatory colour inside one region. */
  private hintTarget(region: string, root: HTMLElement): string {
    const cached = this.hintTargets.get(region)
    if (cached !== undefined && cached.root === root) return cached.color
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;left:-9999px;color:var(--dsw-alias-label-tertiary)'
    root.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    this.hintTargets.set(region, { root, color })
    return color
  }

  /** Region a node belongs to (first match wins, same order as the scan). */
  private hintRegionOf(el: Element): readonly [string, HTMLElement] | null {
    for (const [region, selector] of HINT_REGIONS) {
      const root = el.closest<HTMLElement>(selector)
      if (root !== null) return [region, root]
    }
    return null
  }

  /** One full scan, used when the layer mounts. */
  private hintFullPass(): void {
    for (const [region, selector] of HINT_REGIONS) {
      const root = document.querySelector<HTMLElement>(selector)
      if (root === null) continue
      const target = this.hintTarget(region, root)
      for (const el of root.querySelectorAll<HTMLElement>('*')) this.markHintLeaf(el, region, target)
    }
  }

  /** Handle only the nodes added since the previous pass. */
  private flushHintNodes(): void {
    if (this.hintPending.size === 0) return
    const pending = [...this.hintPending]
    this.hintPending.clear()
    for (const node of pending) {
      if (!node.isConnected) continue
      if (node.hasAttribute('data-dsh-aqua-hint')) continue
      const hit = this.hintRegionOf(node)
      if (hit === null) continue
      const [region, root] = hit
      const target = this.hintTarget(region, root)
      if (node.childElementCount === 0) {
        this.markHintLeaf(node, region, target)
        continue
      }
      for (const el of node.querySelectorAll<HTMLElement>('*')) this.markHintLeaf(el, region, target)
    }
  }

  /** Start watching for explanatory nodes (idempotent). */
  private startHintStamping(): void {
    this.hintFullPass()
    if (this.hintObserver !== undefined) return
    this.hintObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) this.hintPending.add(node as HTMLElement)
        }
      }
      this.stampHintNodes()
    })
    this.hintObserver.observe(document.body, { childList: true, subtree: true })
  }

  /** Stop watching and drop the pending pass. */
  private stopHintStamping(): void {
    this.hintObserver?.disconnect()
    this.hintObserver = undefined
    this.hintPending.clear()
    this.hintTargets.clear()
    if (this.hintStampTimer !== undefined) {
      window.clearTimeout(this.hintStampTimer)
      this.hintStampTimer = undefined
    }
  }

  /** After the user re-grants file access (选择视频 click on an fsa: video),
   *  drop the mount guard and re-apply so the file is re-read and played. */
  authorizeVideo(): void {
    if (this.videoObjectUrl !== undefined) {
      URL.revokeObjectURL(this.videoObjectUrl)
      this.videoObjectUrl = undefined
    }
    this.videoBlobId = undefined
    if (this.enabled) this.scheduleApply()
  }

  private sync(): void {
    if (this.enabled) this.mount()
    else this.unmount()
  }

  /**
   * Coalesce knob writes into one frame.
   *
   * A slider drag fires dozens of `input` events per second, and every setter
   * used to run the full ~40-variable write plus the token composers
   * synchronously. The store mirror (`sync()`) still updates immediately, so the
   * control stays glued to the thumb while the stylesheet catches up a frame
   * later — and only once per frame no matter how many knobs moved.
   */
  private scheduleApply(): void {
    if (this.applyFrame !== undefined) return
    this.applyFrame = window.requestAnimationFrame(() => {
      this.applyFrame = undefined
      this.applySettings()
    })
  }

  /** Drop a queued pass (unmount / disable). */
  private cancelScheduledApply(): void {
    if (this.applyFrame === undefined) return
    window.cancelAnimationFrame(this.applyFrame)
    this.applyFrame = undefined
  }

  /** Write the knob-driven CSS variables and mode attributes onto <html>. */
  private applySettings(): void {
    const style = document.documentElement.style
    style.setProperty('--dsh-aqua-blur', `${this.settings.blur}px`)
    // Frost 0-100 → a 0-1.4 alpha multiplier (50 = 1x). Capped so max frost
    // stays translucent frosted glass instead of collapsing to a solid
    // opaque slab (the dark card would otherwise hit 100% and read as solid
    // navy).
    style.setProperty('--dsh-aqua-frost', String(Math.min(this.settings.frost / 50, 1.4)))
    // The new-session button's frost rides the same knob, +20 points.
    style.setProperty('--dsh-aqua-surface-frost', String(Math.min((this.settings.frost + 20) / 50, 1.4)))
    // The cursor glow follows the fluid tone — same hue as the bloom stops,
    // so 色调 320 glows the same cyan-blue as the water.
    const glowHue = ((this.settings.fluidHue + HUE_BASE) % 360 + 360) % 360
    style.setProperty('--dsh-aqua-spot-color', this.dark
      ? `hsla(${glowHue}, 90%, 62%, 0.17)`
      : `hsla(${glowHue}, 90%, 45%, 0.16)`)
    style.setProperty('--dsh-aqua-wallpaper-blur', `${this.settings.wallpaperBlur}px`)
    style.setProperty('--dsh-aqua-wallpaper-frost', String(this.settings.wallpaperFrost / 100))
    // Video wallpaper: blur rides the video's own filter; brightness drives
    // the scrim veil's alpha (100 = fully lit / no veil, 0 = deepest dim,
    // capped at 0.65 so the film never goes fully black).
    style.setProperty('--dsh-aqua-video-blur', `${this.settings.videoBlur}px`)
    style.setProperty('--dsh-aqua-video-dim', String(((100 - this.settings.videoBrightness) / 100) * 0.65))
    // Background brightness: dark mode darkens (0 = pure black, 50 = off),
    // light mode brightens (50 = off, 100 = pure white) — the knob's range
    // and the overlay direction both follow the resolved scheme.
    const dark = this.dark
    // Only the half of the scale that belongs to the current scheme is ever
    // active, so read the matching field instead of a shared one.
    const brightness = dark ? this.settings.bgBrightnessDark : this.settings.bgBrightnessLight
    style.setProperty('--dsh-aqua-brightness-black', String(dark ? Math.max(0, (50 - brightness) / 50) : 0))
    style.setProperty('--dsh-aqua-brightness-white', String(dark ? 0 : Math.max(0, (brightness - 50) / 50)))
    // Chat surface veil: one knob, scheme-split the same way — light mode
    // lays a white glass sheet over the conversation column, dark mode a
    // neutral dark one. 0 = the backdrop shows untouched.
    // Both variables carry the SAME alpha on purpose: the stylesheet already
    // picks white vs dark fill by scheme, so the value must not be zeroed by
    // our own scheme belief — a disagreement between this layer and the
    // document would silently kill the veil in one of the two modes.
    const chatVeil = String(this.settings.chatAlpha / 100)
    style.setProperty('--dsh-aqua-chat-black', chatVeil)
    style.setProperty('--dsh-aqua-chat-white', chatVeil)
    // Popup surfaces have their own opacity knob: they float over dense text,
    // so they must be able to go near-solid independently of the card frost.
    style.setProperty('--dsh-aqua-menu-opacity', String(this.settings.menuOpacity))

    // Typography: font family and size are NOT ours to write — the host theme
    // service owns them (设置 → 外观), so both surfaces stay identical. What we
    // do own: the line-height multiplier (riding the host's own rhythm), the
    // two weights, and the text-colour palette (its own override layer).
    style.setProperty('--dsh-aqua-line-scale', String(this.settings.lineHeight / 1.5))
    style.setProperty('--dsh-aqua-weight-body', String(this.settings.weightBody))
    style.setProperty('--dsh-aqua-weight-heading', String(this.settings.weightHeading))

    // Per-region weights: an unset region (0) resolves to the global knob, so a
    // global change keeps flowing into every region the user did not override.
    const regionWeight = (region: RegionKey, kind: 'body' | 'heading'): number => {
      const own = this.settings[REGION_WEIGHT_FIELDS[region][kind]]
      if (own > 0) return own
      return kind === 'body' ? this.settings.weightBody : this.settings.weightHeading
    }
    for (const region of REGIONS) {
      style.setProperty(`--dsh-aqua-wb-${region}`, String(regionWeight(region, 'body')))
      style.setProperty(`--dsh-aqua-wh-${region}`, String(regionWeight(region, 'heading')))
    }

    // Explanatory copy gets its own weight / strength / family / colour.
    style.setProperty('--dsh-aqua-hint-weight', String(this.settings.hintWeight))
    style.setProperty('--dsh-aqua-hint-opacity', String(this.settings.hintOpacity / 100))
    if (this.settings.hintFont) style.setProperty('--dsh-aqua-hint-family', this.settings.hintFont)
    else style.removeProperty('--dsh-aqua-hint-family')
    // Conversation-only font colour: written as plain variables on <html> and
    // consumed only when the attribute is present, so "follow global" stays a
    // no-op rather than a second, competing colour source.
    const chatScheme = findPalette(this.settings.paletteChat)
    const chatInk = this.dark ? chatScheme.dark : chatScheme.light
    if (chatInk.primary) {
      style.setProperty('--dsh-aqua-chat-ink-primary', chatInk.primary)
      style.setProperty('--dsh-aqua-chat-ink-secondary', chatInk.secondary)
      style.setProperty('--dsh-aqua-chat-ink-accent', chatInk.accent)
      document.documentElement.setAttribute('data-dsh-aqua-chat-ink', '')
    } else {
      style.removeProperty('--dsh-aqua-chat-ink-primary')
      style.removeProperty('--dsh-aqua-chat-ink-secondary')
      style.removeProperty('--dsh-aqua-chat-ink-accent')
      document.documentElement.removeAttribute('data-dsh-aqua-chat-ink')
    }

    // Explanatory-text BASE colour. The region rules build their token as
    // color-mix(<region colour> <strength>, transparent), falling back to this
    // value. It has to be a concrete colour: defaulting it to
    // var(--dsw-alias-label-tertiary) made the variable reference the very token
    // the region rule rewrites, so the declaration was dropped and neither the
    // colour nor the strength ever applied.
    const schemePalette = findPalette(this.settings.palette)
    const schemeInk = this.dark ? schemePalette.dark : schemePalette.light
    // The per-region "follow" value means "follow the GLOBAL explanatory
    // colour" (字体颜色 → 说明性文字颜色), not "follow the colour scheme".
    // Order: explicit global explanatory colour → that scheme's hint → neutral.
    const globalHint = hintColorValue(this.settings.hintColor, this.dark)
    const baseHint = globalHint !== ''
      ? globalHint
      : schemeInk.hint !== ''
        ? schemeInk.hint
        // "Follow the theme" has no palette hint of ours — use a neutral that
        // matches the host's explanatory tone closely enough for the fallback.
        : (this.dark ? '#A9B8C9' : '#5A6472')
    style.setProperty('--dsh-aqua-hint-c-base', baseHint)
    style.setProperty('--dsh-aqua-hint-cc-base', baseHint)

    // Conversation-area blur split + per-region explanatory text.
    style.setProperty('--dsh-aqua-blur-chat', `${this.settings.blurChat}px`)
    style.setProperty('--dsh-aqua-blur-pages', `${this.settings.blurPages}px`)
    for (const region of REGIONS) {
      const fields = REGION_HINT_FIELDS[region]
      style.setProperty(`--dsh-aqua-hint-w-${region}`, String(this.settings[fields.weight]))
      style.setProperty(`--dsh-aqua-hint-o-${region}`, String(this.settings[fields.opacity] / 100))
      const regionColor = hintColorValue(this.settings[fields.color], this.dark)
      if (regionColor) style.setProperty(`--dsh-aqua-hint-c-${region}`, regionColor)
      else style.removeProperty(`--dsh-aqua-hint-c-${region}`)
    }

    // Region colours feed the hint-marking pass. Drop its cached probes here so
    // the next pass re-reads them — a palette / appearance / explanatory-colour
    // change all land through this method. (The old `--dsh-aqua-hint-color`
    // variable was written here but never read by any rule; the colour reaches
    // the UI through the token override below, so the variable is gone.)
    this.hintTargets.clear()

    // FONT FAMILY BRIDGE. The host writes the picked family to
    // --dsh-font-family-{role}, but its token sheet reads
    // --dsh-font-family-{role}-default — nothing consumes the former, which is
    // exactly why picking a code font did nothing. Our inline values sit above
    // the token layer, so both the body and the code blocks finally follow the
    // pickers. Empty means "let the theme stack win".
    if (this.settings.fontText) style.setProperty('--dsw-font-family', this.settings.fontText)
    else style.removeProperty('--dsw-font-family')
    if (this.settings.fontCode) {
      style.setProperty('--ds-font-family-code', this.settings.fontCode)
      style.setProperty('--dsw-font-markdown-code-font-family', this.settings.fontCode)
    } else {
      style.removeProperty('--ds-font-family-code')
      style.removeProperty('--dsw-font-markdown-code-font-family')
    }

    this.applyPaletteTokens()
    // Layered AFTER the palette on purpose: the theme service composes override
    // layers in registration order, so this one wins on the shared tertiary /
    // caption tokens.
    this.applyHintColorTokens()

    // The float layout is the only rendering mode: every layout rule in the
    // stylesheet keys off data-dsh-float, so it is always present.
    document.documentElement.setAttribute('data-dsh-float', '')

    document.documentElement.toggleAttribute(SPOTLIGHT_ATTRIBUTE, this.settings.spotlight)

    // Interaction shim, not a style.
    this.syncSubmenuHold()

    // Backdrop source: flip the ambient container between fluid and wallpaper.
    const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
    if (ambient !== null) ambient.dataset.background = this.settings.background
    if (ambient !== null) ambient.dataset.critters = this.settings.critters ? 'on' : 'off'
    // The wallpaper may be an image or a video: images and small videos are
    // data URLs; large videos are `idb:<id>` markers (blob in IndexedDB);
    // File System Access videos are `fsa:<name>` markers (the handle lives
    // in IndexedDB and re-reads the original file).
    const wallpaper = this.settings.wallpaper
    const isVideo = wallpaper.startsWith('data:video/') || wallpaper.startsWith('idb:') || wallpaper.startsWith('fsa:')
    const wallpaperLayer = document.querySelector<HTMLElement>('[data-dsh-aqua-wallpaper-layer]')
    if (wallpaperLayer !== null) {
      wallpaperLayer.dataset.background = this.settings.background
      wallpaperLayer.dataset.media = isVideo ? 'video' : 'image'
    }
    // Mirror the wallpaper state onto <html> so the stylesheet can scope
    // video-mode readability rules (bubble plates) without touching the app.
    const wallpaperOn = this.settings.background === 'wallpaper' && wallpaper !== ''
    document.documentElement.toggleAttribute('data-dsh-aqua-wallpaper', wallpaperOn)
    if (wallpaperOn) {
      document.documentElement.setAttribute('data-dsh-aqua-media', isVideo ? 'video' : 'image')
    } else {
      document.documentElement.removeAttribute('data-dsh-aqua-media')
    }
    const img = document.querySelector<HTMLImageElement>('[data-dsh-aqua-wallpaper-img]')
    if (img !== null) {
      if (this.settings.background === 'wallpaper' && wallpaper !== '' && !isVideo) {
        img.src = wallpaper
      } else {
        img.removeAttribute('src')
      }
    }
    const video = document.querySelector<HTMLVideoElement>('[data-dsh-aqua-wallpaper-video]')
    if (video !== null) {
      if (this.settings.background === 'wallpaper' && isVideo) {
        if (wallpaper.startsWith('idb:')) {
          const id = wallpaper.slice(4)
          if (this.videoBlobId === id && this.videoObjectUrl !== undefined) {
            // Already mounted — never reload/revoke on repeated applySettings
            // runs (knob tweaks would otherwise restart the video).
          } else {
            void loadVideoBlob(id).then((blob) => {
              if (blob === null) return
              if (this.settings.wallpaper !== wallpaper) return // stale load
              const url = URL.createObjectURL(blob)
              if (this.videoObjectUrl !== undefined) URL.revokeObjectURL(this.videoObjectUrl)
              this.videoObjectUrl = url
              this.videoBlobId = id
              video.setAttribute('src', url)
              this.configureWallpaperVideo(video)
            })
          }
        } else if (wallpaper.startsWith('fsa:')) {
          if (this.videoBlobId === wallpaper && this.videoObjectUrl !== undefined) {
            // Already mounted — knob tweaks must not reload the file.
          } else {
            void loadVideoHandle().then(async (handle) => {
              if (handle === null) return
              if (this.settings.wallpaper !== wallpaper) return // stale load
              try {
                // The browser remembers the file authorization; only a live
                // grant lets us re-read the original file automatically.
                const permission = await handle.queryPermission({ mode: 'read' })
                if (permission !== 'granted') return // re-authorize on 选择视频 click
                const file = await handle.getFile()
                const url = URL.createObjectURL(file)
                if (this.videoObjectUrl !== undefined) URL.revokeObjectURL(this.videoObjectUrl)
                this.videoObjectUrl = url
                this.videoBlobId = wallpaper
                video.setAttribute('src', url)
                this.configureWallpaperVideo(video)
              } catch {
                /* file moved/deleted or access revoked — stays empty until re-picked */
              }
            })
          }
        } else if (video.getAttribute('src') !== wallpaper) {
          video.setAttribute('src', wallpaper)
          this.configureWallpaperVideo(video)
        }
      } else {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }
  }

  /** The wallpaper plays as a plain <video> element (the browser's own
   *  decoder, no player chrome at all): looping on, cover fill via CSS, and
   *  autoplay with a muted fallback where policy requires it. A direct
   *  element (not an iframe) keeps backdrop-filter working over it, so the
   *  glass panels stay frosted above the video. */
  private configureWallpaperVideo(video: HTMLVideoElement): void {
    video.loop = true
    if (!video.paused) return
    void video.play().catch(() => {
      // Autoplay policy blocked unmuted playback — mute and retry.
      video.muted = true
      void video.play().catch(() => { /* ignore */ })
    })
  }

  /** Apply the deep-sea token layer. */
  private applyTokens(): void {
    this.tokenDisposer?.()
    this.tokenDisposer = this.ctx.theme.overrideTokens(OVERRIDE_SOURCE, AQUA_TOKEN_OVERRIDES)
  }

  private mount(): void {
    this.startHintStamping()
    domOwner = this
    document.documentElement.setAttribute(AQUA_ATTRIBUTE, '')
    this.guardGateAttributes()
    this.watchScheme()
    this.scheduleLateApply()
    ensureAmbientScene()
    ensurePageFades()
    this.applySettings()
    this.applyTokens()
    this.mountFluid()
    this.startSeamStamper()
    this.startEdgeMetrics()
    this.startSpotlightFeed()
    this.syncWhale()
    this.syncMesh()
    this.syncSubmenuHold()
  }

  /**
   * Keep the stylesheet's gate attributes present while enabled.
   *
   * Everything the theme draws hangs off `data-dsh-aqua` (and the float layout
   * off `data-dsh-float`), so a single stray removal — a re-composition, a
   * third-party script rewriting <html>, an older fiber's cleanup — silently
   * turns the whole layer into dead CSS while the settings panel still works.
   * Re-asserting on mutation makes that state impossible to hold.
   */
  private guardGateAttributes(): void {
    this.attributeGuard?.disconnect()
    const html = document.documentElement
    const assert = (): void => {
      if (!this.enabled || domOwner !== this) return
      if (!html.hasAttribute(AQUA_ATTRIBUTE)) html.setAttribute(AQUA_ATTRIBUTE, '')
      if (!html.hasAttribute('data-dsh-float')) html.setAttribute('data-dsh-float', '')
    }
    assert()
    const observer = new MutationObserver(assert)
    observer.observe(html, { attributes: true, attributeFilter: [AQUA_ATTRIBUTE, 'data-dsh-float'] })
    this.attributeGuard = observer
  }

  /**
   * Follow the resolved scheme by watching the attribute the stylesheet uses.
   *
   * `theme/change` is the host's event, but it is not a reliable trigger for
   * this layer: it can fire before `body[data-ds-dark-theme]` is written, or
   * not fire at all for an Appearance flip. When that happens `this.dark` keeps
   * its previous value, and everything derived from it — the fluid palette, the
   * cursor-glow tone, the background-brightness overlay's direction — stays in
   * the old scheme while the rest of the UI turns dark. The backdrop then reads
   * as a washed-out light sheet under dark chrome, which is why switching to
   * dark looked like it "didn't follow" until some knob was touched. Observing
   * the attribute makes the layer track the DOM, which is also what
   * `resolveScheme()` trusts.
   */
  private watchScheme(): void {
    this.schemeObserver?.disconnect()
    const body = document.body
    if (body === null) return
    const observer = new MutationObserver(() => {
      const next = this.resolveScheme()
      if (next === this.dark) return
      this.dark = next
      this.whaleHandle?.setDark(next)
      if (!this.enabled || domOwner !== this) return
      this.scheduleApply()
      this.applyFluidPalettes()
    })
    observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    this.schemeObserver = observer
  }

  /**
   * Re-apply once more shortly after mount. On a cold boot the theme presenter
   * may still be installing tokens when this layer first writes its variables;
   * a second pass after the frame has settled guarantees the knobs' variables
   * survive that ordering instead of depending on who ran last.
   */
  private scheduleLateApply(): void {
    for (const id of this.lateApplyTimers) window.clearTimeout(id)
    this.lateApplyTimers = [300, 1200, 3000].map((delay) => window.setTimeout(() => {
      // The host can apply body[data-ds-dark-theme] AFTER this layer mounts,
      // so re-read the scheme on every late pass: scheme-sensitive variables
      // (the brightness overlay's direction) must not stay on a stale belief.
      this.dark = this.resolveScheme()
      if (this.enabled && domOwner === this) this.scheduleApply()
    }, delay))
  }

  /** Mount or drop the particle whale to match enabled + the whale flag. */
  private syncWhale(): void {
    if (this.enabled && this.settings.whale) {
      if (this.whaleHandle !== undefined) return
      const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
      if (ambient === null) return
      this.whaleHandle = mountWhale(ambient, this.dark)
    } else {
      this.whaleHandle?.dispose()
      this.whaleHandle = undefined
    }
  }

  /** Mount or drop the interactive mesh to match enabled + the mesh flag. */
  private syncMesh(): void {
    if (this.enabled && this.settings.mesh) {
      if (this.meshHandle !== undefined) return
      const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
      if (ambient === null) return
      this.meshHandle = mountMesh(ambient)
    } else {
      this.meshHandle?.dispose()
      this.meshHandle = undefined
    }
  }

  private unmount(): void {
    this.stopHintStamping()
    this.cancelScheduledApply()
    this.attributeGuard?.disconnect()
    this.attributeGuard = undefined
    this.schemeObserver?.disconnect()
    this.schemeObserver = undefined
    for (const id of this.lateApplyTimers) window.clearTimeout(id)
    this.lateApplyTimers = []
    if (this.fluidRetryTimer !== undefined) window.clearTimeout(this.fluidRetryTimer)
    this.fluidRetryTimer = undefined
    // A stale instance must not tear down a newer layer's DOM (see domOwner).
    if (domOwner !== undefined && domOwner !== this) return
    domOwner = undefined
    document.documentElement.removeAttribute(AQUA_ATTRIBUTE)
    document.documentElement.removeAttribute('data-dsh-float')
    document.documentElement.removeAttribute('data-dsh-aqua-wallpaper')
    document.documentElement.removeAttribute('data-dsh-aqua-media')
    document.documentElement.removeAttribute(SPOTLIGHT_ATTRIBUTE)
    this.spotlightDisposer?.()
    this.spotlightDisposer = undefined
    this.whaleHandle?.dispose()
    this.whaleHandle = undefined
    this.meshHandle?.dispose()
    this.meshHandle = undefined
    this.paletteDisposer?.()
    this.paletteDisposer = undefined
    this.appliedPalette = undefined
    this.hintColorDisposer?.()
    this.hintColorDisposer = undefined
    this.appliedHintColor = undefined
    this.tokenDisposer?.()
    this.tokenDisposer = undefined
    if (this.videoObjectUrl !== undefined) {
      URL.revokeObjectURL(this.videoObjectUrl)
      this.videoObjectUrl = undefined
      this.videoBlobId = undefined
    }
    this.teardownFluid()
    removeAmbientScene()
    removePageFades()
    this.edgeMetrics?.dispose()
    this.edgeMetrics = undefined
    this.seamDisposer?.()
    this.seamDisposer = undefined
    // The click-hold shim is behaviour, not paint — release it with the layer
    // (see syncSubmenuHold). `enabled` is already false here.
    this.syncSubmenuHold()
  }

  /** Attach the fluid shader and the interaction feeds. */
  private mountFluid(): void {
    if (this.mainFluid !== undefined) return
    const mainCanvas = document.querySelector<HTMLCanvasElement>('[data-dsh-aqua-fluid-canvas]')
    if (mainCanvas === null) {
      // The ambient scene is injected by this plugin, but it lives in the app
      // shell: on a cold boot the mount can run before the shell's node lands.
      this.scheduleFluidRetry()
      return
    }
    try {
      this.mainFluid = attachFluidShader(mainCanvas, this.fluidParams())
      this.fluidRetries = 0
      // Palette follows the Appearance switch via the layer-lifecycle
      // `theme/change` listener (which also refreshes the brightness overlay).
      this.applyFluidPalettes()
      if (this.mainFluid !== undefined) {
        this.interactionDisposer = attachFluidInteractions({
          main: this.mainFluid,
          mainCanvas,
        })
      }
    } catch {
      // A GPU / driver failure must never take the glass theme down with it:
      // the ambient CSS wash still paints, only the WebGL water is skipped.
      // It is usually TRANSIENT though — a cold start can reach this line while
      // the GPU process is still warming up — and giving up permanently left
      // the backdrop as the flat CSS wash for the whole session. In light mode
      // that wash over a white base reads as an all-white page (and makes the
      // white 会话区不透明度 veil look inert), while dark mode keeps its
      // contrast and looks normal. Retry with backoff instead of surrendering.
      this.mainFluid = undefined
      this.scheduleFluidRetry()
    }
  }

  /** Retry a failed/skipped fluid attach with backoff (bounded). */
  private scheduleFluidRetry(): void {
    if (this.fluidRetryTimer !== undefined || this.fluidRetries >= FLUID_RETRY_LIMIT) return
    this.fluidRetries += 1
    const delay = Math.min(2000, 250 * 2 ** (this.fluidRetries - 1))
    this.fluidRetryTimer = window.setTimeout(() => {
      this.fluidRetryTimer = undefined
      if (!this.enabled || domOwner !== this) return
      this.mountFluid()
    }, delay)
  }

  private teardownFluid(): void {
    this.interactionDisposer?.()
    this.interactionDisposer = undefined
    this.mainFluid?.dispose()
    this.mainFluid = undefined
  }

  private fluidParams(): FluidParams {
    // Continuous hue + depth drive the palette through HSL interpolation —
    // the depth lives in the colors, so the canvas needs no global filter.
    return { ...SITE_FLUID_PARAMS, ...fluidToneColors(this.dark, this.settings.fluidHue, this.settings.fluidDepth) }
  }

  private applyFluidPalettes(): void {
    this.mainFluid?.setParams(this.fluidParams())
  }

  /** Stamp the data-* seams the stylesheet keys off (self-contained mode). */
  private startSeamStamper(): void {
    if (this.seamDisposer !== undefined) return
    this.seamDisposer = startSeamStamper()
  }

  /**
   * Measure the two chrome/transcript seams (header card top, composer glass
   * bottom) and feed the results to the stylesheet. Idempotent per mount: the
   * previous handle is released first so a re-mount cannot leave a second
   * measurement loop and a second veil behind.
   */
  private startEdgeMetrics(): void {
    this.edgeMetrics?.dispose()
    this.edgeMetrics = startEdgeMetrics()
  }

  /** Release every interaction shim. Called on plugin disposal; the visual
   *  flip (setEnabled -> unmount) releases them too, so this is the
   *  belt-and-braces path that must stay idempotent. */
  dispose(): void {
    this.submenuHoldDisposer?.()
    this.submenuHoldDisposer = undefined
  }

  /**
   * Attach or drop the submenu click-hold shim (idempotent).
   *
   * Gated on the layer being ON as well as on the knob, because the shim
   * changes behaviour, not paint: it swallows exactly one click on every
   * expandable row in the app. Left armed while the theme is off it would keep
   * rewriting click handling with no visible cause — and with no way to opt
   * out, since the panel hides its knobs while disabled. "Off == the stock UI"
   * has to cover behaviour too.
   */
  private syncSubmenuHold(): void {
    if (this.enabled && this.settings.submenuHold) {
      if (this.submenuHoldDisposer === undefined) this.submenuHoldDisposer = startSubmenuHold()
      return
    }
    this.submenuHoldDisposer?.()
    this.submenuHoldDisposer = undefined
  }

  /** Attach the cursor-spotlight pointer feeds (idempotent per mount). */
  private startSpotlightFeed(): void {
    if (this.spotlightDisposer !== undefined) return
    this.spotlightDisposer = startSpotlight()
  }
}
