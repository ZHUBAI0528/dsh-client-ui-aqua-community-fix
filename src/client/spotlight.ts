/**
 * Cursor spotlight glow: the deepseek.com/harness feature-card hover
 * interaction, ported onto the floating glass panes.
 *
 * A blue radial glow follows the cursor — a `data-dsh-aqua-glow` overlay
 * inside each pane whose inline background a JS pointermove writes
 * (`radial-gradient(180px at Xpx Ypx, rgba(120,170,255,.15), transparent 70%)`,
 * official values). The glow sits BEHIND the glass (z-index -1) so it
 * diffuses through the translucent surface and never covers content.
 *
 * Port notes:
 * - the sidebar keeps the glow but never carries a transform: a running
 *   3D transform on a backdrop-filtered pane re-rasterizes the whole layer
 *   (text turns blurry), so the former geometric tilt was removed on
 *   purpose — hover feedback is the glow alone;
 * - the fused composer+stats spot is the wider invisible inputbar wrapper:
 *   the hover region and glow geometry are computed against the VISIBLE
 *   glass (see visualRect / glassLocalRect in spot-core.ts), so the
 *   wrapper's side gutters never respond;
 * - geometry is measured ONCE per hover session in untransformed local
 *   space (offset-based) and refreshed on DOM/layout changes, so the
 *   per-frame path does zero layout reads.
 *
 * One html-attribute gate from the layer's settings: `data-dsh-aqua-spotlight`.
 */
import {
  closestSpot, ensureGlow, glassLocalRect, GLOW_ATTR, inside, ON_ATTR, spotElements,
  startOverlayKeeper, visualRect,
} from './spot-core.ts'

/** html attribute the layer uses to switch the glow effect (its toggle). */
export const SPOTLIGHT_ATTRIBUTE = 'data-dsh-aqua-spotlight'

/** Glow radius, px — matches the official card. */
const GLOW_RADIUS = 180

/** Fallback glow color (the CSS var is normally provided by the stylesheet). */
const GLOW_FALLBACK = 'rgba(90, 215, 255, 0.17)'

/** The glow is live only while its gate attribute is on <html>. */
function glowGated(): boolean {
  return document.documentElement.hasAttribute(SPOTLIGHT_ATTRIBUTE)
}

/** Hover tracking runs while the glow is enabled. */
function hoverGated(): boolean {
  return glowGated()
}

/** One hover session: geometry captured at entry, kept fresh by the feed. */
interface SpotSession {
  spot: HTMLElement
  /** The visible glass region in viewport space (cursor math). */
  visual: DOMRect
  /** The visible glass region in spot-local space (glow geometry). */
  local: { left: number; top: number; width: number; height: number }
  /** Glow overlay (null while the glow toggle is off). */
  glow: HTMLElement | null
}

/**
 * Attach the delegated pointer feeds. Everything is document-level: no
 * per-pane listeners, and the rAF merge collapses pointermove bursts to one
 * style write per frame.
 * @returns a disposer that drops listeners, overlays, and inline styles.
 */
