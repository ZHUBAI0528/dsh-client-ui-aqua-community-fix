/**
 * Typography data for the Aqua font panel: font presets, DSH's own font-size
 * specs, and the text-colour schemes.
 *
 * Everything here mirrors what the host already understands:
 * - font sizes ride `theme.setFontSize(role, px)` (same ranges as 设置 → 外观),
 * - font families ride `theme.setFontFamily(role, stack)` (same fields),
 * - colours ride `theme.overrideTokens()` on the label/link tokens, so the
 *   light/dark pair resolves automatically when the scheme flips.
 */

/** Roles the host configures independently. */
export type FontRole = 'text' | 'code' | 'terminal'

/** One font-size spec, mirroring the host's own ranges and defaults. */
export interface FontSizeSpec {
  /** CSS variable the host writes on <body>. */
  variable: string
  min: number
  max: number
  default: number
}

/** Host font-size specs (kept in lockstep with `ui-theme`). */
export const FONT_SIZE_SPECS: Record<FontRole, FontSizeSpec> = {
  text: { variable: '--dsh-content-font-size', min: 10, max: 22, default: 14 },
  code: { variable: '--dsh-code-font-size', min: 10, max: 16, default: 11 },
  terminal: { variable: '--dsh-terminal-font-size', min: 10, max: 20, default: 13 },
}

/** One selectable font family. */
export interface FontPreset {
  /** Stable id stored on the settings row. */
  id: string
  /** Chinese label (the panel's default language). */
  zh: string
  /** English label. */
  en: string
  /** CSS font-family stack; empty means "follow the theme". */
  stack: string
  /** Where the family comes from — drives the small badge in the select. */
  source: 'theme' | 'system' | 'opensource' | 'free' | 'imported'
}

