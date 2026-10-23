/**
 * Edge metrics: the two seams where the floating chrome and the transcript
 * boundary disagree, measured instead of hard-coded.
 *
 * Both seams share one root cause. The glass chrome (header card, composer
 * card + stats dock) floats OVER a transcript that keeps scrolling underneath
 * it, so the transcript's own box edge has to agree with the chrome's edge —
 * otherwise the strip between the two is painted sharp and hard-clipped: text
 * cut in half, no fade, no frost.
 *
 *   - TOP: the stylesheet pulls the scrollport up by a fixed 95px so content
 *     slides under the header card. That constant silently encoded the header
 *     height of the build it was written against; once the header got shorter,
 *     the scrollport's top edge ended up ABOVE the card's top edge and the
 *     surplus band showed bare transcript (`margin-top` cannot know the card
 *     height — CSS has no "sibling's height" value).
 *   - BOTTOM: the input bar reserves 12px below the stats dock, and the
 *     transcript shows through that gap the same way.
 *
 * Two responses, one per seam:
 *
 *   1. ALIGN the transcript's clipping line with the header card's top edge,
 *      so nothing is painted above the card (a CSS variable the scrollport
 *      consumes, written from live measurement).
 *   2. BLUR the two joints where glass meets transcript — one band under the
 *      header card, one rising from the column's bottom edge — so the cut
 *      reads as a dissolve rather than a line.
 *
 * Both are pure measurement plus two injected, pointer-transparent elements:
 * no layout is altered, nothing is mounted inside the host's own tree, and
 * removing the layer removes every trace.
 */

/** CSS variable carrying the measured scrollport lift, in px. */
export const LIFT_VARIABLE = '--dsh-aqua-scroll-lift'

/**
 * Fallback lift, matching the stylesheet's default. Used by the CSS `var()`
 * before the first measurement lands, so the pre-measure frame looks exactly
 * like the previous build instead of flashing a shifted transcript.
 */
const LIFT_FALLBACK_PX = 95

/** Attribute marking an injected seam band; the value is the edge it hugs. */
export const SEAM_ATTRIBUTE = 'data-dsh-aqua-seam'

/**
 * Where a band is pinned — both are GUTTERS, never the content.
 *
 * - `top`  — between the page's top boundary and the header card's top edge
 * - `foot` — between the statistics dock's bottom edge and the page's bottom
 *   boundary
 *
 * The bands deliberately do NOT reach into the conversation. Fogging the
 * transcript itself (a tall tinted strip under the card, or above the
 * composer) reads as a bright horizontal slab sitting on top of the message
 * flow — a defect, not a fade — because the glass already ends in a clean
 * edge there. The gutters are the only places where clipped content has no
 * chrome of its own to hide behind.
 */
export type SeamEdge = 'top' | 'foot'

/** Phase wrapper the conversation chrome lives under. */
const ACTIVE_PHASE = "[data-phase='active']"

/** Teardown handle for the measurement loop. */
export interface EdgeMetricsHandle {
  /** Stop observing and remove the injected seam bands. */
  dispose: () => void
}

/** Parse a computed pixel length; returns NaN for `auto` / empty. */
function parsePx(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** The floating session header card (absent on the hero / panel routes). */
function headerCard(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`${ACTIVE_PHASE} header`)
}

/** The transcript scrollport that slides under the header card. */
function conversationScroll(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`${ACTIVE_PHASE} [data-conversation-scroll]`)
}

/** The center column: the surface the theme owns and the seams are clipped to. */
function centerColumn(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-dsh-center], [class*="centerCol"]')
}

/** The composer seat: the element the glass card + stats dock are mounted in. */
function inputBar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-dsh-inputbar]')
}

/**
 * The statistics dock — the fused glass pill under the composer.
 *
 * Resolved through the same hook the stylesheet paints the glass on
 * (`[class*='dock']:has(> [data-slot='conversation.composer.dock'])`) so the
 * band measures the element that actually has the rounded bottom edge, not a
 * wrapper of it. The fallbacks cover deployments where the dock wrapper is
 * missing: the stats row inside it, then the composer card.
 *
 * @returns the dock element, or null when the composer is not mounted.
 */
function statsDock(): HTMLElement | null {
  const bar = inputBar()
  if (bar === null) return null
  return bar.querySelector<HTMLElement>("[class*='dock']:has(> [data-slot='conversation.composer.dock'])")
    ?? bar.querySelector<HTMLElement>("[class*='dock']")
    ?? bar.querySelector<HTMLElement>('[data-dsh-stats]')
}

/**
 * Align the transcript's top edge with the header card's top edge.
 *
 * The delta is measured live and folded into the variable, so the value
 * converges by construction: the read-back margin is the currently applied
 * lift, and adding the residual offset lands the scrollport exactly on the
 * card's line. Once aligned the residual is 0 and no write happens, which also
 * keeps the ResizeObserver from looping.
 *
 * `padding-top` follows the same variable (see aqua.css), so the content keeps
 * its 12px clearance below the card — only the invisible clipping boundary
 * moves.
 *
 * @param root - the <html> element the variable is written to.
 */
