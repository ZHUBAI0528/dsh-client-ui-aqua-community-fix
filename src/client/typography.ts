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

/**
 * The TWO colours one scheme defines, per appearance mode.
 *
 * It used to carry four (primary / secondary / hint / accent). Four near-identical
 * inks made the switch invisible — a scheme change barely moved the text. Each
 * scheme now ships exactly two strong colours: the body ink and the accent. The
 * explanatory tone is DERIVED from those two (see {@link schemeHint}), so the
 * scheme still owns it without a third hard-to-see grey.
 */
export interface SchemeColors {
  /** Body ink: message text, headings, labels. */
  primary: string
  /** Emphasis ink: links, inline accents, active labels. */
  accent: string
}

/**
 * One selectable colour scheme: the same mood tuned for both appearances.
 *
 * The name spells out the TWO colours the scheme actually ships, body ink first
 * and accent second — and it carries a dark twin, because the dark half is a
 * different pair of colours, not a dimmed copy. A card labelled "墨黑 · 云雾白"
 * whose chips read black + orange was the mismatch: the name described a colour
 * that is not on the card at all.
 */
export interface TextPalette {
  id: string
  /** Light-appearance name: body ink + accent. */
  zh: string
  en: string
  /** Dark-appearance name: the bright pair that replaces the light one. */
  zhDark: string
  enDark: string
  /** Light appearance: dark ink on a bright backdrop. */
  light: SchemeColors
  /** Dark appearance: bright ink on a dim backdrop — the REVERSE of light. */
  dark: SchemeColors
}

/**
 * Shipped schemes. Light mode always uses a DARK ink, dark mode always a BRIGHT
 * one, and both halves carry a genuinely different accent — that reversal is the
 * point: flipping 外观 must repaint the text, not just dim it.
 */
export const TEXT_PALETTES: readonly TextPalette[] = [
  {
    id: 'theme',
    zh: '跟随主题',
    en: 'Theme default',
    zhDark: '跟随主题',
    enDark: 'Theme default',
    light: { primary: '', accent: '' },
    dark: { primary: '', accent: '' },
  },
  {
    id: 'ink',
    zh: '墨黑 · 朱橙',
    en: 'Ink · Vermilion',
    zhDark: '云雾白 · 蜜橙',
    enDark: 'Cloud · Amber',
    light: { primary: '#0E1218', accent: '#C2410C' },
    dark: { primary: '#F4F8FE', accent: '#FFA26B' },
  },
  {
    id: 'navy',
    zh: '深海蓝 · 琥珀',
    en: 'Deep sea · Amber',
    zhDark: '冷月白 · 暖金',
    enDark: 'Moon · Gold',
    light: { primary: '#0A1D36', accent: '#B26A00' },
    dark: { primary: '#DCE9FA', accent: '#FFC46B' },
  },
  {
    id: 'forest',
    zh: '墨绿 · 玫红',
    en: 'Forest · Magenta',
    zhDark: '薄荷白 · 浅粉',
    enDark: 'Mint · Blush',
    light: { primary: '#0B2A21', accent: '#C2185B' },
    dark: { primary: '#E3F5EC', accent: '#FF8FB1' },
  },
  {
    id: 'sepia',
    zh: '暖褐 · 湖蓝',
    en: 'Sepia · Lake',
    zhDark: '暖米白 · 天青',
    enDark: 'Cream · Azure',
    light: { primary: '#2C2015', accent: '#1F6FEB' },
    dark: { primary: '#F5EDDF', accent: '#8FC0FF' },
  },
  {
    id: 'violet',
    zh: '墨紫 · 松绿',
    en: 'Violet · Pine',
    zhDark: '淡紫白 · 薄荷绿',
    enDark: 'Lilac · Mint',
    light: { primary: '#1E1830', accent: '#0E8C74' },
    dark: { primary: '#EDE8FB', accent: '#6FE0C4' },
  },
  {
    id: 'rose',
    zh: '枣红 · 石青',
    en: 'Rosewood · Teal',
    zhDark: '玫瑰白 · 冰蓝',
    enDark: 'Blush · Ice',
    light: { primary: '#33141B', accent: '#0F6E8C' },
    dark: { primary: '#FAE7EC', accent: '#74D2E8' },
  },
  {
    id: 'teal',
    zh: '墨青 · 朱橙',
    en: 'Ink teal · Vermilion',
    zhDark: '冰蓝白 · 杏橙',
    enDark: 'Ice · Apricot',
    light: { primary: '#0B2D2F', accent: '#C2410C' },
    dark: { primary: '#E1F4F6', accent: '#FFAF6B' },
  },
  {
    id: 'graphite',
    zh: '石墨 · 钴蓝',
    en: 'Graphite · Cobalt',
    zhDark: '象牙白 · 雾蓝',
    enDark: 'Ivory · Mist',
    light: { primary: '#1D1D1D', accent: '#2F6BD1' },
    dark: { primary: '#F2F2F2', accent: '#9CC2FF' },
  },
  {
    id: 'indigo',
    zh: '靛蓝 · 朱橙',
    en: 'Indigo · Vermilion',
    zhDark: '雪白 · 杏橙',
    enDark: 'Snow · Apricot',
    light: { primary: '#131A48', accent: '#C2410C' },
    dark: { primary: '#E7EAFB', accent: '#FFA36B' },
  },
  {
    id: 'olive',
    zh: '墨橄榄 · 砖红',
    en: 'Olive · Brick',
    zhDark: '松石白 · 浅绯',
    enDark: 'Mist · Rose',
    light: { primary: '#242A0F', accent: '#A8322E' },
    dark: { primary: '#F0F3DF', accent: '#FF9A94' },
  },
  {
    id: 'cocoa',
    zh: '可可 · 松绿',
    en: 'Cocoa · Pine',
    zhDark: '奶白 · 薄荷绿',
    enDark: 'Milk · Mint',
    light: { primary: '#2A1C15', accent: '#0F7B5C' },
    dark: { primary: '#F7EBE3', accent: '#77DCB8' },
  },
  {
    id: 'slate',
    zh: '岩灰 · 赭石',
    en: 'Slate · Ochre',
    zhDark: '银白 · 杏色',
    enDark: 'Silver · Apricot',
    light: { primary: '#1B232F', accent: '#B4531A' },
    dark: { primary: '#EDF1F7', accent: '#FFB27A' },
  },
  {
    id: 'plum',
    zh: '梅紫 · 青碧',
    en: 'Plum · Jade',
    zhDark: '雪青 · 浅青',
    enDark: 'Snow violet · Cyan',
    light: { primary: '#2A1526', accent: '#0F7B8C' },
    dark: { primary: '#F8E7F3', accent: '#6FD9E6' },
  },
  {
    id: 'amber',
    zh: '琥珀 · 宝蓝',
    en: 'Amber · Sapphire',
    zhDark: '象牙 · 天蓝',
    enDark: 'Ivory · Sky',
    light: { primary: '#33240A', accent: '#1D5FB8' },
    dark: { primary: '#FBF0D8', accent: '#8EC0FF' },
  },
  {
    id: 'crimson',
    zh: '绛红 · 松绿',
    en: 'Crimson · Pine',
    zhDark: '樱白 · 薄荷绿',
    enDark: 'Sakura · Mint',
    light: { primary: '#3A0F16', accent: '#0E6B4F' },
    dark: { primary: '#FCE6EA', accent: '#6FE0B6' },
  },
  {
    id: 'ocean',
    zh: '海蓝 · 赭橙',
    en: 'Ocean · Ochre',
    zhDark: '浪白 · 杏橙',
    enDark: 'Foam · Apricot',
    light: { primary: '#06263F', accent: '#D2691E' },
    dark: { primary: '#DFEFFC', accent: '#FFB066' },
  },
]

