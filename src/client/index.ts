/**
 * Aqua client plugin body: the toggleable glassmorphism skin. Owns the durable
 * enable flag (localStorage), applies/retracts the theme layer through
 * {@link AquaLayer}, and ships its own settings surface in the LEFT SIDEBAR:
 * - a panel icon (`sidebar.panellist`) that opens the glass panel;
 * - the panel page itself (`main`, key `aqua`) carrying the master on/off
 *   switch and every glass knob.
 * One click on the master switch returns the stock UI (every layer is an
 * effect, disposed on flip).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { AquaPanelPage, type AquaPanelPageInjected } from './AquaPanelPage.tsx'
import { AquaPanelIcon } from './AquaPanelIcon.tsx'
import { aquaPanelStore, type AquaPanelActions, type AquaSettingsPayload } from './settings-store.ts'
import { en, NS, zh } from './locales.ts'
import { AquaLayer } from './theme-layer.ts'
// Side-effect imports: the theme-layer stylesheet (unloaded with the plugin)
// and the self-hosted Space Grotesk @font-face (no shell dependency).
import './aqua.css'
import './fonts.css'

/** Required services: theme override stack plus the sidebar panel surfaces. */
export const inject = ['theme', 'slots', 'locale']

/** The panel's key in the `main` slot — also the sidebar panel id. */
const PANEL_ID = 'aqua'

