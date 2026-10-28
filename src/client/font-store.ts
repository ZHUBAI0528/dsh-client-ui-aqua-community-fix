/**
 * Imported fonts: the user picks a font file, we keep the binary in IndexedDB
 * (localStorage's ~5MB quota cannot hold a CJK face), read its real family name
 * out of the `name` table, and inject an `@font-face` rule so the family can be
 * handed straight to `theme.setFontFamily()`.
 *
 * Robustness rules learned the hard way:
 * - One unreadable record must never abort the whole injection pass. A record
 *   with a truncated payload used to throw inside the loop and leave EVERY
 *   imported face unregistered, while the panel's `.catch()` swallowed it — the
 *   font list went empty and there was no UI left to delete the bad record.
 * - The family name is attacker-controlled text that we splice into a CSS rule,
 *   so it is sanitised before it reaches the stylesheet.
 * - The blob URL of a removed font is revoked explicitly; nothing else frees it.
 */

const DB_NAME = 'dsh-aqua-fonts'
const STORE = 'fonts'
const DB_VERSION = 1

/** Largest font file we accept. A full CJK face is 8-24 MB; beyond that it is a mis-pick. */
const MAX_FONT_BYTES = 24 * 1024 * 1024

/** sfnt / woff family magic numbers we can hand to `@font-face`. */
const SFNT_TRUETYPE = 0x00010000
const SFNT_TRUE = 0x74727565
const SFNT_OTTO = 0x4f54544f
const SFNT_TTCF = 0x74746366
const WOFF = 0x774f4646
const WOFF2 = 0x774f4632

/** Why an import was rejected, so the panel can say something useful. */
export type FontImportFailure = 'empty' | 'too-large' | 'not-a-font' | 'collection'

/** Raised by {@link saveImportedFont} with a machine-readable reason. */
export class FontImportError extends Error {
  readonly reason: FontImportFailure

  constructor(reason: FontImportFailure) {
    super(`font import rejected: ${reason}`)
    this.name = 'FontImportError'
    this.reason = reason
  }
}

/** One stored font file. */
export interface ImportedFont {
  /** Stable id (also the `@font-face` family suffix). */
  id: string
  /** Real family name read from the file, or the file name as a fallback. */
  family: string
  /** Original file name, shown in the panel. */
  fileName: string
  /** ms since epoch. */
  addedAt: number
}

/** One record as stored (font + binary). */
interface FontRecord extends ImportedFont {
  data: ArrayBuffer
}

/** A record that survived validation, with its bytes already normalised. */
interface LoadedFont {
  meta: ImportedFont
  data: ArrayBuffer
  /** First four bytes as a big-endian uint32. */
  signature: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('indexedDB open failed')) }
    // Another tab holding an older version would otherwise hang this promise forever.
    request.onblocked = () => { reject(new Error('indexedDB open blocked by another tab')) }
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('indexedDB request failed')) }
  })
}

/** Normalise whatever IndexedDB handed back into a standalone ArrayBuffer. */
function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer
  }
  return null
}

/** Read the sfnt/woff magic; null when the payload is too short to be a font. */
function fontSignature(buffer: ArrayBuffer): number | null {
  if (buffer.byteLength < 4) return null
  try {
    return new DataView(buffer).getUint32(0, false)
  } catch {
    return null
  }
}

/** Map a signature onto the `@font-face` format hint and the blob MIME type. */
function fontFormat(signature: number): { format: string, mime: string } {
  if (signature === SFNT_OTTO) return { format: 'opentype', mime: 'font/otf' }
  if (signature === WOFF) return { format: 'woff', mime: 'font/woff' }
  if (signature === WOFF2) return { format: 'woff2', mime: 'font/woff2' }
  return { format: 'truetype', mime: 'font/ttf' }
}

/** Decode a UTF-16BE string out of the name table. */
function readUtf16be(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i + 1 < length; i += 2) out += String.fromCharCode(view.getUint16(offset + i, false))
  return out
}

/** Decode a Mac Roman string (single byte, platform 1 records). */
function readMacRoman(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i))
  return out
}

/**
 * Strip everything that could close the `@font-face` string or rule early.
 * The family name comes from the file, i.e. from whoever produced it — without
 * this a crafted font injects arbitrary CSS into the page.
 * @param raw - the name as read from the font.
 * @returns the sanitised family, possibly empty.
 */
