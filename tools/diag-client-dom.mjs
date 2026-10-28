import fs from 'node:fs'
import vm from 'node:vm'

const target = process.argv[2]
const code = fs.readFileSync(target, 'utf8')

// ---------- 最小可跑 DOM ----------
class El {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase()
    this.nodeName = this.tagName
    this.children = []
    this.childNodes = []
    this.parentNode = null
    this.attributes = new Map()
    this.dataset = {}
    this.style = new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => '' }, {
      get(t, p) { return p in t ? t[p] : '' },
      set(t, p, v) { t[p] = v; return true },
    })
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
    this.textContent = ''
    this.innerHTML = ''
    this.value = ''
    this.paused = true
    this.ownerDocument = null
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)) }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null }
  hasAttribute(k) { return this.attributes.has(k) }
  removeAttribute(k) { this.attributes.delete(k) }
  toggleAttribute(k, force) { const on = force ?? !this.attributes.has(k); on ? this.setAttribute(k, '') : this.removeAttribute(k); return on }
  appendChild(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c }
  append(...cs) { cs.forEach((c) => this.appendChild(c)) }
  insertBefore(c) { return this.appendChild(c) }
  removeChild(c) { return c }
  remove() {}
  replaceChildren() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true }
  querySelector() { return null }
  querySelectorAll() { return [] }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 } }
  getRootNode() { return doc }
  getContext() { return universal('ctx2d') }
  toDataURL() { return 'data:,' }
  width = 300
  height = 150
  focus() {}
  blur() {}
  play() { return Promise.resolve() }
  pause() {}
  load() {}
  cloneNode() { return new El(this.tagName) }
}

const doc = {
  documentElement: new El('html'),
  head: new El('head'),
  body: new El('body'),
  createElement: (t) => new El(t),
  createElementNS: (ns, t) => new El(t),
  createTextNode: (t) => ({ textContent: t }),
  createDocumentFragment: () => new El('fragment'),
  querySelector: (sel) => new El('div'),
  querySelectorAll: () => [],
  getElementById: () => new El('div'),
  addEventListener() {}, removeEventListener() {},
  readyState: 'complete',
  visibilityState: 'visible',
  hidden: false,
}
doc.documentElement.ownerDocument = doc
doc.body.ownerDocument = doc

// ---------- 宿主服务 ----------
const registeredSlots = []
const calls = { overrideTokens: 0, setFontSize: 0, setFontFamily: 0 }

const theme = {
  overrideTokens(source, tokens) {
    calls.overrideTokens++
    // 复刻宿主校验
    for (const [name, value] of Object.entries(tokens)) {
      if (typeof value === 'string') throw new TypeError(`theme override "${name}" from "${source}" is a bare string`)
      if (typeof value !== 'object' || value === null || typeof value.light !== 'string' || typeof value.dark !== 'string') {
        throw new TypeError(`theme override "${name}" from "${source}" must map to a { light, dark } pair`)
      }
    }
    return () => {}
  },
  getTheme() { return { fontSizes: { text: 14, code: 11, terminal: 13 }, fontFamilies: { text: '', code: '' }, active: 'light' } },
  setFontSize(role, px) { calls.setFontSize++; if (typeof role !== 'string' || typeof px !== 'number') throw new TypeError('setFontSize(role, px)'); return true },
  setFontFamily(role, stack) { calls.setFontFamily++; return true },
  on() { return () => {} }, off() {}, register() { return () => {} }, get() { return undefined },
}

const locale = {
  register(ns, a, b) {
    const pairs = typeof a === 'string' ? [[a, b]] : Object.entries(a)
    const pattern = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u
    for (const [id] of pairs) if (!pattern.test(id)) throw new Error(`locale id "${id}" is not a BCP 47-style tag`)
    return () => {}
  },
  bind: () => (k) => String(k),
  on() { return () => {} },
}

const universal = (name) => new Proxy(function () { return universal(name + '()') }, {
  get(t, p) {
    if (p === Symbol.toPrimitive) return () => name
    if (p === 'then' || p === Symbol.iterator) return undefined
    if (!(p in t)) t[p] = universal(name + '.' + String(p))
    return t[p]
  },
  apply() { return universal(name + '()') },
  construct() { return universal('new ' + name) },
})

const mods = new Map([
  ['@deepseek-ai/dsh-client-store', {
    defineStore: (spec) => ({
      spec,
      create: () => {
        let state = spec.init()
        const subs = new Set()
        const actions = {}
        for (const [k, fn] of Object.entries(spec.actions ?? {})) {
          actions[k] = (...args) => { const draft = { ...state }; fn(draft, ...args); state = draft; subs.forEach((f) => f()) }
        }
        return { actions, getSnapshot: () => state, subscribe: (f) => { subs.add(f); return () => subs.delete(f) }, clearPersisted: () => {} }
      },
    }),
  }],
])
const req = (n) => { if (!mods.has(n)) mods.set(n, universal(n)); return mods.get(n) }

let registered = null
let rafCount = 0
const sb = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  requestAnimationFrame: (f) => { if (++rafCount > 3) return 0; return setTimeout(() => f(Date.now()), 0) },
  cancelAnimationFrame: () => {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, scrollY: 0,
  getComputedStyle: () => ({ getPropertyValue: () => '', fontFamily: '', fontSize: '14px' }),
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail } },
  Event: class { constructor(t) { this.type = t } },
  MutationObserver: class { observe() {} disconnect() {} takeRecords() { return [] } },
  ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
  IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  performance: { now: () => Date.now() },
  devicePixelRatio: 1,
  document: doc,
  navigator: { language: 'zh', languages: ['zh'], userAgent: 'node' },
  HTMLElement: El,
  Element: El,
  Node: El,
  SVGElement: El,
  HTMLCanvasElement: El,
  HTMLVideoElement: El,
  CanvasRenderingContext2D: class {},
  Path2D: class {},
  Image: El,
  Blob: class {},
  requestIdleCallback: (f) => setTimeout(f, 0),
}
sb.window = sb
sb.globalThis = sb
sb.self = sb
sb.window.__ModuleLoader__ = { load(e) { registered = e } }
sb.__ModuleLoader__ = sb.window.__ModuleLoader__

vm.runInContext(code, vm.createContext(sb), { filename: target, timeout: 15000 })
const out = registered.factory(req)

// 复刻 cordis 的 ctx 形状
const ctx = {
  effect(cb) { const d = cb(); return () => { if (typeof d === 'function') d() } },
  on() { return () => {} },
  locale,
  theme,
  slots: {
    inject(name, cb) { return cb() },
    register(opts, comp) { registeredSlots.push({ opts, comp }); return () => {} },
    update() {}, remove() {},
  },
  logger: universal('logger'),
  get(n) { return n === 'theme' ? theme : n === 'locale' ? locale : n === 'slots' ? ctx.slots : undefined },
}
ctx.root = ctx

console.log('=== apply ===')
try {
  const r = out.apply(ctx)
  console.log('apply 正常返回:', r === undefined ? 'undefined' : typeof r)
  console.log('注册 slot:', registeredSlots.map((s) => s.opts?.name).join(', '))
  console.log('theme.overrideTokens 调用:', calls.overrideTokens, '| setFontSize:', calls.setFontSize)
  console.log('>>> 结论: apply 成功，无抛错')
} catch (e) {
  console.log('!!! apply 抛错:', e.constructor.name + ': ' + e.message)
  console.log((e.stack || '').split('\n').slice(0, 8).join('\n'))
}

process.exit(0)
