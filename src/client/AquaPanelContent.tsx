/**
 * Aqua glass-theme control body, shared by the sidebar panel page.
 *
 * Layout: a fixed appearance row (the same light/dark/system switch as
 * 设置 → 外观) followed by collapsible groups — glass material, background,
 * fonts, decorations. Font family / size / weight / colour-scheme settings each
 * carry a reset button and a hover preview so the effect is visible before the
 * value is committed.
 *
 * Every write goes straight through to the layer, so the skin moves live.
 */
import { useEffect, useRef, useState } from 'react'
import { IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Collapsible, ColorDots, fileToDataUrl, FontPicker, Knob, PalettePicker, PreviewBubble, ResetButton, Segmented, TabBar, WeightSelect,
  type FontPickerOption,
} from './AquaControls.tsx'
import { CODE_FONT_PRESETS, HINT_COLORS, TEXT_FONT_PRESETS, TEXT_PALETTES, type FontRole } from './typography.ts'
import { deleteImportedFont, ensureImportedFontFaces, FontImportError, releaseImportedFont, saveImportedFont, verifyImportedFont, type ImportedFont } from './font-store.ts'
import { loadVideoHandle, saveVideoBlob, saveVideoHandle } from './wallpaper-store.ts'
import type { AquaRowState } from './settings-store.ts'
import type { AquaLocaleKey } from './locales.ts'
import css from './AquaAppearanceRow.module.css'

/** Detect if running in Electron renderer. */
function isElectron(): boolean {
  try {
    // @ts-expect-error - process may not exist in browser
    return typeof process !== 'undefined' && !!process.versions?.electron
  } catch {
    return false
  }
}