/**
 * The explanatory tone of a scheme, derived from its two authored colours.
 *
 * A plain grey hint is what made schemes read as "not applied". Mixing the body
 * ink with the scheme's own accent keeps the small copy clearly tinted by the
 * scheme while staying lighter than the body text.
 * @param palette - the selected palette.
 * @param dark - whether the dark appearance is active.
 * @returns a CSS colour, or '' when the palette follows the theme.
 */
export function schemeHint(palette: TextPalette, dark: boolean): string {
  const ink = dark ? palette.dark : palette.light
  if (ink.primary === '') return ''
  return `color-mix(in srgb, ${ink.primary} 74%, ${ink.accent})`
}

/**
 * The scheme's display name for the active appearance.
 *
 * Cards render the DARK half in dark mode, so the label has to follow or it
 * describes colours the card is not showing.
 * @param palette - the scheme.
 * @param chinese - whether the UI language is Chinese.
 * @param dark - whether the dark appearance is active.
 * @returns the label that matches the swatch on screen.
 */
export function paletteName(palette: TextPalette, chinese: boolean, dark: boolean): string {
  if (dark) return chinese ? palette.zhDark : palette.enDark
  return chinese ? palette.zh : palette.en
}

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

/**
 * Explanatory-text colour presets: readable on glass, not washed out. Thirteen
 * stops cover the hue circle so the picker is a real choice instead of six
 * near-greys; every entry carries a light AND a dark value, which is what makes
 * the row flip with 外观.
 */
