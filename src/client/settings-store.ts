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
