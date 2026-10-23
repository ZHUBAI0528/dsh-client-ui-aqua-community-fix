/**
 * Aqua panel page — the glass theme's own surface in the left sidebar.
 *
 * Registered into the `main` slot under the key `aqua`, so clicking the
 * sidebar icon swaps the main column to this page. It owns the master
 * on/off switch and hosts every knob; the plugin no longer borrows a tab
 * inside the built-in Plugins settings section.
 */
import { IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { AquaPanelContent, type AquaPanelContentComponentProps, type AquaPanelContentInjected } from './AquaPanelContent.tsx'
import type { AquaPanelActions } from './settings-store.ts'
import css from './AquaPanelPage.module.css'

/** Injected business face: the master enable write. */
export interface AquaPanelPageInjected extends AquaPanelContentInjected {
  /** Switch the glass layer on or off. */
  setEnabled: (enabled: boolean) => void
}

/** Full component props: store share + locale seat + injected face. */
export type AquaPanelPageComponentProps =
  AquaPanelPageInjected & AquaPanelActions & {
    /** Localized copy seat for the `settings.aqua` namespace. */
    t: AquaPanelContentComponentProps['t']
    /** Selector hook over the panel store snapshot. */
    useStore: AquaPanelContentComponentProps['useStore']
  }
/**
 * Render the Aqua panel page.
 * @param props - composed slot props.
 * @returns the panel page.
 */
export function AquaPanelPage(props: AquaPanelPageComponentProps) {
  const { t, setEnabled, useStore } = props
  const enabled = useStore(s => s.enabled)

  return (
    <div className={css.page}>
      <div className={css.pageScroll}>
        <div className={css.pageContent}>
          <section className={css.master}>
            <div className={css.masterText}>
              <div className={css.masterTitle}>{t('aqua.title')}</div>
              <div className={css.masterDescription}>{t('aqua.description')}</div>
            </div>
            <button
              type="button"
              className={enabled ? css.toggleOn : css.toggle}
              aria-pressed={enabled}
              onClick={() => { setEnabled(!enabled) }}
            >
              <span className={css.check}>
                {enabled && <IconCheckOutlineRegular />}
              </span>
              {enabled ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </section>

          {enabled && (
            <div className={css.body}>
              <AquaPanelContent {...props} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