/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
  const disposers = [
    ctx.locale.register(NS, { zh, en }),
    // The host may report its language as zh-CN as well as zh; both spellings
    // resolve to the same dictionary so the panel copy follows 设置 → 语言.
    ctx.locale.register(NS, 'zh-CN', zh),
  ]
  return () => { for (const dispose of disposers) dispose() }
}, 'ui-aqua: settings dictionaries')
  const t = ctx.locale.bind(NS)

  // The layer owns its lifecycle: enable flag, token stack, and CSS attribute
  // are all effects released on disable/dispose.
  const layer = new AquaLayer(ctx)

  // One store mirror of the layer state, shared by the panel page (master
  // switch + every knob). The mirror is the store declaration exported from
  // settings-store; its `sync` action is what the slot's inject factory binds.
  let panelBound: AquaPanelActions | undefined
  let revision = 0
  const payload = (): AquaSettingsPayload => {
    const s = layer.getSettings()
    return {
      enabled: layer.getEnabled(),
      blur: s.blur,
      frost: s.frost,
      fluidHue: s.fluidHue,
      fluidDepth: s.fluidDepth,
      bgBrightnessLight: s.bgBrightnessLight,
      bgBrightnessDark: s.bgBrightnessDark,
      dark: layer.getDark(),
      background: s.background,
      wallpaper: s.wallpaper,
      whale: s.whale,
      critters: s.critters,
      mesh: s.mesh,
      spotlight: s.spotlight,
      submenuHold: s.submenuHold,
      menuOpacity: s.menuOpacity,
      chatAlpha: s.chatAlpha,
      wallpaperBlur: s.wallpaperBlur,
      wallpaperFrost: s.wallpaperFrost,
      videoBlur: s.videoBlur,
      videoBrightness: s.videoBrightness,
      // Typography
      fontText: s.fontText,
      fontCode: s.fontCode,
      fontSizeText: s.fontSizeText,
      fontSizeCode: s.fontSizeCode,
      fontSizeTerminal: s.fontSizeTerminal,
      lineHeight: s.lineHeight,
      weightBody: s.weightBody,
      weightHeading: s.weightHeading,
      palette: s.palette,
      preference: s.preference,
      weightBodySidebar: s.weightBodySidebar,
      weightHeadingSidebar: s.weightHeadingSidebar,
      weightBodyHeader: s.weightBodyHeader,
      weightHeadingHeader: s.weightHeadingHeader,
      weightBodyChat: s.weightBodyChat,
      weightHeadingChat: s.weightHeadingChat,
      weightBodyComposer: s.weightBodyComposer,
      weightHeadingComposer: s.weightHeadingComposer,
      hintWeight: s.hintWeight,
      hintOpacity: s.hintOpacity,
      hintFont: s.hintFont,
      hintColor: s.hintColor,
      blurChat: s.blurChat,
      blurPages: s.blurPages,
      hintWeightSidebar: s.hintWeightSidebar,
      hintOpacitySidebar: s.hintOpacitySidebar,
      hintWeightHeader: s.hintWeightHeader,
      hintOpacityHeader: s.hintOpacityHeader,
      hintWeightChat: s.hintWeightChat,
      hintOpacityChat: s.hintOpacityChat,
      hintWeightComposer: s.hintWeightComposer,
      hintOpacityComposer: s.hintOpacityComposer,
      hintColorSidebar: s.hintColorSidebar,
      hintColorHeader: s.hintColorHeader,
      hintColorChat: s.hintColorChat,
      hintColorComposer: s.hintColorComposer,
      paletteChat: s.paletteChat,
      locale: ctx.locale.getLocale().active,
    }
  }
  const sync = (): void => {
    const next = payload()
    panelBound?.sync(next, revision)
    revision += 1
  }
  // The Appearance switch flips the brightness knob's half-range; re-sync
  // the store so the panel re-renders with the new range.
  ctx.effect(() => ctx.on('theme/change', () => { sync() }), 'ui-aqua: appearance scheme sync')
  // The panel picks font names by language; a switch must re-render it.
  ctx.effect(() => ctx.on('locale/change', () => { sync() }), 'ui-aqua: locale sync')

  const panelInjected = (actions: AquaPanelActions): AquaPanelPageInjected => {
    panelBound = actions
    // Re-sync from the layer so no flip is lost between registration and
    // first render (the store's revision guard drops stale duplicates).
    sync()
    return {
      setEnabled: (enabled) => {
        layer.setEnabled(enabled)
        sync()
      },
      setBlur: (blur) => {
        layer.setBlur(blur)
        sync()
      },
      setFrost: (frost) => {
        layer.setFrost(frost)
        sync()
      },
      setFluidHue: (fluidHue) => {
        layer.setFluidHue(fluidHue)
        sync()
      },
      setFluidDepth: (fluidDepth) => {
        layer.setFluidDepth(fluidDepth)
        sync()
      },
      setBgBrightness: (bgBrightness) => {
        layer.setBgBrightness(bgBrightness)
        sync()
      },
      setBackground: (background) => {
        layer.setBackground(background)
        sync()
      },
      setWallpaper: (wallpaper) => {
        layer.setWallpaper(wallpaper)
        sync()
      },
      setWhale: (whale) => {
        layer.setWhale(whale)
        sync()
      },
      setCritters: (critters) => {
        layer.setCritters(critters)
        sync()
      },
      setMesh: (mesh) => {
        layer.setMesh(mesh)
        sync()
      },
      setSpotlight: (spotlight) => {
        layer.setSpotlight(spotlight)
        sync()
      },
      setSubmenuHold: (submenuHold) => {
        layer.setSubmenuHold(submenuHold)
        sync()
      },
      setMenuOpacity: (menuOpacity) => {
        layer.setMenuOpacity(menuOpacity)
        sync()
      },
      setChatAlpha: (chatAlpha) => {
        layer.setChatAlpha(chatAlpha)
        sync()
      },
      setWallpaperBlur: (wallpaperBlur) => {
        layer.setWallpaperBlur(wallpaperBlur)
        sync()
      },
      setWallpaperFrost: (wallpaperFrost) => {
        layer.setWallpaperFrost(wallpaperFrost)
        sync()
      },
      setVideoBlur: (videoBlur) => {
        layer.setVideoBlur(videoBlur)
        sync()
      },
      setVideoBrightness: (videoBrightness) => {
        layer.setVideoBrightness(videoBrightness)
        sync()
      },
      // Typography
      setFontText: (stack) => {
        layer.setFontText(stack)
        sync()
      },
      setFontCode: (stack) => {
        layer.setFontCode(stack)
        sync()
      },
      setFontSizeRole: (role, px) => {
        layer.setFontSizeRole(role, px)
        sync()
      },
      setLineHeight: (lineHeight) => {
        layer.setLineHeight(lineHeight)
        sync()
      },
      setWeightBody: (weightBody) => {
        layer.setWeightBody(weightBody)
        sync()
      },
      setWeightHeading: (weightHeading) => {
        layer.setWeightHeading(weightHeading)
        sync()
      },
      setPalette: (id) => {
        layer.setPalette(id)
        sync()
      },
      setPaletteChat: (id) => {
        layer.setPaletteChat(id)
        sync()
      },
      setThemePreference: (id) => {
        layer.setThemePreference(id)
        sync()
      },
      setRegionWeight: (region, kind, value) => {
        layer.setRegionWeight(region, kind, value)
        sync()
      },
      setHintWeight: (value) => {
        layer.setHintWeight(value)
        sync()
      },
      setHintOpacity: (value) => {
        layer.setHintOpacity(value)
        sync()
      },
      setHintFont: (stack) => {
        layer.setHintFont(stack)
        sync()
      },
      setHintColor: (id) => {
        layer.setHintColor(id)
        sync()
      },
      resetRegionWeights: () => {
        layer.resetRegionWeights()
        sync()
      },
      resetHint: () => {
        layer.resetHint()
        sync()
      },
      setBlurChat: (value) => {
        layer.setBlurChat(value)
        sync()
      },
      setBlurPages: (value) => {
        layer.setBlurPages(value)
        sync()
      },
      setRegionHintNumber: (region, kind, value) => {
        layer.setRegionHintNumber(region, kind, value)
        sync()
      },
      setRegionHintColor: (region, id) => {
        layer.setRegionHintColor(region, id)
        sync()
      },
      resetRegionHints: () => {
        layer.resetRegionHints()
        sync()
      },
      resetRegion: (region) => {
        layer.resetRegion(region)
        sync()
      },
      resetFontText: () => {
        layer.resetFontText()
        sync()
      },
      resetFontCode: () => {
        layer.resetFontCode()
        sync()
      },
      resetFontSizeRole: (role) => {
        layer.resetFontSizeRole(role)
        sync()
      },
      resetLineHeight: () => {
        layer.resetLineHeight()
        sync()
      },
      resetWeights: () => {
        layer.resetWeights()
        sync()
      },
      resetPalette: () => {
        layer.resetPalette()
        sync()
      },
      authorizeVideo: () => {
        layer.authorizeVideo()
      },
    }
  }

  // The glass panel lives in the LEFT SIDEBAR: a panel icon in the panel
  // list, and the panel page itself in the `main` slot under the same key.
  // Clicking the icon swaps the main column to the glass controls.
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 20,
    locale: NS,
    label: () => t('tab'),
  }, AquaPanelIcon))

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    store: aquaPanelStore,
    locale: NS,
    // Runtime contract: the registry calls this factory with the store's baked
    // actions as the only argument for a root-scope slot — the host's own
    // registers read `inject: (sessionId, actions)` for session slots, which
    // is the same call with the session id prepended.
    //
    // Typing gap: `InjectParams<K, H>` derives the parameter tuple from
    // `[H] extends [StoreDecl]`, but `register`'s `H` declares the default
    // `= undefined`; the inference loop settles on that default, so the tuple
    // collapses to `[]` and a correctly-typed one-argument factory is
    // rejected. The assertion below restates the declared shape without
    // touching the runtime path (which still receives `actions`). Remove it
    // once the host stops defaulting `H`.
    inject: panelInjected as unknown as () => AquaPanelPageInjected,
  }, AquaPanelPage))
}
