/**
 * Sidebar icon for the Aqua panel. The platform's panel list owns the click
 * behaviour — the icon only declares its glyph and the tooltip comes from
 * the registration's `label`.
 */
import { IconSparkleRegular } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * Render the Aqua sidebar icon.
 * @param props - the panel icon props (carries the requested size).
 * @returns the glyph.
 */
export function AquaPanelIcon({ size }: { size?: number }) {
  return <IconSparkleRegular size={size} />
}