function sanitizeFamily(raw: string): string {
  return raw
    .replace(/["'\\{};()<>/,]/g, ' ')
    // eslint-disable-next-line no-control-regex -- control chars must not reach the stylesheet
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * Pull the family name out of a TrueType/OpenType `name` table.
 * Falls back to the file name when the binary is unreadable.
 * @param buffer - the raw font bytes.
 * @param fallback - name to use when parsing fails.
 * @returns the sanitised family name.
 */
function readFamilyName(buffer: ArrayBuffer, fallback: string): string {
  try {
    const view = new DataView(buffer)
    let base = 0
    // A collection starts with 'ttcf': take the first face's directory.
    if (fontSignature(buffer) === SFNT_TTCF) base = view.getUint32(12, false)
    const numTables = view.getUint16(base + 4, false)
    for (let i = 0; i < numTables; i++) {
      const record = base + 12 + i * 16
      const tag = view.getUint32(record, false)
      if (tag !== 0x6e616d65) continue // 'name'
      const tableOffset = view.getUint32(record + 8, false)
      const count = view.getUint16(tableOffset + 2, false)
      const strings = tableOffset + view.getUint16(tableOffset + 4, false)
      let preferred = ''
      let preferredAny = ''
      let legacy = ''
      let legacyAny = ''
      for (let j = 0; j < count; j++) {
        const entry = tableOffset + 6 + j * 12
        const platform = view.getUint16(entry, false)
        const encoding = view.getUint16(entry + 2, false)
        const language = view.getUint16(entry + 4, false)
        const nameId = view.getUint16(entry + 6, false)
        const length = view.getUint16(entry + 8, false)
        const offset = strings + view.getUint16(entry + 10, false)
        // nameID 16 = typographic family, 1 = legacy family.
        if (nameId !== 1 && nameId !== 16) continue
        // Windows BMP (UCS-2) or Mac Roman. UCS-4 (encoding 10) would need a
        // different decoder, so it is skipped rather than mis-decoded.
        const windows = platform === 3 && encoding === 1
        const mac = platform === 1 && encoding === 0
        if (!windows && !mac) continue
        const raw = windows ? readUtf16be(view, offset, length) : readMacRoman(view, offset, length)
        const text = raw.trim()
        if (text === '') continue
        // en-US wins, but a localised-only face (zh-CN is 0x804) must not lose
        // its name entirely — that was why CJK system fonts fell back to the
        // file name.
        if (nameId === 16) {
          if (language === 0x409 && preferred === '') preferred = text
          if (preferredAny === '') preferredAny = text
        } else {
          if (language === 0x409 && legacy === '') legacy = text
          if (legacyAny === '') legacyAny = text
        }
      }
      const name = sanitizeFamily(preferred || legacy || preferredAny || legacyAny)
      if (name !== '') return name
      break
    }
  } catch {
    /* fall through to the file name */
  }
  const sanitized = sanitizeFamily(fallback)
  return sanitized !== '' ? sanitized : 'Imported font'
}

/** Strip the extension so the fallback family reads cleanly. */
function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/** Parsed records, cached so a knob tweak never re-reads every font binary. */
let cache: LoadedFont[] | null = null

/** Drop records whose payload cannot be turned into an `@font-face`. */
async function pruneRecords(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const id of ids) store.delete(id)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { resolve() }
      tx.onerror = () => { reject(tx.error ?? new Error('font prune failed')) }
      tx.onabort = () => { reject(tx.error ?? new Error('font prune aborted')) }
    })
  } finally {
    db.close()
  }
}

/**
 * Read every stored font once, skipping (and cleaning up) unreadable records.
 * @returns usable records, oldest first.
 */
async function loadFonts(): Promise<LoadedFont[]> {
  if (cache !== null) return cache
  const db = await openDb()
  let records: FontRecord[] = []
  try {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE)
    records = await requestToPromise(store.getAll() as IDBRequest<FontRecord[]>)
  } finally {
    db.close()
  }
  const loaded: LoadedFont[] = []
  const broken: string[] = []
  for (const record of records) {
    const data = toArrayBuffer(record.data)
    const signature = data === null ? null : fontSignature(data)
    if (data === null || signature === null) {
      // One bad payload must not take the whole list down with it.
      broken.push(record.id)
      continue
    }
    loaded.push({
      meta: { id: record.id, family: record.family, fileName: record.fileName, addedAt: record.addedAt },
      data,
      signature,
    })
  }
  loaded.sort((a, b) => a.meta.addedAt - b.meta.addedAt)
  // One family can only carry one `@font-face` we can address: a second record
  // with the same name was unreachable in the picker (both rows share a stack,
  // so the id lookup always answered the first). Keep the newest and drop the
  // stale duplicates instead of leaving dead rows behind.
  const byFamily = new Map<string, LoadedFont>()
  const superseded: string[] = []
  for (const item of loaded) {
    const previous = byFamily.get(item.meta.family)
    if (previous !== undefined) superseded.push(previous.meta.id)
    byFamily.set(item.meta.family, item)
  }
  cache = [...byFamily.values()]
  // Housekeeping is best-effort: a failed prune must not fail the injection.
  void pruneRecords([...broken, ...superseded]).catch(() => { /* keep the good records */ })
  return cache
}