function syncScrollLift(root: HTMLElement): void {
  const header = headerCard()
  const scroll = conversationScroll()
  if (header === null || scroll === null) return
  if (header.getBoundingClientRect().height < 16) return
  const applied = -parsePx(getComputedStyle(scroll).marginTop)
  if (!Number.isFinite(applied)) return
  const delta = scroll.getBoundingClientRect().top - header.getBoundingClientRect().top
  if (Math.abs(delta) < 1) return
  const next = Math.max(0, applied + delta)
  root.style.setProperty(LIFT_VARIABLE, `${Math.round(next * 100) / 100}px`)
}

/**
 * Last geometry string written per band.
 *
 * A measurement pass runs on scroll too, and re-writing identical inline
 * styles would dirty layout on every frame for no visual change. The WeakMap
 * keeps this free of leaks: bands are removed with the layer, and entries die
 * with the elements.
 */
const appliedGeometry = new WeakMap<HTMLElement, string>()

/** Show a band at `css`, touching the DOM only when the geometry changed. */
function setGeometry(el: HTMLElement, css: string): void {
  if (appliedGeometry.get(el) !== css) {
    appliedGeometry.set(el, css)
    el.style.cssText = css
  }
  if (!el.hasAttribute('data-on')) el.setAttribute('data-on', '')
}

/** Hide a band (idempotent — no mutation when it is already hidden). */
function hideSeam(el: HTMLElement): void {
  if (el.hasAttribute('data-on')) el.removeAttribute('data-on')
}

/**
 * Paint the seam fade bands.
 *
 * Two seams, both in the GUTTERS between the page boundary and the floating
 * chrome — never over the conversation itself.
 *
 *   - `top`  — page top boundary → header card's top edge
 *   - `foot` — statistics dock's bottom edge → page bottom boundary
 *
 * Neither band has a fade ramp or a tint (see aqua.css): they are plain
 * backdrop blur, sized to the strip they cover. That is the whole point — the
 * strip belongs to nobody (the chrome paints below/above it, the transcript
 * scrolls past it), so the only thing visible there is a hard-clipped sliver
 * of content, and a blur is enough to hide it.
 *
 * Geometry is written inline (fixed positioning against the viewport) rather
 * than via CSS: the column's horizontal inset depends on the sidebar state, and
 * both chrome edges move with their content.
 *
 * @param top - the band in the gutter above the header card.
 * @param foot - the band in the gutter below the statistics dock.
 */
function syncSeams(top: HTMLElement, foot: HTMLElement): void {
  const column = centerColumn()
  /* Chat routes only: the hero screen has no transcript scrolling behind the
     composer, and panel pages have no composer at all. */
  const columnRect = column === null || conversationScroll() === null
    ? null
    : column.getBoundingClientRect()
  if (columnRect === null || columnRect.width < 1) {
    hideSeam(top)
    hideSeam(foot)
    return
  }
  const box = `left:${columnRect.left}px;right:auto;width:${columnRect.width}px;`

  /* Top gutter: from the page's top boundary down to the card's top edge. When
     the two coincide (the transcript's clipping line is aligned onto the card,
     see syncScrollLift) the gutter is empty and the band hides itself. */
  const header = headerCard()
  const headerRect = header === null ? null : header.getBoundingClientRect()
  const topGutter = headerRect === null ? 0 : headerRect.top - columnRect.top
  if (headerRect === null || topGutter < 1) {
    hideSeam(top)
  } else {
    setGeometry(top, `${box}top:${columnRect.top}px;height:${topGutter}px;`)
  }

  /* Foot gutter: pinned to the statistics dock's BOTTOM edge and sized to the
     gap below it — never taller.

     Two constraints decided this geometry:
     1. The dock's glass ends in a rounded bottom edge (`0 0 16px 16px`).
        Anchoring the band at the dock's bottom line keeps it strictly outside
        the glass, so the arc stays intact; anything that reached into the dock
        (the old `gap + 6`) painted over the curve and squared it off.
     2. The band has to cover the seat padding whatever the layout does, so it
        is `position: fixed` and measured from live rects every pass — scroll
        cannot move it, and a composer that grows or a sidebar that collapses
        only re-measures it.
     Width comes from the dock itself, not the column: the transcript lives
     inside that span, so nothing outside the dock is touched. */
  const dock = statsDock()
  const dockRect = dock === null ? null : dock.getBoundingClientRect()
  const gap = dockRect === null ? 0 : columnRect.bottom - dockRect.bottom
  if (dockRect === null || gap < 1 || dockRect.width < 1) {
    hideSeam(foot)
  } else {
    /* `- 1` closes the sub-pixel joint at the dock's bottom edge. Safe for the
       arc: the band carries no fill (see aqua.css), so it cannot tint the
       glass, and the dock paints above it (z 8) — the 1px only hides a hairline
       of sharp text that would otherwise show exactly on the tangent. */
    setGeometry(
      foot,
      `left:${dockRect.left}px;right:auto;width:${dockRect.width}px;`
        + `top:${dockRect.bottom - 1}px;height:${gap + 1}px;`,
    )
  }
}

