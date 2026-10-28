/**
 * Aqua row slot store: a mirror of the layer's state (enable flag plus the
 * knobs and the backdrop source). The plugin's apply-world change listener is
 * the only writer; the panel component reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Store state mirrored from the Aqua settings scope. */
export interface AquaRowState {
  /** Persisted layer enable flag. */
  enabled: boolean
  /** Glass blur radius, px. */
  blur: number
  /** Glass frost amount, 0-100. */
  frost: number
  /** Fluid hue, degrees (0-360, continuous). */
  fluidHue: number
  /** Fluid depth, 0-100 (continuous). */
  fluidDepth: number
  /** Background brightness, 0-100. */
  bgBrightness: number
  /** Resolved palette is dark (brightness knob = darkening half). */
  dark: boolean
  /** Backdrop source: fluid board or custom wallpaper. */
  background: 'fluid' | 'wallpaper'
  /** Wallpaper image data URL. */
  wallpaper: string
  /** Particle whale in the chat area center. */
  whale: boolean
  /** Ambient marine life (fish / bubbles / plankton). */
  critters: boolean
  /** Interactive mesh (the site's dot-grid with pointer repel). */
  mesh: boolean
  /** Cursor spotlight glow following the pointer over the glass panes. */
  spotlight: boolean
  /** Keep a hover-opened submenu open when the same row is clicked. */
  submenuHold: boolean
  /** Submenu/popup surface opacity, 0-100. */
  menuOpacity: number
  /** Chat surface veil, 0-100 (0 = backdrop untouched, 100 = opaque chat slab). */
  chatAlpha: number
  /** Wallpaper blur radius, px. */
  wallpaperBlur: number
  /** Wallpaper frost veil, 0-100. */
  wallpaperFrost: number
  /** Video wallpaper blur radius, px. */
  videoBlur: number
  /** Video wallpaper brightness, 0-100. */
  videoBrightness: number
  /* ---------- Typography ---------- */
  /** Conversation font stack (mirror of the host theme service). */
  fontText: string
  /** Code-block font stack (mirror of the host theme service). */
  fontCode: string
  /** Conversation font size, px (host range 10-22). */
  fontSizeText: number
  /** Code-block font size, px (host range 10-16). */
  fontSizeCode: number
  /** Sidebar terminal font size, px (host range 10-20). */
  fontSizeTerminal: number
  /** Line-height multiplier (1.0-2.5, 1.5 = host rhythm). */
  lineHeight: number
  /** Body font weight (300-800). */
  weightBody: number
  /** Heading font weight (400-800). */
  weightHeading: number
  /** Text-colour palette id. */
  palette: string
  /** Appearance preference (mirror of 设置 → 外观). */
  preference: 'light' | 'dark' | 'system'
  /** Region weights: 0 = follow the global body/heading knob. */
  weightBodySidebar: number
  weightHeadingSidebar: number
  weightBodyHeader: number
  weightHeadingHeader: number
  weightBodyChat: number
  weightHeadingChat: number
  weightBodyComposer: number
  weightHeadingComposer: number
  weightBodyStats: number
  weightHeadingStats: number
  /** Explanatory-text weight (300-800). */
  hintWeight: number
  /** Explanatory-text strength (40-100). */
  hintOpacity: number
  /** Explanatory-text font stack (empty = follow the body font). */
  hintFont: string
  /** Explanatory-text colour preset id (empty = follow the scheme). */
  hintColor: string
  blurChat: number
  blurPages: number
  hintWeightSidebar: number
  hintOpacitySidebar: number
  hintWeightHeader: number
  hintOpacityHeader: number
  hintWeightChat: number
  hintOpacityChat: number
  hintWeightComposer: number
  hintOpacityComposer: number
  hintWeightStats: number
  hintOpacityStats: number
  hintColorSidebar: string
  hintColorHeader: string
  hintColorChat: string
  hintColorComposer: string
  hintColorStats: string
  weightBodyRightbar: number
  weightHeadingRightbar: number
  hintWeightRightbar: number
  hintOpacityRightbar: number
  hintColorRightbar: string
  /** Conversation-only colour scheme (empty = follow the global font colour). */
  paletteChat: string

