/**
 * Aqua glass-theme control body, shared by the sidebar panel page.
 *
 * The master switch lives in the panel header (see AquaPanelPage); this
 * component owns only the knobs — blur and frost,
 * fluid color, backdrop source, wallpaper picker, and the ambient decorations.
 * Every write goes straight through to the layer, so the skin moves live.
 */
import { useRef } from 'react'
import { IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { fileToDataUrl, Knob, Segmented } from './AquaControls.tsx'
import { loadVideoHandle, saveVideoBlob, saveVideoHandle } from './wallpaper-store.ts'
import type { AquaRowState } from './settings-store.ts'
import type { AquaLocaleKey } from './locales.ts'
import css from './AquaAppearanceRow.module.css'

/** Detect if running in Electron renderer. */
function isElectron(): boolean {
  // Check for Electron's process.versions.electron (available when nodeIntegration or contextIsolation with preload exposes it)
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
  /** Set the glass blur radius, px. */
  setBlur: (value: number) => void
  /** Set the glass frost amount, 0-100. */
  setFrost: (value: number) => void
  /** Set the fluid hue, degrees (0-360, continuous). */
  setFluidHue: (value: number) => void
  /** Set the fluid depth, 0-100 (continuous). */
  setFluidDepth: (value: number) => void
  /** Set the backdrop brightness, 0-100. */
  setBgBrightness: (value: number) => void
  /** Switch the backdrop source. */
  setBackground: (value: 'fluid' | 'wallpaper') => void
  /** Set the wallpaper URL / blob id. */
  setWallpaper: (value: string) => void
  /** Toggle the particle whale. */
  setWhale: (value: boolean) => void
  /** Toggle the fish critters. */
  setCritters: (value: boolean) => void
  /** Toggle the interactive mesh. */
  setMesh: (value: boolean) => void
  /** Toggle the cursor spotlight. */
  setSpotlight: (value: boolean) => void
  /** Toggle the submenu click-hold shim. */
  setSubmenuHold: (value: boolean) => void
  /** Set the submenu surface opacity, 0-100. */
  setMenuOpacity: (value: number) => void
  /** Set the chat surface veil, 0-100. */
  setChatAlpha: (value: number) => void
  /** Set the wallpaper blur radius, px. */
  setWallpaperBlur: (value: number) => void
  /** Set the wallpaper frost amount, 0-100. */
  setWallpaperFrost: (value: number) => void
  /** Set the video wallpaper blur radius, px. */
  setVideoBlur: (value: number) => void
  /** Set the video wallpaper brightness, 0-100. */
  setVideoBrightness: (value: number) => void
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
  } = props
  const blur = useStore(s => s.blur)
  const frost = useStore(s => s.frost)
  const fluidHue = useStore(s => s.fluidHue)
  const fluidDepth = useStore(s => s.fluidDepth)
  const bgBrightness = useStore(s => s.bgBrightness)
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
  const fileRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)

  // Videos are `idb:` blobs, `fsa:` remembered-file handles, or legacy
  // `data:video/` URLs.
  const isVideoWallpaper = wallpaper.startsWith('data:video/') || wallpaper.startsWith('idb:') || wallpaper.startsWith('fsa:')

  /** Pick a video. Chromium: File System Access — the browser remembers the
   *  file authorization, so later visits re-read the ORIGINAL file with no
   *  storage copy. Other browsers (and Electron) fall back to the plain file input. */
  const pickVideo = (): void => {
    if (hasNativeFileSystemAccess()) {
      // `showOpenFilePicker` is declared optional in lib.dom (Chromium-only);
      // `hasNativeFileSystemAccess()` already proved it exists at runtime, but
      // binding it to a local narrows the type for the call below.
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
            // idb unavailable — degrade to the blob store / data URL path.
            const file = await handle.getFile()
            void saveVideoBlob(file).then((id) => {
              if (id !== '') setWallpaper(id)
              else void fileToDataUrl(file).then(setWallpaper)
            })
          }
        } catch {
          /* picker cancelled — keep current state */
        }
      })()
    } else {
      // Electron or browsers without File System Access API: use native file input
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
  // The stored 0-100 value is clamped for display; writing always stays in
  // the offered range, so a value picked in one scheme is inert in the other.
  const bgMin = dark ? 0 : 50
  const bgMax = dark ? 50 : 100
  const bgDisplay = Math.min(bgMax, Math.max(bgMin, bgBrightness))

  return (
    <div className={css.group}>
      {/* 玻璃材质 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.materialGroup')}</div>
        <div className={css.controls}>
          <Knob label={t('aqua.blur')} value={blur} min={0} max={40} step={0.5} unit="px" onChange={setBlur} />
          <Knob label={t('aqua.frost')} value={frost} min={0} max={100} step={1} unit="%" onChange={setFrost} />
        </div>
      </div>

      {/* 背景 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.background')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <Segmented
              label={t('aqua.background')}
              value={background}
              options={[
                { id: 'fluid', label: t('aqua.backgroundFluid') },
                { id: 'wallpaper', label: t('aqua.backgroundWallpaper') },
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
                        setBackground('wallpaper')
                        void fileToDataUrl(file).then(setWallpaper)
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
                        // Picking a backdrop switches the source to wallpaper
                        // automatically, so the media shows right away. The
                        // video plays through the browser's native decoder as
                        // the background (no controls, no progress bar).
                        setBackground('wallpaper')
                        // ALWAYS persist videos in IndexedDB: even a small
                        // video's data URL can blow the localStorage quota
                        // (base64 inflates 33%), which would silently lose
                        // the wallpaper on the next reload. Only when idb is
                        // unavailable do we fall back to the data-URL path.
                        void saveVideoBlob(file).then((id) => {
                          if (id !== '') {
                            setWallpaper(id)
                          } else {
                            void fileToDataUrl(file).then(setWallpaper)
                          }
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
              {/* 图片壁纸：模糊度 + 磨砂度（视频壁纸改用下面的模糊度/亮度） */}
              {!isVideoWallpaper && (
                <>
                  <Knob label={t('aqua.wallpaperBlur')} value={wallpaperBlur} min={0} max={40} step={0.5} unit="px" onChange={setWallpaperBlur} />
                  <Knob label={t('aqua.wallpaperFrost')} value={wallpaperFrost} min={0} max={100} step={1} unit="%" onChange={setWallpaperFrost} />
                </>
              )}
              {/* 视频壁纸：模糊度 + 亮度，配上提醒 */}
              {isVideoWallpaper && (
                <>
                  <Knob label={t('aqua.videoBlur')} value={videoBlur} min={0} max={40} step={0.5} unit="px" onChange={setVideoBlur} />
                  <Knob label={t('aqua.videoBrightness')} value={videoBrightness} min={0} max={100} step={1} unit="%" onChange={setVideoBrightness} />
                  <div className={css.knobHint}>{t('aqua.videoHint')}</div>
                </>
              )}
            </>
          )}

          <Knob label={t('aqua.bgBrightness')} value={bgDisplay} min={bgMin} max={bgMax} step={1} unit="%" onChange={setBgBrightness} />
          <div className={css.knobHint}>
            {t(dark ? 'aqua.bgBrightnessHintDark' : 'aqua.bgBrightnessHintLight')}
          </div>
          {/* 面透明度：会话区底板与子菜单/弹层同为一档"面"的透明度。
              0 = 壁纸/流体原样透出，100 = 完全不透明底板 */}
          <Knob label={t('aqua.chatAlpha')} value={chatAlpha} min={0} max={100} step={1} unit="%" onChange={setChatAlpha} />
          {/* 子菜单/弹层：浮在正文与输入框文字之上，需要比卡片更实的底色，
              单独一档避免两段文字视觉重叠 */}
          <Knob label={t('aqua.menuOpacity')} value={menuOpacity} min={0} max={100} step={1} unit="%" onChange={setMenuOpacity} />
        </div>
      </div>

      {/* 装饰：环境装饰 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.decorAmbient')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('aqua.whale')}</span>
            <button
              type="button"
              className={whale ? css.toggleOn : css.toggle}
              aria-pressed={whale}
              onClick={() => { setWhale(!whale) }}
            >
              <span className={css.check}>
                {whale && <IconCheckOutlineRegular />}
              </span>
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
              <span className={css.check}>
                {critters && <IconCheckOutlineRegular />}
              </span>
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
              <span className={css.check}>
                {mesh && <IconCheckOutlineRegular />}
              </span>
              {mesh ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </div>
        </div>
      </div>

      {/* 子菜单交互：hover 开 + click 切换会让"点一下"把刚展开的二级又关掉
          （鼠标必然先悬停再点击）。开启时吞掉这一次点击，让点击保持展开，
          再点一次才收起。按 ARIA 契约生效，逐级通用，键盘路径不受影响。 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.submenuGroup')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('aqua.submenuHold')}</span>
            <button
              type="button"
              className={submenuHold ? css.toggleOn : css.toggle}
              aria-pressed={submenuHold}
              title={t('aqua.submenuHoldHint')}
              onClick={() => { setSubmenuHold(!submenuHold) }}
            >
              <span className={css.check}>
                {submenuHold && <IconCheckOutlineRegular />}
              </span>
              {submenuHold ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </div>
        </div>
      </div>

      {/* 装饰：悬停效果（下压效果已移除——3D 变换会让 backdrop-filter
          玻璃整层重栅格化，文字发虚） */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.decorHover')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('aqua.spotlight')}</span>
            <button
              type="button"
              className={spotlight ? css.toggleOn : css.toggle}
              aria-pressed={spotlight}
              onClick={() => { setSpotlight(!spotlight) }}
            >
              <span className={css.check}>
                {spotlight && <IconCheckOutlineRegular />}
              </span>
              {spotlight ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
