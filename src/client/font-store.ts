/**
 * Imported fonts: the user picks a font file, we keep the binary in IndexedDB
 * (localStorage's ~5MB quota cannot hold a CJK face), read its real family name
 * out of the `name` table, and inject an `@font-face` rule so the family can be
 * handed straight to `theme.setFontFamily()`.
 */

const DB_NAME = 'dsh-aqua-fonts'
const STORE = 'fonts'
const DB_VERSION = 1

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('indexedDB open failed')) }
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result) }
    request.onerror = () => { reject(request.error ?? new Error('indexedDB request failed')) }
  })
}

/** Read the sfnt/woff magic so `@font-face` gets the right format hint. */
function fontFormat(view: DataView): string {
  const tag = view.getUint32(0, false)
  // 'OTTO' → CFF outlines, 'wOFF'/'wOF2' → wrapped, 'ttcf' → collection.
  if (tag === 0x4f54544f) return 'opentype'
  if (tag === 0x774f4646) return 'woff'
  if (tag === 0x774f4632) return 'woff2'
  return 'truetype'
}

/** Decode a UTF-16BE string out of the name table. */
function readUtf16be(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i + 1 < length; i += 2) out += String.fromCharCode(view.getUint16(offset + i, false))
  return out
}

/**
 * Pull the family name out of a TrueType/OpenType `name` table.
 * Falls back to the file name when the binary is a WOFF wrapper or unreadable.
 * @param buffer - the raw font bytes.
 * @param fallback - name to use when parsing fails.
 * @returns the family name.
 */
function readFamilyName(buffer: ArrayBuffer, fallback: string): string {
  try {
    const view = new DataView(buffer)
    let base = 0
    // A collection starts with 'ttcf': take the first face's directory.
    if (view.getUint32(0, false) === 0x74746366) base = view.getUint32(12, false)
    const numTables = view.getUint16(base + 4, false)
    for (let i = 0; i < numTables; i++) {
      const record = base + 12 + i * 16
      const tag = view.getUint32(record, false)
      if (tag !== 0x6e616d65) continue // 'name'
      const tableOffset = view.getUint32(record + 8, false)
      const count = view.getUint16(tableOffset + 2, false)
      const strings = tableOffset + view.getUint16(tableOffset + 4, false)
      let preferred = ''
      let windows = ''
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
        if (platform !== 3 || encoding !== 1) continue
        const text = readUtf16be(view, offset, length).trim()
        if (text === '') continue
        if (nameId === 16 && language === 0x409) preferred = text
        else if (nameId === 1 && language === 0x409) windows = windows === '' ? text : windows
      }
      const name = preferred || windows
      if (name !== '') return name
      break
    }
  } catch {
    /* fall through to the file name */
  }
  return fallback
}

/** Strip the extension so the fallback family reads cleanly. */
function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/** List every stored font without their binaries. */
export async function listImportedFonts(): Promise<ImportedFont[]> {
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE)
    const records = await requestToPromise(store.getAll() as IDBRequest<FontRecord[]>)
    return records
      .sort((a, b) => a.addedAt - b.addedAt)
      .map(({ id, family, fileName, addedAt }) => ({ id, family, fileName, addedAt }))
  } finally {
    db.close()
  }
}

/** Persist one picked font file and report the family name it carries. */
export async function saveImportedFont(file: File): Promise<ImportedFont> {
  const data = await file.arrayBuffer()
  const family = readFamilyName(data, baseName(file.name))
  const record: FontRecord = {
    id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    family,
    fileName: file.name,
    addedAt: Date.now(),
    data,
  }
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    await requestToPromise(store.put(record))
  } finally {
    db.close()
  }
  return { id: record.id, family, fileName: record.fileName, addedAt: record.addedAt }
}

/** Delete one stored font. */
export async function deleteImportedFont(id: string): Promise<void> {
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    await requestToPromise(store.delete(id))
  } finally {
    db.close()
  }
}

/** Live blob URLs so a re-injection can revoke the previous ones. */
const objectUrls = new Map<string, string>()

/** `<style>` element that carries every imported `@font-face`. */
function styleElement(): HTMLStyleElement {
  const existing = document.querySelector<HTMLStyleElement>('style[data-dsh-aqua-fonts]')
  if (existing !== null) return existing
  const style = document.createElement('style')
  style.dataset.dshAquaFonts = ''
  document.head.appendChild(style)
  return style
}

/**
 * Read every stored font, inject one `@font-face` per family and return the
 * list the panel offers. Safe to call on every boot (idempotent).
 * @returns the imported fonts, oldest first.
 */
export async function ensureImportedFontFaces(): Promise<ImportedFont[]> {
  const db = await openDb()
  let records: FontRecord[] = []
  try {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE)
    records = await requestToPromise(store.getAll() as IDBRequest<FontRecord[]>)
  } finally {
    db.close()
  }
  records.sort((a, b) => a.addedAt - b.addedAt)
  const rules: string[] = []
  for (const record of records) {
    const buffer = record.data instanceof ArrayBuffer ? record.data : new Uint8Array(record.data as ArrayBuffer).buffer
    const url = objectUrls.get(record.id) ?? URL.createObjectURL(new Blob([buffer], { type: 'font/ttf' }))
    objectUrls.set(record.id, url)
    const format = fontFormat(new DataView(buffer))
    rules.push(`@font-face{font-family:"${record.family}";src:url("${url}") format("${format}");font-display:swap;}`)
  }
  styleElement().textContent = rules.join('\n')
  return records.map(({ id, family, fileName, addedAt }) => ({ id, family, fileName, addedAt }))
}

/** Drop one font's `@font-face` rule and revoke its blob URL. */
export function forgetImportedFontFace(family: string): void {
  const style = document.querySelector<HTMLStyleElement>('style[data-dsh-aqua-fonts]')
  if (style === null) return
  const kept = (style.textContent ?? '')
    .split('\n')
    .filter(rule => !rule.includes(`font-family:"${family}"`))
  style.textContent = kept.join('\n')
}
