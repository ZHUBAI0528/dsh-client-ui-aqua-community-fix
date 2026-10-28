/**
 * Shared controls for the Aqua panel: the Knob (slider + number box), a
 * Segmented picker, the collapsible group shell, the font picker (a popover
 * list that can delete imported faces and restore defaults), the colour-scheme
 * cards, the hover preview bubble, and the wallpaper file reader.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import css from './AquaAppearanceRow.module.css'

/** One slider + number box, wired to a single value. */
export interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}

/** Render one knob row. */
export function Knob({ label, value, min, max, step, unit, onChange }: KnobProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))
  // The number box keeps its own draft while it has focus. Writing every
  // keystroke straight through clamped "1" to the minimum before "18" could be
  // finished, and an empty box became 0 → min. The draft is committed on blur
  // or Enter, and re-synced whenever the real value changes from elsewhere
  // (slider, reset button, another window).
  const uid = useId()
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  const commit = (raw: string): void => {
    const parsed = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = clamp(parsed)
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    // A <label> can only be associated with ONE control; this row has two. The
    // slider takes the label, the number box names itself.
    <div className={css.knob}>
      <label className={css.knobLabel} htmlFor={uid}>{label}</label>
      <input
        id={uid}
        type="range"
        className={css.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { onChange(clamp(Number(e.target.value))) }}
      />
      <span className={css.numberWrap}>
        <input
          type="number"
          className={css.number}
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={draft}
          onFocus={() => { setEditing(true) }}
          onChange={(e) => { setDraft(e.target.value) }}
          onBlur={(e) => { setEditing(false); commit(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span className={css.unit}>{unit}</span>
      </span>
    </div>
  )
}

/** One option of a Segmented picker. */
export interface SegmentedOption<T extends string> {
  id: T
  label: string
}

export interface SegmentedProps<T extends string> {
  /** Accessible name for the button group. */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onSelect: (value: T) => void
}

/** Render a segmented picker (2-3 mutually exclusive choices). */
export function Segmented<T extends string>({ label, value, options, onSelect }: SegmentedProps<T>) {
  return (
    <div className={css.segmented} role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? css.segActive : css.seg}
          aria-pressed={option.id === value}
          onClick={() => { onSelect(option.id) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Collapsible group: a clickable header plus the control stack it owns. */
export interface CollapsibleProps {
  /** Group title (localized). */
  title: string
  /** Whether the body is visible. */
  open: boolean
  /** Toggle handler; omitted by groups whose header is hidden (tab-switched). */
  onToggle?: () => void
  /** Short right-aligned summary shown while collapsed. */
  summary?: string
  /** When false the whole group renders nothing (used by the tab switcher). */
  visible?: boolean
  /** Hide the header row entirely (the tab bar already names the group). */
  hideHeader?: boolean
  children: ReactNode
}

/** Render one collapsible group. */
export function Collapsible({ title, open, onToggle, summary, visible = true, hideHeader = false, children }: CollapsibleProps) {
  if (!visible) return null
  return (
    <section className={css.subGroup}>
      {!hideHeader && (
        <button
          type="button"
          className={css.groupHead}
          aria-expanded={open}
          onClick={() => { onToggle?.() }}
        >
          <span className={css.groupChevron} data-open={open}>▾</span>
          <span className={css.groupTitle}>{title}</span>
          {summary !== undefined && <span className={css.groupSummary}>{summary}</span>}
        </button>
      )}
      {open && <div className={css.controls}>{children}</div>}
    </section>
  )
}

/** One tab of the panel's card-style switcher. */
export interface TabItem {
  id: string
  label: string
}

export interface TabBarProps {
  items: readonly TabItem[]
  /** Active tab id. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the tab list. */
  label: string
}

/**
 * Card-style tab bar: every group is a glass card; the selected one carries an
 * accent border and a brighter fill so the active page is unmistakable.
 */
export function TabBar({ items, value, onChange, label }: TabBarProps) {
  return (
    <div className={css.tabBar} role="tablist" aria-label={label}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className={item.id === value ? `${css.tabCard} ${css.tabCardActive}` : css.tabCard}
          onClick={() => { onChange(item.id) }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** One font choice in the picker. */
export interface FontPickerOption {
  /** Stable id (preset id, or `imported:<id>`). */
  id: string
  /** Locale-resolved label. */
  label: string
  /** Optional tag rendered after the label (e.g. Imported). */
  badge?: string
  /** When present the row offers a delete button. */
  onDelete?: () => void
}

export interface FontPickerProps {
  label: string
  /** Currently selected option id. */
  value: string
  options: readonly FontPickerOption[]
  onChange: (id: string) => void
  /** Restore-to-default action shown at the bottom of the list. */
  onRestore?: () => void
  /** Localized "restore" text. */
  restoreLabel?: string
  /** Localized delete tooltip. */
  deleteLabel?: string
}

/**
 * Font-family picker. A native `<select>` cannot host per-row actions, so the
 * list is a popover of buttons: imported faces get a delete affordance and the
 * footer restores the host default in one click.
 *
 * The list is positioned against the viewport (fixed) rather than its trigger:
 * the panel lives inside `overflow: auto`, which used to clip the popover as
 * soon as the trigger sat near the bottom of the scroll area. Space below is
 * measured, and the list flips upward when there is not enough of it.
 */
export function FontPicker({ label, value, options, onChange, onRestore, restoreLabel, deleteLabel }: FontPickerProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<
    { left: number, width: number, top: number } | { left: number, width: number, bottom: number, maxHeight: number } | null
  >(null)
  const current = options.find(option => option.id === value) ?? options[0]

  // Measure on open (and on resize, below) so the popover never leaves the viewport.
  useLayoutEffect(() => {
    if (!open) { setPlacement(null); return }
    const trigger = triggerRef.current
    if (trigger === null) return
    const box = trigger.getBoundingClientRect()
    const below = window.innerHeight - box.bottom - 8
    const above = box.top - 8
    if (below < 280 && above > below) {
      setPlacement({ left: box.left, width: box.width, bottom: window.innerHeight - box.top + 4, maxHeight: Math.min(320, Math.max(160, above)) })
    } else {
      setPlacement({ left: box.left, width: box.width, top: box.bottom + 4 })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current !== null && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // Scrolling the panel would detach a fixed popover from its trigger; close
    // instead of tracking (except for scrolling inside the list itself).
    const onScroll = (event: Event) => {
      if (listRef.current !== null && event.target instanceof Node && listRef.current.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <div className={css.fontPicker} ref={wrapRef}>
      <span className={css.knobLabel}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={css.fontPickerTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setOpen(prev => !prev) }}
      >
        <span className={css.fontPickerValue}>{current?.label ?? ''}</span>
        {current?.badge !== undefined && <span className={css.fontBadge}>{current.badge}</span>}
        <span className={css.fontPickerArrow}>▾</span>
      </button>

      {open && (
        <div
          ref={listRef}
          className={css.fontPickerList}
          role="menu"
          aria-label={label}
          style={placement === null
            ? undefined
            : {
              position: 'fixed',
              left: placement.left,
              right: 'auto',
              width: placement.width,
              ...('top' in placement
                ? { top: placement.top, bottom: 'auto' }
                : { top: 'auto', bottom: placement.bottom, maxHeight: placement.maxHeight }),
            }}
        >
          {options.map(option => (
            // `role="none"` keeps the wrapper out of the accessibility tree so
            // the menu's owned elements are the buttons themselves.
            <div key={option.id} role="none" className={option.id === value ? `${css.fontOption} ${css.fontOptionActive}` : css.fontOption}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option.id === value}
                className={css.fontOptionPick}
                onClick={() => { onChange(option.id); setOpen(false) }}
              >
                <span className={css.fontOptionLabel}>{option.label}</span>
                {option.badge !== undefined && <span className={css.fontBadge}>{option.badge}</span>}
              </button>
              {option.onDelete !== undefined && (
                <button
                  type="button"
                  role="menuitem"
                  className={css.fontOptionDelete}
                  title={deleteLabel}
                  aria-label={deleteLabel}
                  onClick={() => { option.onDelete?.() }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {onRestore !== undefined && (
            <button type="button" role="menuitem" className={css.fontRestoreAll} onClick={() => { onRestore(); setOpen(false) }}>
              {restoreLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** One colour-scheme card. */
export interface PaletteOption {
  id: string
  label: string
  /** Light-mode colours (used for the "Aa" swatch). */
  light: { primary: string, secondary: string, hint: string, accent: string }
  /** Dark-mode colours. */
  dark: { primary: string, secondary: string, hint: string, accent: string }
  /** True when the current appearance is dark (picks which half to preview). */
  darkMode: boolean
}

export interface PalettePickerProps {
  label: string
  value: string
  options: readonly PaletteOption[]
  onChange: (id: string) => void
  /** Accessible name for "follow the theme" rows without colours. */
  themeLabel: string
}

/**
 * Colour-scheme picker: one card per scheme with a real "Aa" sample rendered in
 * that scheme's own ink, plus three dots for secondary / hint / accent. The
 * card is what makes the switch obvious at a glance.
 */
export function PalettePicker({ label, value, options, onChange }: PalettePickerProps) {
  return (
    <div className={css.paletteBlock}>
      <span className={css.knobLabel}>{label}</span>
      <div className={css.paletteGrid} role="radiogroup" aria-label={label}>
        {options.map(option => {
          const ink = option.darkMode ? option.dark : option.light
          const isTheme = ink.primary === ''
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === value}
              className={option.id === value ? `${css.paletteCard} ${css.paletteCardActive}` : css.paletteCard}
              onClick={() => { onChange(option.id) }}
            >
              <span
                className={css.paletteAa}
                style={{ color: isTheme ? undefined : ink.primary }}
              >
                Aa
              </span>
              <span className={css.paletteName}>{option.label}</span>
              {!isTheme && (
                <span className={css.paletteDots}>
                  <i style={{ background: ink.secondary }} />
                  <i style={{ background: ink.hint }} />
                  <i style={{ background: ink.accent }} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** One colour dot. */
export interface ColorDotOption {
  id: string
  /** Localized name (tooltip + a11y label). */
  label: string
  /** CSS colour; empty renders the "follow" ring. */
  color: string
}

export interface ColorDotsProps {
  label: string
  value: string
  options: readonly ColorDotOption[]
  onChange: (id: string) => void
}

/** A row of colour dots — used for the explanatory-text colour. */
export function ColorDots({ label, value, options, onChange }: ColorDotsProps) {
  return (
    <div className={css.colorDotsRow}>
      <span className={css.knobLabel}>{label}</span>
      <div className={css.colorDots} role="radiogroup" aria-label={label}>
        {options.map(option => {
          const active = option.id === value
          return (
            <button
              key={option.id === '' ? 'follow' : option.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              className={active ? `${css.colorDot} ${css.colorDotActive}` : css.colorDot}
              style={{ background: option.color === '' ? 'transparent' : option.color }}
              onClick={() => { onChange(option.id) }}
            >
              {option.color === '' ? '○' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Compact weight picker: "Follow" plus the five usable weights. */
export interface WeightSelectProps {
  /** Current value; 0 means "follow the global knob". */
  value: number
  /** Localized "follow" label. */
  followLabel: string
  /** Accessible name (region + role). */
  label: string
  onChange: (value: number) => void
}

/** Render a small weight dropdown. */
export function WeightSelect({ value, followLabel, label, onChange }: WeightSelectProps) {
  return (
    <select
      className={css.weightSelect}
      value={value}
      aria-label={label}
      onChange={(e) => { onChange(Number(e.target.value)) }}
    >
      <option value={0}>{followLabel}</option>
      {[300, 400, 500, 600, 700, 800].map(weight => (
        <option key={weight} value={weight}>{weight}</option>
      ))}
    </select>
  )
}

/** Hover preview bubble attached to one setting row. */
export interface PreviewBubbleProps {
  /** Sample copy (localized). */
  text: string
  /** Inline style applied to the sample (line-height / weight / colour). */
  style?: React.CSSProperties
  /** Optional second line rendered with the accent colour. */
  accentText?: string
}

/** Render a preview bubble; CSS shows it only while its row is hovered. */
export function PreviewBubble({ text, style, accentText }: PreviewBubbleProps) {
  return (
    <span className={css.previewBubble}>
      <span className={css.previewSample} style={style}>{text}</span>
      {accentText !== undefined && <span className={css.previewAccent}>{accentText}</span>}
    </span>
  )
}

/** The reset affordance that follows every font setting. */
export interface ResetButtonProps {
  /** Accessible label (localized). */
  label: string
  /** Tooltip title (localized). */
  title: string
  onClick: () => void
}

/** Render a small "back to the host default" button. */
export function ResetButton({ label, title, onClick }: ResetButtonProps) {
  return (
    <button
      type="button"
      className={css.resetBtn}
      title={title}
      aria-label={label}
      onClick={onClick}
    >
      ↺
    </button>
  )
}

/** Largest wallpaper file we accept before decoding it into memory. */
const MAX_WALLPAPER_BYTES = 32 * 1024 * 1024

/**
 * Read a file, downscale to ≤1920px, and return a compact data URL.
 *
 * JPEG has no alpha channel, so a transparent PNG used to come out on a black
 * plate. WebP keeps the alpha (and is smaller); when the browser cannot encode
 * it we flatten onto white rather than leaving the canvas black.
 * @param file - the picked image.
 * @returns the data URL.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_WALLPAPER_BYTES) throw new Error('wallpaper too large')
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { resolve(String(reader.result)) }
    reader.onerror = () => { reject(reader.error) }
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => { resolve(im) }
    im.onerror = () => { reject(new Error('image load failed')) }
    im.src = raw
  })
  // An SVG without intrinsic dimensions reports 0 — keep a sane canvas size
  // instead of producing a 1x1 wallpaper.
  const sourceWidth = image.naturalWidth > 0 ? image.naturalWidth : 1920
  const sourceHeight = image.naturalHeight > 0 ? image.naturalHeight : 1080
  const scale = Math.min(1, 1920 / Math.max(sourceWidth, sourceHeight))
  const w = Math.max(1, Math.round(sourceWidth * scale))
  const h = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx === null) return raw
  ctx.drawImage(image, 0, 0, w, h)
  const webp = canvas.toDataURL('image/webp', 0.85)
  if (webp.startsWith('data:image/webp')) return webp
  const flat = document.createElement('canvas')
  flat.width = w
  flat.height = h
  const flatCtx = flat.getContext('2d')
  if (flatCtx === null) return canvas.toDataURL('image/jpeg', 0.82)
  flatCtx.fillStyle = '#ffffff'
  flatCtx.fillRect(0, 0, w, h)
  flatCtx.drawImage(image, 0, 0, w, h)
  return flat.toDataURL('image/jpeg', 0.82)
}