/** Conversation text families (宋 / 黑 / 楷 + free UI faces). */
export const TEXT_FONT_PRESETS: readonly FontPreset[] = [
  { id: 'theme', zh: '跟随主题', en: 'Theme default', stack: '', source: 'theme' },
  { id: 'yahei', zh: '微软雅黑 · 黑体', en: 'Microsoft YaHei · Sans', stack: '"Microsoft YaHei", "Microsoft YaHei UI", "PingFang SC", sans-serif', source: 'system' },
  { id: 'dengxian', zh: '等线 · 黑体', en: 'DengXian · Sans', stack: '"DengXian", "等线", "Microsoft YaHei", sans-serif', source: 'system' },
  { id: 'simhei', zh: '中易黑体 · 黑体', en: 'SimHei · Sans', stack: '"SimHei", "黑体", "Microsoft YaHei", sans-serif', source: 'system' },
  { id: 'simsun', zh: '宋体 · 宋体', en: 'SimSun · Serif', stack: '"SimSun", "宋体", "Songti SC", serif', source: 'system' },
  { id: 'kaiti', zh: '楷体 · 楷体', en: 'KaiTi · Kai', stack: '"KaiTi", "楷体", "STKaiti", "Kaiti SC", serif', source: 'system' },
  { id: 'sourceHanSans', zh: '思源黑体 · 黑体', en: 'Source Han Sans · Sans', stack: '"Source Han Sans SC", "Noto Sans SC", "Microsoft YaHei", sans-serif', source: 'opensource' },
  { id: 'sourceHanSerif', zh: '思源宋体 · 宋体', en: 'Source Han Serif · Serif', stack: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif', source: 'opensource' },
  { id: 'lxgwWenkai', zh: '霞鹜文楷 · 楷体', en: 'LXGW WenKai · Kai', stack: '"LXGW WenKai", "霞鹜文楷", "KaiTi", serif', source: 'opensource' },
  { id: 'misans', zh: 'MiSans · 黑体', en: 'MiSans · Sans', stack: '"MiSans", "MiSans VF", "Microsoft YaHei", sans-serif', source: 'free' },
  { id: 'harmonyos', zh: '鸿蒙 Sans · 黑体', en: 'HarmonyOS Sans · Sans', stack: '"HarmonyOS Sans SC", "Microsoft YaHei", sans-serif', source: 'free' },
]

/** Code-block families. */
export const CODE_FONT_PRESETS: readonly FontPreset[] = [
  { id: 'theme', zh: '跟随主题', en: 'Theme default', stack: '', source: 'theme' },
  { id: 'cascadia', zh: 'Cascadia Code', en: 'Cascadia Code', stack: '"Cascadia Code", "Cascadia Mono", Consolas, monospace', source: 'system' },
  { id: 'consolas', zh: 'Consolas', en: 'Consolas', stack: 'Consolas, "Courier New", monospace', source: 'system' },
  { id: 'sarasa', zh: '更纱黑体 Mono', en: 'Sarasa Mono SC', stack: '"Sarasa Mono SC", "Sarasa Mono HC", Consolas, monospace', source: 'opensource' },
  { id: 'jetbrains', zh: 'JetBrains Mono', en: 'JetBrains Mono', stack: '"JetBrains Mono", "Cascadia Code", Consolas, monospace', source: 'opensource' },
]

/** Look one preset up by id (falling back to the theme entry). */
export function findFontPreset(list: readonly FontPreset[], id: string): FontPreset {
  return list.find(preset => preset.id === id) ?? list[0]
}

/** The four colour roles one scheme defines, per appearance mode. */
export interface SchemeColors {
  /** Body text, message text, headings. */
  primary: string
  /** Secondary labels, list subtitles. */
  secondary: string
  /** Explanatory copy, timestamps, panel hints — deliberately NOT dim grey. */
  hint: string
  /** Links, inline emphasis, active accents. */
  accent: string
}

/** One selectable colour scheme: the same mood tuned for both appearances. */
export interface TextPalette {
  id: string
  zh: string
  en: string
  /** Light appearance: dark ink on a bright backdrop. */
  light: SchemeColors
  /** Dark appearance: bright ink on a dim backdrop. */
  dark: SchemeColors
}

/**
 * Shipped schemes. Light mode always uses a DARK ink family, dark mode always a
 * BRIGHT one; every scheme carries an accent so the switch reads as a real
 * change rather than a subtle tint.
 */
export const TEXT_PALETTES: readonly TextPalette[] = [
  {
    id: 'theme',
    zh: '跟随主题',
    en: 'Theme default',
    light: { primary: '', secondary: '', hint: '', accent: '' },
    dark: { primary: '', secondary: '', hint: '', accent: '' },
  },
  {
    id: 'ink',
    zh: '墨黑 · 云雾白',
    en: 'Ink · Cloud',
    light: { primary: '#15191F', secondary: '#3D4650', hint: '#454F5B', accent: '#1F6FEB' },
    dark: { primary: '#EAF0F8', secondary: '#BAC7D7', hint: '#AFC0D3', accent: '#6FB3FF' },
  },
  {
    id: 'navy',
    zh: '深海蓝 · 冷月白',
    en: 'Deep sea · Moon',
    light: { primary: '#0F2440', secondary: '#34496A', hint: '#43557A', accent: '#0B6BCB' },
    dark: { primary: '#DCE8F7', secondary: '#A9BCD2', hint: '#A3B6CC', accent: '#7CC4FF' },
  },
  {
    id: 'forest',
    zh: '墨绿 · 薄荷白',
    en: 'Forest · Mint',
    light: { primary: '#11302A', secondary: '#33564C', hint: '#43604F', accent: '#0E7C5A' },
    dark: { primary: '#E1F2E9', secondary: '#AECBBD', hint: '#A6C4B6', accent: '#5FE3A8' },
  },
  {
    id: 'sepia',
    zh: '暖褐 · 暖米白',
    en: 'Sepia · Cream',
    light: { primary: '#33261A', secondary: '#5C4A38', hint: '#665440', accent: '#B4531A' },
    dark: { primary: '#F1E9DC', secondary: '#CBBEA9', hint: '#C6B79F', accent: '#FFB865' },
  },
  {
    id: 'graphite',
    zh: '石墨 · 象牙白',
    en: 'Graphite · Ivory',
    light: { primary: '#232323', secondary: '#4A4A4A', hint: '#525252', accent: '#4A6FA5' },
    dark: { primary: '#F0F0F0', secondary: '#C4C4C4', hint: '#BCBCBC', accent: '#9EC5FF' },
  },
  {
    id: 'violet',
    zh: '墨紫 · 淡紫白',
    en: 'Violet · Lilac',
    light: { primary: '#241F33', secondary: '#473F5E', hint: '#4F4769', accent: '#6D49D6' },
    dark: { primary: '#EAE6FA', secondary: '#BAB2D7', hint: '#B3AACF', accent: '#B79BFF' },
  },
  {
    id: 'rose',
    zh: '枣红 · 玫瑰白',
    en: 'Rosewood · Blush',
    light: { primary: '#3A1B23', secondary: '#63333E', hint: '#6B464F', accent: '#C2415C' },
    dark: { primary: '#F7E6EA', secondary: '#D4B4BC', hint: '#CCAEB7', accent: '#FF89A6' },
  },
  {
    id: 'teal',
    zh: '墨青 · 冰蓝白',
    en: 'Ink teal · Ice',
    light: { primary: '#123334', secondary: '#35595A', hint: '#426566', accent: '#0E7B84' },
    dark: { primary: '#E0F2F4', secondary: '#A9C9CC', hint: '#A2C3C7', accent: '#5FE0EA' },
  },
]

/** Look one palette up by id (falling back to the theme entry). */
export function findPalette(id: string): TextPalette {
  return TEXT_PALETTES.find(palette => palette.id === id) ?? TEXT_PALETTES[0]
}

/** One explanatory-text colour preset (both appearances resolved by the layer). */
export interface HintColorPreset {
  /** Stable id; empty string means "follow the colour scheme". */
  id: string
  zh: string
  en: string
  /** Light-appearance colour (empty = follow the scheme). */
  light: string
  /** Dark-appearance colour. */
  dark: string
}

/** Explanatory-text colour presets: readable on glass, not washed out. */
export const HINT_COLORS: readonly HintColorPreset[] = [
  { id: '', zh: '跟随色彩方案', en: 'Follow scheme', light: '', dark: '' },
  { id: 'neutral', zh: '中性灰', en: 'Neutral', light: '#4A5460', dark: '#BAC7D7' },
  { id: 'blue', zh: '蓝', en: 'Blue', light: '#2F6FB8', dark: '#8FC4FF' },
  { id: 'green', zh: '绿', en: 'Green', light: '#2C7A5B', dark: '#86D9B4' },
  { id: 'amber', zh: '琥珀', en: 'Amber', light: '#8A5A12', dark: '#F0C27A' },
  { id: 'rose', zh: '玫红', en: 'Rose', light: '#A64358', dark: '#FF9DB0' },
  { id: 'violet', zh: '紫', en: 'Violet', light: '#5B45B0', dark: '#C0A6FF' },
]

/**
 * Resolve one explanatory-text colour preset for the current appearance.
 * @param id - preset id ('' = follow the scheme).
 * @param dark - whether the dark appearance is active.
 * @returns the CSS colour, or '' when the scheme should win.
 */
export function hintColorValue(id: string, dark: boolean): string {
  const preset = HINT_COLORS.find(item => item.id === id)
  if (preset === undefined || preset.id === '') return ''
  return dark ? preset.dark : preset.light
}

/**
 * Build the host token overrides for one palette.
 *
 * Six tokens, not two: the label ramp covers body/secondary/explanatory copy,
 * and `--dsw-alias-link` + `--dsw-alias-brand-primary` carry the accent so a
 * scheme change is visible on links and emphasis too. The explanatory ramp uses
 * its own value rather than a faded secondary — that was the "grey on glass"
 * readability complaint.
 * @param palette - the selected palette.
 * @returns token name → `{ light, dark }` pair map (empty when following the theme).
 */
export function paletteTokens(palette: TextPalette): Record<string, { light: string, dark: string }> {
  if (palette.id === 'theme') return {}
  return {
    '--dsw-alias-label-primary': { light: palette.light.primary, dark: palette.dark.primary },
    '--dsw-alias-label-secondary': { light: palette.light.secondary, dark: palette.dark.secondary },
    '--dsw-alias-label-tertiary': { light: palette.light.hint, dark: palette.dark.hint },
    '--dsw-alias-label-caption': { light: palette.light.hint, dark: palette.dark.hint },
    '--dsw-alias-link': { light: palette.light.accent, dark: palette.dark.accent },
    // --dsw-alias-brand-primary is deliberately NOT overridden. It is the
    // product's accent (buttons, selection, and the sidebar's group headings),
    // so tinting it re-coloured chrome that must stay on-brand — the sidebar
    // "工作区" heading was the visible casualty.
  }
}