export const HINT_COLORS: readonly HintColorPreset[] = [
  { id: '', zh: '跟随色彩方案', en: 'Follow scheme', light: '', dark: '' },
  { id: 'neutral', zh: '中性灰', en: 'Neutral', light: '#4A5460', dark: '#BAC7D7' },
  { id: 'slate', zh: '石板灰', en: 'Slate', light: '#3C4A5A', dark: '#C8D6E4' },
  { id: 'blue', zh: '蓝', en: 'Blue', light: '#2F6FB8', dark: '#8FC4FF' },
  { id: 'sky', zh: '天青', en: 'Sky', light: '#1F7A97', dark: '#86DEFA' },
  { id: 'teal', zh: '青', en: 'Teal', light: '#1B7268', dark: '#84E2D6' },
  { id: 'green', zh: '绿', en: 'Green', light: '#2C7A5B', dark: '#86D9B4' },
  { id: 'olive', zh: '橄榄', en: 'Olive', light: '#5E6B1E', dark: '#CBDD85' },
  { id: 'amber', zh: '琥珀', en: 'Amber', light: '#8A5A12', dark: '#F0C27A' },
  { id: 'orange', zh: '橙', en: 'Orange', light: '#9A4A16', dark: '#FFB483' },
  { id: 'rose', zh: '玫红', en: 'Rose', light: '#A64358', dark: '#FF9DB0' },
  { id: 'violet', zh: '紫', en: 'Violet', light: '#5B45B0', dark: '#C0A6FF' },
  { id: 'plum', zh: '梅紫', en: 'Plum', light: '#7A2166', dark: '#F5A0DF' },
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
 * Conversation ink: ONE colour, like the explanatory-text row.
 *
 * It used to be a whole palette, which meant a second scheme on top of the
 * global one — two conceptually different things behind two look-alike pickers.
 * A single ink is what the row actually needs: "paint the transcript this
 * colour".
 */
export interface ChatColorPreset {
  /** Stable id; empty string means "follow the font colour scheme". */
  id: string
  zh: string
  en: string
  /** Light-appearance colour (empty = follow the scheme). */
  light: string
  /** Dark-appearance colour. */
  dark: string
}

/** Conversation ink presets — the same hue circle as the explanatory row. */
export const CHAT_COLORS: readonly ChatColorPreset[] = [
  { id: '', zh: '跟随色彩方案', en: 'Follow scheme', light: '', dark: '' },
  { id: 'ink', zh: '墨黑', en: 'Ink', light: '#0E1218', dark: '#F4F8FE' },
  { id: 'graphite', zh: '石墨', en: 'Graphite', light: '#333B45', dark: '#D9E2EC' },
  { id: 'blue', zh: '海蓝', en: 'Sea blue', light: '#1B4F9C', dark: '#8FC0FF' },
  { id: 'sky', zh: '天青', en: 'Sky', light: '#0E6E8C', dark: '#7FD8F0' },
  { id: 'teal', zh: '湖绿', en: 'Lagoon', light: '#0E6F5A', dark: '#7FE3C4' },
  { id: 'green', zh: '松绿', en: 'Pine', light: '#256B31', dark: '#9ADE9F' },
  { id: 'olive', zh: '橄榄', en: 'Olive', light: '#5A6416', dark: '#D2DE7A' },
  { id: 'amber', zh: '琥珀', en: 'Amber', light: '#8A5208', dark: '#F5C978' },
  { id: 'orange', zh: '赤橙', en: 'Ember', light: '#9A3B10', dark: '#FFAE7A' },
  { id: 'rose', zh: '玫红', en: 'Rose', light: '#9C2740', dark: '#FF9FB2' },
  { id: 'violet', zh: '紫罗兰', en: 'Violet', light: '#5A34A8', dark: '#C3A8FF' },
  { id: 'plum', zh: '梅紫', en: 'Plum', light: '#7A1F63', dark: '#F09BDC' },
]

/**
 * Resolve the conversation ink for the current appearance.
 * @param id - preset id ('' = follow the font colour scheme).
 * @param dark - whether the dark appearance is active.
 * @returns the CSS colour, or '' when the scheme should win.
 */
export function chatColorValue(id: string, dark: boolean): string {
  const preset = CHAT_COLORS.find(item => item.id === id)
  if (preset === undefined || preset.id === '') return ''
  return dark ? preset.dark : preset.light
}

/**
 * Build the host token overrides for one palette.
 *
 * Five tokens from two authored colours: the label ramp takes the body ink
 * (primary AND secondary — a scheme should recolour the text, not tint half of
 * it), the explanatory ramp takes the derived tone so small copy stays legible,
 * and `--dsw-alias-link` carries the accent. Every entry ships its `{light,dark}`
 * pair, so flipping 外观 re-resolves the whole scheme with no listener of ours.
 * @param palette - the selected palette.
 * @returns token name → `{ light, dark }` pair map (empty when following the theme).
 */
export function paletteTokens(palette: TextPalette): Record<string, { light: string, dark: string }> {
  if (palette.id === 'theme') return {}
  return {
    '--dsw-alias-label-primary': { light: palette.light.primary, dark: palette.dark.primary },
    '--dsw-alias-label-secondary': { light: palette.light.primary, dark: palette.dark.primary },
    '--dsw-alias-label-tertiary': { light: schemeHint(palette, false), dark: schemeHint(palette, true) },
    '--dsw-alias-label-caption': { light: schemeHint(palette, false), dark: schemeHint(palette, true) },
    '--dsw-alias-link': { light: palette.light.accent, dark: palette.dark.accent },
    // --dsw-alias-brand-primary is deliberately NOT overridden. It is the
    // product's accent (buttons, selection, and the sidebar's group headings),
    // so tinting it re-coloured chrome that must stay on-brand — the sidebar
    // "工作区" heading was the visible casualty.
  }
}
