import React, { useEffect, useState } from 'react';
import { IconMinus, IconSquare, IconX, IconDownload } from '@tabler/icons-react';
import styles from './TitleBar.module.css';
import type { UiStatus } from './StatusPill';

export function TitleBar(props: { status: UiStatus; batchLabel?: string | null }) {
  const api = window.mediaSaver;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    api.windowIsMaximized().then(setMaximized).catch(() => setMaximized(false));
  }, []);

  async function toggleMaximize() {
    await api.windowToggleMaximize();
    // We re-check state after toggling (cheap, avoids adding extra event channels).
    try {
      setMaximized(await api.windowIsMaximized());
    } catch {
      // ignore
    }
  }

  const statusLabel =
    props.status === 'cancelling'
      ? 'CANCELLING'
      : props.status === 'cancelled'
        ? 'CANCELLED'
        : props.status === 'running'
        ? 'RUNNING'
        : props.status === 'finished'
          ? 'DONE'
          : props.status === 'error'
            ? 'ERROR'
            : 'IDLE';

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        {/* Same tile as the app icon and the skipit.space listing. */}
        <div className={styles.iconWrap} aria-hidden>
          <IconDownload size={16} stroke={2.2} />
        </div>
        <div className={styles.title}>Media Saver</div>
      </div>

      <div className={styles.right} style={{ WebkitAppRegion: 'no-drag' }}>
        {/* Keep status compact. No "IDLE Media Saver" billboard in the title bar. */}
        <div
          className={`${styles.statusChip} ${
            props.status === 'error'
              ? styles.statusError
              : props.status === 'running' || props.status === 'cancelling'
                ? styles.statusRunning
                : props.status === 'finished'
                  ? styles.statusDone
                  : styles.statusIdle
          }`}
          title={props.batchLabel ?? undefined}
        >
          <span className={styles.statusDot} />
          <span className={styles.statusText}>{statusLabel}</span>
          {props.batchLabel ? <span className={styles.statusSub}>{props.batchLabel}</span> : null}
        </div>

        <div className={styles.controls}>
          <button className={styles.btn} onClick={() => api.windowMinimize()} aria-label="Minimize">
            <IconMinus size={16} />
          </button>
          <button className={styles.btn} onClick={toggleMaximize} aria-label={maximized ? 'Restore' : 'Maximize'}>
            <IconSquare size={14} />
          </button>
          <button className={`${styles.btn} ${styles.btnClose}`} onClick={() => api.windowClose()} aria-label="Close">
            <IconX size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


