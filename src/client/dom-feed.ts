/**
 * Shared DOM-mutation feed.
 *
 * WHY: three independent features (seam stamping, glow overlay upkeep, the
 * wordmark badge) each used to own a `MutationObserver` on
 * `document.documentElement` with `{ childList: true, subtree: true }`. The app
 * is a chat surface that mutates constantly — every streamed token batch,
 * every React commit — so one message could fire all three callbacks many
 * times per frame, and each callback ran its own full-document queries
 * (the seam pass alone walks 13 selectors, one of them `*:has(...)`).
 * Measured shape of that cost: scans × mutations-per-frame × observers.
 *
 * This module keeps ONE observer for the whole plugin and one pending frame:
 * a burst of mutations collapses into a single pass before the next paint, so
 * the cost above drops to "one pass per frame at most", no matter how chatty
 * the page is.
 *
 * The observer is reference-counted: it exists only while at least one
 * feature is subscribed, and detaches with the last one, so disabling the
 * layer leaves no listener behind.
 *
 * rAF is the right coalescing point rather than a microtask or a timer: the
 * callbacks position overlays against freshly-rendered layout, so they want to
 * land after React's commit and before paint — and rAF stops firing entirely
 * while the document is hidden, which parks the whole feed for free.
 */

/** A pass to run after a mutation batch, before the next paint. */
export type DomMutationCallback = () => void

/** Live subscribers. A Set keeps registration order and de-dupes. */
const subscribers = new Set<DomMutationCallback>()

/** The single shared observer; undefined while nobody is subscribed. */
let observer: MutationObserver | undefined

/** Pending frame id (0 = nothing scheduled). */
let frame = 0

/** Run every subscriber once for the mutations collected so far. */
function flush(): void {
  frame = 0
  // Copied so a callback may unsubscribe (or subscribe) while running.
  for (const callback of [...subscribers]) {
    try {
      callback()
    } catch (error) {
      // Error containment: one feature failing (a layout it cannot measure, a
      // node removed mid-pass) must not starve the others of their frame. Each
      // feature used to own its observer, so this restores that isolation.
      console.error('[aqua] DOM feed subscriber failed:', error)
    }
  }
}

/** Coalesce the current mutation burst into one upcoming frame. */
function schedule(): void {
  if (frame !== 0) return
  frame = window.requestAnimationFrame(flush)
}

/**
 * Subscribe a pass to DOM mutations anywhere in the document.
 *
 * The callback runs at most once per frame. It is NOT called on subscribe —
 * callers that need an initial pass run it themselves, which keeps their
 * first paint synchronous with mount.
 *
 * @param callback - the pass to run.
 * @returns an unsubscribe function; the shared observer detaches with the
 *          last subscriber.
 */
export function subscribeDomMutations(callback: DomMutationCallback): () => void {
  subscribers.add(callback)
  if (observer === undefined) {
    observer = new MutationObserver(schedule)
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }
  return () => {
    subscribers.delete(callback)
    if (subscribers.size > 0) return
    observer?.disconnect()
    observer = undefined
    if (frame !== 0) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
  }
}
