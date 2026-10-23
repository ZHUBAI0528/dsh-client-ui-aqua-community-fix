/**
 * Submenu click-hold shim.
 *
 * WHY: several plugins (dsh-armory's quick-invoke board among them) open a
 * submenu on HOVER (`onMouseEnter` sets the open flag) and ALSO toggle it on
 * CLICK (`setOpen(v => v === key ? null : key)`). A mouse user always hovers
 * on the way to the click, so by the time the click lands the submenu is
 * already open and the toggle CLOSES the panel the hover just opened. The row
 * then reads as "click shows only level 1, only hover reveals level 2".
 * Keyboard-only users never hover, which is why that path always worked.
 *
 * WHAT: remember the row whose hover just opened a submenu, and swallow
 * exactly one click on that same row while it is still open. Swallowing keeps
 * the panel open — which is the click's intent — and disarms, so every later
 * click toggles as the plugin designed: open, close, open, ...
 *
 * SCOPE: keyed on the ARIA contract `[aria-haspopup="true"][aria-expanded]`,
 * never on a vendor class name. That makes it depth-agnostic (a third level is
 * simply another such row) and inert for any menu whose items do not expand.
 * Nothing is re-rendered and no plugin handler is patched: the listener runs in
 * the document capture phase, ahead of the app root's delegated handlers, and
 * stops propagation for that single click.
 */

/** A row that reports an expandable submenu and its current state. */
const HOVER_OPENER = '[aria-haspopup="true"][aria-expanded]'

/** Rows whose hover already opened the submenu and that are still unclicked. */
const armed = new WeakSet<Element>()

function openerOf(event: Event): Element | null {
  const target = event.target
  return target instanceof Element ? target.closest(HOVER_OPENER) : null
}

function onPointerOver(event: MouseEvent): void {
  const row = openerOf(event)
  // aria-expanded is still 'false' here — React has not re-rendered yet — so
  // this is precisely "the hover is what opens it".
  if (row !== null && row.getAttribute('aria-expanded') === 'false') armed.add(row)
}

function onPointerOut(event: MouseEvent): void {
  const row = openerOf(event)
  if (row === null) return
  // Leaving the row entirely disarms it; moving into its submenu (or any other
  // descendant) keeps the arm, so the row still answers a click afterwards.
  const next = event.relatedTarget
  if (next instanceof Node && row.contains(next)) return
  armed.delete(row)
}

function onClickCapture(event: MouseEvent): void {
  const row = openerOf(event)
  if (row === null || !armed.has(row)) return
  // Disarm first: the next click on this row must toggle (that is how the user
  // closes the submenu), including on rapid repeated clicks.
  armed.delete(row)
  if (row.getAttribute('aria-expanded') !== 'true') return
  event.stopPropagation()
  event.preventDefault()
}

/**
 * Attach the shim.
 * @returns a disposer that removes every listener.
 */
export function startSubmenuHold(): () => void {
  document.addEventListener('mouseover', onPointerOver, true)
  document.addEventListener('mouseout', onPointerOut, true)
  document.addEventListener('click', onClickCapture, true)
  return () => {
    document.removeEventListener('mouseover', onPointerOver, true)
    document.removeEventListener('mouseout', onPointerOut, true)
    document.removeEventListener('click', onClickCapture, true)
  }
}