/** Create (or reuse) one seam band element for the given edge. */
function ensureSeam(edge: SeamEdge): HTMLElement {
  const selector = `[${SEAM_ATTRIBUTE}='${edge}']`
  const existing = document.querySelector<HTMLElement>(selector)
  if (existing !== null) return existing
  const seam = document.createElement('div')
  seam.setAttribute(SEAM_ATTRIBUTE, edge)
  seam.setAttribute('aria-hidden', 'true')
  document.body.appendChild(seam)
  return seam
}

/**
 * Start the measurement loop.
 *
 * Triggers are deliberately narrow: the observed boxes (header, scrollport,
 * column, input bar) only change on layout events, and `data-phase` only flips
 * on route changes — a `childList` observer over the transcript subtree would
 * re-measure on every streamed token.
 *
 * @returns a handle that stops the loop and removes the seam bands.
 */
export function startEdgeMetrics(): EdgeMetricsHandle {
  const root = document.documentElement
  const topSeam = ensureSeam('top')
  const footSeam = ensureSeam('foot')
  const observed = new Set<Element>()
  let frame = 0
  let scrollFrame = 0
  /** Scrollport currently carrying the geometry-only re-measure listener. */
  let scrollTarget: HTMLElement | null = null
  let disposed = false

  const sync = (): void => {
    if (disposed) return
    syncScrollLift(root)
    syncSeams(topSeam, footSeam)
  }

  /**
   * Geometry-only pass for scroll.
   *
   * Scrolling cannot move the fixed bands, but it CAN move the transcript's
   * clipping edge under a host that re-lays out mid-scroll — and the foot band
   * exists precisely to keep covering that strip. The pass skips the scroll
   * lift on purpose: that one needs `getComputedStyle`, which forces a style
   * recalc, and the lift only changes on layout (already covered by the
   * ResizeObserver). With the write-skip in `setGeometry` below a scroll frame
   * costs three rect reads and no style invalidation.
   */
  const syncSeamsOnly = (): void => {
    if (disposed) return
    syncSeams(topSeam, footSeam)
  }

  const schedule = (): void => {
    if (disposed || frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      bind()
      sync()
    })
  }

  const scheduleSeams = (): void => {
    if (disposed || scrollFrame !== 0) return
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0
      syncSeamsOnly()
    })
  }

  const observer = new ResizeObserver(schedule)

  /**
   * (Re)attach to the current nodes. The host re-creates the header, the
   * scrollport and the composer on route changes, so every pass drops the
   * detached ones before observing what is live now.
   */
  const bind = (): void => {
    for (const node of [...observed]) {
      if (node.isConnected) continue
      observer.unobserve(node)
      observed.delete(node)
    }
    for (const node of [headerCard(), conversationScroll(), centerColumn(), inputBar()]) {
      if (node === null || observed.has(node)) continue
      observer.observe(node)
      observed.add(node)
    }
    const scroll = conversationScroll()
    if (scroll !== scrollTarget) {
      scrollTarget?.removeEventListener('scroll', scheduleSeams)
      scrollTarget = scroll
      scrollTarget?.addEventListener('scroll', scheduleSeams, { passive: true })
    }
  }

  const phaseObserver = new MutationObserver(schedule)
  phaseObserver.observe(document.body, { attributes: true, attributeFilter: ['data-phase'], subtree: true })

  window.addEventListener('resize', schedule)

  bind()
  sync()

  /**
   * Boot race: this layer can mount before the conversation has rendered, so
   * the one-shot `bind()` above observes nothing and — with no phase flip and
   * no resize — the bands would stay half-positioned until the user happened
   * to resize the window. A short, bounded settle ladder re-binds as the shell
   * appears; it stops on its own, so there is no standing cost.
   */
  const settleTimers = [120, 400, 900, 1600, 2600, 4000]
    .map(ms => window.setTimeout(schedule, ms))

  return {
    dispose: () => {
      disposed = true
      for (const id of settleTimers) window.clearTimeout(id)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      if (scrollFrame !== 0) window.cancelAnimationFrame(scrollFrame)
      frame = 0
      scrollFrame = 0
      observer.disconnect()
      phaseObserver.disconnect()
      window.removeEventListener('resize', schedule)
      scrollTarget?.removeEventListener('scroll', scheduleSeams)
      scrollTarget = null
      observed.clear()
      topSeam.remove()
      footSeam.remove()
      // A band left behind by an earlier build (the retired `bottom` edge) must
      // not survive a re-mount.
      for (const stale of document.querySelectorAll(`[${SEAM_ATTRIBUTE}]`)) stale.remove()
      root.style.removeProperty(LIFT_VARIABLE)
    },
  }
}

/** The stylesheet default, exported for tests and documentation symmetry. */
export const DEFAULT_SCROLL_LIFT_PX = LIFT_FALLBACK_PX