  /** Monotonic revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** The full payload the layer pushes into the row store on every change. */
export interface AquaSettingsPayload {
  enabled: boolean
  blur: number
  frost: number
  fluidHue: number
  fluidDepth: number
  bgBrightness: number
  dark: boolean
  background: 'fluid' | 'wallpaper'
  wallpaper: string
  whale: boolean
  critters: boolean
  mesh: boolean
  spotlight: boolean
  submenuHold: boolean
  menuOpacity: number
  chatAlpha: number
  wallpaperBlur: number
  wallpaperFrost: number
  videoBlur: number
  videoBrightness: number
  /* ---------- Typography ---------- */
  fontText: string
  fontCode: string
  fontSizeText: number
  fontSizeCode: number
  fontSizeTerminal: number
  lineHeight: number
  weightBody: number
  weightHeading: number
  palette: string
  preference: 'light' | 'dark' | 'system'
  /** Region weights: 0 = follow the global body/heading knob. */
  weightBodySidebar: number
  weightHeadingSidebar: number
  weightBodyHeader: number
  weightHeadingHeader: number
  weightBodyChat: number
  weightHeadingChat: number
  weightBodyComposer: number
  weightHeadingComposer: number
  weightBodyStats: number
  weightHeadingStats: number
  /** Explanatory-text weight (300-800). */
  hintWeight: number
  /** Explanatory-text strength (40-100). */
  hintOpacity: number
  /** Explanatory-text font stack (empty = follow the body font). */
  hintFont: string
  hintColor: string
  blurChat: number
  blurPages: number
  hintWeightSidebar: number
  hintOpacitySidebar: number
  hintWeightHeader: number
  hintOpacityHeader: number
  hintWeightChat: number
  hintOpacityChat: number
  hintWeightComposer: number
  hintOpacityComposer: number
  hintWeightStats: number
  hintOpacityStats: number
  hintColorSidebar: string
  hintColorHeader: string
  hintColorChat: string
  hintColorComposer: string
  hintColorStats: string
  weightBodyRightbar: number
  weightHeadingRightbar: number
  hintWeightRightbar: number
  hintOpacityRightbar: number
  hintColorRightbar: string
  /** Conversation-only colour scheme (empty = follow the global font colour). */
  paletteChat: string
}

/** Declared action shape giving the exported factory a stable return type. */
type AquaRowActions = {
  sync: (draft: AquaRowState, next: AquaSettingsPayload, revision: number) => void
}

/**
 * Declares the Aqua panel state and write surface.
 * @returns the store handle.
 */
export function createAquaRowStore(): EngineStoreHandle<AquaRowState, AquaRowActions> {  return defineStore({
    init: (): AquaRowState => ({
      enabled: true,
      blur: 20,
      frost: 7,
      fluidHue: 320,
      fluidDepth: 25,
      bgBrightness: 50,
      dark: false,
      background: 'fluid',
      wallpaper: '',
      whale: true,
      critters: true,
      mesh: true,
      spotlight: true,
      submenuHold: true,
      menuOpacity: 96,
      chatAlpha: 25,
      wallpaperBlur: 0,
      wallpaperFrost: 0,
      videoBlur: 6,
      videoBrightness: 45,
      /* Typography defaults */
      fontText: '',
      fontCode: '',
      fontSizeText: 14,
      fontSizeCode: 11,
      fontSizeTerminal: 13,
      lineHeight: 1.5,
      weightBody: 400,
      weightHeading: 600,
      palette: 'ink',
      preference: 'system',
      weightBodySidebar: 0,
      weightHeadingSidebar: 0,
      weightBodyHeader: 0,
      weightHeadingHeader: 0,
      weightBodyChat: 0,
      weightHeadingChat: 0,
      weightBodyComposer: 0,
      weightHeadingComposer: 0,
      weightBodyStats: 0,
      weightHeadingStats: 0,
      hintWeight: 400,
      hintOpacity: 80,
      hintFont: '',
      hintColor: '',
      blurChat: 14,
      blurPages: 14,
      hintWeightSidebar: 400,
      hintOpacitySidebar: 92,
      hintWeightHeader: 400,
      hintOpacityHeader: 92,
      hintWeightChat: 400,
      hintOpacityChat: 92,
      hintWeightComposer: 400,
      hintOpacityComposer: 92,
      hintWeightStats: 400,
      hintOpacityStats: 92,
      hintColorSidebar: '',
      hintColorHeader: '',
      hintColorChat: '',
      hintColorComposer: '',
      hintColorStats: '',
      weightBodyRightbar: 0,
      weightHeadingRightbar: 0,
      hintWeightRightbar: 400,
      hintOpacityRightbar: 92,
      hintColorRightbar: '',
      paletteChat: '',
      revision: -1,
    }),
    actions: {
      sync: (d, next: AquaSettingsPayload, revision: number) => {
        if (revision <= d.revision) return
        d.enabled = next.enabled
        d.blur = next.blur
        d.frost = next.frost
        d.fluidHue = next.fluidHue
        d.fluidDepth = next.fluidDepth
        d.bgBrightness = next.bgBrightness
        d.dark = next.dark
        d.background = next.background
        d.wallpaper = next.wallpaper
        d.whale = next.whale
        d.critters = next.critters
        d.mesh = next.mesh
        d.spotlight = next.spotlight
        d.submenuHold = next.submenuHold
        d.menuOpacity = next.menuOpacity
        d.chatAlpha = next.chatAlpha
        d.wallpaperBlur = next.wallpaperBlur
        d.wallpaperFrost = next.wallpaperFrost
        d.videoBlur = next.videoBlur
        d.videoBrightness = next.videoBrightness
        d.fontText = next.fontText
        d.fontCode = next.fontCode
        d.fontSizeText = next.fontSizeText
        d.fontSizeCode = next.fontSizeCode
        d.fontSizeTerminal = next.fontSizeTerminal
        d.lineHeight = next.lineHeight
        d.weightBody = next.weightBody
        d.weightHeading = next.weightHeading
        d.palette = next.palette
        d.preference = next.preference
        d.weightBodySidebar = next.weightBodySidebar
        d.weightHeadingSidebar = next.weightHeadingSidebar
        d.weightBodyHeader = next.weightBodyHeader
        d.weightHeadingHeader = next.weightHeadingHeader
        d.weightBodyChat = next.weightBodyChat
        d.weightHeadingChat = next.weightHeadingChat
        d.weightBodyComposer = next.weightBodyComposer
        d.weightHeadingComposer = next.weightHeadingComposer
        d.weightBodyStats = next.weightBodyStats
        d.weightHeadingStats = next.weightHeadingStats
        d.hintWeight = next.hintWeight
        d.hintOpacity = next.hintOpacity
        d.hintFont = next.hintFont
        d.hintColor = next.hintColor
        d.blurChat = next.blurChat
        d.blurPages = next.blurPages
        d.hintWeightSidebar = next.hintWeightSidebar
        d.hintOpacitySidebar = next.hintOpacitySidebar
        d.hintWeightHeader = next.hintWeightHeader
        d.hintOpacityHeader = next.hintOpacityHeader
        d.hintWeightChat = next.hintWeightChat
        d.hintOpacityChat = next.hintOpacityChat
        d.hintWeightComposer = next.hintWeightComposer
        d.hintOpacityComposer = next.hintOpacityComposer
        d.hintWeightStats = next.hintWeightStats
        d.hintOpacityStats = next.hintOpacityStats
        d.hintColorSidebar = next.hintColorSidebar
        d.hintColorHeader = next.hintColorHeader
        d.hintColorChat = next.hintColorChat
        d.hintColorComposer = next.hintColorComposer
        d.hintColorStats = next.hintColorStats
        d.weightBodyRightbar = next.weightBodyRightbar
        d.weightHeadingRightbar = next.weightHeadingRightbar
        d.hintWeightRightbar = next.hintWeightRightbar
        d.hintOpacityRightbar = next.hintOpacityRightbar
        d.hintColorRightbar = next.hintColorRightbar
        d.paletteChat = next.paletteChat
        d.revision = revision
      },
    },
  })
}

/**
 * The slot's store declaration, in the official plugin-manager shape: the
 * declaration spread plus `create` overridden to hand back ONE shared
 * instance. The host materializes the slot's store through `create()`, so the
 * panel component, the inject factory, and the apply-world `sync` writer all
 * observe the same snapshot.
 */
const aquaPanelStoreHandle = createAquaRowStore()
const aquaPanelStoreInstance = aquaPanelStoreHandle.create()

/** The store declaration handed to the slot registration. */
export const aquaPanelStore = {
  ...aquaPanelStoreHandle,
  create: () => aquaPanelStoreInstance,
}

/**
 * The baked action face the slot's inject factory receives: the store's
 * `sync` action with the draft argument already bound (call it as
 * `sync(next, revision)`).
 */
export interface AquaPanelActions {
  /** Mirror one layer-state payload into the store. */
  sync: (next: AquaSettingsPayload, revision: number) => void
}