export function startSpotlight(): () => void {
  /** The hovered pane (cleared on leave). */
  let current: HTMLElement | null = null
  /** Geometry for the hovered pane. */
  let session: SpotSession | null = null
  let raf = 0
  let refreshRaf = 0

  /** Drop every effect this controller wrote onto a pane. */
  const clearSpot = (spot: HTMLElement): void => {
    spot.removeAttribute(ON_ATTR)
    if (current === spot) {
      current = null
      session = null
    }
    const glow = spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)
    if (glow !== null) glow.style.removeProperty('background-image')
  }

  /** Capture (or refresh) the hover geometry; sets the glow overlay box. */
  const measure = (spot: HTMLElement): SpotSession => {
    const visual = visualRect(spot)
    const local = glassLocalRect(spot)
    const glow = glowGated() ? ensureGlow(spot) : null
    if (glow !== null) {
      glow.style.left = `${local.left}px`
      glow.style.top = `${local.top}px`
      glow.style.width = `${local.width}px`
      glow.style.height = `${local.height}px`
    }
    return { spot, visual, local, glow }
  }

  /** Write the glow gradient for the pointer position. */
  const paint = (s: SpotSession, clientX: number, clientY: number): void => {
    if (raf !== 0) return
    raf = requestAnimationFrame(() => {
      raf = 0
      const { spot, visual } = s
      // Over a gutter / padding region, not the glass — nothing to paint.
      if (!inside(visual, clientX, clientY)) {
        clearSpot(spot)
        return
      }
      let glow = s.glow
      if (glow === null && glowGated()) {
        // Toggle flipped on mid-hover: late-bind the glow overlay.
        s = session = measure(spot)
        glow = s.glow
      }
      if (glow !== null) {
        if (glowGated()) {
          // background-image only: the shorthand would wipe any CSS paint.
          glow.style.backgroundImage =
            `radial-gradient(${GLOW_RADIUS}px at ${clientX - visual.left}px ${clientY - visual.top}px, var(--dsh-aqua-spot-color, ${GLOW_FALLBACK}), transparent 70%)`
        } else {
          // Toggle flipped off mid-hover: drop the last radial so the
          // now-ungated div turns invisible immediately.
          glow.style.removeProperty('background-image')
        }
      }
    })
  }

  const onMove = (event: PointerEvent): void => {
    if (!hoverGated()) return
    const spot = closestSpot(event.target)
    if (spot === null || session?.spot !== spot) return
    paint(session, event.clientX, event.clientY)
  }

  const onOver = (event: PointerEvent): void => {
    if (!hoverGated()) return
    const spot = closestSpot(event.target)
    if (spot === null) return
    // The settings overlay renders INSIDE the sidebar column: while it is
    // open, the sidebar stays out of every hover effect.
    if (spot.matches('[class*="sidebarCol"]') && document.querySelector('[role="dialog"]') !== null) return
    // Gutter/padding entries never start a session.
    const next = measure(spot)
    if (!inside(next.visual, event.clientX, event.clientY)) return
    spot.setAttribute(ON_ATTR, '')
    current = spot
    session = next
    paint(next, event.clientX, event.clientY)
  }

  const onOut = (event: PointerEvent): void => {
    const spot = closestSpot(event.target)
    if (spot === null || spot !== current) return
    // Moving between children keeps the effect live; leaving the visible
    // glass (including into the wrapper's gutters) clears it.
    if (session !== null && inside(session.visual, event.clientX, event.clientY)) return
    clearSpot(spot)
  }

  // The glow divs live with the panes through React re-renders; DOM/layout
  // changes also refresh the active hover session (coalesced).
  const keeper = startOverlayKeeper(() => {
    // The settings dialog mounts INSIDE the sidebar column — release the
    // sidebar's glow while it is open.
    for (const spot of spotElements()) {
      if (!spot.matches('[class*="sidebarCol"]')) continue
      if (spot.querySelector('[role="dialog"]') === null) continue
      spot.removeAttribute(ON_ATTR)
      const glow = spot.querySelector<HTMLElement>(`:scope > [${GLOW_ATTR}]`)
      if (glow !== null) glow.style.removeProperty('background-image')
      if (current === spot) {
        current = null
        session = null
      }
    }
    if (session === null || refreshRaf !== 0) return
    refreshRaf = requestAnimationFrame(() => {
      refreshRaf = 0
      if (session !== null) session = measure(session.spot)
    })
  })

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerover', onOver, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })

  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerover', onOver)
    document.removeEventListener('pointerout', onOut)
    keeper()
    if (raf !== 0) cancelAnimationFrame(raf)
    if (refreshRaf !== 0) cancelAnimationFrame(refreshRaf)
    for (const spot of spotElements()) spot.removeAttribute(ON_ATTR)
  }
}