/** Check if File System Access API is truly available (not just polyfilled). */
function hasNativeFileSystemAccess(): boolean {
  if (isElectron()) return false
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

/** Injected business face: every knob write except the master switch. */
export interface AquaPanelContentInjected {
  setBlur: (value: number) => void
  setFrost: (value: number) => void
  setFluidHue: (value: number) => void
  setFluidDepth: (value: number) => void
  setBgBrightness: (value: number) => void
  setBackground: (value: 'fluid' | 'wallpaper') => void
  setWallpaper: (value: string) => void
  setWhale: (value: boolean) => void
  setCritters: (value: boolean) => void
  setMesh: (value: boolean) => void
  setSpotlight: (value: boolean) => void
  setSubmenuHold: (value: boolean) => void
  setMenuOpacity: (value: number) => void
  setChatAlpha: (value: number) => void
  setWallpaperBlur: (value: number) => void
  setWallpaperFrost: (value: number) => void
  setVideoBlur: (value: number) => void
  setVideoBrightness: (value: number) => void
  /* ---------- Typography ---------- */
  setFontText: (stack: string) => void
  setFontCode: (stack: string) => void
  setFontSizeRole: (role: FontRole, px: number) => void
  setLineHeight: (value: number) => void
  setWeightBody: (value: number) => void
  setWeightHeading: (value: number) => void
  setPalette: (id: string) => void
  resetFontText: () => void
  resetFontCode: () => void
  resetFontSizeRole: (role: FontRole) => void
  resetLineHeight: () => void
  resetWeights: () => void
  resetPalette: () => void
  /* ---------- Appearance ---------- */
  /** Light / dark / system — the same switch as 设置 → 外观. */
  setThemePreference: (id: 'light' | 'dark' | 'system') => void
  /* ---------- Region weights ---------- */
  /** Set one region's body/heading weight; 0 = follow the global knob. */
  setRegionWeight: (region: 'sidebar' | 'header' | 'chat' | 'composer', kind: 'body' | 'heading', value: number) => void
  /** Explanatory-text weight. */
  setHintWeight: (value: number) => void
  /** Explanatory-text strength. */
  setHintOpacity: (value: number) => void
  /** Explanatory-text font stack (empty = follow the body font). */
  setHintFont: (stack: string) => void
  /** Explanatory-text colour preset (empty = follow the scheme). */
  setHintColor: (id: string) => void
  /** Restore every region to "follow the global weight". */
  resetRegionWeights: () => void
  /** Restore the explanatory-text knobs. */
  resetHint: () => void
  /** Conversation-detail blur radius. */
  setBlurChat: (value: number) => void
  /** Menu-page / feature-page blur radius. */
  setBlurPages: (value: number) => void
  /** One region's explanatory-text weight or strength. */
  setRegionHintNumber: (region: 'sidebar' | 'header' | 'chat' | 'composer', kind: 'weight' | 'opacity', value: number) => void
  /** One region's explanatory-text colour preset. */
  setRegionHintColor: (region: 'sidebar' | 'header' | 'chat' | 'composer', id: string) => void
  /** Restore every region's explanatory-text knobs. */
  resetRegionHints: () => void
  /** Restore one region (weights + explanatory trio). */
  resetRegion: (region: 'sidebar' | 'header' | 'chat' | 'composer') => void
  /** Conversation-only colour scheme (empty = follow the global one). */
  setPaletteChat: (id: string) => void
  /** Re-request permission for a remembered video file. */
  authorizeVideo: () => void
}

/** The locale seat the slot renderer provides for a registration with `locale`. */
export type AquaLocaleSeat = (key: AquaLocaleKey) => string

/** The selector hook the slot renderer provides when a `store` is declared. */
export type AquaUseStore = <T>(selector: (snapshot: AquaRowState) => T) => T

/** Full component props: store share + locale seat + injected face. */
export type AquaPanelContentComponentProps =
  AquaPanelContentInjected & {
    /** Localized copy seat for the `settings.aqua` namespace. */
    t: AquaLocaleSeat
    /** Selector hook over the panel store snapshot. */
    useStore: AquaUseStore
  }

/**
 * Render the Aqua knob body.
 * @param props - composed slot props.
 * @returns the control groups.
 */
export function AquaPanelContent(props: AquaPanelContentComponentProps) {
  const { t, useStore } = props
  const {
    setBlur, setFrost, setFluidHue, setFluidDepth, setBgBrightness,
    setBackground, setWallpaper, setWhale, setCritters, setMesh, setSpotlight, setSubmenuHold, setMenuOpacity, setChatAlpha,
    setWallpaperBlur, setWallpaperFrost, setVideoBlur, setVideoBrightness, authorizeVideo,
    setFontText, setFontCode, setFontSizeRole, setLineHeight, setWeightBody, setWeightHeading, setPalette,
    resetFontText, resetFontCode, resetFontSizeRole, resetLineHeight, resetWeights, resetPalette,
    setThemePreference,
    setRegionWeight, setHintWeight, setHintOpacity, setHintFont, setHintColor, resetRegionWeights, resetHint,
    setBlurChat, setBlurPages, setRegionHintNumber, setRegionHintColor, resetRegionHints, resetRegion, setPaletteChat,
  } = props

  const blur = useStore(s => s.blur)
  const frost = useStore(s => s.frost)
  const fluidHue = useStore(s => s.fluidHue)
  const fluidDepth = useStore(s => s.fluidDepth)
  const bgBrightnessLight = useStore(s => s.bgBrightnessLight)
  const bgBrightnessDark = useStore(s => s.bgBrightnessDark)
  const dark = useStore(s => s.dark)
  const background = useStore(s => s.background)
  const whale = useStore(s => s.whale)
  const critters = useStore(s => s.critters)
  const mesh = useStore(s => s.mesh)
  const spotlight = useStore(s => s.spotlight)
  const submenuHold = useStore(s => s.submenuHold)
  const menuOpacity = useStore(s => s.menuOpacity)
  const chatAlpha = useStore(s => s.chatAlpha)
  const wallpaper = useStore(s => s.wallpaper)
  const wallpaperBlur = useStore(s => s.wallpaperBlur)
  const wallpaperFrost = useStore(s => s.wallpaperFrost)
  const videoBlur = useStore(s => s.videoBlur)
  const videoBrightness = useStore(s => s.videoBrightness)
  const fontText = useStore(s => s.fontText)
  const fontCode = useStore(s => s.fontCode)
  const fontSizeText = useStore(s => s.fontSizeText)
  const fontSizeCode = useStore(s => s.fontSizeCode)
  const fontSizeTerminal = useStore(s => s.fontSizeTerminal)
  const lineHeight = useStore(s => s.lineHeight)
  const weightBody = useStore(s => s.weightBody)
  const weightHeading = useStore(s => s.weightHeading)
  const palette = useStore(s => s.palette)
  const preference = useStore(s => s.preference)
  const weightBodySidebar = useStore(s => s.weightBodySidebar)
  const weightHeadingSidebar = useStore(s => s.weightHeadingSidebar)
  const weightBodyHeader = useStore(s => s.weightBodyHeader)
  const weightHeadingHeader = useStore(s => s.weightHeadingHeader)
  const weightBodyChat = useStore(s => s.weightBodyChat)
  const weightHeadingChat = useStore(s => s.weightHeadingChat)
  const weightBodyComposer = useStore(s => s.weightBodyComposer)
  const weightHeadingComposer = useStore(s => s.weightHeadingComposer)
  const hintWeight = useStore(s => s.hintWeight)
  const hintOpacity = useStore(s => s.hintOpacity)
  const hintFont = useStore(s => s.hintFont)
  const hintColor = useStore(s => s.hintColor)
  const blurChat = useStore(s => s.blurChat)
  const blurPages = useStore(s => s.blurPages)
  const hintWeightSidebar = useStore(s => s.hintWeightSidebar)
  const hintOpacitySidebar = useStore(s => s.hintOpacitySidebar)
  const hintColorSidebar = useStore(s => s.hintColorSidebar)
  const hintWeightHeader = useStore(s => s.hintWeightHeader)
  const hintOpacityHeader = useStore(s => s.hintOpacityHeader)
  const hintColorHeader = useStore(s => s.hintColorHeader)
  const hintWeightChat = useStore(s => s.hintWeightChat)
  const hintOpacityChat = useStore(s => s.hintOpacityChat)
  const hintColorChat = useStore(s => s.hintColorChat)
  const hintWeightComposer = useStore(s => s.hintWeightComposer)
  const hintOpacityComposer = useStore(s => s.hintOpacityComposer)
  const hintColorComposer = useStore(s => s.hintColorComposer)
  const paletteChat = useStore(s => s.paletteChat)

  /** Read a picked image; `fileToDataUrl` rejects on oversize / undecodable files. */
  const applyImage = (file: File): void => {
    setBackground('wallpaper')
    void fileToDataUrl(file).then(setWallpaper).catch(() => { window.alert(t('aqua.wallpaperFailed')) })
  }

  const fileRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)
  const fontFileRef = useRef<HTMLInputElement | null>(null)
  const [importedFonts, setImportedFonts] = useState<ImportedFont[]>([])
  /* Card-style tab switcher: exactly one group page is mounted at a time.
     Defaults to the background group, which is the one the user tunes most. */
  const [tab, setTab] = useState('background')
  /* Fold flags for the nested region cards. The top-level groups are not
     collapsible: the tab bar already shows exactly one of them, so their
     headers are hidden and an `open` flag there could never be read. */
  const [openRegionMap, setOpenRegionMap] = useState<Record<string, boolean>>({})

  // Videos are `idb:` blobs, `fsa:` remembered-file handles, or legacy
  // `data:video/` URLs.
  const isVideoWallpaper = wallpaper.startsWith('data:video/') || wallpaper.startsWith('idb:') || wallpaper.startsWith('fsa:')

  /** Pick a video. Chromium: File System Access — the browser remembers the
   *  file authorization, so later visits re-read the ORIGINAL file with no
   *  storage copy. Other browsers (and Electron) fall back to the plain file input. */
  const pickVideo = (): void => {
    if (hasNativeFileSystemAccess()) {
      const picker = window.showOpenFilePicker
      if (picker === undefined) return
      void (async () => {
        try {
          const [handle] = await picker({
            multiple: false,
            types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv'] } }],
          })
          if (handle === undefined) return
          setBackground('wallpaper')
          if (await saveVideoHandle(handle)) {
            setWallpaper(`fsa:${handle.name}`)
          } else {
            const file = await handle.getFile()
            void saveVideoBlob(file).then((id) => {
              if (id !== '') setWallpaper(id)
              // `fileToDataUrl` decodes IMAGES; handing it a video only ever
              // produced a silent rejection (and a multi-MB data URL if it had
              // worked, which localStorage cannot hold).
              else window.alert(t('aqua.videoSaveFailed'))
            })
          }
        } catch {
          /* picker cancelled — keep current state */
        }
      })()
    } else {
      videoRef.current?.click()
    }
  }

  /** 选择视频 click: an fsa: video with stale permission re-authorizes in
   *  one click (no picker); anything else opens the picker. */
  const onChooseVideo = (): void => {
    if (wallpaper.startsWith('fsa:') && hasNativeFileSystemAccess()) {
      void (async () => {
        const handle = await loadVideoHandle()
        if (handle !== null) {
          try {
            const permission = await handle.queryPermission({ mode: 'read' })
            if (permission === 'granted') {
              authorizeVideo()
              return
            }
            if (permission === 'prompt') {
              const next = await handle.requestPermission({ mode: 'read' })
              if (next === 'granted') {
                authorizeVideo()
                return
              }
            }
          } catch {
            /* fall through to re-pick */
          }
        }
        pickVideo()
      })()
    } else {
      pickVideo()
    }
  }

  // The brightness knob only ever offers the half that makes sense for the
  // resolved scheme: dark mode darkens (0-50), light mode brightens (50-100).
  // Each half is stored separately, so flipping 外观 no longer discards the
  // other side's value or leaves the knob showing a clamped lie.
  const bgMin = dark ? 0 : 50
  const bgMax = dark ? 50 : 100
  const bgBrightness = dark ? bgBrightnessDark : bgBrightnessLight

  /* ---------- Typography helpers ---------- */

  // The host reports its language as either zh / zh-CN or en; the panel copy
  // comes from the dictionary, so the font names follow the same switch.
  const chinese = t('aqua.enable') === '开启'

  // Booting the panel restores every imported @font-face and lists them.
  useEffect(() => {
    let cancelled = false
    void ensureImportedFontFaces()
      .then((fonts) => { if (!cancelled) setImportedFonts(fonts) })
      .catch(() => { /* no IndexedDB — the import entry simply stays inert */ })
    return () => { cancelled = true }
  }, [])

  const optionLabel = (preset: { zh: string, en: string }): string => (chinese ? preset.zh : preset.en)

  /** Imported faces join both pickers under their real family name. */
  const toImportedOptions = (): Array<{
    id: string
    zh: string
    en: string
    stack: string
    source: 'imported'
    badge: string
    onDelete: () => void
  }> => importedFonts.map(font => ({
    id: `imported:${font.id}`,
    zh: font.family,
    en: font.family,
    stack: `"${font.family}"`,
    source: 'imported' as const,
    badge: t('aqua.fontImportedBadge'),
    onDelete: () => { onDeleteFont(font) },
  }))

  const textFontOptions = [...TEXT_FONT_PRESETS, ...toImportedOptions()]
  const codeFontOptions = [...CODE_FONT_PRESETS, ...toImportedOptions()]

  /** Resolve a picker id back to the CSS stack it carries. */
  const stackOf = (list: typeof textFontOptions, id: string): string => list.find(option => option.id === id)?.stack ?? ''

  /** The picker id for a stored stack (imported faces included). */
  const idOf = (list: typeof textFontOptions, stack: string): string => list.find(option => option.stack === stack)?.id ?? 'theme'

  /** Build the picker rows for one role (badge + delete only on imported faces). */
  const pickerOptions = (list: typeof textFontOptions): FontPickerOption[] => list.map((option) => {
    const imported = 'badge' in option && typeof option.badge === 'string'
    const removable = 'onDelete' in option && typeof option.onDelete === 'function'
    return {
      id: option.id,
      label: optionLabel(option),
      badge: imported ? option.badge as string : undefined,
      onDelete: removable ? option.onDelete as () => void : undefined,
    }
  })

  /** Turn a rejected import into the sentence that explains it. */
  const importFailureText = (error: unknown): string => {
    if (error instanceof FontImportError) {
      if (error.reason === 'empty') return t('aqua.fontImportEmpty')
      if (error.reason === 'too-large') return t('aqua.fontImportTooLarge')
      if (error.reason === 'not-a-font') return t('aqua.fontImportNotAFont')
      if (error.reason === 'collection') return t('aqua.fontImportCollection')
    }
    return t('aqua.fontImportFailed')
  }

  const onFontFileChosen = (file: File | undefined): void => {
    if (file === undefined) return
    void (async () => {
      try {
        const saved = await saveImportedFont(file)
        setImportedFonts(await ensureImportedFontFaces())
        // `@font-face` failures are silent: confirm the browser really resolved
        // the family before claiming success and switching the body font to it.
        if (!await verifyImportedFont(saved.family)) {
          window.alert(t('aqua.fontImportBroken'))
          return
        }
        // Picking it right away is the whole point of importing one.
        setFontText(`"${saved.family}"`)
        // The popup must say WHERE it landed: body font only, code needs the
        // other picker.
        window.alert(`${t('aqua.importOkTitle')}：${saved.family}\n\n${t('aqua.importOkBody')}`)
      } catch (error) {
        window.alert(importFailureText(error))
      }
    })()
  }

  const onDeleteFont = (font: ImportedFont): void => {
    if (!window.confirm(t('aqua.deleteFontConfirm'))) return
    const stack = `"${font.family}"`
    void (async () => {
      await deleteImportedFont(font.id)
      releaseImportedFont(font.id)
      // Clear the references too. Leaving them made the picker say "跟随主题"
      // while the state still pointed at a family that no longer exists.
      if (fontText === stack) resetFontText()
      if (fontCode === stack) resetFontCode()
      if (hintFont === stack) setHintFont('')
      setImportedFonts(await ensureImportedFontFaces())
    })()
  }

  /** The colour scheme currently in force, for the preview bubbles. */
  const activePalette = TEXT_PALETTES.find(item => item.id === palette) ?? TEXT_PALETTES[0]
  const scheme = dark ? activePalette.dark : activePalette.light

  /** The five glass regions, in reading order, with their live values. */
  const regionRows = [
    { key: 'sidebar' as const, label: t('aqua.regionSidebar'), body: weightBodySidebar, heading: weightHeadingSidebar, hintW: hintWeightSidebar, hintO: hintOpacitySidebar, hintC: hintColorSidebar },
    { key: 'header' as const, label: t('aqua.regionHeader'), body: weightBodyHeader, heading: weightHeadingHeader, hintW: hintWeightHeader, hintO: hintOpacityHeader, hintC: hintColorHeader },
    { key: 'chat' as const, label: t('aqua.regionChat'), body: weightBodyChat, heading: weightHeadingChat, hintW: hintWeightChat, hintO: hintOpacityChat, hintC: hintColorChat },
    { key: 'composer' as const, label: t('aqua.regionComposer'), body: weightBodyComposer, heading: weightHeadingComposer, hintW: hintWeightComposer, hintO: hintOpacityComposer, hintC: hintColorComposer },
  ]

  /** Explanatory-text families: "follow body" first, then every text preset. */
  const hintFontOptions: FontPickerOption[] = [
    { id: 'follow', label: t('aqua.hintFontFollow') },
    ...pickerOptions(textFontOptions).slice(1),
  ]

  return (
    <div className={css.group}>
      {/* 外观：与「设置 → 外观」同一个开关，不折叠 */}
      <section className={`${css.subGroup} ${css.spanAll}`}>
        <div className={css.subTitle}>{t('aqua.appearance')}</div>
        <div className={css.controls}>
          <Segmented
            label={t('aqua.appearance')}
            value={preference}
            options={[
              { id: 'light' as const, label: t('aqua.appearanceLight') },
              { id: 'dark' as const, label: t('aqua.appearanceDark') },
              { id: 'system' as const, label: t('aqua.appearanceSystem') },
            ]}
            onSelect={setThemePreference}
          />
          <div className={css.knobHint}>{t('aqua.appearanceHint')}</div>
        </div>
      </section>

      {/* 卡片式标签：一次只显示一个设置组 */}
      <div className={css.spanAll}>
        <TabBar
          label={t('aqua.title')}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'glass', label: t('aqua.materialGroup') },
            { id: 'background', label: t('aqua.background') },
            { id: 'fonts', label: t('aqua.typographyGroup') },
            { id: 'colors', label: t('aqua.colorGroup') },
            { id: 'regions', label: t('aqua.regionsGroup') },
            { id: 'decor', label: t('aqua.decorGroup') },
          ]}
        />
      </div>

      {/* 玻璃材质 */}
      <Collapsible
        title={t('aqua.materialGroup')}
        open
        visible={tab === 'glass'}
        hideHeader
      >
        <Knob label={t('aqua.blur')} value={blur} min={0} max={40} step={0.5} unit="px" onChange={setBlur} />
        <Knob label={t('aqua.frost')} value={frost} min={0} max={100} step={1} unit="%" onChange={setFrost} />
        <Knob label={t('aqua.blurChat')} value={blurChat} min={0} max={40} step={0.5} unit="px" onChange={setBlurChat} />
        <Knob label={t('aqua.blurPages')} value={blurPages} min={0} max={40} step={0.5} unit="px" onChange={setBlurPages} />
        <div className={css.knobHint}>{t('aqua.blurChatHint')}；{t('aqua.blurPagesHint')}</div>
      </Collapsible>

      {/* 背景 */}
      <Collapsible
        title={t('aqua.background')}
        open
        visible={tab === 'background'}
        hideHeader
      >
        <div className={css.row}>
          <Segmented
            label={t('aqua.background')}
            value={background}
            options={[
              { id: 'fluid' as const, label: t('aqua.backgroundFluid') },
              { id: 'wallpaper' as const, label: t('aqua.backgroundWallpaper') },
            ]}
            onSelect={setBackground}
          />
        </div>

        {background === 'fluid' && (
          <>
            <Knob label={t('aqua.fluidHue')} value={fluidHue} min={0} max={360} step={1} unit="°" onChange={setFluidHue} />
            <Knob label={t('aqua.fluidDepth')} value={fluidDepth} min={0} max={100} step={1} unit="%" onChange={setFluidDepth} />
          </>
        )}

        {background === 'wallpaper' && (
          <>
            <div className={css.row}>
              <span className={css.rowLabel}>{t('aqua.wallpaper')}</span>
              <div className={css.wallpaperPick}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className={css.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file !== undefined) {
                      applyImage(file)
                    }
                    e.target.value = ''
                  }}
                />
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  className={css.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file !== undefined) {
                      setBackground('wallpaper')
                      void saveVideoBlob(file).then((id) => {
                        if (id !== '') setWallpaper(id)
                        else window.alert(t('aqua.videoSaveFailed'))
                      })
                    }
                    e.target.value = ''
                  }}
                />
                <button type="button" className={css.pickButton} onClick={() => { fileRef.current?.click() }}>
                  {t('aqua.chooseImage')}
                </button>
                <button type="button" className={css.pickButton} onClick={onChooseVideo}>
                  {t('aqua.chooseVideo')}
                </button>
                {wallpaper !== '' && (
                  <button type="button" className={css.deleteButton} onClick={() => { setWallpaper('') }}>
                    {t('aqua.deleteWallpaper')}
                  </button>
                )}
              </div>
            </div>
            <div className={css.knobHint}>{t('aqua.wallpaperHint')}</div>
            {!isVideoWallpaper && (
              <>
                <Knob label={t('aqua.wallpaperBlur')} value={wallpaperBlur} min={0} max={40} step={0.5} unit="px" onChange={setWallpaperBlur} />
                <Knob label={t('aqua.wallpaperFrost')} value={wallpaperFrost} min={0} max={100} step={1} unit="%" onChange={setWallpaperFrost} />
              </>
            )}
            {isVideoWallpaper && (
              <>
                <Knob label={t('aqua.videoBlur')} value={videoBlur} min={0} max={40} step={0.5} unit="px" onChange={setVideoBlur} />
                <Knob label={t('aqua.videoBrightness')} value={videoBrightness} min={0} max={100} step={1} unit="%" onChange={setVideoBrightness} />
                <div className={css.knobHint}>{t('aqua.videoHint')}</div>
              </>
            )}
          </>
        )}

        <Knob label={t('aqua.bgBrightness')} value={bgBrightness} min={bgMin} max={bgMax} step={1} unit="%" onChange={setBgBrightness} />
        <div className={css.knobHint}>
          {t(dark ? 'aqua.bgBrightnessHintDark' : 'aqua.bgBrightnessHintLight')}
        </div>
        <Knob label={t('aqua.chatAlpha')} value={chatAlpha} min={0} max={100} step={1} unit="%" onChange={setChatAlpha} />
        <Knob label={t('aqua.menuOpacity')} value={menuOpacity} min={0} max={100} step={1} unit="%" onChange={setMenuOpacity} />
      </Collapsible>

      {/* 字体：字体 / 字号 / 排版 / 色彩方案 四段 */}
      <Collapsible
        title={t('aqua.typographyGroup')}
        open
        visible={tab === 'fonts'}
        hideHeader
      >
        {/* 字体 */}
        <div className={css.miniTitle}>{t('aqua.fontText')} / {t('aqua.fontCode')}</div>
        <div className={css.fieldRow}>
          <FontPicker
            label={t('aqua.fontText')}
            value={idOf(textFontOptions, fontText)}
            options={pickerOptions(textFontOptions)}
            onChange={(id) => { setFontText(stackOf(textFontOptions, id)) }}
            onRestore={resetFontText}
            restoreLabel={t('aqua.fontRestoreAll')}
            deleteLabel={t('aqua.deleteFont')}
          />
          <button type="button" className={css.importBtn} onClick={() => { fontFileRef.current?.click() }}>
            {t('aqua.importFont')}
          </button>
          <input
            ref={fontFileRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            className={css.fileInput}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              onFontFileChosen(file)
            }}
          />
        </div>
        <div className={css.knobHint}>{t('aqua.fontTextHint')}</div>

        <div className={css.fieldRow}>
          <FontPicker
            label={t('aqua.fontCode')}
            value={idOf(codeFontOptions, fontCode)}
            options={pickerOptions(codeFontOptions)}
            onChange={(id) => { setFontCode(stackOf(codeFontOptions, id)) }}
            onRestore={resetFontCode}
            restoreLabel={t('aqua.fontRestoreAll')}
            deleteLabel={t('aqua.deleteFont')}
          />
        </div>
        <div className={css.knobHint}>{t('aqua.fontCodeHint')}</div>

        {/* 字号 */}
        <div className={css.miniTitle}>{t('aqua.fontSizeText')} / {t('aqua.fontSizeCode')} / {t('aqua.fontSizeTerminal')}</div>
        <div className={css.fieldRow}>
          <Knob label={t('aqua.fontSizeText')} value={fontSizeText} min={10} max={22} step={1} unit="px" onChange={(value) => { setFontSizeRole('text', value) }} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { resetFontSizeRole('text') }} />
        </div>
        <div className={css.fieldRow}>
          <Knob label={t('aqua.fontSizeCode')} value={fontSizeCode} min={10} max={16} step={1} unit="px" onChange={(value) => { setFontSizeRole('code', value) }} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { resetFontSizeRole('code') }} />
        </div>
        <div className={css.fieldRow}>
          <Knob label={t('aqua.fontSizeTerminal')} value={fontSizeTerminal} min={10} max={20} step={1} unit="px" onChange={(value) => { setFontSizeRole('terminal', value) }} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { resetFontSizeRole('terminal') }} />
        </div>
        <div className={css.knobHint}>{t('aqua.fontSizeHint')}</div>

        {/* 排版：行间距 / 正文粗细 / 标题粗细（各自带悬停预览） */}
        <div className={css.miniTitle}>{t('aqua.weightBody')} / {t('aqua.weightHeading')}</div>

        <div className={css.fieldRow}>
          <Knob label={t('aqua.weightBody')} value={weightBody} min={300} max={800} step={100} unit="" onChange={setWeightBody} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetWeights} />
          <PreviewBubble text={t('aqua.previewBodyWeight')} style={{ fontWeight: weightBody }} />
        </div>

        <div className={css.fieldRow}>
          <Knob label={t('aqua.weightHeading')} value={weightHeading} min={400} max={800} step={100} unit="" onChange={setWeightHeading} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetWeights} />
          <PreviewBubble
            text={t('aqua.previewHeadingWeight')}
            style={{ fontWeight: weightHeading, fontSize: 15 }}
          />
        </div>
        <div className={css.knobHint}>{t('aqua.weightHint')}</div>

        {/* 说明文字 */}
        <div className={css.miniTitle}>{t('aqua.hintGroup')}</div>
        <div className={css.fieldRow}>
          <FontPicker
            label={t('aqua.hintFont')}
            value={hintFont === '' ? 'follow' : (idOf(textFontOptions, hintFont) === 'theme' ? 'follow' : idOf(textFontOptions, hintFont))}
            options={hintFontOptions}
            onChange={(id) => { setHintFont(id === 'follow' ? '' : stackOf(textFontOptions, id)) }}
            restoreLabel={t('aqua.fontRestoreAll')}
            deleteLabel={t('aqua.deleteFont')}
          />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetHint} />
          <PreviewBubble
            text={t('aqua.hintGroupHint')}
            style={{ fontWeight: hintWeight, opacity: hintOpacity / 100 }}
          />
        </div>
        <div className={css.fieldRow}>
          <Knob label={t('aqua.hintWeight')} value={hintWeight} min={300} max={800} step={100} unit="" onChange={setHintWeight} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetHint} />
        </div>
        <div className={css.fieldRow}>
          <Knob label={t('aqua.hintOpacity')} value={hintOpacity} min={40} max={100} step={5} unit="%" onChange={setHintOpacity} />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetHint} />
        </div>
        <div className={css.knobHint}>{t('aqua.hintGroupHint')}</div>

        <div className={css.knobHint}>{t('aqua.importFontHint')}</div>
      </Collapsible>

      {/* 字体颜色：独立标签页，与字体设置组分离 */}
      <Collapsible
        title={t('aqua.colorGroup')}
        open
        visible={tab === 'colors'}
        hideHeader
      >
        <div className={css.fieldRow}>
          <PalettePicker
            label={t('aqua.textColorScheme')}
            value={palette}
            themeLabel={optionLabel(TEXT_PALETTES[0])}
            options={TEXT_PALETTES.map(item => ({
              id: item.id,
              label: optionLabel(item),
              light: item.light,
              dark: item.dark,
              darkMode: dark,
            }))}
            onChange={setPalette}
          />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetPalette} />
          <PreviewBubble
            text={t('aqua.previewScheme')}
            style={{ color: scheme.primary === '' ? undefined : scheme.primary, fontWeight: weightBody }}
            accentText={scheme.accent === '' ? undefined : `↗ ${optionLabel(activePalette)}`}
          />
        </div>
        <div className={css.knobHint}>{t('aqua.textColorHint')}</div>

        <div className={css.fieldRow}>
          <PalettePicker
            label={t('aqua.colorChat')}
            value={paletteChat}
            themeLabel={optionLabel(TEXT_PALETTES[0])}
            options={TEXT_PALETTES.map(item => ({
              id: item.id,
              label: optionLabel(item),
              light: item.light,
              dark: item.dark,
              darkMode: dark,
            }))}
            onChange={setPaletteChat}
          />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { setPaletteChat('') }} />
        </div>
        <div className={css.knobHint}>{t('aqua.colorChatHint')}</div>

        <div className={css.fieldRow}>
          <ColorDots
            label={t('aqua.hintColorGlobal')}
            value={hintColor}
            options={HINT_COLORS.map(item => ({
              id: item.id,
              label: optionLabel(item),
              color: item.id === '' ? '' : (dark ? item.dark : item.light),
            }))}
            onChange={setHintColor}
          />
          <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetHint} />
        </div>
        <div className={css.knobHint}>{t('aqua.hintGroupHint')}</div>
      </Collapsible>

      {/* 区域：五大玻璃区域，结构与「背景」组一致，每组一个折叠卡片 */}
      <Collapsible
        title={t('aqua.regionsGroup')}
        open
        visible={tab === 'regions'}
        hideHeader
        summary={t('aqua.regionWeights')}
      >
        {regionRows.map(region => {
          const open = openRegionMap[region.key] === true
          const label = (value: number) => (value === 0 ? t('aqua.weightFollow') : String(value))
          return (
            <Collapsible
              key={region.key}
              title={region.label}
              open={open}
              onToggle={() => { setOpenRegionMap({ ...openRegionMap, [region.key]: !open }) }}
              summary={label(region.body) + ' / ' + label(region.heading)}
            >
              <div className={css.fieldRow}>
                <span className={css.rowLabel}>{t('aqua.weightColumn')}</span>
                <WeightSelect
                  label={region.label + ' ' + t('aqua.weightColumn')}
                  value={region.body}
                  followLabel={t('aqua.weightFollow')}
                  onChange={(value) => { setRegionWeight(region.key, 'body', value) }}
                />
                <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { setRegionWeight(region.key, 'body', 0) }} />
              </div>
              <div className={css.fieldRow}>
                <span className={css.rowLabel}>{t('aqua.weightHeadingColumn')}</span>
                <WeightSelect
                  label={region.label + ' ' + t('aqua.weightHeadingColumn')}
                  value={region.heading}
                  followLabel={t('aqua.weightFollow')}
                  onChange={(value) => { setRegionWeight(region.key, 'heading', value) }}
                />
                <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { setRegionWeight(region.key, 'heading', 0) }} />
              </div>

              {/* 行间距归属会话区 */}
              {region.key === 'chat' && (
                <div className={css.fieldRow}>
                  <Knob label={t('aqua.lineHeight')} value={lineHeight} min={1} max={2.5} step={0.05} unit="" onChange={setLineHeight} />
                  <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={resetLineHeight} />
                  <PreviewBubble text={t('aqua.previewLineHeight')} style={{ lineHeight }} />
                </div>
              )}

              {/* 该区域的说明文字：字重 / 浓度 / 颜色 */}
              <div className={css.miniTitle}>{t('aqua.regionHintGroup')}</div>
              <div className={css.fieldRow}>
                <Knob label={t('aqua.hintWeight')} value={region.hintW} min={300} max={800} step={100} unit="" onChange={(value) => { setRegionHintNumber(region.key, 'weight', value) }} />
                <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { setRegionHintNumber(region.key, 'weight', 400) }} />
              </div>
              <div className={css.fieldRow}>
                <Knob label={t('aqua.hintOpacity')} value={region.hintO} min={40} max={100} step={5} unit="%" onChange={(value) => { setRegionHintNumber(region.key, 'opacity', value) }} />
                <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { setRegionHintNumber(region.key, 'opacity', 92) }} />
              </div>
              <div className={css.fieldRow}>
                <ColorDots
                  label={t('aqua.hintColor')}
                  value={region.hintC}
                  options={HINT_COLORS.map(item => ({
                    id: item.id,
                    label: optionLabel(item),
                    color: item.id === '' ? '' : (dark ? item.dark : item.light),
                  }))}
                  onChange={(id) => { setRegionHintColor(region.key, id) }}
                />
                <ResetButton label={t('aqua.fontReset')} title={t('aqua.fontResetTitle')} onClick={() => { setRegionHintColor(region.key, '') }} />
              </div>
              {/* One click puts the whole region back — the injected reset was
                  already implemented but had no control pointing at it. */}
              <div className={css.fieldRow}>
                <span className={css.knobHint}>{t('aqua.regionResetHint')}</span>
                <button type="button" className={css.textBtn} onClick={() => { resetRegion(region.key) }}>
                  {t('aqua.regionReset')}
                </button>
              </div>
            </Collapsible>
          )
        })}
        <div className={css.fieldRow}>
          <span className={css.knobHint}>{t('aqua.regionWeightsHint')}</span>
          <button
            type="button"
            className={css.textBtn}
            onClick={() => { resetRegionWeights(); resetRegionHints() }}
          >
            {t('aqua.resetAllRegions')}
          </button>
        </div>
      </Collapsible>

      {/* 装饰：环境 + 悬停 + 子菜单交互 */}
      <Collapsible
        title={t('aqua.decorGroup')}
        open
        visible={tab === 'decor'}
        hideHeader
      >
        <div className={css.miniTitle}>{t('aqua.decorAmbient')}</div>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.whale')}</span>
          <button
            type="button"
            className={whale ? css.toggleOn : css.toggle}
            aria-pressed={whale}
            onClick={() => { setWhale(!whale) }}
          >
            <span className={css.check}>{whale && <IconCheckOutlineRegular />}</span>
            {whale ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.critters')}</span>
          <button
            type="button"
            className={critters ? css.toggleOn : css.toggle}
            aria-pressed={critters}
            onClick={() => { setCritters(!critters) }}
          >
            <span className={css.check}>{critters && <IconCheckOutlineRegular />}</span>
            {critters ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.mesh')}</span>
          <button
            type="button"
            className={mesh ? css.toggleOn : css.toggle}
            aria-pressed={mesh}
            onClick={() => { setMesh(!mesh) }}
          >
            <span className={css.check}>{mesh && <IconCheckOutlineRegular />}</span>
            {mesh ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>

        <div className={css.miniTitle}>{t('aqua.decorHover')}</div>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.spotlight')}</span>
          <button
            type="button"
            className={spotlight ? css.toggleOn : css.toggle}
            aria-pressed={spotlight}
            onClick={() => { setSpotlight(!spotlight) }}
          >
            <span className={css.check}>{spotlight && <IconCheckOutlineRegular />}</span>
            {spotlight ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>

        <div className={css.miniTitle}>{t('aqua.submenuGroup')}</div>
        <div className={css.row}>
          <span className={css.rowLabel}>{t('aqua.submenuHold')}</span>
          <button
            type="button"
            className={submenuHold ? css.toggleOn : css.toggle}
            aria-pressed={submenuHold}
            title={t('aqua.submenuHoldHint')}
            onClick={() => { setSubmenuHold(!submenuHold) }}
          >
            <span className={css.check}>{submenuHold && <IconCheckOutlineRegular />}</span>
            {submenuHold ? t('aqua.enable') : t('aqua.disable')}
          </button>
        </div>
      </Collapsible>
    </div>
  )
}