/**
 * Persist one picked font file and report the family name it carries.
 * A file whose family is already imported replaces that entry instead of
 * producing a second, unreachable row with the same stack.
 * @param file - the picked file.
 * @returns the stored font's metadata.
 * @throws FontImportError when the file is empty, oversized, not a font, or a collection.
 */
export async function saveImportedFont(file: File): Promise<ImportedFont> {
  if (file.size === 0) throw new FontImportError('empty')
  if (file.size > MAX_FONT_BYTES) throw new FontImportError('too-large')
  const data = await file.arrayBuffer()
  const signature = fontSignature(data)
  if (signature === null) throw new FontImportError('not-a-font')
  // `.ttc` bundles several faces; `@font-face` cannot address one of them.
  if (signature === SFNT_TTCF) throw new FontImportError('collection')
  if (signature !== SFNT_TRUETYPE && signature !== SFNT_TRUE && signature !== SFNT_OTTO
    && signature !== WOFF && signature !== WOFF2) {
    throw new FontImportError('not-a-font')
  }

  const family = readFamilyName(data, baseName(file.name))
  const existing = (await loadFonts()).find(item => item.meta.family === family)
  const meta: ImportedFont = {
    id: existing?.meta.id ?? `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    family,
    fileName: file.name,
    addedAt: existing?.meta.addedAt ?? Date.now(),
  }
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    await requestToPromise(store.put({ ...meta, data } satisfies FontRecord))
  } finally {
    db.close()
  }
  cache = null
  return meta
}

/** Delete one stored font (its blob URL is released by {@link releaseImportedFont}). */
export async function deleteImportedFont(id: string): Promise<void> {
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    await requestToPromise(store.delete(id))
  } finally {
    db.close()
  }
  cache = null
}

/** Live blob URLs so a re-injection can revoke the previous ones. */
const objectUrls = new Map<string, string>()

/** Revoke one font's blob URL — nothing else frees that memory. */
export function releaseImportedFont(id: string): void {
  const url = objectUrls.get(id)
  if (url === undefined) return
  URL.revokeObjectURL(url)
  objectUrls.delete(id)
}

/** `<style>` element that carries every imported `@font-face`. */
function styleElement(): HTMLStyleElement {
  const existing = document.querySelector<HTMLStyleElement>('style[data-dsh-aqua-fonts]')
  if (existing !== null) return existing
  const style = document.createElement('style')
  style.dataset.dshAquaFonts = ''
  document.head.appendChild(style)
  return style
}

/** In-flight injection, so two callers cannot interleave style rewrites. */
let pending: Promise<ImportedFont[]> | null = null

/**
 * Read every stored font, inject one `@font-face` per family and return the
 * list the panel offers. Safe to call on every boot (idempotent).
 * @returns the imported fonts, oldest first.
 */
export function ensureImportedFontFaces(): Promise<ImportedFont[]> {
  if (pending !== null) return pending
  pending = (async (): Promise<ImportedFont[]> => {
    let loaded: LoadedFont[] = []
    try {
      loaded = await loadFonts()
    } catch {
      // No IndexedDB (private mode, quota) — the import entry stays inert.
      return []
    }
    const rules: string[] = []
    const live = new Set<string>()
    for (const { meta, data, signature } of loaded) {
      live.add(meta.id)
      let url = objectUrls.get(meta.id)
      if (url === undefined) {
        const { mime } = fontFormat(signature)
        url = URL.createObjectURL(new Blob([data], { type: mime }))
        objectUrls.set(meta.id, url)
      }
      const { format } = fontFormat(signature)
      const safeFamily = sanitizeFamily(meta.family)
      if (safeFamily === '') continue
      rules.push(`@font-face{font-family:"${safeFamily}";src:url("${url}") format("${format}");font-display:swap;}`)
    }
    // Release URLs whose record is gone; the map used to grow forever.
    for (const id of [...objectUrls.keys()]) {
      if (!live.has(id)) releaseImportedFont(id)
    }
    styleElement().textContent = rules.join('\n')
    return loaded.map(item => item.meta)
  })().finally(() => { pending = null })
  return pending
}

/**
 * Confirm the browser actually resolved a family we just registered.
 * `@font-face` failures are silent, so a corrupt file used to raise a success
 * dialog and then fall back to the theme stack.
 * @param family - the family to probe.
 * @returns whether at least one face loaded.
 */
export async function verifyImportedFont(family: string): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document)) return true
  try {
    const faces = await document.fonts.load(`16px ${JSON.stringify(family)}`)
    return faces.length > 0
  } catch {
    return false
  }
}
